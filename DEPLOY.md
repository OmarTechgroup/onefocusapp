# Déploiement

OneFocus est un process Node unique (Express) qui sert aussi les fichiers statiques du client buildé (`client/dist`) — donc les deux chemins de déploiement ci-dessous partent du même artefact, juste packagés différemment.

## Option A — VPS avec Docker + CI/CD (GitHub Actions)

### Prérequis sur le VPS
- Docker + Docker Compose plugin installés
- Un répertoire de déploiement, ex. `/opt/onefocusapp`

### Mise en place initiale (une fois)

1. Sur le VPS :
   ```bash
   mkdir -p /opt/onefocusapp && cd /opt/onefocusapp
   ```
2. Copie `docker-compose.yml` (une première fois manuellement — ensuite le pipeline le resynchronise automatiquement à chaque déploiement, voir plus bas) et `.env` (rempli à partir de `.env.example`) dans ce dossier. `.env` reste sur le serveur, jamais commité, et n'est **pas** synchronisé par le pipeline.
3. `docker-compose.yml` pointe vers `ghcr.io/omartechgroup/onefocusapp:latest` — nom fixe (owner/onefocusapp), pas dérivé du nom du repo, car un nom d'image Docker ne peut pas commencer par un caractère spécial (le nom du repo GitHub commence par `-`). **Ce nom doit rester identique** à celui calculé dans `.github/workflows/deploy.yml` (étape "Compute image name").
4. Si tu utilises `firebase-admin` via fichier de clé plutôt que la variable `FIREBASE_SERVICE_ACCOUNT_JSON`, monte-le en volume :
   ```yaml
   volumes:
     - onefocus_data:/app/data
     - ./serviceAccountKey.json:/app/server/fcm/serviceAccountKey.json:ro
   ```
5. **Rends le package GHCR public** — sinon `docker compose pull` sur le VPS échoue avec `error from registry: denied` (les packages GHCR sont privés par défaut, et l'image ne contient pas de secrets : les clés/env sont injectées via `.env` au runtime, jamais buildées dedans) :
   GitHub → onglet **Packages** → `onefocusapp` → **Package settings** → **Danger Zone** → **Change visibility** → **Public**.
   (Alternative si tu préfères le garder privé : authentifier le VPS avec `echo $GHCR_TOKEN | docker login ghcr.io -u <user> --password-stdin`, `$GHCR_TOKEN` étant un Personal Access Token avec le scope `read:packages`.)
6. Premier démarrage manuel :
   ```bash
   docker compose pull && docker compose up -d
   docker compose exec app node server/db/init.js   # optionnel : données de démo
   ```

### Synchronisation automatique

Depuis `deploy.yml`, chaque déploiement recopie `docker-compose.yml` du repo vers le VPS (via `appleboy/scp-action`) avant `docker compose pull && up -d`. Donc toute modif de `docker-compose.yml` (nom d'image, volumes, ports…) poussée sur `main` est appliquée automatiquement au prochain déploiement — plus besoin de la recopier à la main après la mise en place initiale.

### Secrets GitHub à configurer (Settings → Secrets and variables → Actions)

| Secret | Description |
|---|---|
| `VPS_HOST` | IP ou domaine du VPS |
| `VPS_USER` | utilisateur SSH (avec accès Docker) |
| `VPS_SSH_KEY` | clé privée SSH correspondante |
| `VPS_PORT` | (optionnel) port SSH, 22 par défaut |
| `VPS_PATH` | (optionnel) chemin du dossier de déploiement, `/opt/onefocusapp` par défaut |

`GITHUB_TOKEN` (fourni automatiquement par Actions) suffit pour pousser l'image sur GHCR — aucun secret supplémentaire requis pour le registre.

### Pipeline

- **`.github/workflows/ci.yml`** — sur chaque push/PR : installe les dépendances serveur + client, lance les tests serveur, vérifie que le client build sans erreur.
- **`.github/workflows/deploy.yml`** — après un CI réussi sur `main` : build l'image Docker, la pousse sur `ghcr.io/<owner>/onefocusapp`, resynchronise `docker-compose.yml` sur le VPS, puis se connecte en SSH pour `docker compose pull && docker compose up -d`.

### Build/test local avant de pousser

```bash
docker compose up --build
curl http://localhost:3900/api/health
```

### Persistance des données

La base SQLite vit dans le volume nommé `onefocus_data` (chemin `/app/data/onefocus.db` dans le conteneur, configurable via `DB_PATH`). Elle survit aux redéploiements/`docker compose pull`.

---

## Option B — o2switch (mutualisé, sans Docker)

o2switch propose un "Setup Node.js App" (cPanel) basé sur Passenger — pas d'accès Docker, donc ce chemin reste indépendant du pipeline ci-dessus.

1. **Builder le client en local** (o2switch ne lance pas Vite) :
   ```bash
   npm run build --prefix client
   ```
2. Uploader tout le repo (avec `client/dist/` généré) sur o2switch, hors `node_modules` et `data/`.
3. Dans cPanel → **Setup Node.js App** :
   - **Application root** : le dossier racine du projet (celui contenant `server/`)
   - **Application startup file** : `server/index.js`
   - **Node.js version** : ≥ 22.5 (requis par `node:sqlite`, voir `server/db/index.js`) — si non disponible sur o2switch, il faudra remplacer cette dépendance par `better-sqlite3` (compilation native, voir commentaire dans `server/db/index.js`)
4. Renseigner les variables d'environnement via l'interface cPanel (mêmes clés que `.env.example`), **plus** `NODE_OPTIONS=--experimental-sqlite` — Passenger lance `server/index.js` directement sans passer par `npm start`, donc c'est la seule façon de faire passer ce flag sans pouvoir éditer la commande de démarrage (`node:sqlite`, utilisé par `server/db/index.js`, l'exige sur Node 22.x).
5. Lancer `npm install` (bouton cPanel, ou terminal) — uniquement les dépendances racine (serveur), le client est déjà buildé en statique.
6. `node server/db/init.js` une fois pour créer/peupler la base (ou laisser `db.migrate()` créer le schéma vide au premier démarrage).
7. Démarrer/redémarrer l'app depuis cPanel.

Le serveur sert automatiquement `client/dist/` via `express.static` (voir `server/index.js`) — même artefact que celui packagé dans l'image Docker.

### Limite connue

`server/db/index.js` utilise `node:sqlite`, expérimental et disponible seulement à partir de Node 22.5+. Vérifie la version Node proposée par o2switch avant de déployer ; si elle est trop ancienne, c'est le seul point à adapter (migration vers `better-sqlite3`, qui nécessite un compilateur C++ — généralement indisponible en mutualisé, donc à tester au cas par cas).
