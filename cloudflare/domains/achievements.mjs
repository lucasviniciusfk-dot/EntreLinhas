import {DomainError,all,first,reply,result,stamp} from './http.mjs';
import {FRAME_DB,FRAME_NAME,MEDALS} from '../achievement-catalog.mjs';
import {activeExisting,canon,chosenBook,clubMetrics,desiredMedals,eligibleFrames,medalDbId,seasonWinners,sequenceInfo,socialMetrics,statsByUser} from '../achievement-rules.mjs';

const EMPTY_STATS=()=>({pages:0,finished:0,genres:{},works:{},over200:0,darkBooks:0,genreCount:0});
const bool=v=>v===true||v===1;
const frameIsActive=row=>!!row&&(row.ativa==null||bool(row.ativa));
function notification(id,uid,title,message,now){return {id:'v409_'+id+'_'+uid,usuario_id:uid,target_id:uid,titulo:title,mensagem:message,tipo:'achievement',lida:0,lida_por:'[]',ocultada_por:'[]',origem:'reconciliacao_v409',dados:'{}',criada_em:now,atualizado_em:now};}

export function handleAchievements(request,env,context){
  const {uid,headers,email}=context,url=new URL(request.url);
  if(url.pathname!=='/api/v1/me/awards/reconcile')return null;
  return result(headers,async()=>{
    if(request.method!=='POST')throw new DomainError('Método não permitido.',405);
    const user=await first(env.DB,'SELECT * FROM usuarios WHERE id=? AND COALESCE(apagado,0)=0 AND COALESCE(conta_removida,0)=0',uid);
    if(!user)throw new DomainError('Perfil não encontrado.',404);
    const [books,reads,metas,daily,medals,frames,messages,reactions,participants,clubBook,seasons,seasonEntries,clubFinished,configs]=await Promise.all([
      all(env.DB,'SELECT * FROM livros_pessoais WHERE usuario_id=? AND COALESCE(ativo,1)=1',uid),
      all(env.DB,'SELECT * FROM leituras WHERE usuario_id=?',uid),
      all(env.DB,'SELECT * FROM metas_usuarios WHERE usuario_id=?',uid),
      all(env.DB,'SELECT * FROM metas_diarias WHERE usuario_id=? ORDER BY data DESC LIMIT 1500',uid),
      all(env.DB,'SELECT * FROM usuario_medalhas WHERE usuario_id=?',uid),
      all(env.DB,'SELECT a.*,m.slug AS moldura_slug FROM usuario_molduras a LEFT JOIN molduras m ON m.id=a.moldura_id WHERE a.usuario_id=?',uid),
      all(env.DB,'SELECT * FROM chat_mensagens WHERE usuario_id=? AND COALESCE(apagada,0)=0 AND COALESCE(removida,0)=0 LIMIT 1500',uid),
      all(env.DB,'SELECT r.* FROM chat_reacoes r JOIN chat_mensagens m ON m.id=r.mensagem_id WHERE m.usuario_id=? AND COALESCE(m.apagada,0)=0 AND COALESCE(m.removida,0)=0 LIMIT 5000',uid),
      all(env.DB,'SELECT * FROM clube_livro_participantes WHERE usuario_id=? LIMIT 1000',uid),
      first(env.DB,"SELECT * FROM clube_livro_atual WHERE id='atual' AND COALESCE(ativo,1)=1 LIMIT 1"),
      all(env.DB,'SELECT * FROM ranking_temporadas LIMIT 500'),
      all(env.DB,'SELECT * FROM ranking_temporada_entries LIMIT 5000'),
      all(env.DB,'SELECT * FROM clube_livros_finalizados LIMIT 1000'),
      all(env.DB,"SELECT * FROM app_configuracoes WHERE usuario_id=? OR usuario_id='global' OR usuario_id LIKE '00000000-0000-0000-0000-000000000%' OR lower(COALESCE(chave,'')) LIKE '%escolhido%' OR lower(COALESCE(chave,'')) LIKE '%secret book%' OR lower(COALESCE(chave,'')) LIKE '%livro especial%'",uid)
    ]);
    const person={...user,email:email||user.email||''},users=[person],stats=statsByUser(users,books,reads,clubFinished),st=stats[uid]||EMPTY_STATS();
    if(!Object.keys(st.works||{}).length)st.pages=Math.max(st.pages,Number(user.paginas_lidas)||0);
    const streak=sequenceInfo(users,daily,metas),socialSummary=socialMetrics(messages,reactions),clubSummary=clubMetrics(users,participants,clubFinished,clubBook);
    const social={messages:Number(socialSummary.messages[uid])||0,reactions:Number(socialSummary.reactions[uid])||0},club=clubSummary[uid]||{participations:0,currentProgress:0};
    const winners=seasonWinners(seasons,seasonEntries),existing=activeExisting(medals)[uid]||{},chosen=chosenBook(configs);
    const desired=desiredMedals(person,st,Number(streak.current[uid])||0,social,club,!!winners[uid],existing,chosen),eligible=eligibleFrames(person,st,desired),current=stamp(),statements=[],newMedals=[],newFrames=[];
    const awarded=new Set(medals.map(row=>canon(row.medalha_id||row.medal_id||row.slug||row.id)));
    for(const slug of Object.keys(desired)){
      if(awarded.has(slug)||!MEDALS[slug])continue;
      const dbId=medalDbId(slug),claimId=crypto.randomUUID(),medal=MEDALS[slug];
      statements.push(env.DB.prepare('INSERT OR IGNORE INTO usuario_medalhas(id,usuario_id,medalha_id,conquistada_em) VALUES(?,?,?,?)').bind(claimId,uid,dbId,current));
      statements.push(env.DB.prepare('INSERT OR IGNORE INTO app_notificacoes(id,usuario_id,target_id,titulo,mensagem,tipo,lida,lida_por,ocultada_por,origem,dados,criada_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(notification('medal_'+slug,uid,'Medalha conquistada','Você conquistou a medalha '+medal[0]+'.',current).id,uid,uid,'Medalha conquistada','Você conquistou a medalha '+medal[0]+'.','achievement',0,'[]','[]','reconciliacao_v409','{}',current,current));
      newMedals.push(slug);
    }
    const ownedFrames=new Map(frames.map(row=>[row.moldura_slug||Object.keys(FRAME_DB).find(key=>FRAME_DB[key]===row.moldura_id),row]).filter(([key])=>key));
    for(const slug of Object.keys(eligible)){
      const frameId=FRAME_DB[slug];if(!frameId)continue;const row=ownedFrames.get(slug);
      if(frameIsActive(row))continue;
      if(row){
        statements.push(env.DB.prepare('UPDATE usuario_molduras SET ativa=1,origem=?,atualizado_em=? WHERE usuario_id=? AND moldura_id=? AND COALESCE(ativa,0)=0').bind('reconciliacao_v409',current,uid,frameId));
      }else{
        statements.push(env.DB.prepare('INSERT OR IGNORE INTO usuario_molduras(id,usuario_id,moldura_id,desbloqueada_em,nome,origem,ativa,criado_em,atualizado_em,dados) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),uid,frameId,current,FRAME_NAME[slug]||slug,'reconciliacao_v409',1,current,current,'{}'));
      }
      statements.push(env.DB.prepare('INSERT OR IGNORE INTO app_notificacoes(id,usuario_id,target_id,titulo,mensagem,tipo,lida,lida_por,ocultada_por,origem,dados,criada_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(notification('frame_'+slug,uid,'Moldura desbloqueada','Você desbloqueou a moldura '+(FRAME_NAME[slug]||slug)+'.',current).id,uid,uid,'Moldura desbloqueada','Você desbloqueou a moldura '+(FRAME_NAME[slug]||slug)+'.','achievement',0,'[]','[]','reconciliacao_v409','{}',current,current));
      newFrames.push(slug);
    }
    const currentSequence=Number(streak.current[uid])||0;
    if((Number(user.sequencia_dias)||0)!==currentSequence)statements.push(env.DB.prepare('UPDATE usuarios SET sequencia_dias=?,atualizado_em=? WHERE id=?').bind(currentSequence,current,uid));
    if(statements.length)await env.DB.batch(statements);
    const [savedMedals,savedFrames]=await Promise.all([
      all(env.DB,'SELECT u.*,m.nome,m.categoria,m.descricao,m.imagem_url FROM usuario_medalhas u LEFT JOIN medalhas m ON m.id=u.medalha_id WHERE u.usuario_id=? ORDER BY u.conquistada_em DESC,u.id DESC',uid),
      all(env.DB,'SELECT u.*,m.slug AS moldura_slug FROM usuario_molduras u LEFT JOIN molduras m ON m.id=u.moldura_id WHERE u.usuario_id=? ORDER BY u.desbloqueada_em DESC,u.id DESC',uid)
    ]);
    return reply(headers,{medals:savedMedals,frames:savedFrames.map(row=>({...row,ativa:row.ativa!==0})),stats:{pages:st.pages,finished:st.finished,sequence:currentSequence,medals:Object.keys(desired).length},granted:{medals:newMedals,frames:newFrames},rewards_changed:false});
  });
}
