import {readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../index.html',import.meta.url),raw=readFileSync(path,'utf8'),nl=raw.includes('\r\n')?'\r\n':'\n';
let html=raw.replace(/\r\n/g,'\n');
if(html.includes('/* CF_CHAT_INTEGRATION_V1 */'))process.exit(0);
const start=html.indexOf('  function signature(messages,pins)'),end=html.indexOf('<!-- EntreLinhas v431 — Chat consolidado -->',start);
if(start<0||end<start)throw new Error('Active chat boundary not found.');
let chat=html.slice(start,end);
function once(a,b){if(chat.split(a).length!==2)throw new Error('Chat anchor missing/ambiguous: '+a.slice(0,90));chat=chat.replace(a,b);}
once('  async function fetchRows(limit){',`  function cfChat(){return new URLSearchParams(location.search).get('cf_chat')==='1';}
  function cfApi(){return window.EntreLinhasCloudflareApi.create();}
  async function fetchRows(limit){
    if(cfChat()){
      const result=await cfApi().listMessages('?limit='+encodeURIComponent(limit));
      const rx=mapReactions(result.reactions||[]),pins=[],msgs=[];
      (result.items||[]).forEach(function(row){var info=parseDados(row);if(row.fixada||info.tipo==='pin'||info.pin===true)pins.push(mapPin(row));else msgs.push(mapMessage(row,rx[String(row.id)]));});
      (result.pins||[]).forEach(function(row){if(!pins.some(p=>p.id===String(row.id)))pins.push(mapPin(row));});
      return {messages:msgs,pins:pins,hasMore:!!result.hasMore};
    }
  `);
once('  async function insertMessage(item){',`  async function insertMessage(item){
    if(cfChat()){const r=await cfApi().sendMessage({client_id:item.id,message:item.text,reply:item.reply});if(!r.ok||!r.message)throw new Error('Mensagem não confirmada.');return String(r.message.id);}
  `);
once("if(!networkError(e))break","if(!networkError(e)){rest=rest.concat(q.slice(i+1));break}");
once("if(previous===emoji)r=await c.from('chat_reacoes').delete().eq('mensagem_id',id).eq('usuario_id',uid);else r=await c.from('chat_reacoes').upsert({mensagem_id:id,usuario_id:uid,emoji:emoji||'❤️'},{onConflict:'mensagem_id,usuario_id'});",
 "if(cfChat())r=previous===emoji?await cfApi().removeReaction(id):await cfApi().reactToMessage(id,emoji||'❤️');else if(previous===emoji)r=await c.from('chat_reacoes').delete().eq('mensagem_id',id).eq('usuario_id',uid);else r=await c.from('chat_reacoes').upsert({mensagem_id:id,usuario_id:uid,emoji:emoji||'❤️'},{onConflict:'mensagem_id,usuario_id'});");
once("var r=await c.from('chat_mensagens').update({mensagem:text,editada:true,editado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()}).eq('id',String(id));",
 "var r=cfChat()?await cfApi().editMessage(id,text):await c.from('chat_mensagens').update({mensagem:text,editada:true,editado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()}).eq('id',String(id));");
once("await c.from('chat_reacoes').delete().eq('mensagem_id',String(id));var r=await c.from('chat_mensagens').delete().eq('id',String(id));if(r.error){r=await c.from('chat_mensagens').update({removida:true,atualizado_em:new Date().toISOString()}).eq('id',String(id))}",
 "var r;if(cfChat()){r=await cfApi().removeMessage(id);}else{await c.from('chat_reacoes').delete().eq('mensagem_id',String(id));r=await c.from('chat_mensagens').delete().eq('id',String(id));if(r.error){r=await c.from('chat_mensagens').update({removida:true,atualizado_em:new Date().toISOString()}).eq('id',String(id))}}");
html=html.slice(0,start)+chat+html.slice(end);
const a="return 'entrel:v431:chat-queue:'+(u.id||u.email||'anon')";
if(html.split(a).length!==2)throw new Error('Queue key anchor missing.');
html=html.replace(a,a+"+(new URLSearchParams(location.search).get('cf_chat')==='1'?':cloudflare':'')");
html+='\n<!-- /* CF_CHAT_INTEGRATION_V1 */ -->\n';
writeFileSync(path,html.replace(/\n/g,nl));
console.log('Integrated active chat reads, sends, edits, reactions and safe deletion.');
