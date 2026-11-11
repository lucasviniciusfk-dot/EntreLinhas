export function pgJson(value){
 if(value===null||value===undefined)return "null";
 if(Array.isArray(value))return "["+value.map(pgJson).join(", ")+"]";
 if(typeof value==="object"){
  const bytes=new TextEncoder();
  const keys=Object.keys(value).sort((a,b)=>{const x=bytes.encode(a),y=bytes.encode(b);if(x.length!==y.length)return x.length-y.length;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;});
  return "{"+keys.map(k=>JSON.stringify(k)+": "+pgJson(value[k])).join(", ")+"}";
 }
 return JSON.stringify(value);
}

export function normalizedForManifest(row,cols){
 const out={...row};
 for(const c of cols){let v=out[c.column_name];if(v==null)continue;
 if(c.data_type==="boolean")v=v===true||v===1;
 if(["json","jsonb","ARRAY"].includes(c.data_type)&&typeof v==="string")v=JSON.parse(v);
 if(c.data_type.startsWith("timestamp")&&typeof v==="string"){
  const m=v.match(/^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d(?::?\d\d)?)$/);
  if(m){const zone=m[4]==="Z"?"+00:00":m[4].length===3?m[4]+":00":m[4],d=new Date(m[1]+"T"+m[2]+zone);v=d.toISOString().slice(0,19)+"."+(m[3]||"").padEnd(6,"0").slice(0,6)+"Z";}
 }out[c.column_name]=v;
 }return out;
}

export function manifestSQL(table,cols,pk){const kv=cols.map(c=>`'${c.column_name}',${c.data_type.startsWith("timestamp")?`CASE WHEN t."${c.column_name}" IS NULL THEN NULL ELSE to_jsonb(to_char(t."${c.column_name}" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) END`:`to_jsonb(t."${c.column_name}")`}`).join(",");return `SELECT jsonb_build_array(${pk.map(k=>`t."${k}"`).join(",")}) AS pk,encode(sha256(convert_to(jsonb_build_object(${kv})::text,'UTF8')),'hex') AS row_sha256 FROM "${table}" t`;}
