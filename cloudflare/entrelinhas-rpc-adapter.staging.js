/* Entre Linhas — adaptador RPC Supabase -> Cloudflare Worker (staging)
 * Não altera auth nem intercepta fetch global. Instale somente no build de staging.
 * Operações sem rota compatível permanecem no Supabase por segurança.
 */
(function (global) {
  'use strict';
  const DEFAULT_API = 'https://entrelinhas-api-staging.lucasviniciusk.workers.dev';

  function installCloudflareRpcAdapter(client, options) {
    if (!client || typeof client.rpc !== 'function' || !client.auth) {
      throw new Error('Cliente Supabase inválido para o adaptador Entre Linhas.');
    }
    if (client.__entrelinhasCloudflareRpcInstalled) return client;
    const api = String((options && options.apiBase) || DEFAULT_API).replace(/\/$/, '');
    const originalRpc = client.rpc.bind(client);
    const mapped = new Set([
      'entrel_verified_monthly_progress_v512',
      'entrel_award_period_goal_v507',
      'entrel_award_daily_epub_v507',
      'entrel_reject_request_v507',
      'entrel_approve_finish_request_v508',
      'entrel_approve_club_finish_v507',
      'entrel_approve_club_finish_v509',
      'entrel_approve_club_finish_v511',
      'entrel_submit_club_finish_v509',
      'entrel_submit_club_finish_v511'
    ]);

    async function call(path, method, body) {
      const sessionResult = await client.auth.getSession();
      const token = sessionResult && sessionResult.data && sessionResult.data.session &&
        sessionResult.data.session.access_token;
      if (!token) return { data: null, error: { message: 'Sessão não autenticada.' } };
      const response = await fetch(api + path, {
        method: method || 'POST',
        headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
      });
      let data = null;
      const type = response.headers.get('content-type') || '';
      if (type.includes('application/json')) data = await response.json();
      else data = await response.text();
      if (!response.ok) return { data: null, error: { message: data && data.error || 'Worker respondeu HTTP ' + response.status, status: response.status, details: data } };
      return { data, error: null };
    }

    client.rpc = function (name, args) {
      const a = args || {};
      switch (name) {
        case 'entrel_verified_monthly_progress_v512':
          return call('/api/v1/progress/monthly?period=' + encodeURIComponent(a.p_period_key || ''), 'GET');
        case 'entrel_award_period_goal_v507':
          return call('/api/v1/rewards/period', 'POST', {
            kind: a.p_kind, period_key: a.p_period_key, current: a.p_current,
            target: a.p_target, xp: a.p_xp, points: a.p_points
          });
        case 'entrel_award_daily_epub_v507':
          return call('/api/v1/rewards/daily-epub', 'POST', { date: a.p_date });
        case 'entrel_reject_request_v507':
          return call('/api/v1/admin/requests/reject', 'POST', {
            request_id: a.p_request_id, reason: a.p_reason
          });
        case 'entrel_approve_finish_request_v508':
          return call('/api/v1/admin/requests/approve-book-finish', 'POST', {
            request_id: a.p_request_id, reason: a.p_reason
          });
        case 'entrel_approve_club_finish_v507':
        case 'entrel_approve_club_finish_v509':
        case 'entrel_approve_club_finish_v511':
          return call('/api/v1/admin/requests/approve-club-finish', 'POST', {
            request_id: a.p_request_id, reason: a.p_reason
          });
        case 'entrel_submit_club_finish_v509':
          return call('/api/v1/club/finish-request', 'POST', {
            cycle_id: global.__ENTREL_ACTIVE_CLUB_CYCLE_ID__ || ''
          });
        case 'entrel_submit_club_finish_v511':
          return call('/api/v1/club/finish-request', 'POST', { cycle_id: a.p_cycle_id });
        default:
          return originalRpc(name, args);
      }
    };
    Object.defineProperty(client, '__entrelinhasCloudflareRpcInstalled', { value: true });
    Object.defineProperty(client, '__entrelinhasCloudflareRpcMapped', { value: mapped });
    return client;
  }

  global.installEntreLinhasCloudflareRpcAdapter = installCloudflareRpcAdapter;
})(window);
