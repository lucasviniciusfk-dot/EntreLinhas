/* EntreLinhas — cliente Cloudflare isolado (staging).
 * Sem interceptação global: não altera PostgREST, cache ou fila offline.
 */
(function (root) {
  'use strict';
  if (root.EntreLinhasCloudflare) return;

  var BASE = 'https://entrelinhas-api-staging.lucasviniciusfk.workers.dev';

  function supabase() {
    return root.entSupabaseClient || root.supabaseClient || null;
  }
  async function token() {
    var c = supabase();
    if (!c || !c.auth || typeof c.auth.getSession !== 'function') {
      throw new Error('Cliente Supabase Auth indisponível.');
    }
    var r = await c.auth.getSession();
    if (r && r.error) throw r.error;
    var session = r && r.data && r.data.session;
    if (!session || !session.access_token) throw new Error('Sessão não autenticada.');
    return session.access_token;
  }
  async function request(path, options) {
    options = options || {};
    if (typeof path !== 'string' || !/^\/api\/v1\//.test(path) || path.indexOf('..') !== -1) {
      throw new TypeError('Rota de API inválida.');
    }
    var headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + await token());
    headers.set('Accept', 'application/json');
    var body = options.body;
    if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    var response = await fetch(BASE + path, {
      method: options.method || 'GET', headers: headers, body: body,
      cache: 'no-store', credentials: 'omit'
    });
    var raw = await response.text(), payload = null;
    if (raw) { try { payload = JSON.parse(raw); } catch (_) { payload = { message: raw.slice(0, 300) }; } }
    if (!response.ok) {
      var e = new Error(payload && (payload.error || payload.message) || ('HTTP ' + response.status));
      e.status = response.status; e.payload = payload; throw e;
    }
    return payload;
  }
  function id(value) {
    if (value === null || value === undefined || String(value).trim() === '') throw new TypeError('ID obrigatório.');
    return encodeURIComponent(String(value));
  }
  function toApiBook(book) {
    book = book || {};
    return {
      id: book.onlinePersonalId || book.id,
      title: book.title || book.titulo || 'Livro',
      author: book.author || book.autor || 'Autor não identificado',
      genre: book.genre || book.genero || 'Outro',
      pages: book.pages || book.paginas || 300,
      cover_url: book.cover || book.capa_url || book.capa || '',
      current_page: book.currentPage || book.readerPage || book.pagina_atual || 0,
      epub_cfi: book.epubCfi || book.epub_cfi || '',
      status: book.status || 'reading'
    };
  }
  function toApiBookPatch(patch) {
    patch = patch || {};
    var out = {};
    function copy(target, names, transform) {
      for (var i = 0; i < names.length; i++) {
        if (Object.prototype.hasOwnProperty.call(patch, names[i])) {
          var value = patch[names[i]];
          out[target] = transform ? transform(value) : value;
          return;
        }
      }
    }
    copy('title', ['title', 'titulo']);
    copy('author', ['author', 'autor']);
    copy('genre', ['genre', 'genero']);
    copy('pages', ['pages', 'paginas']);
    copy('cover_url', ['cover_url', 'cover', 'capa_url', 'capa']);
    copy('current_page', ['current_page', 'currentPage', 'readerPage', 'pagina_atual']);
    copy('epub_cfi', ['epub_cfi', 'epubCfi']);
    copy('status', ['status']);
    return out;
  }
  function fromApiBook(row) {
    row = row || {};
    var dados = row.dados;
    if (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch (_) { dados = {}; } }
    dados = dados && typeof dados === 'object' ? dados : {};
    return {
      id: row.id, onlinePersonalId: row.id, personalFingerprint: row.livro_id || dados.fingerprint || '',
      userId: row.usuario_id, title: row.titulo || '', author: row.autor || '',
      genre: row.genero || 'Outro', pages: Number(row.paginas) || 300,
      cover: row.capa_url || row.capa || '', currentPage: Number(row.pagina_atual) || 0,
      readerPage: Number(row.pagina_atual) || 0, epubProgress: Number(row.progresso) || 0,
      epubCfi: row.epub_cfi || '', status: row.status || 'reading',
      epubStoragePath: row.epub_storage_path || '', epubFileName: dados.epubFileName || '',
      source: dados.source || 'cloudflare-staging', syncedOnline: true,
      updatedAt: row.atualizado_em || row.criado_em || null
    };
  }
  var fileRules = Object.freeze({
    epub: { max: 25 * 1024 * 1024, types: ['application/epub+zip', 'application/octet-stream'] },
    cover: { max: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
    avatar: { max: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
    'club-photo': { max: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
    receipt: { max: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] }
  });
  var fileCategories = Object.freeze({
    epub: 'epub', capa: 'cover', cover: 'cover', avatar: 'avatar',
    'foto-encontro': 'club-photo', 'club-photo': 'club-photo',
    comprovante: 'receipt', receipt: 'receipt'
  });
  function validateFile(file, category) {
    var normalized = fileCategories[String(category || '').toLowerCase()];
    if (!normalized || !file || typeof file.size !== 'number') {
      throw new TypeError('Arquivo ou categoria inválida.');
    }
    var rule = fileRules[normalized], mime = String(file.type || 'application/octet-stream').toLowerCase();
    if (file.size < 1 || file.size > rule.max) throw new RangeError('Tamanho do arquivo fora do limite permitido.');
    if (rule.types.indexOf(mime) === -1) throw new TypeError('Tipo de arquivo não permitido.');
    return normalized;
  }

  var api = Object.freeze({
    version: '0.2.0-staging',
    request: request,
    me: function () { return request('/api/v1/me'); },
    library: Object.freeze({
      listPage: async function (options) {
        options = options || {};
        var query = new URLSearchParams();
        if (options.limit !== undefined) query.set('limit', String(options.limit));
        if (options.before && options.beforeId) {
          query.set('before', String(options.before));
          query.set('before_id', String(options.beforeId));
        }
        var suffix = query.toString();
        var result = await request('/api/v1/library/books' + (suffix ? '?' + suffix : ''));
        return { items: (result && result.items || []).map(fromApiBook), count: Number(result && result.count) || 0, limit: Number(result && result.limit) || 0, nextCursor: result && result.nextCursor || null };
      },
      list: async function () {
        var page = await api.library.listPage();
        return page.items;
      },
      get: async function (bookId) {
        var result = await request('/api/v1/library/books/' + id(bookId));
        return fromApiBook(result && result.book);
      },
      create: async function (book) {
        var result = await request('/api/v1/library/books', { method: 'POST', body: toApiBook(book) });
        return fromApiBook(result && result.book);
      },
      update: async function (bookId, patch) {
        var result = await request('/api/v1/library/books/' + id(bookId), { method: 'PATCH', body: toApiBookPatch(patch) });
        return fromApiBook(result && result.book);
      },
      deactivate: function (bookId) {
        return request('/api/v1/library/books/' + id(bookId), { method: 'DELETE' });
      },
      listFiles: async function (bookId) {
        var result = await request('/api/v1/library/books/' + id(bookId) + '/assets');
        return result && result.items || [];
      },
      attachFile: function (bookId, fileId, role) {
        if (role !== 'epub' && role !== 'cover') throw new TypeError('Função do arquivo inválida.');
        return request('/api/v1/library/books/' + id(bookId) + '/assets', {
          method: 'POST', body: { file_id: String(fileId), role: role }
        });
      }
    }),
    reading: Object.freeze({
      list: function () { return request('/api/v1/reading'); },
      save: function (book) {
        book = book || {};
        return request('/api/v1/reading', { method: 'POST', body: {
          book_id: book.onlinePersonalId || book.id,
          current_page: book.currentPage || book.readerPage || 0,
          epub_cfi: book.epubCfi || ''
        }});
      }
    }),
    clubCurrent: Object.freeze({
      get: async function () {
        var result = await request('/api/v1/club/current-book');
        return result && result.book || null;
      }
    }),
    clubLibrary: Object.freeze({
      listBooks: async function (options) {
        options = options || {};
        var query = new URLSearchParams();
        if (options.limit !== undefined) query.set('limit', String(options.limit));
        var suffix = query.toString();
        var result = await request('/api/v1/club/library/books' + (suffix ? '?' + suffix : ''));
        return result && result.items || [];
      },
      getBook: async function (bookId) {
        var result = await request('/api/v1/club/library/books/' + id(bookId));
        return result && result.book || null;
      }
    }),
    clubAlbums: Object.freeze({
      list: async function (options) {
        options = options || {};
        var query = new URLSearchParams();
        if (options.limit !== undefined) query.set('limit', String(options.limit));
        var suffix = query.toString();
        var result = await request('/api/v1/club/albums' + (suffix ? '?' + suffix : ''));
        return result && result.items || [];
      },
      create: function (album) {
        album = album || {};
        return request('/api/v1/club/albums', { method: 'POST', body: {
          name: album.name, meeting_date: album.meetingDate || '',
          location: album.location || '', book_title: album.bookTitle || '',
          book_author: album.bookAuthor || '', cover_url: album.coverUrl || '',
          dynamics: album.dynamics || ''
        } });
      },
      update: function (albumId, album) {
        if (!albumId) throw new TypeError('ID do álbum obrigatório.');
        album = album || {};
        var body = {};
        if (album.name !== undefined) body.name = album.name;
        if (album.meetingDate !== undefined) body.meeting_date = album.meetingDate;
        if (album.location !== undefined) body.location = album.location;
        if (album.bookTitle !== undefined) body.book_title = album.bookTitle;
        if (album.bookAuthor !== undefined) body.book_author = album.bookAuthor;
        if (album.coverUrl !== undefined) body.cover_url = album.coverUrl;
        if (album.dynamics !== undefined) body.dynamics = album.dynamics;
        if (album.locked !== undefined) body.locked = !!album.locked;
        if (album.active !== undefined) body.active = !!album.active;
        return request('/api/v1/club/albums/' + id(albumId), { method: 'PATCH', body: body });
      },
      listPhotos: async function (albumId, options) {
        if (!albumId || !String(albumId).trim()) throw new TypeError('Identificador do álbum obrigatório.');
        options = options || {};
        var query = new URLSearchParams({ album_id: String(albumId) });
        if (options.limit !== undefined) query.set('limit', String(options.limit));
        var result = await request('/api/v1/club/albums/photos?' + query.toString());
        var items = (result && result.items || []).map(function (photo) {
          if (photo && photo.origem_arquivo === 'r2-private-v1') {
            photo.image_endpoint = '/api/v1/club/albums/photos/' + id(photo.id) + '/content';
          }
          return photo;
        });
        return { items: items, locked: !!(result && result.locked), albumId: String(albumId) };
      },
      addPhoto: async function (albumId, file) {
        if (!albumId || !String(albumId).trim()) throw new TypeError('Identificador do álbum obrigatório.');
        var uploaded = await api.files.upload(file, 'club-photo');
        var fileId = uploaded && uploaded.file && uploaded.file.id;
        if (!fileId) throw new Error('O upload não retornou o identificador do arquivo.');
        try {
          return await request('/api/v1/club/albums/photos', {
            method: 'POST', body: { album_id: String(albumId), file_id: String(fileId) }
          });
        } catch (error) {
          error.uploadedFileId = String(fileId);
          throw error;
        }
      },
      downloadPhoto: async function (photoId) {
        var photoKey = id(photoId);
        var headers = new Headers({ Authorization: 'Bearer ' + await token() });
        var response = await fetch(BASE + '/api/v1/club/albums/photos/' + photoKey + '/content', {
          method: 'GET', headers: headers, cache: 'no-store', credentials: 'omit'
        });
        if (!response.ok) {
          var message = 'Falha ao baixar foto (HTTP ' + response.status + ').';
          try { var data = await response.json(); message = data.error || message; } catch (_) {}
          var error = new Error(message); error.status = response.status; throw error;
        }
        return response.blob();
      },
      removePhoto: function (photoId) {
        return request('/api/v1/club/albums/photos/' + id(photoId), { method: 'DELETE' });
      }
    }),
    club: Object.freeze({
      submitFinishRequest: function (cycleId) {
        if (!cycleId || !String(cycleId).trim()) throw new TypeError('Identificador do ciclo obrigatório.');
        return request('/api/v1/club/finish-request', { method: 'POST', body: { cycle_id: String(cycleId).trim() } });
      }
    }),
    admin: Object.freeze({
      listRequests: function (options) {
        options = options || {};
        var query = new URLSearchParams();
        if (options.status) query.set('status', String(options.status));
        if (options.limit) query.set('limit', String(options.limit));
        var suffix = query.toString();
        return request('/api/v1/admin/requests' + (suffix ? '?' + suffix : ''));
      },
      rejectRequest: function (requestId, reason) {
        if (!requestId) throw new TypeError('ID da solicitação obrigatório.');
        return request('/api/v1/admin/requests/reject', { method: 'POST', body: { request_id: String(requestId), reason: String(reason || '') } });
      },
      approveBookFinish: function (requestId, reason) {
        if (!requestId) throw new TypeError('ID da solicitação obrigatório.');
        return request('/api/v1/admin/requests/approve-book-finish', { method: 'POST', body: { request_id: String(requestId), reason: String(reason || '') } });
      },
      approveClubFinish: function (requestId, reason) {
        if (!requestId) throw new TypeError('ID da solicitação obrigatório.');
        return request('/api/v1/admin/requests/approve-club-finish', { method: 'POST', body: { request_id: String(requestId), reason: String(reason || '') } });
      }
    }),
    chat: Object.freeze({
      list: async function (options) {
        options = options || {};
        var query = new URLSearchParams();
        if (options.limit !== undefined) query.set('limit', String(options.limit));
        var suffix = query.toString();
        var result = await request('/api/v1/chat/messages' + (suffix ? '?' + suffix : ''));
        return { items: result && result.items || [], reactions: result && result.reactions || [], count: Number(result && result.count) || 0 };
      },
      send: function (message, reply) {
        if (typeof message !== 'string' || !message.trim()) throw new TypeError('Mensagem obrigatória.');
        return request('/api/v1/chat/messages', { method: 'POST', body: { message: message, reply: reply || null } });
      },
      edit: function (messageId, message) {
        if (typeof message !== 'string' || !message.trim()) throw new TypeError('Mensagem obrigatória.');
        return request('/api/v1/chat/messages/' + id(messageId), { method: 'PATCH', body: { message: message } });
      },
      remove: function (messageId) {
        return request('/api/v1/chat/messages/' + id(messageId), { method: 'DELETE' });
      },
      setReaction: function (messageId, emoji) {
        if (typeof emoji !== 'string' || !emoji.trim()) throw new TypeError('Emoji obrigatório.');
        return request('/api/v1/chat/messages/' + id(messageId) + '/reaction', { method: 'PUT', body: { emoji: emoji } });
      },
      removeReaction: function (messageId) {
        return request('/api/v1/chat/messages/' + id(messageId) + '/reaction', { method: 'DELETE' });
      }
    }),
    notifications: Object.freeze({
      list: function (options) {
        options = options || {};
        var query = new URLSearchParams();
        if (options.limit !== undefined) query.set('limit', String(options.limit));
        var suffix = query.toString();
        return request('/api/v1/notifications' + (suffix ? '?' + suffix : ''));
      },
      markRead: function (notificationId) {
        return request('/api/v1/notifications/' + id(notificationId) + '/read', { method: 'POST' });
      },
      hide: function (notificationId) {
        return request('/api/v1/notifications/' + id(notificationId) + '/hide', { method: 'POST' });
      }
    }),
    goals: Object.freeze({ list: function () { return request('/api/v1/goals'); } }),
    progress: Object.freeze({
      monthly: function (period) {
        if (typeof period !== 'string' || !/^[0-9]{4}-[0-9]{2}$/.test(period) || Number.isNaN(Date.parse(period + '-01T00:00:00Z')) || new Date(period + '-01T00:00:00Z').toISOString().slice(0, 7) !== period) throw new TypeError('Período mensal inválido.');
        return request('/api/v1/progress/monthly?period=' + encodeURIComponent(period));
      }
    }),
    rewards: Object.freeze({
      awardPeriodGoal: function (kind, periodKey, current, target, xp, points) {
        if (kind !== 'weekly' && kind !== 'monthly') throw new TypeError('Tipo de meta periódica inválido.');
        if (typeof periodKey !== 'string') throw new TypeError('Período obrigatório.');
        if (kind === 'weekly' && (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(periodKey) || Number.isNaN(Date.parse(periodKey + 'T00:00:00Z')) || new Date(periodKey + 'T00:00:00Z').toISOString().slice(0, 10) !== periodKey)) throw new TypeError('Período semanal inválido.');
        if (kind === 'monthly' && (!/^[0-9]{4}-[0-9]{2}$/.test(periodKey) || Number.isNaN(Date.parse(periodKey + '-01T00:00:00Z')) || new Date(periodKey + '-01T00:00:00Z').toISOString().slice(0, 7) !== periodKey)) throw new TypeError('Período mensal inválido.');
        [current, target, xp, points].forEach(function (value) {
          if (value !== undefined && value !== null && !Number.isFinite(Number(value))) throw new TypeError('Valores da meta precisam ser numéricos.');
        });
        return request('/api/v1/rewards/period', { method: 'POST', body: {
          kind: kind, period_key: periodKey, current: Number(current || 0),
          target: Number(target || 0), xp: Number(xp || 0), points: Number(points || 0)
        } });
      },
      awardDailyEpub: function (date) {
        if (typeof date !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw new TypeError('Data inválida.');
        return request('/api/v1/rewards/daily-epub', { method: 'POST', body: { date: date } });
      }
    }),
    files: Object.freeze({
      validate: validateFile,
      upload: function (file, category, albumId) {
        var normalized = validateFile(file, category);
        var form = new FormData();
        form.append("file", file);
        form.append("tipo", normalized);
        if (albumId) form.append("albumId", String(albumId));
        return request("/api/v1/files/upload", { method: "POST", body: form });
      },
      download: async function (fileId) {
        var headers = new Headers({ Authorization: "Bearer " + await token() });
        var response = await fetch(BASE + "/api/v1/files/" + id(fileId), {
          method: "GET", headers: headers, cache: "no-store", credentials: "omit"
        });
        if (!response.ok) {
          var message = "Falha ao baixar arquivo (HTTP " + response.status + ").";
          try { var data = await response.json(); message = data.error || message; } catch (_) {}
          var error = new Error(message); error.status = response.status; throw error;
        }
        return response.blob();
      },
      remove: function (fileId) {
        return request("/api/v1/files/" + id(fileId), { method: "DELETE" });
      }
    }),
    challenges: Object.freeze({ list: function () { return request("/api/v1/challenges"); } }),
    mapping: Object.freeze({ toApiBook: toApiBook, toApiBookPatch: toApiBookPatch, fromApiBook: fromApiBook }),
    fileRules: fileRules
  });
  Object.defineProperty(root, 'EntreLinhasCloudflare', {
    value: api, configurable: false, enumerable: false, writable: false
  });
})(window);
