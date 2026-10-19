# API du classement Quoridor (Cloudflare Worker + base SQLite D1)

Gratuit (offre Cloudflare Workers + D1), sans carte bancaire. Une victoire n'est comptée que si les deux joueurs de la partie envoient des résultats concordants.

## Déploiement

Il faut Node.js et un compte Cloudflare gratuit (https://dash.cloudflare.com/sign-up).

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler d1 create quoridor          # note le database_id affiché
```

Colle ce `database_id` dans `wrangler.toml` (à la place de `REMPLACE-PAR-TON-DATABASE-ID`), puis :

```bash
wrangler d1 execute quoridor --remote --file=schema.sql
wrangler deploy
```

`wrangler deploy` affiche l'adresse du Worker, du type `https://quoridor-classement.TON-COMPTE.workers.dev`.

## Brancher le jeu

Dans `index.html`, remplace la ligne `var LB_API='';` par :

```js
var LB_API='https://quoridor-classement.TON-COMPTE.workers.dev';
```

Sans adresse, le jeu utilise le relais public ntfy.sh (classement gardé 12 heures seulement).

## Routes

- `GET /api/leaderboard` : les 50 meilleurs joueurs.
- `POST /api/result` : `{gid, pid, name, won, plies}`, envoyé par chaque joueur en fin de partie.
