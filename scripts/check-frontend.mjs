import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let checked=0;
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(/\bsrc\s*=|type\s*=\s*["'](?:application\/json|application\/ld\+json|importmap)/i.test(m[1]))continue;
  if(/type\s*=\s*["']module/i.test(m[1]))throw new Error('Module syntax needs a module parser.');
  new vm.Script(m[2],{filename:'index.html:'+ (html.slice(0,m.index).split('\n').length)});
  checked++;
}
for(const file of readdirSync(new URL('../cloudflare/',import.meta.url)).filter(f=>f.endsWith('.js')))new vm.Script(readFileSync(new URL('../cloudflare/'+file,import.meta.url),'utf8'),{filename:file});
const validation=readFileSync(new URL('../cloudflare-validation.html',import.meta.url),'utf8');
for(const m of validation.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi))if(!/\bsrc\s*=/.test(m[1]))new vm.Script(m[2],{filename:'cloudflare-validation.html'});
if(!html.includes('./cloudflare/entrelinhas-profile-data.js')||!html.includes('/* CF_PROFILE_INTEGRATION_V1 */'))throw new Error('Profile integration missing.');
console.log('Parsed '+checked+' inline scripts and Cloudflare browser modules successfully.');
