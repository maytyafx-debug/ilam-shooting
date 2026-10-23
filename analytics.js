'use strict';

/*
 * Privacy-friendly page-view counter.
 * - No cookies, no IP storage, no personal identifiers.
 * - Sends one anonymous count per page per browser session.
 * - Disabled until SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are set.
 */
(function () {
  const CONFIG = {
    SUPABASE_URL: 'https://pphizckfdlqeveigkkqp.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_CY9hwHe0MdKKu7Ij48U1hA_jP-dl_vY'
  };

  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) return;
  if (navigator.doNotTrack === '1') return;

  const path = (location.pathname || '/').slice(0, 200);
  const sessionKey = 'pv:' + path;

  try {
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
  } catch (e) {
    // Storage may be blocked; still count the view.
  }

  fetch(CONFIG.SUPABASE_URL + '/rest/v1/rpc/record_pageview', {
    method: 'POST',
    headers: {
      'apikey': CONFIG.SUPABASE_PUBLISHABLE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_path: path }),
    keepalive: true
  }).catch(function () { /* analytics must never break the page */ });
})();
