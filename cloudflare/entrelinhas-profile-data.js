/* One writer per account per page. Fallback is selected BEFORE a Cloudflare write. */
(function (root) {
  'use strict';
  function create(options) {
    const o = options || {}, states = new Map(), inFlight = new Map(), photos = new Map();
    const enabled = o.enabled === undefined ? new URLSearchParams(root.location.search).get('cf_profile') === '1' : o.enabled;
    const api = o.api || root.EntreLinhasCloudflareApi.create();
    function client() { return o.client || root.entSupabaseClient || root.supabaseClient; }
    async function identity(expected) {
      const r = await client().auth.getSession();
      if (r.error || !r.data || !r.data.session) throw new Error('Faça login novamente.');
      const uid = r.data.session.user.id;
      if (expected && String(expected) !== String(uid)) throw new Error('Você só pode alterar seu próprio perfil.');
      return uid;
    }
    async function decorate(p) {
      if (!p) throw new Error('Perfil não encontrado.');
      const row = Object.assign({}, p);
      if (/^cf-asset:/.test(row.foto_url || '')) {
        const key = row.foto_url.slice(9);
        if (!photos.has(key)) photos.set(key, root.URL.createObjectURL(await api.getFile(key)));
        row.foto_reference = row.foto_url; row.foto_url = photos.get(key);
      }
      return row;
    }
    async function readSupabase(uid) {
      const r = await client().from('usuarios').select('*').eq('id', uid).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) throw new Error('Perfil não encontrado.');
      return r.data;
    }
    async function load(expected, bootstrap) {
      const uid = await identity(expected), state = states.get(uid);
      if (!enabled || state === 'supabase') return readSupabase(uid);
      try {
        let r;
        try { r = await api.getMe(); } catch (e) {
          if (e.status === 404 && bootstrap) r = await api.bootstrapMe(); else throw e;
        }
        if (!r.ok || !r.profile || String(r.profile.id) !== String(uid)) throw new Error('Identidade do perfil não confirmada.');
        states.set(uid, 'cloudflare');
        return await decorate(r.profile);
      } catch (e) {
        // Never downgrade AUTH/403, malformed responses or an account already using D1.
        if (!state && states.get(uid) !== 'cloudflare' && (e.code === 'NETWORK' || [502,503,504].includes(e.status))) {
          const row = await readSupabase(uid); states.set(uid, 'supabase');
          root.__ENTREL_PROFILE_PROVIDER__ = 'supabase-fallback';
          return row;
        }
        throw e;
      }
    }
    async function save(expected, patch, file) {
      const uid = await identity(expected);
      if (inFlight.has(uid)) throw new Error('Aguarde a gravação do perfil em andamento.');
      const task = (async () => {
        if (enabled && !states.has(uid)) await load(uid, true);
        const fields = ['nome','bio','livro_favorito','foto_url','moldura_atual','perfil_privado','biblioteca_publica'];
        const body = Object.fromEntries(fields.filter(k => Object.hasOwn(patch, k)).map(k => [k, patch[k]]));
        const provider = enabled && states.get(uid) === 'cloudflare' ? 'cloudflare' : 'supabase';
        if (file && provider === 'cloudflare') {
          const r = await api.uploadFile(file, 'avatar');
          if (!r.ok || !r.file || !r.file.id) throw new Error('Upload da foto não confirmado.');
          body.foto_url = 'cf-asset:' + r.file.id;
        } else if (file) {
          if (typeof root.entrelUploadR2V118 !== 'function') throw new Error('Upload de foto indisponível.');
          body.foto_url = await root.entrelUploadR2V118(file, 'avatar', {userId:uid, fileName:'avatar_' + Date.now() + '.jpg', contentType:file.type});
        }
        let row;
        if (provider === 'cloudflare') {
          const r = await api.updateMe(body);
          if (!r.ok || !r.profile || String(r.profile.id) !== String(uid)) throw new Error('Gravação não confirmada. Recarregue o perfil.');
          row = await decorate(r.profile);
        } else {
          const r = await client().from('usuarios').update(body).eq('id', uid).select('*').single();
          if (r.error) throw r.error;
          if (!r.data) throw new Error('Gravação não confirmada.');
          row = r.data;
        }
        root.__ENTREL_PROFILE_PROVIDER__ = provider;
        return row;
      })();
      inFlight.set(uid, task);
      try { return await task; } finally { inFlight.delete(uid); }
    }
    return Object.freeze({enabled, load, save, provider:uid => states.get(uid) || (enabled ? 'pending' : 'supabase')});
  }
  root.EntreLinhasProfileData = Object.freeze({create});
  root.entrelProfileData = create();
})(typeof window !== 'undefined' ? window : globalThis);
