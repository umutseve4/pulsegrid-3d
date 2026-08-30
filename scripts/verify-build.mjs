import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';

const root = new URL('../dist/', import.meta.url);
async function files(directory) {
  return (await Promise.all((await readdir(directory)).map(async name => {
    const path=join(directory,name); return (await stat(path)).isDirectory()?files(path):[path];
  }))).flat();
}
const output=await files(root);
const rows=await Promise.all(output.map(async path=>{const bytes=await readFile(path);return{path:relative(root.pathname,path),raw:bytes.length,gzip:gzipSync(bytes).length};}));
const total=rows.reduce((sum,row)=>sum+row.gzip,0);
const javascript=rows.filter(row=>row.path.endsWith('.js')).reduce((sum,row)=>sum+row.gzip,0);
const html=await readFile(new URL('index.html',root),'utf8');
if(!html.includes('/pulsegrid-3d/assets/')) throw new Error('GitHub Pages base path is missing from built HTML.');
if(total>1_500_000) throw new Error(`Compressed transfer budget exceeded: ${total} bytes`);
if(javascript>300_000) throw new Error(`Compressed JavaScript budget exceeded: ${javascript} bytes`);
console.table(rows);
console.log(`Build evidence: ${output.length} files, ${total} gzip bytes total, ${javascript} gzip JavaScript bytes.`);
