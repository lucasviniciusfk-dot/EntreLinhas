/* EntreLinhas — cliente isolado da API Cloudflare (staging)
 * Não intercepta fetch/PostgREST e não altera a fila offline.
 * Só é ativado quando um módulo chama explicitamente window.EntreLinhasCloudflare.
 */
(function (root) {
  'use strict';

  if (root.EntreLinhasCloudflare) return;

  var DEFAULT_BASE = 'https://entrelinhas-api-staging.lucasviniciusfk.workers.dev';
  var baseUrl = DEFAULT_BASE.replace(/\/+$/, '');

  function getSupabaseClient() {
    return root.entSupabaseClient || root.supabaseClient || null;
  }

  async function accessToken() {
    var client = getSupabaseClient();
    if (!client || !client.auth || typeof client.auth.getSession !== 'function') {
      throw new Error('Sessão do Supabase Auth indisponível.');
    }
    var result = await client.auth.getSession();
    if (result && result.error) throw result.error;
    var session = result && result.data && result.data.session;
    if (!session || !session.access_token) {
      throw new Error('Faça login novamente para continuar.');
    }
    return session.access_token;
  }

  async function request(path, options) {
    options = options || {};
    if (typeof path !== 'string' || path.charAt(0) !== '/' || path.indexOf('..') !== -1) {
      throw new TypeError('Caminho de API inválido.');
    }
    var token = await accessToken();
    var headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + token);
    headers.set('Accept', 'application/json');
    var body = options.body;
    if (body !== undefined && !(body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    var response = await fetch(baseUrl + path, {
      method: options.method || 'GET',
      headers: headers,
      body: body,
      cache: 'no-store',
      credentials: 'omit'
    });
    var raw = await response.text();
    var payload = null;
    if (raw) {
      try { payload = JSON.parse(raw); }
      catch (_) { payload = { message: raw.slice(0, 500) }; }
    }
    if (!response.ok) {
      var message = payload && (payload.error || payload.message);
      var error = new Error(message || ('Falha na API (' + response.status + ').'));
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function encodeId(id) {
    if (id === undefined || id === null || String(id).trim() === '') {
      throw new TypeError('Identificador obrigatório.');
    }
    return encodeURIComponent(String(id));
  }

  var api = Object.freeze({
    version: '0.1.0-staging',
    request: request,
    me: function () { return request('/api/v1/me'); },
    library: Object.freeze({
      list: function () { return request('/api/v1/library/books'); },
      create: function (book) { return request('/api/v1/library/books', { method: 'POST', body: book }); },
      update: function (id, patch) {
        return request('/api/v1/library/books/' + encodeId(id), { method: 'PATCH', body: patch });
      },
      deactivate: function (id) {
        return request('/api/v1/library/books/' + encodeId(id), { method: 'DELETE' });
      }
    }),
    reading: Object.freeze({
      list: function () { return request('/api/v1/reading'); },
      save: function (reading) { return request('/api/v1/reading', { method: 'POST', body: reading }); }
    }),
    goals: Object.freeze({
      list: function () { return request('/api/v1/goals'); }
    }),
    challenges: Object.freeze({
      list: function () { return request('/api/v1/challenges'); }
    })
  });

  Object.defineProperty(root, 'EntreLinhasCloudflare', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false
  });
})(window);
