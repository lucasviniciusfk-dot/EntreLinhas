import {DomainError,own,object,text,body,all,first,reply,result,requireAdmin,stamp} from './http.mjs';
const keys=new Set(['theme','showProfileFrames','readerTheme','readerVoice','readerFont','readerBrightness','readerSpeed','notificationsClub','notificationsAchievements','notificationsReading','notificationsSystem','notificationsChat','notificationsChallenges','notificationsAdmin','notificationOpenMarksRead','publicProfile','readerPrefs']);
const protectedKey=k=>/claim|reward|recompens|v[0-9]+_(?:paid|approved|applied)|moldura.*(?:loss|lost)/i.test(k);
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v}catch(_){return {}}};
export function handleSettings(request,env,context){
  const {uid,headers}=context,url=new URL(request.url),route=url.pathname.match(/^\/api\/v1\/settings(?:\/(user|global)\/([^/]+))?$/);
  if(!route)return null;
  return result(headers,async()=>{
    if(request.method==='GET'&&!route[1]){
      const legacy=await all(env.DB,"SELECT * FROM app_configuracoes WHERE usuario_id=? OR usuario_id='global' OR usuario_id LIKE '00000000-0000-0000-0000-000000000%'"+(context.isAdmin?' OR 1=1':''),uid);
      const normalized=await all(env.DB,"SELECT * FROM scoped_settings WHERE scope='global' OR owner_id=?"+(context.isAdmin?' OR 1=1':''),uid);
      const rows=legacy.map(r=>({...r,configuracoes:parse(r.configuracoes),valor:parse(r.valor),ativo:r.ativo!==0}));
      for(const item of normalized){const owner=item.scope==='global'?(item.legacy_user_id||'global'):item.owner_id;const at=rows.findIndex(r=>String(r.usuario_id)===owner&&r.chave===item.key);const value={id:item.legacy_id||('setting:'+item.scope+':'+item.owner_id+':'+item.key),usuario_id:owner,chave:item.key,valor:parse(item.value),ativo:!!item.active,atualizado_em:item.updated_at,configuracoes:{}};if(at<0)rows.push(value);else rows[at]={...rows[at],...value,configuracoes:rows[at].configuracoes};}
      return reply(headers,{items:rows});
    }
    const scope=route[1],key=text(decodeURIComponent(route[2]||''),240,'Chave',true);
    if(!scope)throw new DomainError('Operação de configurações inválida.');
    if(scope==='global')requireAdmin(context);
    if(protectedKey(key))throw new DomainError('Marcadores de recompensa são controlados pelo servidor.',403);
    const b=request.method==='DELETE'?{}:await body(request,524288),owner=scope==='global'?'global':uid,now=stamp();
    if(key==='preferences'){
      if(scope!=='user')throw new DomainError('Preferências pertencem à conta.',403);
      const current=await first(env.DB,'SELECT * FROM app_configuracoes WHERE usuario_id=?',uid),prefs={...object(current?.configuracoes)};
      if(request.method==='DELETE')throw new DomainError('Preferências não podem ser apagadas em bloco.',405);
      for(const[k,v]of Object.entries(b.configuracoes||b.value||b)){if(!keys.has(k))continue;if(k.startsWith('notifications')||['showProfileFrames','notificationOpenMarksRead','publicProfile'].includes(k)){if(typeof v!=='boolean')throw new DomainError('Preferência booleana inválida.');}if(['readerFont','readerBrightness','readerSpeed'].includes(k)&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1000))throw new DomainError('Preferência do leitor inválida.');prefs[k]=v;}
      const id=current?.id||crypto.randomUUID();
      await env.DB.prepare("INSERT INTO app_configuracoes(usuario_id,configuracoes,atualizado_em,id) VALUES(?,?,?,?) ON CONFLICT(usuario_id) DO UPDATE SET configuracoes=excluded.configuracoes,atualizado_em=excluded.atualizado_em").bind(uid,JSON.stringify(prefs),now,id).run();
      return reply(headers,{row:{...current,id,usuario_id:uid,configuracoes:prefs,atualizado_em:now}});
    }
    if(request.method==='DELETE'){
      await env.DB.prepare('UPDATE scoped_settings SET active=0,updated_at=? WHERE scope=? AND owner_id=? AND key=?').bind(now,scope,owner,key).run();
      return reply(headers,{removed:true});
    }
    if(!['PUT','PATCH','POST'].includes(request.method))throw new DomainError('Método não permitido.',405);
    if(scope==='user'&&!/^(reader_|preferences_|mural_feed_|book_pref_)/.test(key))throw new DomainError('Esta configuração exige uma operação específica.',403);
    const value=own(b,'value')?b.value:own(b,'valor')?b.valor:b;
    const current=await first(env.DB,'SELECT * FROM scoped_settings WHERE scope=? AND owner_id=? AND key=?',scope,owner,key);
    const legacy=scope==='global'?(current?.legacy_user_id?{usuario_id:current.legacy_user_id,id:current.legacy_id}:await first(env.DB,"SELECT usuario_id,id FROM app_configuracoes WHERE chave=? AND (usuario_id='global' OR usuario_id LIKE '00000000-0000-0000-0000-000000000%') ORDER BY COALESCE(atualizado_em,criado_em,'') DESC,CASE WHEN usuario_id='00000000-0000-0000-0000-000000000000' THEN 0 WHEN usuario_id='00000000-0000-0000-0000-000000000181' THEN 1 WHEN usuario_id='global' THEN 2 ELSE 3 END LIMIT 1",key)):null;
    const legacyUser=legacy?.usuario_id||null;
    const id=current?.legacy_id||crypto.randomUUID();
    await env.DB.prepare("INSERT INTO scoped_settings(scope,owner_id,key,value,legacy_user_id,legacy_id,active,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(scope,owner_id,key) DO UPDATE SET value=excluded.value,legacy_user_id=COALESCE(scoped_settings.legacy_user_id,excluded.legacy_user_id),legacy_id=COALESCE(scoped_settings.legacy_id,excluded.legacy_id),active=excluded.active,updated_at=excluded.updated_at").bind(scope,owner,key,JSON.stringify(value),legacyUser,current?.legacy_id||legacy?.id||id,b.ativo===false?0:1,now).run();
    // Existing internal reward readers still use the legacy row. Update its value
    // only when the same key already occupies that row; never clobber another key.
    if(legacyUser)await env.DB.prepare('UPDATE app_configuracoes SET valor=?,ativo=?,atualizado_em=? WHERE chave=? AND usuario_id=?').bind(JSON.stringify(value),b.ativo===false?0:1,now,key,legacyUser).run();
    return reply(headers,{row:{id,usuario_id:legacyUser||owner,chave:key,valor:value,ativo:b.ativo!==false,atualizado_em:now}});
  });
}
