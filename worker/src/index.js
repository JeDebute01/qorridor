// API du classement Quoridor : Cloudflare Worker + base D1 (SQLite).
// Une victoire n'est comptée que lorsque les DEUX joueurs d'une même partie
// envoient un résultat concordant (l'un gagnant, l'autre perdant).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const GID = /^g[a-z0-9]{8,40}$/;
const PID = /^p[a-z0-9]{8,40}$/;
const nickOk = (n) => typeof n === 'string' && n.trim().length >= 2 && n.trim().length <= 20 && !/^joueur(\s|$)/i.test(n.trim());

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT pid, name, wins, games FROM players WHERE games > 0 ORDER BY wins DESC, games ASC, name ASC LIMIT 50'
      ).all();
      return json({ rows: results });
    }

    if (url.pathname === '/api/result' && request.method === 'POST') {
      let b;
      try { b = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const gid = String(b.gid || ''), pid = String(b.pid || ''), name = String(b.name || '').trim().slice(0, 20);
      const won = b.won ? 1 : 0, plies = b.plies | 0, now = Date.now();
      if (!GID.test(gid) || !PID.test(pid)) return json({ error: 'Identifiants invalides' }, 400);
      if (!nickOk(name)) return json({ error: 'Pseudo invalide' }, 400);
      if (plies < 8) return json({ error: 'Partie trop courte' }, 400);

      // Le pseudo suit toujours le dernier résultat envoyé par le joueur.
      await env.DB.prepare(
        'INSERT INTO players (pid, name, wins, games, updated) VALUES (?1, ?2, 0, 0, ?3) ' +
        'ON CONFLICT(pid) DO UPDATE SET name = ?2, updated = ?3'
      ).bind(pid, name, now).run();
      await env.DB.prepare('INSERT OR IGNORE INTO reports (gid, pid, won, plies, t) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(gid, pid, won, plies, now).run();

      const { results } = await env.DB.prepare('SELECT pid, won FROM reports WHERE gid = ?1').bind(gid).all();
      if (results.length === 2 && results[0].pid !== results[1].pid && results[0].won !== results[1].won) {
        // Une seule insertion réussit même si les deux joueurs arrivent en même temps.
        const ins = await env.DB.prepare('INSERT OR IGNORE INTO counted (gid, t) VALUES (?1, ?2)').bind(gid, now).run();
        if (ins.meta && ins.meta.changes === 1) {
          await env.DB.batch(results.map((r) =>
            env.DB.prepare('UPDATE players SET wins = wins + ?1, games = games + 1, updated = ?2 WHERE pid = ?3').bind(r.won, now, r.pid)
          ));
        }
        return json({ ok: true, counted: true });
      }
      return json({ ok: true, counted: false });
    }

    return json({ error: 'Introuvable' }, 404);
  },
};
