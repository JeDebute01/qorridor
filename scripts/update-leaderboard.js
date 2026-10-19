// Met à jour leaderboard.json à partir des résultats publiés sur le relais ntfy.sh.
// Une victoire n'est comptée que si les DEUX joueurs d'une partie envoient des résultats
// concordants (l'un gagnant, l'autre perdant). Chaque partie n'est comptée qu'une fois.
'use strict';
const fs = require('fs');
const path = require('path');

const RELAY = process.env.QUORIDOR_RELAY || 'https://ntfy.sh';
const TOPIC = 'quoridorlb-resultats-v1';
const FILE = path.join(__dirname, '..', 'leaderboard.json');
const GID = /^g[a-z0-9]{8,40}$/;
const PID = /^p[a-z0-9]{8,40}$/;
const nickOk = (n) => typeof n === 'string' && n.trim().length >= 2 && n.trim().length <= 20 && !/^joueur(\s|$)/i.test(n.trim());

function parseReports(lines) {
  const out = [];
  for (const raw of lines) {
    let m;
    try {
      const j = JSON.parse(raw);
      if (j.event !== 'message') continue;
      m = JSON.parse(j.message);
    } catch { continue; }
    if (!m || m.k !== 'res') continue;
    const gid = String(m.gid || ''), pid = String(m.pid || ''), name = String(m.name || '').trim().slice(0, 20);
    if (!GID.test(gid) || !PID.test(pid) || !nickOk(name)) continue;
    if ((m.won !== 0 && m.won !== 1) || !(m.plies >= 8)) continue;
    out.push({ gid, pid, name, won: m.won, t: Number(m.t) || 0 });
  }
  return out;
}

function merge(db, reports) {
  const counted = new Set(db.counted);
  const byGame = new Map();
  for (const r of reports) {
    if (counted.has(r.gid)) continue;
    if (!byGame.has(r.gid)) byGame.set(r.gid, new Map());
    const g = byGame.get(r.gid);
    if (!g.has(r.pid)) g.set(r.pid, r); // un seul résultat par joueur et par partie
  }
  for (const [gid, g] of byGame) {
    if (g.size !== 2) continue;
    const [a, b] = [...g.values()];
    if (a.won === b.won) continue;
    for (const r of [a, b]) {
      const p = db.players[r.pid] || { name: r.name, wins: 0, games: 0 };
      p.name = r.name; p.wins += r.won; p.games += 1;
      db.players[r.pid] = p;
    }
    db.counted.push(gid);
  }
  db.counted = db.counted.slice(-5000);
  return db;
}

async function main() {
  const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { players: {}, counted: [], updated: 0 };
  db.players = db.players || {}; db.counted = db.counted || [];
  const res = await fetch(`${RELAY}/${TOPIC}/json?poll=1&since=all`);
  if (!res.ok) throw new Error('Relais : HTTP ' + res.status);
  const text = await res.text();
  const before = JSON.stringify({ p: db.players, c: db.counted });
  merge(db, parseReports(text.split('\n').filter(Boolean)));
  if (JSON.stringify({ p: db.players, c: db.counted }) === before) { console.log('Aucun changement.'); return; }
  db.updated = Date.now();
  fs.writeFileSync(FILE, JSON.stringify(db, null, 1) + '\n');
  console.log('Classement mis à jour :', Object.keys(db.players).length, 'joueurs.');
}

module.exports = { parseReports, merge };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
