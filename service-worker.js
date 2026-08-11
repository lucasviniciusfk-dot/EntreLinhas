const ENTRELINHAS_SW_VERSION='1.0.48-v512';
const CACHE_NAME='entrelinhas-pwa-1-0-48-v512';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./offline.html','./icon-180.png','./icon-192.png','./icon-512.png','./maskable-512.png'];

async function cacheShell(){
  const cache=await caches.open(CACHE_NAME);
  for(const url of APP_SHELL){
    try{
      const response=await fetch(new Request(url,{cache:'no-store'}));
      if(response&&response.ok)await cache.put(url,response.clone());
    }catch(e){}
  }
}

self.addEventListener('install',event=>{
  /* A nova versão permanece em waiting até a usuária escolher Atualizar. */
  event.waitUntil(cacheShell());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.includes('entrelinhas')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await cacheShell();
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clients.forEach(client=>client.postMessage({type:'PWA_VERSION',version:ENTRELINHAS_SW_VERSION}));
  })());
});

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='SKIP_WAITING')self.skipWaiting();
  if(data.type==='GET_VERSION'&&event.source)event.source.postMessage({type:'PWA_VERSION',version:ENTRELINHAS_SW_VERSION});
  if(data.type==='REFRESH_SHELL')event.waitUntil(cacheShell());
});

async function fetchNavigation(request){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const fresh=await fetch(new Request(request,{cache:'no-store',signal:controller.signal}));
    if(fresh&&fresh.ok){
      const cache=await caches.open(CACHE_NAME);
      await cache.put('./index.html',fresh.clone());
      return fresh;
    }
  }catch(e){}finally{clearTimeout(timeout)}
  return (await caches.match('./index.html'))||(await caches.match('./offline.html'))||Response.error();
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  let url;
  try{url=new URL(request.url)}catch(e){return}

  /* APIs, autenticação, R2, Google e CDNs nunca entram no cache local. */
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(fetchNavigation(request));
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached)return cached;
    try{
      const response=await fetch(request);
      if(response&&response.ok){
        const cache=await caches.open(CACHE_NAME);
        cache.put(request,response.clone()).catch(()=>undefined);
      }
      return response;
    }catch(e){
      return cached||Response.error();
    }
  })());
});
