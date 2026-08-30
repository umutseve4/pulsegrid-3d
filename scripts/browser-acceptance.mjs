import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const processes=[];
let failureReported=false;
function cleanup(){for(const child of processes)child.kill('SIGTERM');}
function reportFailure(error){
  if(failureReported)return;
  failureReported=true;
  const detail=String(error?.stack??error).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  console.error(`::error title=Browser acceptance failed::${detail}`);
  cleanup();
  process.exitCode=1;
  setTimeout(()=>process.exit(1),100);
}
process.once('uncaughtException',reportFailure);
process.once('unhandledRejection',reportFailure);
function launch(command,args){
  const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
  processes.push(child);
  child.stdout.on('data',data=>process.stdout.write(data));
  child.stderr.on('data',data=>process.stderr.write(data));
  return child;
}
async function waitFor(url,attempts=60){
  for(let i=0;i<attempts;i++){
    try{const response=await fetch(url);if(response.ok)return response;}catch{}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const profile=await mkdtemp(join(tmpdir(),'pulsegrid-chrome-'));
launch('npm',['run','preview','--','--host','127.0.0.1','--port','4173']);
await waitFor('http://127.0.0.1:4173/pulsegrid-3d/');
launch('google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--remote-debugging-port=9222',`--user-data-dir=${profile}`,'about:blank']);
await waitFor('http://127.0.0.1:9222/json/version');
const pages=await (await fetch('http://127.0.0.1:9222/json/list')).json();
const socket=new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let sequence=0;
const pending=new Map();
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(!message.id)return;
  const waiter=pending.get(message.id);
  if(!waiter)return;
  pending.delete(message.id);
  message.error?waiter.reject(new Error(message.error.message)):waiter.resolve(message.result);
});
function send(method,params={}){
  const id=++sequence;
  socket.send(JSON.stringify({id,method,params}));
  return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
}
async function evaluate(expression){
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function load(){
  await send('Page.navigate',{url:'http://127.0.0.1:4173/pulsegrid-3d/'});
  for(let i=0;i<60;i++){
    if(await evaluate("document.readyState === 'complete' && Boolean(document.querySelector('#pipeline-table tr'))"))return;
    await sleep(250);
  }
  const readiness=await evaluate(`(() => ({href:location.href,title:document.title,readyState:document.readyState,rows:document.querySelectorAll('#pipeline-table tr').length,body:document.body?.innerText.slice(0,240)}))()`);
  throw new Error(`Application did not become ready: ${JSON.stringify(readiness)}`);
}
function assert(condition,message){if(!condition)throw new Error(message);console.log(`PASS: ${message}`);}

try{
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await load();

  const semantics=await evaluate(`(() => ({
    lang:document.documentElement.lang,
    canvasLabel:document.querySelector('#scene')?.getAttribute('aria-label'),
    live:document.querySelector('#announcer')?.getAttribute('aria-live'),
    caption:document.querySelector('table caption')?.textContent.trim(),
    rows:document.querySelectorAll('#pipeline-table tr').length
  }))()`);
  assert(semantics.lang==='en' && semantics.canvasLabel && semantics.live==='polite' && semantics.caption && semantics.rows===4,'semantic canvas, live region, and four-row evidence table are present');

  const overflow=await evaluate('document.documentElement.scrollWidth <= window.innerWidth');
  assert(overflow,'360 px viewport has no horizontal overflow');

  await evaluate("document.querySelector('#scene').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
  const focused=await evaluate("document.querySelector('[data-district=\"1\"]')?.getAttribute('aria-current')");
  assert(focused==='true','ArrowRight moves canvas district focus');

  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space'});
  const toggled=await evaluate("document.querySelector('#motion-toggle')?.getAttribute('aria-pressed')");
  assert(toggled==='true','Space toggles reduced motion from the canvas');

  const lifecycle=await evaluate(`(() => {
    const labels=[];
    const button=document.querySelector('#scenario-button');
    for(let i=0;i<5;i++){labels.push(document.querySelector('#health-label').textContent);button.click();}
    return labels;
  })()`);
  assert(JSON.stringify(lifecycle)===JSON.stringify(['NOMINAL','SCHEMA DRIFT','CONTAINED','REPLAY ACTIVE','RECOVERY VERIFIED']),'incident lifecycle is deterministic in the browser');

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await load();
  const osMotion=await evaluate("document.querySelector('#motion-toggle')?.getAttribute('aria-pressed')");
  assert(osMotion==='true','OS reduced-motion preference is honored on startup');

  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;
      return original.call(this,type,...args);
    };
  `});
  await load();
  const fallback=await evaluate(`(() => ({canvasHidden:document.querySelector('#scene').hidden,fallbackVisible:!document.querySelector('#fallback').hidden,controls:Boolean(document.querySelector('#scenario-button'))}))()`);
  assert(fallback.canvasHidden && fallback.fallbackVisible && fallback.controls,'WebGL failure preserves the accessible fallback and incident controls');
} finally {
  socket.close();
  cleanup();
}
