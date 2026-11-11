import {DomainError,all,first,body,object,text,integer,bool,reply,result,requireAdmin,stamp,rowJSON} from './http.mjs';

const TYPES=new Set(['pages','dailyPages','books','genre','clubBook','daily','streak','level','medals','social','specificBook','book','author','manual']);
const REQUEST_SOURCE='challenge_cf_v1';
const shape=row=>rowJSON(row,['dados'],['ativo']);
const done=value=>value===true||value===1||String(value).toLowerCase()==='true';
const terminalStatus=value=>['approved','aprovado','aprovada','rejected','recusado','recusada'].includes(String(value||'').toLowerCase());
function input(body,old,uid,creating){
  const has=(...keys)=>keys.some(key=>Object.prototype.hasOwnProperty.call(body,key));
  const value=(keys,fallback)=>{for(const key of keys)if(Object.prototype.hasOwnProperty.call(body,key))return body[key];return fallback;};
  const title=text(value(['title','titulo'],old?.titulo||''),160,'Título',true),description=text(value(['description','descricao'],old?.descricao||''),2400,'Descrição');
  const type=text(value(['type','tipo'],old?.tipo||'manual'),40,'Tipo',true);if(!TYPES.has(type))throw new DomainError('Tipo de desafio inválido.');
  const target=integer(value(['target','meta'],old?.meta??1),1,1000000,'Meta'),metaText=text(value(['metaText','meta_texto'],old?.meta_texto||''),240,'Referência');
  const xp=integer(value(['xp'],old?.xp??0),0,1000000,'XP'),points=integer(value(['points','pontos'],old?.pontos??0),0,1000000,'Estrelinhas');
  const deadline=text(value(['deadline','prazo'],old?.prazo||''),10,'Prazo');
  if(deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||Number.isNaN(Date.parse(deadline+'T00:00:00Z'))||new Date(deadline+'T00:00:00Z').toISOString().slice(0,10)!==deadline))throw new DomainError('Prazo inválido.');
  const active=has('active','ativo')?bool(value(['active','ativo'],true),'Estado'):old?.ativo==null?1:(old.ativo?1:0);
  const data=Object.assign({},object(old?.dados),object(value(['data','dados'],{})),{v55:true,metaText,deadline});
  return {titulo:title,descricao:description,tipo:type,meta:target,meta_texto:metaText,xp,pontos:points,prazo:deadline||null,ativo:active,dados:JSON.stringify(data),criado_por:creating?uid:(old?.criado_por||uid),criado_em:old?.criado_em||stamp(),atualizado_em:stamp()};
}

