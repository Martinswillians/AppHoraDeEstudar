// Cloudflare Worker "horadeestudar" — entrega o servidor TURN (Metered Open Relay) ao app,
// sem expor a chave no código do site. Responde {"iceServers":[...]} só para o app do GitHub Pages.
//
// Variáveis do Worker (Settings > Variables and Secrets):
//   METERED_DOMAIN      (Text)   ex.: meuapp.metered.live   (aparece na página "Developers" do painel Metered)
//   METERED_API_KEY     (Secret) apiKey de uma credencial TURN criada no painel Metered   [recomendado]
//   METERED_SECRET_KEY  (Secret) alternativa: se não houver API Key, o Worker cria uma credencial de 4h sozinho
export default {
  async fetch(request, env) {
    const allowed = ['https://martinswillians.github.io'];
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Vary': 'Origin'
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj),
      { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!allowed.includes(origin)) return new Response('forbidden', { status: 403, headers: cors });
    if (!env.METERED_DOMAIN || !(env.METERED_API_KEY || env.METERED_SECRET_KEY))
      return json({ error: 'Worker sem METERED_DOMAIN e METERED_API_KEY/METERED_SECRET_KEY' }, 500);

    try {
      const base = 'https://' + env.METERED_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      let apiKey = env.METERED_API_KEY;
      if (!apiKey) {
        const c = await fetch(`${base}/api/v1/turn/credential?secretKey=${encodeURIComponent(env.METERED_SECRET_KEY)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiryInSeconds: 14400, label: 'sala' }) });
        apiKey = (await c.json()).apiKey;
      }
      const r = await fetch(`${base}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`);
      const data = await r.json();
      const iceServers = Array.isArray(data) ? data : data.iceServers;
      if (!r.ok || !Array.isArray(iceServers) || !iceServers.length)
        return json({ error: 'Metered não devolveu servidores', detail: data }, 502);
      return json({ iceServers });
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }
};
