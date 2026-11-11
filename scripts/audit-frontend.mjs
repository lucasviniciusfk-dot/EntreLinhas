import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {parse} from 'acorn';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),types=JSON.parse(readFileSync(root+'cloudflare/source-column-types.json','utf8'));
const tables=new Set(types.map(c=>c.table_name)),buckets=new Set(['capas','epubs','comprovantes']);
const calls=[],rpcs=[],storage=[],fetches=[],dynamic=[];
function scan(source,file,lineOffset=0,sourceType='script'){
  const ast=parse(source,{ecmaVersion:'latest',sourceType,locations:true,allowReturnOutsideFunction:false});
  const parents=new WeakMap(),nodes=[];
  function walk(node,parent){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(x=>walk(x,parent));return;}if(!node.type)return;parents.set(node,parent);nodes.push(node);for(const[k,v]of Object.entries(node))if(k!=='loc')walk(v,node);}
  walk(ast,null);
  for(const n of nodes){
    if(n.type!=='CallExpression')continue;
    const callee=n.callee,method=callee.type==='MemberExpression'&&!callee.computed?callee.property.name:callee.type==='Identifier'?callee.name:'';
    if(!['from','rpc','fetch'].includes(method))continue;
    if(method==='from'&&callee.object?.type==='Identifier'&&callee.object.name==='Array')continue;
    const arg=n.arguments[0],name=arg?.type==='Literal'&&typeof arg.value==='string'?arg.value:null,where={file,line:lineOffset+n.loc.start.line};
    if(method==='fetch'){fetches.push({...where,static:!!name});continue;}
    if(!name){dynamic.push({...where,method});continue;}
    if(method==='rpc'){rpcs.push({...where,name});continue;}
    let p=n,chain=[];
    while(parents.get(p)?.type==='MemberExpression'&&parents.get(p).object===p){const member=parents.get(p),call=parents.get(member);if(call?.type!=='CallExpression')break;chain.push(member.computed?'computed':member.property.name);p=call;}
    const entry={...where,name,operation:chain.find(x=>['insert','update','upsert','delete'].includes(x))||'select',chain};
    if(tables.has(name))calls.push(entry);else if(buckets.has(name))storage.push(entry);
  }
}
const html=readFileSync(root+'index.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(/\bsrc\s*=|type\s*=\s*["'](?:application\/json|application\/ld\+json|importmap)/i.test(m[1]))continue;
  const offset=html.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1;
  scan(m[2],'index.html',offset,/type\s*=\s*["']module/i.test(m[1])?'module':'script');
}
for(const file of ['service-worker.js',...readdirSync(root+'cloudflare').filter(x=>x.endsWith('.js')).map(x=>'cloudflare/'+x)])scan(readFileSync(root+file,'utf8'),file);
const counts={};for(const c of calls)counts[c.name]=(counts[c.name]||0)+1;
const report={generatedAt:new Date().toISOString(),method:'AST; includes old overridden functions; does not prove runtime activity',tableCalls:calls.length,tables:Object.keys(counts).length,byTable:counts,rpcOccurrences:rpcs.length,rpcNames:[...new Set(rpcs.map(x=>x.name))].sort(),storageOccurrences:storage.length,storageBuckets:[...new Set(storage.map(x=>x.name))],fetchOccurrences:fetches.length,staticFetchOccurrences:fetches.filter(x=>x.static).length,dynamic,calls,rpcs,storage};
writeFileSync(root+'cloudflare/FRONTEND_INVENTORY_2026-11-11.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({tableCalls:report.tableCalls,tables:report.tables,rpcs:report.rpcOccurrences,storage:report.storageOccurrences,fetch:report.fetchOccurrences,staticFetch:report.staticFetchOccurrences,dynamic:dynamic.length,byTable:counts},null,2));