export function handleChallenges(request,env,{uid,headers,isAdmin}){
  const url=new URL(request.url),path=url.pathname,route=path.match(/^\/api\/v1\/challenges(?:\/([^/]+))?$/),submission=path.match(/^\/api\/v1\/challenges\/([^/]+)\/requests$/),adminRequests=path.match(/^\/api\/v1\/admin\/challenge-requests(?:\/([^/]+)\/review)?$/);
  if(!route&&!submission&&!adminRequests)return null;
  return result(headers,async()=>{
    if(adminRequests){
      requireAdmin({isAdmin});
      if(!adminRequests[1]&&request.method==='GET'){
        const status=String(url.searchParams.get('status')||'pending').toLowerCase(),where={pending:"lower(COALESCE(status,'')) IN ('pending','pendente')",processing:"lower(COALESCE(status,'')) IN ('processing','processando')",approved:"lower(COALESCE(status,'')) IN ('approved','aprovado','aprovada')",rejected:"lower(COALESCE(status,'')) IN ('rejected','recusado','recusada')",all:'1=1'};
        if(!where[status])throw new DomainError('Filtro de status inválido.');
        const rawLimit=Number(url.searchParams.get('limit')),limit=Number.isFinite(rawLimit)?Math.max(1,Math.min(200,Math.floor(rawLimit))):100;
        const q=await env.DB.prepare("SELECT id,usuario_id,usuario_nome,tipo,desafio_id,livro,paginas,resenha,prova,comprovante,status,origem,dados,xp,pontos,created_at,updated_at,atualizado_em,revisado_em,resposta_admin FROM solicitacoes_validacao WHERE origem=? AND "+where[status]+" ORDER BY COALESCE(created_at,criado_em) DESC,id DESC LIMIT ?").bind(REQUEST_SOURCE,limit).all();
        return reply(headers,{items:(q.results||[]).map(row=>rowJSON(row,['dados'])),count:(q.results||[]).length});
      }
      if(adminRequests[1]&&request.method==='POST'){
        const id=text(decodeURIComponent(adminRequests[1]),128,'Solicitação',true),payload=await body(request),action=text(payload.action||'',16,'Ação',true).toLowerCase(),reason=text(payload.reason||'',1000,'Motivo');
        if(!['approved','rejected'].includes(action))throw new DomainError('Ação inválida.');
        const req=await first(env.DB,"SELECT * FROM solicitacoes_validacao WHERE id=? AND origem=? AND lower(COALESCE(tipo,''))='challenge' LIMIT 1",id,REQUEST_SOURCE);
        if(!req)throw new DomainError('Solicitação de desafio não encontrada.',404);
        const current=String(req.status||'pending').toLowerCase();
        if(terminalStatus(current))return reply(headers,{request_id:id,status:current,already_reviewed:true,applied:false});
        if(!['pending','pendente'].includes(current))throw new DomainError('Esta solicitação já está sendo processada.',409);
        const userId=String(req.usuario_id||''),challengeId=String(req.desafio_id||object(req.dados).desafio_id||'');
        if(!userId||!challengeId)throw new DomainError('Solicitação sem usuário ou desafio vinculado.',422);
        const reviewedAt=stamp(),admin=await first(env.DB,'SELECT nome FROM usuarios WHERE id=? LIMIT 1',uid),adminName=String(admin?.nome||'Admin'),reasonText=reason||(action==='approved'?'Desafio aprovado.':'Solicitação recusada pela administração.'),data=object(req.dados);
        let statements=[env.DB.prepare("UPDATE solicitacoes_validacao SET status='processing',revisado_por=?,revisado_em=?,updated_at=?,atualizado_em=? WHERE id=? AND origem=? AND lower(COALESCE(status,'')) IN ('pending','pendente')").bind(uid,reviewedAt,reviewedAt,reviewedAt,id,REQUEST_SOURCE)];
        let xp=0,points=0,claimKey='challenge:'+userId+':'+challengeId,oldProgress=null,progress=0,progressData=null,results=[];
        if(action==='rejected'){
          const rejectedData=JSON.stringify({...data,v601_rejected:true,v601_rejected_at:reviewedAt,v601_reject_reason:reasonText});
          statements.push(
            env.DB.prepare("UPDATE solicitacoes_validacao SET status='rejected',resposta_admin=?,updated_at=?,atualizado_em=?,dados=? WHERE id=? AND origem=? AND status='processing' AND revisado_por=? AND revisado_em=?").bind(reasonText,reviewedAt,reviewedAt,rejectedData,id,REQUEST_SOURCE,uid,reviewedAt),
            env.DB.prepare("INSERT INTO app_notificacoes(id,usuario_id,target_id,titulo,mensagem,tipo,lida,lida_por,ocultada_por,origem,dados,criada_em,atualizado_em) SELECT ?,?,?,'Desafio recusado',?,'solicitacao',0,'[]','[]',?,?,?,? WHERE EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE id=? AND origem=? AND status='rejected' AND revisado_por=? AND revisado_em=?)").bind(crypto.randomUUID(),userId,userId,reasonText,REQUEST_SOURCE,JSON.stringify({request_id:id,challenge_id:challengeId}),reviewedAt,reviewedAt,id,REQUEST_SOURCE,uid,reviewedAt),
            env.DB.prepare("INSERT INTO admin_logs(id,admin_id,admin_nome,acao,detalhe,usuario_id,dados,criado_em) SELECT ?,?,?,'Recusou solicitação de desafio',?,?,?,? WHERE EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE id=? AND origem=? AND status='rejected' AND revisado_por=? AND revisado_em=?)").bind(crypto.randomUUID(),uid,adminName,String(req.livro||'Desafio'),userId,JSON.stringify({request_id:id,challenge_id:challengeId,reason:reasonText}),reviewedAt,id,REQUEST_SOURCE,uid,reviewedAt)
          );
        }else{
          const [challenge,member]=await Promise.all([first(env.DB,'SELECT * FROM desafios WHERE id=? LIMIT 1',challengeId),first(env.DB,'SELECT id FROM usuarios WHERE id=? LIMIT 1',userId)]);
          if(!challenge)throw new DomainError('A definição do desafio não foi encontrada.',404);
          if(!member)throw new DomainError('O perfil do participante não foi encontrado.',404);
          oldProgress=await first(env.DB,'SELECT * FROM usuario_desafios WHERE usuario_id=? AND desafio_id=? LIMIT 1',userId,challengeId);
          const oldData=object(oldProgress?.dados),challengeData=object(challenge.dados),reward=await first(env.DB,'SELECT xp,pontos,applied FROM entrel_reward_claims_v510 WHERE claim_key=? LIMIT 1',claimKey);
          const explicitUnrewarded=oldData.recompensa_aplicada===false||oldData.rewarded===false||oldData.recompensa_recebida===false,legacyRewarded=done(oldData.recompensa_aplicada)||done(oldData.rewarded)||done(oldData.recompensa_recebida)||done(oldData.recompensado_em),completed=!!(oldProgress&&(done(oldProgress.concluido)||/concluido|completed/i.test(String(oldProgress.status||''))));
          const rewardAlreadyApplied=Number(reward?.applied)===1||(!reward&&(legacyRewarded||(completed&&!explicitUnrewarded)));
          xp=rewardAlreadyApplied?0:Math.max(0,Math.floor(Number(reward?.xp??challenge.xp??challenge.xp_recompensa??challengeData.xp??challengeData.xp_recompensa)||0));
          points=rewardAlreadyApplied?0:Math.max(0,Math.floor(Number(reward?.pontos??challenge.pontos??challenge.pontos_recompensa??challengeData.pontos??challengeData.points??challengeData.estrelinhas)||0));
          const target=Math.max(1,Number(challenge.meta)||1);progress=Math.max(target,Number(req.paginas)||0,Number(oldProgress?.progresso)||0);
          progressData=JSON.stringify({...oldData,v601:true,challenge_request_id:id,source:'challenge_request_cf_v1',recompensa_aplicada:true,rewarded:true,recompensado_em:oldData.recompensado_em||reviewedAt});
          const approvedData=JSON.stringify({...data,v601_approved:true,v601_approved_at:reviewedAt,v601_reward_applied:true,v601_reward_xp:xp,v601_reward_points:points,v601_challenge_id:challengeId,v601_admin_reason:reasonText});
          statements.push(
            env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at,applied_at) SELECT ?,?,'challenge',?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE id=? AND origem=? AND status='processing' AND revisado_por=? AND revisado_em=?)").bind(claimKey,userId,id,xp,points,rewardAlreadyApplied?1:0,reviewedAt,rewardAlreadyApplied?reviewedAt:null,id,REQUEST_SOURCE,uid,reviewedAt),
            env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+(SELECT xp FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),pontos=COALESCE(pontos,0)+(SELECT pontos FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),atualizado_em=? WHERE id=? AND EXISTS(SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND usuario_id=? AND applied=0) AND EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE id=? AND origem=? AND status='processing' AND revisado_por=? AND revisado_em=?)").bind(claimKey,claimKey,reviewedAt,userId,claimKey,userId,id,REQUEST_SOURCE,uid,reviewedAt),
            env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0 AND EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE id=? AND origem=? AND status='processing' AND revisado_por=? AND revisado_em=?)").bind(reviewedAt,claimKey,id,REQUEST_SOURCE,uid,reviewedAt),
            env.DB.prepare("INSERT INTO usuario_desafios(id,usuario_id,desafio_id,progresso,concluido,concluido_em,status,dados,criado_em,atualizado_em) SELECT ?,?,?,?,?,?,'concluido',?,?,? WHERE EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE id=? AND origem=? AND status='processing' AND revisado_por=? AND revisado_em=?) ON CONFLICT(usuario_id,desafio_id) DO UPDATE SET progresso=MAX(COALESCE(usuario_desafios.progresso,0),excluded.progresso),concluido=1,concluido_em=COALESCE(usuario_desafios.concluido_em,excluded.concluido_em),status='concluido',dados=excluded.dados,atualizado_em=excluded.atualizado_em").bind(crypto.randomUUID(),userId,challengeId,progress,1,reviewedAt,progressData,reviewedAt,reviewedAt,id,REQUEST_SOURCE,uid,reviewedAt),
            env.DB.prepare("UPDATE solicitacoes_validacao SET status='approved',resposta_admin=?,updated_at=?,atualizado_em=?,dados=? WHERE id=? AND origem=? AND status='processing' AND revisado_por=? AND revisado_em=?").bind(reasonText,reviewedAt,reviewedAt,approvedData,id,REQUEST_SOURCE,uid,reviewedAt),
            env.DB.prepare("INSERT INTO app_notificacoes(id,usuario_id,target_id,titulo,mensagem,tipo,lida,lida_por,ocultada_por,origem,dados,criada_em,atualizado_em) SELECT ?,?,?,'Desafio aprovado',?,'solicitacao',0,'[]','[]',?,?,?,? WHERE EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE id=? AND origem=? AND status='approved' AND revisado_por=? AND revisado_em=?)").bind(crypto.randomUUID(),userId,userId,'Sua solicitação de desafio foi aprovada.'+(xp||points?' Recompensa: +'+xp+' XP e +'+points+' Estrelinhas.':''),REQUEST_SOURCE,JSON.stringify({request_id:id,challenge_id:challengeId}),reviewedAt,reviewedAt,id,REQUEST_SOURCE,uid,reviewedAt),
            env.DB.prepare("INSERT INTO admin_logs(id,admin_id,admin_nome,acao,detalhe,usuario_id,dados,criado_em) SELECT ?,?,?,'Aprovou solicitação de desafio',?,?,?,? WHERE EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE id=? AND origem=? AND status='approved' AND revisado_por=? AND revisado_em=?)").bind(crypto.randomUUID(),uid,adminName,String(req.livro||challenge.titulo||'Desafio'),userId,JSON.stringify({request_id:id,challenge_id:challengeId,xp,points,reward_already_applied:rewardAlreadyApplied}),reviewedAt,id,REQUEST_SOURCE,uid,reviewedAt)
          );
        }
        results=await env.DB.batch(statements);const lockChanges=Number(results[0]?.meta?.changes)||0,finalStatus=String((await first(env.DB,'SELECT status FROM solicitacoes_validacao WHERE id=?',id))?.status||'').toLowerCase();
        if(lockChanges!==1){if(terminalStatus(finalStatus))return reply(headers,{request_id:id,status:finalStatus,already_reviewed:true,applied:false});throw new DomainError('A solicitação foi alterada em outro aparelho. Atualize a fila e tente novamente.',409);}
        if(finalStatus!==(action==='approved'?'approved':'rejected'))throw new DomainError('A revisão não foi confirmada.',409);
        if(action==='rejected')return reply(headers,{request_id:id,status:'rejected',already_reviewed:false,applied:false});
        const balance=await first(env.DB,'SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1',userId);
        const applied=Number(results[2]?.meta?.changes)===1&&!!(xp||points);
        return reply(headers,{request_id:id,status:'approved',already_reviewed:false,applied,xp_added:applied?xp:0,points_added:applied?points:0,xp:Number(balance?.xp)||0,points:Number(balance?.pontos)||0});
      }
      throw new DomainError('Método não permitido.',405);
    }
    if(submission&&request.method==='POST'){
      const challengeId=text(decodeURIComponent(submission[1]),128,'Desafio',true),payload=await body(request),challenge=await first(env.DB,'SELECT * FROM desafios WHERE id=? LIMIT 1',challengeId);
      if(!challenge||Number(challenge.ativo)===0)throw new DomainError('Desafio não encontrado ou inativo.',404);
      const id=text(payload.request_id||crypto.randomUUID(),128,'Solicitação',true);if(!/^[A-Za-z0-9_-]+$/.test(id))throw new DomainError('Identificador de solicitação inválido.');
      const existing=await first(env.DB,'SELECT * FROM solicitacoes_validacao WHERE id=? AND usuario_id=? AND origem=? LIMIT 1',id,uid,REQUEST_SOURCE);
      if(existing){if(String(existing.desafio_id||'')!==challengeId)throw new DomainError('Este identificador já foi usado em outra solicitação.',409);return reply(headers,{request:rowJSON(existing,['dados']),already_pending:!terminalStatus(existing.status)},200);}
      const pending=await first(env.DB,"SELECT * FROM solicitacoes_validacao WHERE usuario_id=? AND desafio_id=? AND origem=? AND lower(COALESCE(status,'')) IN ('pending','processing','pendente','processando') ORDER BY COALESCE(created_at,criado_em) DESC,id DESC LIMIT 1",uid,challengeId,REQUEST_SOURCE);
      if(pending)return reply(headers,{request:rowJSON(pending,['dados']),already_pending:true},200);
      const meta=object(challenge.dados),requirement=String(meta.proofRequirement||meta.proof_requirement||'optional').toLowerCase(),note=text(payload.note??payload.text??'',12000,'Relato'),reference=text(payload.reference??payload.book_title??'',240,'Referência'),progress=integer(payload.progress??0,0,1000000,'Progresso'),proofId=text(payload.proof_file_id||'',128,'Comprovante');
      if(['text','text_image','both'].includes(requirement)&&!note)throw new DomainError('Escreva a explicação exigida antes de enviar.');
      if(['image','text_image','both'].includes(requirement)&&!proofId)throw new DomainError('Adicione o comprovante exigido antes de enviar.');
      if(['either','any','mixed'].includes(requirement)&&!note&&!proofId)throw new DomainError('Envie um texto ou um comprovante.');
      let asset=null;if(proofId){asset=await first(env.DB,"SELECT id FROM file_assets WHERE id=? AND owner_id=? AND category='receipt' AND deleted_at IS NULL LIMIT 1",proofId,uid);if(!asset)throw new DomainError('O comprovante não pertence à sua conta ou não está disponível.',403);}
      const [profile,oldProgress]=await Promise.all([first(env.DB,'SELECT nome FROM usuarios WHERE id=? LIMIT 1',uid),first(env.DB,'SELECT progresso FROM usuario_desafios WHERE usuario_id=? AND desafio_id=? LIMIT 1',uid,challengeId)]),createdAt=stamp(),fileRef=asset?'cf-asset:'+asset.id:'',xp=Math.max(0,Math.floor(Number(challenge.xp??challenge.xp_recompensa??meta.xp??meta.xp_recompensa)||0)),points=Math.max(0,Math.floor(Number(challenge.pontos??challenge.pontos_recompensa??meta.pontos??meta.points??meta.estrelinhas)||0)),requestData=JSON.stringify({v601:true,request_kind:'challenge',desafio_id:challengeId,challengeTitle:String(challenge.titulo||''),validationMode:String(meta.validationMode||meta.validation_mode||''),proofRequirement:requirement,cycleKey:String(meta.cycleKey||'once'),target:Number(challenge.meta)||1,proof_asset_id:asset?.id||'',source:REQUEST_SOURCE});
      const inserted=await env.DB.prepare("INSERT OR IGNORE INTO solicitacoes_validacao(id,usuario_id,usuario_nome,tipo,desafio_id,livro,paginas,prova,comprovante,resenha,status,origem,dados,xp,pontos,created_at,updated_at,criado_em,atualizado_em) SELECT ?,?,?, 'challenge', ?,?,?,?,?,?,'pending',?,?,?, ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE usuario_id=? AND desafio_id=? AND origem=? AND lower(COALESCE(status,'')) IN ('pending','processing','pendente','processando'))").bind(id,uid,String(profile?.nome||''),challengeId,reference,Math.max(progress,Number(oldProgress?.progresso)||0),fileRef,fileRef,note,REQUEST_SOURCE,requestData,xp,points,createdAt,createdAt,createdAt,createdAt,uid,challengeId,REQUEST_SOURCE).run();
      if(Number(inserted.meta?.changes)!==1){const repeated=await first(env.DB,"SELECT * FROM solicitacoes_validacao WHERE usuario_id=? AND desafio_id=? AND origem=? AND lower(COALESCE(status,'')) IN ('pending','processing','pendente','processando') ORDER BY COALESCE(created_at,criado_em) DESC,id DESC LIMIT 1",uid,challengeId,REQUEST_SOURCE);if(repeated)return reply(headers,{request:rowJSON(repeated,['dados']),already_pending:true},200);throw new DomainError('A solicitação não foi confirmada.',409);}
      const saved=await first(env.DB,'SELECT * FROM solicitacoes_validacao WHERE id=? AND usuario_id=? AND origem=?',id,uid,REQUEST_SOURCE);
      return reply(headers,{request:rowJSON(saved,['dados']),already_pending:false},201);
    }
    if(request.method==='GET'&&!route[1]){
      const includeProgress=url.searchParams.get('definitions_only')!=='1';
      const [items,progress,requests]=await Promise.all([
        all(env.DB,'SELECT * FROM desafios WHERE (?=1 OR COALESCE(ativo,1)=1) ORDER BY criado_em DESC,id DESC LIMIT 200',isAdmin?1:0),
        includeProgress?all(env.DB,'SELECT * FROM usuario_desafios WHERE usuario_id=? ORDER BY atualizado_em DESC,id DESC LIMIT 500',uid):Promise.resolve([]),
        includeProgress&&!isAdmin?all(env.DB,"SELECT id,usuario_id,usuario_nome,tipo,desafio_id,livro,paginas,resenha,prova,comprovante,status,origem,dados,xp,pontos,created_at,updated_at,atualizado_em,revisado_em,resposta_admin FROM solicitacoes_validacao WHERE usuario_id=? AND origem=? ORDER BY COALESCE(created_at,criado_em) DESC,id DESC LIMIT 80",uid,REQUEST_SOURCE):Promise.resolve([])
      ]);
      return reply(headers,{items:items.map(shape),progress:progress.map(row=>rowJSON(row,['dados'],['concluido'])),requests:requests.map(row=>rowJSON(row,['dados']))});
    }
    if(request.method==='POST'&&!route[1]){
      requireAdmin({isAdmin});const payload=await body(request),row=input(payload,null,uid,true),id=crypto.randomUUID();
      await env.DB.prepare('INSERT INTO desafios(id,titulo,descricao,tipo,meta,meta_texto,xp,pontos,prazo,ativo,dados,criado_por,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,row.titulo,row.descricao,row.tipo,row.meta,row.meta_texto,row.xp,row.pontos,row.prazo,row.ativo,row.dados,row.criado_por,row.criado_em,row.atualizado_em).run();
      return reply(headers,{item:shape(await first(env.DB,'SELECT * FROM desafios WHERE id=?',id))},201);
    }
    if(route[1]&&(request.method==='PUT'||request.method==='PATCH')){
      requireAdmin({isAdmin});const id=text(decodeURIComponent(route[1]),128,'ID',true),old=await first(env.DB,'SELECT * FROM desafios WHERE id=?',id);if(!old)throw new DomainError('Desafio não encontrado.',404);
      const payload=await body(request),row=input(payload,old,uid,false),updated=await env.DB.prepare('UPDATE desafios SET titulo=?,descricao=?,tipo=?,meta=?,meta_texto=?,xp=?,pontos=?,prazo=?,ativo=?,dados=?,atualizado_em=? WHERE id=?').bind(row.titulo,row.descricao,row.tipo,row.meta,row.meta_texto,row.xp,row.pontos,row.prazo,row.ativo,row.dados,row.atualizado_em,id).run();
      if(Number(updated.meta?.changes)!==1)throw new DomainError('Alteração do desafio não foi confirmada.',409);
      return reply(headers,{item:shape(await first(env.DB,'SELECT * FROM desafios WHERE id=?',id))});
    }
    if(route[1]&&request.method==='DELETE'){
      requireAdmin({isAdmin});const id=text(decodeURIComponent(route[1]),128,'ID',true),updated=await env.DB.prepare('UPDATE desafios SET ativo=0,atualizado_em=? WHERE id=?').bind(stamp(),id).run();
      if(Number(updated.meta?.changes)!==1)throw new DomainError('Desafio não encontrado.',404);
      return reply(headers,{id,active:false});
    }
    throw new DomainError('Método não permitido.',405);
  });
}
