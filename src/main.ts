import './styles.css';
import { PulseCity, supportsWebGL } from './city';
import { nextState, scenarioNumber, snapshotFor, statusColor, type SystemState } from './simulation';

const $ = <T extends HTMLElement>(selector:string):T => {
  const element=document.querySelector<T>(selector);
  if(!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

const canvas=$<HTMLCanvasElement>('#scene');
const fallback=$<HTMLElement>('#fallback');
const motionToggle=$<HTMLButtonElement>('#motion-toggle');
const scenarioButton=$<HTMLButtonElement>('#scenario-button');
const heroButton=$<HTMLButtonElement>('#inject-hero');
const announcer=$<HTMLElement>('#announcer');
let state:SystemState='healthy';
let reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let city:PulseCity|undefined;

const districts=[
  {name:'Ingestion',rate:'12.8K',latency:'42 ms'},
  {name:'Validation',rate:'12.4K',latency:'84 ms'},
  {name:'Transformation',rate:'11.9K',latency:'68 ms'},
  {name:'Delivery',rate:'11.1K',latency:'52 ms'}
];

const stateCopy:Record<SystemState,string>={
  healthy:'Deterministic event streams are moving through every district.',
  failure:'Schema drift has interrupted the validation district.',
  quarantined:'Invalid events are contained without stopping healthy traffic.',
  replaying:'The verified batch is replaying through its original lineage.',
  recovered:'Recovery is verified and the full evidence chain is complete.'
};

function districtStatus(index:number):string{
  if(index!==1 || state==='healthy') return state==='recovered'?'Verified':'Active';
  if(state==='failure') return 'Failed';
  if(state==='quarantined') return 'Quarantined';
  if(state==='replaying') return 'Replaying';
  return 'Verified';
}

function renderTable(){
  const body=$<HTMLTableSectionElement>('#pipeline-table');
  body.replaceChildren(...districts.map((district,index)=>{
    const row=document.createElement('tr');
    const label=districtStatus(index);
    const color=index===1?statusColor(state):'#55f7e4';
    row.innerHTML=`<th scope="row">${district.name}</th><td><span class="status-tag" style="--status-color:${color}">${label}</span></td><td>${district.rate}</td><td>${district.latency}</td>`;
    return row;
  }));
}

function renderState(announce=true){
  const snapshot=snapshotFor(state);
  $<HTMLElement>('#health-label').textContent=snapshot.label;
  $<HTMLElement>('#health-detail').textContent=snapshot.detail;
  $<HTMLElement>('#throughput').textContent=snapshot.throughput;
  $<HTMLElement>('#latency').textContent=String(snapshot.latency);
  $<HTMLElement>('#validity').textContent=snapshot.validity;
  $<HTMLElement>('#scenario-index').textContent=scenarioNumber(state);
  $<HTMLElement>('#scenario-name').textContent=snapshot.label.toLowerCase().replace(/^./,letter=>letter.toUpperCase());
  $<HTMLElement>('#scenario-copy').textContent=stateCopy[state];
  $<HTMLElement>('#timeline-progress').style.width=`${snapshot.progress}%`;
  scenarioButton.textContent=snapshot.nextAction;
  $<HTMLElement>('.health-orb').dataset.state=state;
  document.documentElement.style.setProperty('--state-color',statusColor(state));
  city?.setState(state);
  renderTable();
  document.querySelectorAll<HTMLButtonElement>('.district-nav button').forEach((button,index)=>{
    const status=button.querySelector('small'); if(status) status.textContent=districtStatus(index).toUpperCase();
  });
  if(announce) announcer.textContent=`System state: ${snapshot.label}. ${snapshot.detail}.`;
}

function advance(){state=nextState(state);renderState();}
scenarioButton.addEventListener('click',advance);
heroButton.addEventListener('click',()=>{state='failure';renderState();scenarioButton.focus();});

document.querySelectorAll<HTMLButtonElement>('[data-district]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.district);
  document.querySelectorAll<HTMLButtonElement>('[data-district]').forEach(other=>other.setAttribute('aria-current',String(other===button)));
  city?.focusDistrict(index);
  announcer.textContent=`Focused ${districts[index]?.name ?? 'pipeline'} district.`;
}));

function applyMotion(value:boolean){
  reducedMotion=value;
  motionToggle.setAttribute('aria-pressed',String(value));
  motionToggle.textContent=value?'Enable motion':'Reduce motion';
  city?.setMotion(!value && !document.hidden);
}
motionToggle.addEventListener('click',()=>applyMotion(!reducedMotion));
document.addEventListener('visibilitychange',()=>city?.setMotion(!reducedMotion&&!document.hidden));

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){canvas.focus();return;}
  if(document.activeElement===canvas && ['ArrowLeft','ArrowRight'].includes(event.key)){
    event.preventDefault();
    const current=[...document.querySelectorAll('[data-district]')].findIndex(item=>item.getAttribute('aria-current')==='true');
    const direction=event.key==='ArrowRight'?1:-1;
    const next=(current+direction+districts.length)%districts.length;
    const button=document.querySelectorAll<HTMLButtonElement>('[data-district]')[next];button?.click();
  }
  if(document.activeElement===canvas && event.key===' '){event.preventDefault();applyMotion(!reducedMotion);}
});

function start(){
  if(supportsWebGL()){
    try{city=new PulseCity(canvas,reducedMotion);}catch(error){console.error('3D scene fallback',error);canvas.hidden=true;fallback.hidden=false;}
  }else{canvas.hidden=true;fallback.hidden=false;}
  applyMotion(reducedMotion);
  renderState(false);
  const tick=()=>{ $<HTMLElement>('#clock').textContent=new Date().toISOString().slice(11,19)+' UTC'; };
  tick();setInterval(tick,1000);
  addEventListener('pagehide',()=>city?.destroy(),{once:true});
}

start();
