/* Auth stays on Supabase. No global fetch/SDK interception. */
(function (root) {
  'use strict';
  const DEFAULT_API = 'https://entrelinhas-api-staging.lucasviniciusfk.workers.dev';
  class ApiError extends Error {
    constructor(message, status, code) { super(message); this.name = 'ApiError'; this.status = status || 0; this.code = code || 'API_ERROR'; }
  }
  function create(options) {
    const config = options || {}, apiBase = String(config.apiBase || DEFAULT_API).replace(/\/+$/, '');
    const getAccessToken = config.getAccessToken || async function () {
      const c = config.client || root.entSupabaseClient || root.supabaseClient;
      if (!c || !c.auth) throw new ApiError('Sessão indisponível. Faça login novamente.', 401, 'AUTH');
      let r = await c.auth.getSession();
      if (r.error) throw new ApiError('Não foi possível recuperar a sessão.', 401, 'AUTH');
      let session = r.data && r.data.session;
      if (session && session.expires_at && session.expires_at * 1000 <= Date.now() + 30000) {
        r = await c.auth.refreshSession();
        if (r.error) throw new ApiError('Sessão expirada. Faça login novamente.', 401, 'AUTH');
        session = r.data && r.data.session;
      }
      if (!session || !session.access_token) throw new ApiError('Faça login novamente.', 401, 'AUTH');
      return session.access_token;
    };
    async function request(path, init, binary) {
      const token = await getAccessToken(), headers = new Headers(init && init.headers);
      headers.set('Authorization', 'Bearer ' + token);
      if (init && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), config.timeoutMs || 20000);
      try {
        const r = await (config.fetch || root.fetch.bind(root))(apiBase + path, Object.assign({}, init, {headers, cache:'no-store', signal:controller.signal}));
        if (binary && r.ok) return await r.blob();
        let data;
        try { data = await r.json(); } catch (_) { throw new ApiError('Resposta inválida da API (HTTP ' + r.status + ').', r.status, 'INVALID_RESPONSE'); }
        if (!r.ok) throw new ApiError(data.error || 'Falha na API.', r.status, data.code);
        if (!data || typeof data !== 'object') throw new ApiError('Resposta inválida da API.', r.status, 'INVALID_RESPONSE');
        return data;
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('Falha de rede. Recarregue os dados para conferir o resultado antes de tentar novamente.', 0, 'NETWORK');
      } finally { clearTimeout(timer); }
    }
    const get = p => request(p, {method:'GET'});
    const send = (p, method, body) => request(p, {method, body:body === undefined ? undefined : JSON.stringify(body)});
    const id = encodeURIComponent;
    return Object.freeze({
      apiBase, request,
      getMe: () => get('/api/v1/me'),
      bootstrapMe: () => send('/api/v1/me/bootstrap', 'POST', {}),
      updateMe: (p, revision) => request('/api/v1/me', {method:'PATCH',body:JSON.stringify(p),headers:revision?{'If-Match':revision}:undefined}),
      getAwards: () => get('/api/v1/me/awards'),
      reconcileAwards: () => send('/api/v1/me/awards/reconcile', 'POST', {}),
      listBooks: query => get('/api/v1/library/books' + (query || '')),
      createBook: b => send('/api/v1/library/books', 'POST', b),
      updateBook: (key, b) => send('/api/v1/library/books/' + id(key), 'PATCH', b),
      removeBook: key => send('/api/v1/library/books/' + id(key), 'DELETE'),
      getReading: () => get('/api/v1/reading'),
      saveReading: p => send('/api/v1/reading', 'POST', p),
      awardDailyEpub: date => send('/api/v1/rewards/daily-epub', 'POST', {date}),
      requestFinishBook: (bookId, requestId, review) => send('/api/v1/library/books/' + id(bookId) + '/finish-request', 'POST', {request_id:requestId, resenha:review || ''}),
      listAdminRequests: query => get('/api/v1/admin/requests' + (query || '')),
      approveBookFinish: (requestId, reason) => send('/api/v1/admin/requests/approve-book-finish', 'POST', {request_id:requestId, reason:reason || ''}),
      rejectRequest: (requestId, reason) => send('/api/v1/admin/requests/reject', 'POST', {request_id:requestId, reason:reason || ''}),
      getSettings: () => get('/api/v1/settings'),
      savePreferences: value => send('/api/v1/settings/user/preferences', 'PUT', {configuracoes:value}),
      getScopedSetting: key => get('/api/v1/settings/user/' + id(key)),
      saveScopedSetting: (key, value) => send('/api/v1/settings/user/' + id(key), 'PUT', {value}),
      getGlobalSetting: key => get('/api/v1/settings/global/' + id(key)),
      saveGlobalSetting: (key, value) => send('/api/v1/settings/global/' + id(key), 'PUT', {value}),
      linkBookAsset: (bookId, fileId, role) => send('/api/v1/library/books/' + id(bookId) + '/assets', 'POST', {file_id:fileId, role}),
      listBookAssets: bookId => get('/api/v1/library/books/' + id(bookId) + '/assets'),
      getGoals: query => get('/api/v1/goals' + (query || '')),
      getWeeklyProgress: period => get('/api/v1/progress/weekly?period=' + id(period)),
      getMonthlyProgress: period => get('/api/v1/progress/monthly?period=' + id(period)),
      awardPeriod: (kind, period) => send('/api/v1/rewards/period', 'POST', {kind,period_key:period}),
      listChallenges: () => get('/api/v1/challenges?definitions_only=1'),
      getChallengeState: () => get('/api/v1/challenges'),
      createChallengeRequest: (key, value) => send('/api/v1/challenges/' + id(key) + '/requests', 'POST', value),
      listChallengeRequests: query => get('/api/v1/admin/challenge-requests' + (query || '')),
      reviewChallengeRequest: (key, action, reason) => send('/api/v1/admin/challenge-requests/' + id(key) + '/review', 'POST', {action,reason:reason || ''}),
      createChallenge: value => send('/api/v1/challenges', 'POST', value),
      updateChallenge: (key, value) => send('/api/v1/challenges/' + id(key), 'PUT', value),
      removeChallenge: key => send('/api/v1/challenges/' + id(key), 'DELETE'),
      listClubMural: query => get('/api/v1/club/mural' + (query || '')),
      createClubPost: value => send('/api/v1/club/mural', 'POST', value),
      updateClubPost: (key, value) => send('/api/v1/club/mural/' + id(key), 'PATCH', value),
      removeClubPost: key => send('/api/v1/club/mural/' + id(key), 'DELETE'),
      reactToClubPost: (key, active) => send('/api/v1/club/mural/' + id(key) + '/reaction', active ? 'PUT' : 'DELETE', {}),
      listAlbums: query => get('/api/v1/club/albums' + (query || '')),
      createAlbum: value => send('/api/v1/club/albums', 'POST', value),
      updateAlbum: (key, value) => send('/api/v1/club/albums/' + id(key), 'PATCH', value),
      listPhotos: (album, query) => get('/api/v1/club/albums/photos?album_id=' + id(album) + (query || '')),
      uploadClubPhoto: file => { const f = new FormData(); f.append('file', file); f.append('tipo', 'club-photo'); return request('/api/v1/files/upload', {method:'POST', body:f}); },
      addClubPhoto: (album, file) => send('/api/v1/club/albums/photos', 'POST', {album_id:album,file_id:file}),
      removeClubPhoto: key => send('/api/v1/club/albums/photos/' + id(key), 'DELETE'),
      getClubPhoto: key => request('/api/v1/club/albums/photos/' + id(key) + '/content', {method:'GET'}, true),
      listMessages: query => get('/api/v1/chat/messages' + (query || '')),
      sendMessage: p => send('/api/v1/chat/messages', 'POST', p),
      editMessage: (key, message) => send('/api/v1/chat/messages/' + id(key), 'PATCH', {message}),
      removeMessage: key => send('/api/v1/chat/messages/' + id(key), 'DELETE'),
      reactToMessage: (key, emoji) => send('/api/v1/chat/messages/' + id(key) + '/reaction', 'PUT', {emoji}),
      removeReaction: key => send('/api/v1/chat/messages/' + id(key) + '/reaction', 'DELETE'),
      listNotifications: query => get('/api/v1/notifications'+(query||'')),
      markNotification: (key, action) => {
        if (!['read','hide'].includes(action)) throw new TypeError('Ação inválida.');
        return send('/api/v1/notifications/' + id(key) + '/' + action, 'POST', {});
      },
      uploadFile: (file, category) => { const f = new FormData(); f.append('file', file); f.append('tipo', category); return request('/api/v1/files/upload', {method:'POST', body:f}); },
      getFile: key => request('/api/v1/files/' + id(key), {method:'GET'}, true),
      deleteFile: key => send('/api/v1/files/' + id(key), 'DELETE')
    });
  }
  root.EntreLinhasCloudflareApi = Object.freeze({create, ApiError, DEFAULT_API});
})(typeof window !== 'undefined' ? window : globalThis);
