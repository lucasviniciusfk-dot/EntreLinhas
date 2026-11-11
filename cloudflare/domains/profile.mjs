const booleanFields = ['is_admin','admin_principal','perfil_privado','biblioteca_publica','banido','banned','apagado','conta_removida','oculto_publico'];
export function profileJSON(row) {
  if (!row) return null;
  const p = {...row};
  for (const key of booleanFields) if (p[key] !== null && p[key] !== undefined) p[key] = p[key] === true || p[key] === 1;
  for (const key of ['medalhas_manuais','medalhas_evento','medalhas_secretas','historico_medalhas','historico_molduras']) {
    try { p[key] = typeof p[key] === 'string' ? JSON.parse(p[key]) : p[key]; } catch (_) { p[key] = []; }
  }
  return p;
}
export async function bootstrapProfile(env, user) {
  const now = new Date().toISOString(), meta = user.user_metadata || {};
  const name = String(meta.full_name || meta.name || (user.email || '').split('@')[0] || 'Membro').trim().slice(0,80);
  const photo = /^https:\/\//i.test(String(meta.avatar_url || '')) ? String(meta.avatar_url).slice(0,2048) : '';
  // Auth metadata supplies presentation only. Never derive roles or ownership from it.
  await env.DB.prepare("INSERT INTO usuarios (id,nome,email,foto_url,bio,livro_favorito,nivel,xp,pontos,paginas_lidas,livros_finalizados,sequencia_dias,is_admin,admin_principal,perfil_privado,biblioteca_publica,moldura_atual,estado,medalhas_manuais,medalhas_evento,medalhas_secretas,historico_medalhas,historico_molduras,criado_em,atualizado_em) VALUES (?,?,?,?,'','',1,0,0,0,0,0,0,0,0,1,'entrelinhas','ativo','[]','[]','[]','[]','[]',?,?) ON CONFLICT(id) DO NOTHING").bind(user.id,name,user.email || '',photo,now,now).run();
}
export async function handleProfile(request, env, context) {
  const {uid, headers, authUser} = context, path = new URL(request.url).pathname;
  if (!['/api/v1/me','/api/v1/me/awards'].includes(path)) return null;
  const reply = (body, status = 200) => Response.json(body, {status,headers});
  try {
    if (path === '/api/v1/me/awards' && request.method === 'GET') {
      const [medals, frames] = await Promise.all([
        env.DB.prepare('SELECT u.*,m.nome,m.categoria,m.descricao,m.imagem_url FROM usuario_medalhas u LEFT JOIN medalhas m ON m.id=u.medalha_id WHERE u.usuario_id=? ORDER BY u.conquistada_em DESC,u.id DESC').bind(uid).all(),
        env.DB.prepare('SELECT u.*,m.slug AS moldura_slug FROM usuario_molduras u LEFT JOIN molduras m ON m.id=u.moldura_id WHERE u.usuario_id=? ORDER BY u.desbloqueada_em DESC,u.id DESC').bind(uid).all()
      ]);
      return reply({ok:true,medals:medals.results,frames:frames.results.map(f=>({...f,ativa:f.ativa!==0}))});
    }
    if (path !== '/api/v1/me') return null;
    if (request.method === 'PATCH') {
      const text = await request.text();
      if (text.length > 32768) return reply({ok:false,error:'Corpo da requisição muito grande.'},413);
      const body = JSON.parse(text || '{}');
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ok:false,error:'Formato JSON inválido.'},400);
      const limits = {nome:80,bio:500,livro_favorito:160,foto_url:2048,moldura_atual:80};
      const keys = Object.keys(body);
      if (!keys.length || keys.some(k=>!Object.hasOwn(limits,k) && !['perfil_privado','biblioteca_publica'].includes(k))) return reply({ok:false,error:'Envie somente campos editáveis do perfil.'},400);
      const sets = [], values = [];
      for (const key of keys) {
        let v = body[key];
        if (['perfil_privado','biblioteca_publica'].includes(key)) {
          if (typeof v !== 'boolean') return reply({ok:false,error:'Valor booleano inválido para '+key},400);
          v = v ? 1 : 0;
        } else {
          if (v === null && ['bio','livro_favorito','foto_url'].includes(key)) v = '';
          if (typeof v !== 'string') return reply({ok:false,error:'Texto inválido para '+key},400);
          v = v.trim();
          if (v.length > limits[key] || (['nome','moldura_atual'].includes(key) && !v)) return reply({ok:false,error:'Valor inválido para '+key},400);
          if (key === 'foto_url' && v) {
            if (v.startsWith('cf-asset:')) {
              const asset = await env.DB.prepare("SELECT id FROM file_assets WHERE id=? AND owner_id=? AND category='avatar' AND deleted_at IS NULL").bind(v.slice(9),uid).first();
              if (!asset) return reply({ok:false,error:'Foto não pertence à sua conta ou está indisponível.'},403);
            } else {
              let valid = false;
              try { const u = new URL(v); valid = u.protocol === 'https:' && !u.username && !u.password; } catch (_) {}
              if (!valid) return reply({ok:false,error:'A foto precisa ser uma URL HTTPS ou um avatar da sua conta.'},400);
            }
          }
          if (key === 'moldura_atual' && !['none','entrelinhas'].includes(v)) {
            const owned = await env.DB.prepare("SELECT u.id FROM usuario_molduras u JOIN molduras m ON m.id=u.moldura_id WHERE u.usuario_id=? AND (m.slug=? OR m.id=?) AND COALESCE(u.ativa,1)=1 AND COALESCE(m.ativa,1)=1 LIMIT 1").bind(uid,v,v).first();
            const current = await env.DB.prepare('SELECT moldura_atual FROM usuarios WHERE id=?').bind(uid).first();
            if (!owned && current?.moldura_atual !== v) return reply({ok:false,error:'Esta moldura ainda não foi desbloqueada.'},403);
          }
        }
        sets.push(key+'=?'); values.push(v);
      }
      sets.push('atualizado_em=?'); values.push(new Date().toISOString(),uid);
      const result = await env.DB.prepare('UPDATE usuarios SET '+sets.join(',')+' WHERE id=? AND COALESCE(apagado,0)=0 AND COALESCE(conta_removida,0)=0').bind(...values).run();
      if (Number(result.meta?.changes) !== 1) return reply({ok:false,error:'Gravação não confirmada. Recarregue o perfil.'},409);
    } else if (request.method !== 'GET') return null;
    const row = await env.DB.prepare('SELECT * FROM usuarios WHERE id=? LIMIT 1').bind(uid).first();
    if (!row) return reply({ok:false,error:'Perfil não encontrado.'},404);
    return reply({ok:true,user:{id:uid,email:authUser.email || row.email},profile:profileJSON(row)});
  } catch (e) {
    if (e instanceof SyntaxError) return reply({ok:false,error:'JSON inválido.'},400);
    return reply({ok:false,error:'Banco de dados temporariamente indisponível.'},503);
  }
}
