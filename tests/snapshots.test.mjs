import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runtime} from './runtime.mjs';
let r;
before(async()=>r=await runtime());after(async()=>await r?.close());
const sha=b=>createHash('sha256').update(b).digest('hex');
test('snapshot archive exports exact bytes only to its verified owner',async()=>{
  const bytes=Buffer.from(JSON.stringify({message:'Arquivo íntegro 🌸',books:[1,2,3]})),parts=[bytes.subarray(0,12),bytes.subarray(12)],bucket=await r.mf.getR2Bucket('FILES');
  const manifests=[];
  for(let i=0;i<parts.length;i++){const key='archive/part-00'+i;await bucket.put(key,parts[i]);manifests.push({key,bytes:parts[i].length,sha256:sha(parts[i])});}
  await bucket.put('archive/manifest.json',JSON.stringify({version:1,sha256:sha(bytes),bytes:bytes.length,parts:manifests}));
  await r.insert('snapshot_archives',{source_table:'entrel_user_snapshot_v260',source_primary_key:'original-id',owner_id:'alice',object_key:'archive/manifest.json',sha256:sha(bytes),size_bytes:bytes.length,source_updated_at:'2026-11-01T00:00:00Z',created_at:'2026-11-11T00:00:00Z'});
  const response=await r.api('/api/v1/me/snapshots/v260','alice');assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  assert.equal((await r.api('/api/v1/me/snapshots/v260','bob')).status,404);
  assert.equal((await r.api('/api/v1/me/snapshots/v260','admin')).status,404);
});
test('corrupted snapshot part fails verification before export',async()=>{
  await (await r.mf.getR2Bucket('FILES')).put('archive/part-000','corrupted');
  assert.equal((await r.api('/api/v1/me/snapshots/v260','alice')).status,503);
});
