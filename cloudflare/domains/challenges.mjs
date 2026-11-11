import {DomainError,all,first,body,object,text,integer,bool,reply,result,requireAdmin,stamp,rowJSON} from './http.mjs';

const TYPES=new Set(['pages','dailyPages','books','genre','clubBook','daily','streak','level','medals','social','specificBook','book','author','manual']);
const shape=row=>rowJSON(row,['dados'],['ativo']);
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
  const url=new URL(request.url),path=url.pathname,route=path.match(/^\/api\/v1\/challenges(?:\/([^/]+))?$/);
  if(!route)return null;
  return result(headers,async()=>{
    if(request.method==='GET'&&!route[1]){
      const includeProgress=url.searchParams.get('definitions_only')!=='1';
      const [items,progress]=await Promise.all([
        all(env.DB,'SELECT * FROM desafios WHERE (?=1 OR COALESCE(ativo,1)=1) ORDER BY criado_em DESC,id DESC LIMIT 200',isAdmin?1:0),
        includeProgress?all(env.DB,'SELECT * FROM usuario_desafios WHERE usuario_id=? ORDER BY atualizado_em DESC,id DESC LIMIT 500',uid):Promise.resolve([])
      ]);
      return reply(headers,{items:items.map(shape),progress:progress.map(row=>rowJSON(row,['dados'],['concluido']))});
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
