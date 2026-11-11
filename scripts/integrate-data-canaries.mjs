import {readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../index.html',import.meta.url),raw=readFileSync(path,'utf8'),newline=raw.includes('\r\n')?'\r\n':'\n';
let html=raw.replace(/\r\n/g,'\n');
function replaceInFunction(start,old,next){const pos=html.indexOf(start);if(pos<0)throw new Error('Function anchor missing: '+start);let end=html.indexOf('\n  }',pos);if(end<0)end=html.indexOf('\n',pos);const target=html.indexOf(old,pos);if(target<0||(end>=0&&target>=end))throw new Error('Local anchor missing in '+start+': '+old);html=html.slice(0,target)+next+html.slice(target+old.length);}
if(!html.includes('/* CF_DATA_CANARIES_V1 */')){
  const anchor='</body>';
  if(html.split(anchor).length!==2)throw new Error('Expected one body closing tag.');
  html=html.replace(anchor,'<script src="./cloudflare/entrelinhas-data-canaries.js"></script>\n'+anchor);
  html+='\n<!-- /* CF_DATA_CANARIES_V1 */ -->\n';
}
if(!html.includes('/* CF_DATA_CANARIES_V2 */')){
  replaceInFunction('async function saveProgressNowV8(book){','    try{',"    if(window.EntreLinhasDataCanaries&&window.EntreLinhasDataCanaries.enabled('cf_library'))return window.EntreLinhasDataCanaries.saveProgress(book);\n    try{");
  replaceInFunction('async function saveProgressDirect(book,opts){','    try{',"    if(window.EntreLinhasDataCanaries&&window.EntreLinhasDataCanaries.enabled('cf_library'))return window.EntreLinhasDataCanaries.saveProgress(book);\n    try{");
  replaceInFunction('async function upsertBookProgressOnline(book, reason){','    try{',"      if(window.EntreLinhasDataCanaries&&window.EntreLinhasDataCanaries.enabled('cf_library'))return await window.EntreLinhasDataCanaries.saveProgress(book);\n    try{");
  replaceInFunction('async function refreshLibrary(force){','if(S.libraryLoading)',"if(window.EntreLinhasDataCanaries&&window.EntreLinhasDataCanaries.enabled('cf_library'))return window.EntreLinhasDataCanaries.readLibrary(!!force);if(S.libraryLoading)");
  html+='\n<!-- /* CF_DATA_CANARIES_V2 */ -->\n';
}
if(!html.includes('/* CF_DATA_CANARIES_V3 */')){
  replaceInFunction('async function readRequestBatch(){','var c=client();',"if(window.EntreLinhasDataCanaries&&window.EntreLinhasDataCanaries.enabled('cf_admin'))return await window.EntreLinhasDataCanaries.readFinishRequests();var c=client();");
  replaceInFunction('async function loadRequests(force){','if(REQUEST_STATE.loading)return;if(!REQUEST_STATE.loaded)restoreRequestCache();',"if(REQUEST_STATE.loading)return;var cloudflareAdmin=window.EntreLinhasDataCanaries&&window.EntreLinhasDataCanaries.enabled('cf_admin');if(!cloudflareAdmin&&!REQUEST_STATE.loaded)restoreRequestCache();else if(cloudflareAdmin){REQUEST_STATE.loaded=false;REQUEST_STATE.at=0;REQUEST_STATE.requests=[];REQUEST_STATE.users=[];REQUEST_STATE.challenges=[]}");
  replaceInFunction('async function loadRequests(force){','var c=client();if(!c){if(!REQUEST_STATE.requests.length)',"var c=client();if(!c&&!cloudflareAdmin){if(!REQUEST_STATE.requests.length)");
  html+='\n<!-- /* CF_DATA_CANARIES_V3 */ -->\n';
}
writeFileSync(path,html.replace(/\n/g,newline));
console.log('Integrated opt-in Cloudflare settings, library, reader writes and personal finish review.');
