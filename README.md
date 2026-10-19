# Quoridor

Jeu de Quoridor en une seule page (`index.html`) : solo contre l'IA, à deux sur le même écran, ou en ligne avec un lien.

- **En ligne** : les parties passent par le relais public ntfy.sh, sans compte.
- **Classement** : chaque joueur envoie son résultat en fin de partie. Le workflow `.github/workflows/classement.yml` (toutes les 30 minutes) lit ces résultats avec `scripts/update-leaderboard.js` et met à jour `leaderboard.json`, qui sert de petite base de données. Une victoire n'est comptée que si les deux joueurs envoient des résultats concordants.
- **Option** : `worker/` contient une API SQLite (Cloudflare Workers + D1), si tu préfères une vraie base. Voir `worker/README.md`.
