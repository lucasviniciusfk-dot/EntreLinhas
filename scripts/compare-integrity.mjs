import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),privateDir=new URL('.migration-private/',root);
const columns=JSON.parse(readFileSync(new URL('cloudflare/source-column-types.json',root),'utf8'));
export function canonical(v) {
  if(Array.isArray(v))return v.map(canonical);
  if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
  return v;
}
export function normalize(row,table) {
  const out={...row};
  for(const c of columns.filter(x=>x.table_name===table)){
    let v=out[c.column_name];
    if(v===null||v===undefined)continue;
    if(c.data_type==='boolean')v=v===true||v===1||v==='true';
    if(['json','jsonb','ARRAY'].includes(c.data_type)&&typeof v==='string'){try{v=JSON.parse(v)}catch(_){}}
    // Offset formatting differs between PostgREST and the original importer.
    // Preserve sub-millisecond precision while canonicalizing timezone notation.
    if(c.data_type.startsWith('timestamp')&&typeof v==='string'){
      const m=v.match(/^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d(?::?\d\d)?)$/);
      if(m){
        const zone=m[4]==='Z'?'+00:00':m[4].length===3?m[4]+':00':m[4];
        const whole=new Date(m[1]+'T'+m[2]+zone);
        if(!Number.isNaN(whole.getTime()))v=whole.toISOString().slice(0,19)+'.'+((m[3]||'').replace(/0+$/,'')||'0')+'Z';
      }
    }
    out[c.column_name]=canonical(v);
  }
  return canonical(out);
}
const pk=JSON.parse(readFileSync(new URL('primary-keys.json',privateDir),'utf8'));
const reports=[];
for(const file of readdirSync(privateDir).filter(f=>f.endsWith('.json')&&!['primary-keys.json','counts.json'].includes(f))){
  const data=JSON.parse(readFileSync(new URL(file,privateDir),'utf8'));
  if(!data.table||!data.pg||!data.d1)continue;
  const fields=pk.find(x=>x.table_name===data.table)?.primary_key||[];
  if(!fields.length){reports.push({table:data.table,status:'NO_PRIMARY_KEY'});continue;}
  const key=r=>JSON.stringify(fields.map(k=>r[k]));
  const pg=new Map(data.pg.map(r=>[key(r),normalize(r,data.table)])),d1=new Map(data.d1.map(r=>[key(r),normalize(r,data.table)]));
  const missingInD1=[...pg.keys()].filter(k=>!d1.has(k)),extraInD1=[...d1.keys()].filter(k=>!pg.has(k)),changed=[];
  for(const [k,p] of pg)if(d1.has(k)&&JSON.stringify(p)!==JSON.stringify(d1.get(k))){
    const d=d1.get(k),fields=Object.keys(p).filter(f=>JSON.stringify(p[f])!==JSON.stringify(d[f]));
    changed.push({key:k,fields});
  }
  const digest=map=>createHash('sha256').update(JSON.stringify([...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
  reports.push({table:data.table,status:missingInD1.length||extraInD1.length||changed.length?'DIFFERENT':'MATCH',pgRows:pg.size,d1Rows:d1.size,missingInD1:missingInD1.length,extraInD1:extraInD1.length,changedRows:changed.length,changedFields:[...new Set(changed.flatMap(x=>x.fields))],pgSha256:digest(pg),d1Sha256:digest(d1)});
  // Detailed keys stay in the private workspace, never in the published report.
  writeFileSync(new URL(data.table+'.diff.private',privateDir),JSON.stringify({missingInD1,extraInD1,changed},null,2));
}
const output=new URL('cloudflare/INTEGRITY_2026-11-11.json',root);
let previous={};
try{previous=JSON.parse(readFileSync(output,'utf8'))}catch(_){}
const combined=new Map((previous.tables||[]).map(x=>[x.table,x]));
for(const item of reports)combined.set(item.table,item);
writeFileSync(output,JSON.stringify({...previous,localComparisonRecomputedAt:new Date().toISOString(),normalization:'boolean, JSON key ordering and timestamp notation; local captured data, no remote reads',tables:[...combined.values()].sort((a,b)=>a.table.localeCompare(b.table))},null,2)+'\n');
console.log('Recomputed local captures only; remote evidence dates were preserved.');
console.log(JSON.stringify(reports.map(x=>({table:x.table,status:x.status,changedRows:x.changedRows,missingInD1:x.missingInD1,extraInD1:x.extraInD1,fields:x.changedFields})),null,2));
