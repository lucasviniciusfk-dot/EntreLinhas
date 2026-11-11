/* Reversible, per-page canaries for settings and personal library data. */
(function (root) {
  'use strict';
  const params = () => new URLSearchParams(root.location.search);
  const enabled = name => params().get(name) === '1';
  const api = () => root.EntreLinhasCloudflareApi.create();
  const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch (_) { return {}; } };
  const text = value => String(value == null ? '' : value);
  const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const own = (book, uid) => text(book && (book.userId || book.usuario_id || book.user_id || book.owner_id)) === text(uid);
  const personal = book => !!(book && (book.userId || book.usuario_id || book.user_id || book.onlinePersonalId || book.personalOnlineId || book.personalFingerprint || /personal|pessoal|manual|epub/i.test(text(book.source || book.origem)))) && !/club|clube|global|public|catalog/i.test(text(book && book.source));
  const localSave = () => { try { if (typeof root.save === 'function') root.save(); else if (typeof root.saveData === 'function') root.saveData(); } catch (_) {} };
  const render = () => { try { if (typeof root.render === 'function') root.render(); } catch (_) {} };
  const info = (title, message) => { try { if (typeof root.prettyInfo === 'function') root.prettyInfo(title, message || '', 'OK'); else root.alert(title + (message ? '\n\n' + message : '')); } catch (_) {} };
  const uuid = () => root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const byRef = ref => (root.data && Array.isArray(root.data.books) ? root.data.books : []).find(b => [b && b.id,b && b.onlinePersonalId,b && b.personalOnlineId,b && b.livroId,b && b.livro_id].some(x => text(x) === text(ref)));
  const objectUrls = new Map();
  async function fileUrl(value) {
    const match = text(value).match(/^cf-asset:(.+)$/);
    if (!match) return text(value);
    if (!objectUrls.has(match[1])) objectUrls.set(match[1], root.URL.createObjectURL(await api().getFile(match[1])));
    return objectUrls.get(match[1]);
  }
  async function mapBook(row, uid, prior) {
    const d = parse(row.dados), pages = Math.max(1, Number(row.paginas) || 300), page = Math.max(0, Number(row.pagina_atual) || 0);
    const epub = await fileUrl(row.epub_storage_path || row.epub_url || '');
    return Object.assign({}, prior || {}, {
      id:row.id,onlinePersonalId:row.id,personalOnlineId:row.id,livroId:row.livro_id || row.id,personalFingerprint:row.livro_id || row.id,
      userId:uid,title:row.titulo || d.title || 'Livro',author:row.autor || d.author || 'Autor não identificado',genre:row.genero || d.genre || 'Outro',
      pages,currentPage:page,readerPage:page,epubProgress:Number(row.progresso) || Math.round(page / pages * 100),epubCfi:row.epub_cfi || '',
      status:row.status || 'reading',finished:/^(finished|finalizado|concluido|concluído)$/i.test(text(row.status)),finalizado:/^(finished|finalizado|concluido|concluído)$/i.test(text(row.status)),
      finishPending:/pending_finish|aguardando/i.test(text(row.status)) || !!d.finishPending,source:row.epub_storage_path || row.epub_url ? 'personal-epub-online-r2' : 'personal-manual-online',
      cover:await fileUrl(row.capa_url || row.capa || d.cover || ''),coverReference:row.capa_url || row.capa || '',epubStoragePath:epub,epubStorageKey:row.epub_storage_path || row.epub_url || '',
      epubRemoteUrl:epub,epub_url:epub,atualizado_em:row.atualizado_em || '',updatedAt:row.atualizado_em ? Date.parse(row.atualizado_em) : Date.now(),syncedOnline:true,dados:d
    });
  }
  async function identity() {
    const result = await api().getMe();
    if (!result.ok || !result.profile || !result.profile.id) throw new Error('A conta no Cloudflare não foi confirmada.');
    return result.profile;
  }
  async function readLibrary(force) {
    if (!enabled('cf_library')) return;
    const now = Date.now();
    if (!force && root.__entrelCfLibraryCache && now - root.__entrelCfLibraryCache.at < 45000) return root.__entrelCfLibraryCache.items;
    const user = await identity(), items = [];
    let cursor = '';
    do {
      const page = await api().listBooks('?limit=500' + cursor);
      if (!page.ok || !Array.isArray(page.items)) throw new Error('A biblioteca no Cloudflare não confirmou a leitura.');
      items.push(...page.items);
      cursor = page.nextCursor ? '&before=' + encodeURIComponent(page.nextCursor.before || '') + '&before_id=' + encodeURIComponent(page.nextCursor.before_id || '') : '';
      if (items.length >= 5000) break;
    } while (cursor);
    const books = Array.isArray(root.data && root.data.books) ? root.data.books : [], globals = [], local = [], mapped = [];
    for (const row of items) {
      const old = books.find(b => own(b,user.id) && (text(b.id) === text(row.id) || text(b.onlinePersonalId || b.personalOnlineId || b.livroId) === text(row.id) || (normalize(b.title || b.titulo) === normalize(row.titulo) && normalize(b.author || b.autor) === normalize(row.autor))));
      mapped.push(await mapBook(row,user.id,old));
    }
    books.forEach(b => {
      if (!personal(b)) globals.push(b);
      else if (own(b,user.id) && !mapped.some(x => text(x.id) === text(b.id) || text(x.livroId) === text(b.livroId || b.personalFingerprint))) local.push(b);
      else if (!own(b,user.id)) {
        root.data.__entrelCfQuarantinedBooks = Array.isArray(root.data.__entrelCfQuarantinedBooks) ? root.data.__entrelCfQuarantinedBooks : [];
        if (!root.data.__entrelCfQuarantinedBooks.some(x => text(x.id) === text(b.id))) root.data.__entrelCfQuarantinedBooks.push(b);
      }
    });
    root.data.books = globals.concat(mapped,local);
    localSave();
    root.__entrelCfLibraryCache = {at:Date.now(),items:mapped};
    if (force) render();
    return mapped;
  }
  async function safeReadLibrary(force){try{return await readLibrary(force)}catch(e){root.__entrelCfLibraryError=text(e&&e.message||e);try{console.warn('[Cloudflare library]',root.__entrelCfLibraryError)}catch(_){}return []}}
  async function saveProgress(book, requestedPage) {
    if (!enabled('cf_library')) return false;
    if (!book) return false;
    const user = await identity(), id = text(book.onlinePersonalId || book.personalOnlineId || book.id), pages = Math.max(1,Number(book.pages || book.paginas) || 1);
    const page = Math.max(0,Math.min(pages,Math.floor(Number(requestedPage == null ? (book.readerPage || book.currentPage || 0) : requestedPage) || 0)));
    book.userId = user.id; book.readerPage = book.currentPage = page; book.epubProgress = Math.round(page / pages * 100);
    const result = await api().saveReading({book_id:id,current_page:page,epub_cfi:book.epubCfi || '',status:'reading',atualizado_em:book.atualizado_em || '',dados:book.dados || {}});
    if (!result.ok || !result.book) throw new Error('O progresso não foi confirmado no Cloudflare.');
    book.status = result.book.status || 'reading'; book.finishPending = /pending_finish/i.test(book.status); book.atualizado_em=result.book.atualizado_em||'';book.updatedAt = Date.now();
    localSave(); root.__entrelCfLibraryCache = null; return true;
  }
  async function safeSaveProgress(book,page){try{return await saveProgress(book,page)}catch(e){root.__entrelCfLibraryError=text(e&&e.message||e);try{console.warn('[Cloudflare progress]',root.__entrelCfLibraryError)}catch(_){}return false}}
  async function addBook() {
    if (!enabled('cf_library')) return;
    const title=text((root.document.getElementById('bt')||{}).value).trim(), author=text((root.document.getElementById('ba')||{}).value).trim(), pages=Math.floor(Number((root.document.getElementById('bp')||{}).value)), genre=text((root.document.getElementById('bg')||{}).value).trim();
    const already=!!((root.document.getElementById('entrelV482AlreadyFinished')||{}).checked);
    if (!title || !author || pages < 1 || !genre) throw new Error('Preencha título, autor, páginas e gênero.');
    const user=await identity(), file=root.__personalCoverV118 instanceof File ? root.__personalCoverV118 : null;
    let cover=text((root.document.getElementById('bc')||{}).value).trim(), uploaded=null;
    if (file) { uploaded=await api().uploadFile(file,'cover'); if(!uploaded.ok||!uploaded.file)throw new Error('A capa não foi guardada no Cloudflare.'); cover='cf-asset:'+uploaded.file.id; }
    const id=uuid(), created=await api().createBook({id,livro_id:id,titulo:title,autor:author,genero:genre,paginas:pages,capa:cover,capa_url:cover,status:'reading',ativo:true,publico:false,dados:{source:'personal-manual-cloudflare',createdFrom:'manual'}});
    if(!created.ok||!created.book) { if(uploaded)try{await api().deleteFile(uploaded.file.id)}catch(_){} throw new Error('O livro não foi confirmado no Cloudflare.'); }
    if(uploaded){await api().linkBookAsset(id,uploaded.file.id,'cover');root.__personalCoverV118=null;}
    const book=await mapBook(created.book,user.id); root.data.books=Array.isArray(root.data.books)?root.data.books:[];root.data.books.unshift(book);localSave();root.__entrelCfLibraryCache=null;
    if(already){const review=text((root.document.getElementById('finishReview')||{}).value).trim();const req=await api().requestFinishBook(id,uuid(),review);if(req.ok){book.status='pending_finish';book.finishPending=true;}else info('Livro adicionado','O livro foi salvo, mas o pedido de finalização não foi confirmado.');}
    try{if(typeof root.closeModal==='function')root.closeModal()}catch(_){}render();
    info('Livro pessoal salvo','Os dados foram confirmados no Cloudflare.');return book;
  }
  async function editBook(id) {
    if (!enabled('cf_library')) return;
    const book=byRef(id);if(!book)throw new Error('Livro não encontrado.');
    const title=text((root.document.getElementById('editTitle')||{}).value).trim(),author=text((root.document.getElementById('editAuthor')||{}).value).trim(),pages=Math.floor(Number((root.document.getElementById('editPages')||{}).value)),genre=text((root.document.getElementById('editGenre')||{}).value).trim(),cover=text((root.document.getElementById('editCover')||{}).value).trim();
    if(!title||!author||pages<1||!genre)return info('Dados incompletos','Preencha nome, autor, páginas e gênero.');
    const user=await identity(),idOnline=text(book.onlinePersonalId||book.personalOnlineId||book.id),page=Math.min(pages,Math.max(0,Number(book.currentPage||book.readerPage)||0)),result=await api().updateBook(idOnline,{titulo:title,autor:author,genero:genre,paginas:pages,capa:cover,capa_url:cover,pagina_atual:page});
    if(!result.ok||!result.book)throw new Error('A alteração não foi confirmada no Cloudflare.');
    Object.assign(book,{title,author,genre,genero:genre,pages,currentPage:page,readerPage:page,cover,updatedAt:Date.now(),userId:user.id});localSave();root.__entrelCfLibraryCache=null;
    try{if(typeof root.closeModal==='function')root.closeModal()}catch(_){}render();info('Livro atualizado','As alterações foram confirmadas no Cloudflare.');return true;
  }
  async function requestFinish(ref) {
    if (!enabled('cf_library')) return;
    const book=byRef(ref);if(!book)throw new Error('Livro não encontrado na sua biblioteca.');
    const user=await identity(),id=text(book.onlinePersonalId||book.personalOnlineId||book.id);
    if(book.finishPending||/pending_finish/i.test(text(book.status)))return info('Finalização já enviada','A solicitação já está aguardando aprovação.');
    const review=text((root.document.getElementById('finishReview')||{}).value).trim(),request=await api().requestFinishBook(id,uuid(),review);
    if(!request.ok||!request.request)throw new Error('A solicitação não foi confirmada no Cloudflare.');
    book.userId=user.id;book.status='pending_finish';book.finishPending=true;book.review=review;book.updatedAt=Date.now();localSave();root.__entrelCfLibraryCache=null;
    try{if(typeof root.closeModal==='function')root.closeModal()}catch(_){}render();info('Solicitação enviada','A finalização está aguardando aprovação administrativa.');return true;
  }
  if(typeof root.entLoadSettingsV66 === 'function'){
    const oldLoad=root.entLoadSettingsV66, oldSave=root.entSaveSettingsV66;
    root.entLoadSettingsV66=async function(){
      if(!enabled('cf_settings'))return oldLoad.apply(this,arguments);
      const current=Object.assign({},root.getEntreLinhasSettingsV66?root.getEntreLinhasSettingsV66():{},root.data&&root.data.appSettings||{});
      try{const response=await api().getSettings();if(!response.ok||!Array.isArray(response.items))throw new Error('As configurações não foram confirmadas no Cloudflare.');
        const user=await identity(),row=response.items.find(x=>text(x.usuario_id)===text(user.id)&&x.configuracoes&&typeof x.configuracoes==='object'),settings=Object.assign(current,row?row.configuracoes:{});
        root.localStorage.setItem('entrelinhas_app_settings_v1863',JSON.stringify(settings));if(root.data){root.data.appSettings=settings;if(root.data.user)root.data.user.publicProfile=!!settings.publicProfile;}
        if(typeof root.applyEntreLinhasSettingsV66==='function')root.applyEntreLinhasSettingsV66();return settings;
      }catch(e){root.__entrelCfSettingsError=text(e&&e.message||e);try{console.warn('[Cloudflare settings]',root.__entrelCfSettingsError)}catch(_){}return current;}
    };
    root.entSaveSettingsV66=async function(value){
      if(!enabled('cf_settings'))return oldSave.apply(this,arguments);
      const defaults={theme:'claro',showProfileFrames:true,readerTheme:'claro',readerVoice:'feminina',readerFont:100,readerBrightness:100,readerSpeed:1,notificationsClub:true,notificationsAchievements:true,notificationsReading:true,publicProfile:true,notificationsSystem:true,notificationsChat:true,notificationsChallenges:true,notificationsAdmin:true,notificationOpenMarksRead:true};
      const settings=Object.assign({},defaults,root.getEntreLinhasSettingsV66?root.getEntreLinhasSettingsV66():{},value||{});
      root.localStorage.setItem('entrelinhas_app_settings_v1863',JSON.stringify(settings));if(root.data)root.data.appSettings=settings;
      try{const response=await api().savePreferences(settings);if(!response.ok)throw new Error('A gravação das configurações não foi confirmada no Cloudflare.');root.__entrelCfSettingsError='';return true;}
      catch(e){root.__entrelCfSettingsError=text(e&&e.message||e);try{console.warn('[Cloudflare settings]',root.__entrelCfSettingsError)}catch(_){}return false;}
    };
  }
  if(typeof root.entrelV482LoadOwnLibrary==='function'){
    const oldLoad=root.entrelV482LoadOwnLibrary;
    root.entrelV482LoadOwnLibrary=function(force){return enabled('cf_library')?safeReadLibrary(!!force):oldLoad.apply(this,arguments)};
    root.loadPersonalLibraryOnlineV5=root.entrelV482LoadOwnLibrary;root.syncPersonalLibraryV34=root.entrelV482LoadOwnLibrary;root.entrelV506RefreshLibrary=root.entrelV482LoadOwnLibrary;
  }
  const oldAddBook=root.addBook,oldSaveBookEdit=root.saveBookEdit,oldSaveGenre=root.saveEpubGenreEdit,oldConfirmFinish=root.confirmFinishBook,oldDeleteBook=root.deleteBook,oldSaveProgress=root.saveProgress,oldSaveProgressV8=root.saveProgressNowV8,oldSaveProgressV211=root.entrelV211SaveProgress;
  if(typeof oldAddBook==='function')root.addBook=function(){return enabled('cf_library')?addBook.apply(this,arguments):oldAddBook.apply(this,arguments)};
  if(typeof oldSaveBookEdit==='function')root.saveBookEdit=function(){if(!enabled('cf_library'))return oldSaveBookEdit.apply(this,arguments);return editBook.apply(this,arguments).catch(e=>{info('Erro ao atualizar',text(e&&e.message||e));return false})};
  if(typeof oldSaveGenre==='function')root.saveEpubGenreEdit=async function(id){if(!enabled('cf_library'))return oldSaveGenre.apply(this,arguments);const book=byRef(id),genre=text((root.document.getElementById('editEpubGenre')||{}).value).trim();if(!book||!genre)return;const result=await api().updateBook(book.onlinePersonalId||book.id,{genero:genre});if(!result.ok)throw new Error('O gênero não foi confirmado no Cloudflare.');book.genre=book.genero=genre;localSave();root.__entrelCfLibraryCache=null;try{if(typeof root.closeModal==='function')root.closeModal()}catch(_){}render();info('Gênero atualizado','A alteração foi confirmada no Cloudflare.');return true;};
  if(typeof oldConfirmFinish==='function')root.confirmFinishBook=function(){if(!enabled('cf_library'))return oldConfirmFinish.apply(this,arguments);return requestFinish.apply(this,arguments).catch(e=>{info('Finalização não enviada',text(e&&e.message||e));return false})};
  if(typeof oldDeleteBook==='function')root.deleteBook=async function(ref){
    if(!enabled('cf_library'))return oldDeleteBook.apply(this,arguments);
    const book=byRef(ref);if(!book)throw new Error('Livro não encontrado.');
    try{const result=await api().removeBook(book.onlinePersonalId||book.id);if(!result.ok)throw new Error('A remoção não foi confirmada no Cloudflare.');
    book.status='removed';book.ativo=false;book.removed=true;localSave();root.__entrelCfLibraryCache=null;render();return true;
    }catch(e){info('Não foi possível excluir',text(e&&e.message||e));return false;}
  };
  if(typeof oldSaveProgressV8==='function')root.saveProgressNowV8=async function(book){if(!enabled('cf_library'))return oldSaveProgressV8.apply(this,arguments);return safeSaveProgress(book)};
  if(typeof oldSaveProgressV211==='function')root.entrelV211SaveProgress=async function(book){if(!enabled('cf_library'))return oldSaveProgressV211.apply(this,arguments);return safeSaveProgress(book)};
  if(typeof oldSaveProgress==='function')root.saveProgress=async function(ref){
    if(!enabled('cf_library'))return oldSaveProgress.apply(this,arguments);
    const book=byRef(ref);if(!book)throw new Error('Livro não encontrado.');const input=root.document.getElementById('newPage');
    const page=input?Number(input.value):Number(book.readerPage||book.currentPage||0),ok=await safeSaveProgress(book,page);render();return ok;
  };
  root.entrelCfReconcileAwards=async function(){if(!enabled('cf_awards'))throw new Error('Ative cf_awards para usar a reconciliação de medalhas no Cloudflare.');return api().reconcileAwards()};
  root.EntreLinhasDataCanaries=Object.freeze({enabled,readLibrary:safeReadLibrary,saveProgress:safeSaveProgress});
})(typeof window !== 'undefined' ? window : globalThis);
