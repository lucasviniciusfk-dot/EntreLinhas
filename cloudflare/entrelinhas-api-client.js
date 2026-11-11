/* Entre Linhas — Cloudflare API client (staging)
 * Auth remains Supabase Auth; application data requests go to the Worker.
 * This module is opt-in and does not monkey-patch fetch or Supabase.
 */
(function (root) {
  "use strict";

  const DEFAULT_API = "https://entrelinhas-api-staging.lucasviniciusk.workers.dev";

  function createEntreLinhasApi(options) {
    const config = options || {};
    const apiBase = String(config.apiBase || DEFAULT_API).replace(/\/+$/, "");
    const getAccessToken = typeof config.getAccessToken === "function"
      ? config.getAccessToken
      : async function () {
          const client = root.entSupabaseClient || root.supabaseClient;
          if (!client || !client.auth || typeof client.auth.getSession !== "function") {
            throw new Error("Sessão do Supabase Auth indisponível.");
          }
          const result = await client.auth.getSession();
          const session = result && result.data && result.data.session;
          if (result && result.error) throw result.error;
          if (!session || !session.access_token) throw new Error("Faça login novamente.");
          return session.access_token;
        };

    async function request(path, init) {
      const token = await getAccessToken();
      const headers = new Headers((init && init.headers) || {});
      headers.set("Authorization", "Bearer " + token);
      if (init && init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      const response = await fetch(apiBase + path, Object.assign({}, init || {}, { headers }));
      let payload;
      try { payload = await response.json(); }
      catch (_) { throw new Error("A API do Entre Linhas retornou uma resposta inválida (HTTP " + response.status + ")."); }
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || ("Falha na API (HTTP " + response.status + ")."));
      }
      return payload;
    }

    return Object.freeze({
      getMe: function () {
        return request("/api/v1/me", { method: "GET" });
      },
      updateMe: function (profile) {
        if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
          return Promise.reject(new TypeError("Informe os campos do perfil."));
        }
        return request("/api/v1/me", {
          method: "PATCH",
          body: JSON.stringify(profile)
        });
      }
    });
  }

  root.EntreLinhasCloudflareApi = Object.freeze({ create: createEntreLinhasApi });
})(typeof window !== "undefined" ? window : globalThis);
