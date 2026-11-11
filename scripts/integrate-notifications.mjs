import {readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../index.html',import.meta.url),raw=readFileSync(path,'utf8'),nl=raw.includes('\r\n')?'\r\n':'\n';
let html=raw.replace(/\r\n/g,'\n');
if(html.includes('/* CF_NOTIFICATIONS_INTEGRATION_V1 */'))process.exit(0);
function once(a,b){if(html.split(a).length!==2)throw new Error('Notification anchor missing/ambiguous: '+a);html=html.replace(a,b);}
once('  async function readOnlineRows(){',`  function cfNotifications(){return new URLSearchParams(location.search).get('cf_notifications')==='1';}
  async function readOnlineRows(){
    if(cfNotifications()){
      const api=window.EntreLinhasCloudflareApi.create(),rows=[];let cursor='';
      do{const r=await api.listNotifications('?limit=100'+cursor);if(!r.ok)throw new Error('Leitura de notificações não confirmada.');rows.push(...(r.items||[]));cursor=r.nextCursor?'&before='+encodeURIComponent(r.nextCursor.before)+'&before_id='+encodeURIComponent(r.nextCursor.before_id):'';}while(cursor&&rows.length<MAX_ROWS);
      return rows.slice(0,MAX_ROWS);
    }
  `);
const updateStart=html.indexOf('  async function updateArrayField(id,field){',html.indexOf('  async function readOnlineRows(){'));
if(updateStart<0)throw new Error('Notification action boundary missing.');
html=html.slice(0,updateStart)+html.slice(updateStart).replace('  async function updateArrayField(id,field){',`  async function updateArrayField(id,field){
    if(cfNotifications()){
      try{const r=await window.EntreLinhasCloudflareApi.create().markNotification(id,field==='lida_por'?'read':'hide');return !!r.ok;}catch(e){return false;}
    }
  `);
// Separate cached data and pending state between the two validation backends.
const pos=html.indexOf('  function storeKey(prefix){'),end=html.indexOf('\n  }',pos);
if(pos<0||end<pos)throw new Error('Notification cache boundary missing.');
let fn=html.slice(pos,end);
const marker="return prefix+";
if(!fn.includes(marker))throw new Error('Notification cache key anchor missing.');
fn=fn.replace(marker,"return prefix+(new URLSearchParams(location.search).get('cf_notifications')==='1'?'cloudflare:':'')+");
html=html.slice(0,pos)+fn+html.slice(end);
html+='\n<!-- /* CF_NOTIFICATIONS_INTEGRATION_V1 */ -->\n';
writeFileSync(path,html.replace(/\n/g,nl));
console.log('Integrated notification reads and per-user read/hide actions.');
