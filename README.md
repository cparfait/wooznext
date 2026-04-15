# WoozNext

Outil open source de gestion de file d'attente physique pour collectivites (mairie, service public).

Le visiteur scanne un QR code, saisit son numero de telephone, et recoit un ticket numerique. L'agent appelle les visiteurs depuis une interface dediee. Un ecran public (Chromecast) affiche le numero en cours.

## Fonctionnalites

- **Vue Visiteur** (mobile-first) : prise de ticket par QR code, suivi en temps reel, son de notification, confetti quand c'est son tour
- **Vue Agent** : appel du suivant, appel manuel, rappel du visiteur, retour en file avec motif optionnel, marquage absent, ajout de ticket, cloture du guichet, changement de mot de passe
- **Retour en file** : lorsqu'un ticket est remis en file, l'agent peut saisir une raison. Les tickets remis en file sont priorises lors de l'appel suivant via un panneau de selection dedie
- **Vue Admin** : gestion des services (CRUD, prefixe, horaires, guichets, reinitialisation par service), agents (nom/prenom, service, role, anonymisation), statistiques filtrees avec export PDF/CSV, upload du logo, QR codes par service
- **Affichage Public** (Chromecast) : ticket en cours en grand format avec label guichet, bandeau lateral gauche "Appels precedents", flux d'actualites configurable avec images, message defilant urgent, flash + son a chaque appel
- **Roles** : ADMIN (gestion globale) et AGENT (operations file + administration de son propre service)
- **Presence agent** : liberation automatique du guichet a la deconnexion (support multi-onglets)
- **QR Code** : generation automatique par service via `/api/qrcode?serviceId=ID`
- **Temps reel** : Socket.IO pour toutes les mises a jour
- **RGPD** : purge automatique des donnees visiteurs apres 30 jours
- **Nettoyage minuit** : fermeture automatique des tickets ouverts en fin de journee

## Securite

- Mots de passe haches avec bcrypt (cout 12), minimum 12 caracteres avec majuscule, chiffre et caractere special
- Sessions JWT via NextAuth.js (cookie HttpOnly + SameSite=Strict)
- En-tetes HTTP de securite : CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Rate limiting sur la prise de ticket (anti-spam, 10 requetes/min par IP)
- Protection SSRF sur le flux d'actualites (HTTPS uniquement, blocage des IPs privees)
- Images du flux proxifiees cote serveur (CSP strict, contenu valide uniquement)
- Journalisation d'audit structuree (JSON) pour les actions sensibles
- PostgreSQL non expose sur le reseau public en production
- Purge RGPD automatique apres 30 jours

## Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Langage | TypeScript | 5.x |
| Style | Tailwind CSS | 3.x |
| Base de donnees | PostgreSQL | 16 |
| ORM | Prisma | 5.x |
| Temps reel | Socket.IO | 4.x |
| Authentification | NextAuth.js | 4.x |
| Hachage | bcryptjs | 2.x |
| QR Code | qrcode | 1.x |
| Validation | Zod | 3.x |
| Export PDF | jsPDF + jspdf-autotable | - |
| Tests E2E | Playwright | - |
| Conteneurs | Docker + Docker Compose | - |

## Installation locale

### Prerequis

| Outil | Windows | Linux |
|---|---|---|
| Docker | [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) | Docker Engine (voir ci-dessous) |
| Node.js | [Node.js 22 LTS](https://nodejs.org/) | nvm ou NodeSource (voir ci-dessous) |
| Git | [Git for Windows](https://git-scm.com/) | `sudo apt install git` |

---

### Installation sur Windows

> **Docker Desktop for Windows est requis.** Il fournit Docker et Docker Compose en un seul installeur et s'integre avec WSL2.

#### 1. Installer Docker Desktop

Telechargez et installez [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
Au premier lancement, activez le backend **WSL2** dans _Settings > General > Use the WSL 2 based engine_.

#### 2. Cloner le projet

```powershell
git clone https://github.com/cparfait/wooznext.git
cd wooznext
```

#### 3. Configurer les variables d'environnement

```powershell
copy .env.example .env
```

Editez `.env` :

```env
DATABASE_URL=postgresql://wooznext:wooznext_dev@localhost:5432/wooznext
NEXTAUTH_SECRET=votre_secret_ici
NEXTAUTH_URL=http://localhost:3000
```

Pour generer un secret securise :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 4. Demarrer la base de donnees

```powershell
docker compose -f docker-compose.dev.yml up -d
```

Verifiez que PostgreSQL tourne sur `localhost:5432` :

```powershell
docker compose -f docker-compose.dev.yml ps
```

#### 5. Installer les dependances et preparer la base

```powershell
npm install
npx prisma migrate dev
npm run db:seed
```

> **Important** : ne jamais laisser `npx prisma migrate dev` creer une migration locale non commitee. Si Prisma en propose une, verifiez qu'elle correspond a un vrai changement de schema avant de valider.

Apres un `git pull` qui modifie `prisma/schema.prisma`, pensez a :

```powershell
npx prisma generate
npx prisma migrate dev
```

Si vous obtenez une erreur SSL :

```powershell
set NODE_TLS_REJECT_UNAUTHORIZED=0
npx prisma migrate dev
set NODE_TLS_REJECT_UNAUTHORIZED=
```

#### 6. Lancer l'application

```powershell
npm run dev
```

L'application est accessible sur **http://localhost:3000**.

---

### Installation sur Linux

> **Docker Engine** (sans Docker Desktop) est suffisant sur Linux. La procedure ci-dessous est valable sur Ubuntu/Debian.

#### 1. Installer Docker Engine

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

Verifiez l'installation :

```bash
docker --version
docker compose version
```

#### 2. Installer Node.js 22 via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # ou source ~/.zshrc selon votre shell
nvm install 22
nvm use 22
```

#### 3. Cloner le projet

```bash
git clone https://github.com/cparfait/wooznext.git
cd wooznext
```

#### 4. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Editez `.env` :

```env
DATABASE_URL=postgresql://wooznext:wooznext_dev@localhost:5432/wooznext
NEXTAUTH_SECRET=votre_secret_ici
NEXTAUTH_URL=http://localhost:3000
```

Pour generer un secret securise :

```bash
openssl rand -base64 32
```

#### 5. Demarrer la base de donnees

```bash
docker compose -f docker-compose.dev.yml up -d
```

Verifiez que PostgreSQL tourne sur `localhost:5432` :

```bash
docker compose -f docker-compose.dev.yml ps
```

#### 6. Installer les dependances et preparer la base

```bash
npm install
npx prisma migrate dev
npm run db:seed
```

> **Important** : ne jamais laisser `npx prisma migrate dev` creer une migration locale non commitee. Si Prisma en propose une, verifiez qu'elle correspond a un vrai changement de schema avant de valider.

Apres un `git pull` qui modifie `prisma/schema.prisma`, pensez a :

```bash
npx prisma generate
npx prisma migrate dev
```

#### 7. Lancer l'application

```bash
npm run dev
```

L'application est accessible sur **http://localhost:3000**.

## Tester les interfaces

| Interface | URL | Acces |
|---|---|---|
| Visiteur | http://localhost:3000/?service=ID | Public (via QR code) |
| Connexion Agent | http://localhost:3000/agent/login | Public |
| Dashboard Agent | http://localhost:3000/agent | Apres connexion |
| Admin | http://localhost:3000/admin | Compte admin |
| Affichage Public | http://localhost:3000/display/SERVICE_ID | Public |
| QR Code (liste) | http://localhost:3000/api/qrcode | Public (JSON) |
| QR Code (SVG) | http://localhost:3000/api/qrcode?serviceId=ID | Public |

### Comptes de test

| Role | Email | Mot de passe | Service |
|---|---|---|---|
| Admin | admin@wooz.next | admin | - |
| Agent | agent1@wooz.next | agent | SUPPORT |
| Agent | agent2@wooz.next | agent | ACCUEIL |

> **Note** : les mots de passe de seed sont volontairement simples. En production, utilisez des mots de passe conformes a la politique (12 caracteres minimum, majuscule, chiffre, caractere special).

### Parcours de test recommande

1. **Admin** : connectez-vous sur http://localhost:3000/admin avec `admin@wooz.next` / `admin`. Les services SUPPORT et ACCUEIL sont deja crees. Cliquez "Liens / QR" sur un service pour obtenir l'URL visiteur.
2. **Visiteur** : ouvrez l'URL visiteur (avec `?service=ID`) sur votre telephone ou dans un onglet mobile. Saisissez un numero de telephone, prenez un ticket.
3. **Agent** : dans un autre onglet, connectez-vous sur http://localhost:3000/agent/login avec `agent1@wooz.next` / `agent`. Cliquez "Suivant" pour appeler le visiteur.
4. **Temps reel** : observez la mise a jour instantanee sur la vue visiteur (son + popup "C'est votre tour !").
5. **Affichage public** : ouvrez l'URL d'affichage (`/display/SERVICE_ID`) dans un troisieme onglet pour voir le ticket en cours et le bandeau des appels.

## Tests End-to-End (Playwright)

Les tests E2E couvrent les parcours critiques : connexion agent et prise de ticket visiteur.

### Prerequis

Les navigateurs Playwright doivent etre installes une seule fois sur la machine :

```bash
npx playwright install chromium --with-deps
```

> Les binaires (~300 Mo) sont telecharges dans le cache systeme (`~/.cache/ms-playwright/`). Rien n'est ajoute au depot git.

### Lancer les tests

La base de donnees doit etre demarree avant de lancer les tests. Playwright demarre le serveur Next.js automatiquement (ou reutilise celui deja en cours).

```bash
# 1. Demarrer PostgreSQL (si pas deja lance)
docker compose -f docker-compose.dev.yml up -d

# 2. Lancer les tests en mode terminal
npm run test:e2e

# 3. Ou en mode interactif (UI Playwright)
npm run test:e2e:ui
```

### Scenarios couverts

**Connexion agent** (`tests/login.spec.ts`) :
- Connexion valide (agent) → redirection vers `/agent`
- Connexion valide (admin) → redirection vers `/agent`
- Identifiants invalides → message d'erreur
- Session deja active → acces direct au dashboard

**Parcours visiteur** (`tests/prise-ticket.spec.ts`) :
- URL sans `?service=` → message d'erreur
- Service valide → formulaire visible
- Prise de ticket → redirection vers `/ticket/<id>`
- Anti-doublon → meme numero de telephone retourne le meme ticket

### Rapport HTML

Apres chaque execution, un rapport HTML est genere :

```bash
npx playwright show-report
```

## Deploiement en production (VPS)

### 1. Preparer le serveur

Installez Docker et Docker Compose sur votre VPS (Ubuntu/Debian) :

```bash
curl -fsSL https://get.docker.com | sh
```

### 2. Cloner et configurer

```bash
git clone https://github.com/cparfait/wooznext.git
cd wooznext
cp .env.example .env
```

Editez `.env` avec des valeurs de production :

```env
DATABASE_URL=postgresql://wooznext:MOT_DE_PASSE_FORT@db:5432/wooznext
DB_PASSWORD=MOT_DE_PASSE_FORT
NEXTAUTH_SECRET=secret_genere_avec_openssl
NEXTAUTH_URL=https://votre-domaine.fr
PHONE_PEPPER=pepper_genere_avec_openssl
```

> **Important** : `NEXTAUTH_URL` determine la base de toutes les URLs generees par l'application (QR codes, liens visiteur, liens affichage public). Utilisez votre nom de domaine ou votre IP publique.

### 3. Lancer

```bash
docker compose up -d --build
```

Cela demarre PostgreSQL + l'application. Les migrations s'appliquent automatiquement au demarrage via `npx prisma migrate deploy`.

L'application est configuree avec les optimisations production suivantes :
- Index de base de donnees optimises pour les requetes frequentes
- Arret propre (graceful shutdown) : les connexions Socket.IO et Prisma sont fermees proprement a l'arret du conteneur
- Limites de ressources Docker (512 Mo RAM, 1 CPU)
- Limite de 20 connexions Socket.IO par IP
- CORS Socket.IO restreint au domaine de production (`NEXTAUTH_URL`)
- En-tete `X-Powered-By` supprime
- Cache immutable sur les fichiers statiques (`/sounds/*`)
- CSP sans `unsafe-eval` en production

### 4. Verifier

```bash
docker compose ps          # Etat des conteneurs
docker compose logs -f app # Logs de l'application
```

L'application est accessible sur le port **3002**. Configurez un reverse proxy pour le HTTPS.

---

### Deploiement via Portainer

Si vous utilisez [Portainer](https://www.portainer.io/) pour gerer vos conteneurs :

#### Installer Portainer (si necessaire)

```bash
docker volume create portainer_data
docker run -d -p 8000:8000 -p 9443:9443 \
  --name portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Acces : `https://IP_DU_SERVEUR:9443`

#### Deployer WoozNext

1. Clonez le repo sur le serveur et preparez le `.env` :

```bash
git clone https://github.com/cparfait/wooznext.git
cd wooznext
cp .env.example .env
nano .env
```

2. Lancez l'application en SSH :

```bash
docker compose up -d --build
```

Portainer detectera automatiquement les conteneurs.

3. Ou via l'interface Portainer :
   - **Stacks** → **Add stack**
   - **Build method** : **Repository**
   - **Repository URL** : `https://github.com/cparfait/wooznext.git`
   - **Compose path** : `docker-compose.yml`
   - **Environment variables** : ajoutez les variables de votre `.env` (voir section 2 ci-dessus)
   - Cliquez **Deploy the stack**

#### Gerer depuis Portainer

| Action | Dans Portainer |
|---|---|
| Voir les logs | Conteneur `wooznext-app-1` → **Logs** |
| Acceder au shell | Conteneur → **Console** → `/bin/sh` |
| Redemarrer | Conteneur → **Restart** |
| Creer les comptes | **Console** → `npx tsx prisma/seed.ts` |
| Mettre a jour | SSH : `git pull && docker compose up -d --build` puis Portainer reflète le changement |

### Exemple avec Nginx Proxy Manager

1. Installez Nginx Proxy Manager sur le VPS :

```bash
docker run -d \
  --name npm \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -p 81:81 \
  -v npm_data:/data \
  -v npm_letsencrypt:/etc/letsencrypt \
  jc21/nginx-proxy-manager:latest
```

2. Accedez a l'interface d'administration sur `http://votre-ip:81` (identifiants par defaut : `admin@example.com` / `changeme`)

3. Ajoutez un **Proxy Host** :
   - **Domain Names** : `votre-domaine.fr`
   - **Scheme** : `http`
   - **Forward Hostname/IP** : `host.docker.internal` (ou l'IP du conteneur app)
   - **Forward Port** : `3002`
   - **Websockets Support** : **coche** (requis pour Socket.IO)
   - **Block Common Exploits** : coche
   - Onglet **SSL** : activez SSL, choisissez "Request a new SSL Certificate" via Let's Encrypt, cochez "Force SSL" et "HTTP/2 Support"

> **Important** : l'option **Websockets Support** doit etre activee pour que les mises a jour temps reel (Socket.IO) fonctionnent.

## Sauvegarde et maintenance

### Sauvegarder la base de donnees

```bash
docker compose exec db pg_dump -U wooznext wooznext > backup_$(date +%Y%m%d).sql
```

### Restaurer une sauvegarde

```bash
docker compose exec -T db psql -U wooznext -d wooznext < backup.sql
```

### Sauvegarde automatique via cron

```bash
crontab -e
0 2 * * * cd /chemin/wooznext && docker compose exec -T db pg_dump -U wooznext wooznext > /backups/wooznext_$(date +\%Y\%m\%d).sql
```

### Mettre a jour l'application apres un push GitHub

```bash
git pull origin main
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

## Depannage

### Conflit de migrations locales

Si `npx prisma migrate dev` ou `migrate reset` echoue avec une erreur sur une migration inconnue, c'est qu'une migration a ete creee localement et n'est pas dans le repo. Supprimez-la :

```powershell
# Windows — remplacez le nom par celui indique dans l'erreur
Remove-Item -Recurse -Force "prisma\migrations\NOM_DE_LA_MIGRATION"
```

```bash
# Linux/Mac
rm -rf prisma/migrations/NOM_DE_LA_MIGRATION
```

Puis relancez `npx prisma migrate reset`.

### Regenerer le client Prisma apres un changement de schema

```bash
npx prisma generate        # Regenerer le client
npx prisma migrate dev     # Appliquer les nouvelles migrations
```

A faire systematiquement apres un `git pull` qui modifie `prisma/schema.prisma`.

### L'application ne demarre pas (production)

```bash
docker compose logs app             # Verifier les erreurs
docker compose ps                   # Etat des conteneurs
# Verifier le fichier .env : variables correctes ?
```

### Erreur de connexion a la base

```bash
docker compose logs db              # PostgreSQL est-il pret ?
docker compose exec db pg_isready   # Tester la connexion
# Verifier DATABASE_URL dans .env
```

### Probleme de certificat SSL

- Verifier les logs NPM : `docker logs npm`
- Verifier que le DNS pointe bien vers le serveur
- Verifier que le port 80 est ouvert (necessaire pour Let's Encrypt)

### Reinitialiser completement

```bash
docker compose down -v              # Supprime conteneurs + volumes (ATTENTION)
docker compose up -d --build        # Tout reconstruire
docker compose exec app npx tsx prisma/seed.ts  # Reinjecter les donnees de test
```

## Commandes utiles

```bash
# Developpement
npm run dev              # Lancer l'app (Next.js + Socket.IO)
npm run db:migrate       # Appliquer les migrations
npm run db:seed          # Injecter les donnees de test
npm run db:studio        # Ouvrir Prisma Studio (interface BDD)

# Production
docker compose up -d --build      # Build et lancer tout
docker compose logs -f app        # Voir les logs
docker compose down               # Arreter tout

# Reinitialiser la base (tout effacer + reseed)
npx prisma migrate reset

# RGPD
npx tsx scripts/purge-rgpd.ts     # Purge manuelle des donnees > 30 jours

# Nettoyage minuit
npx tsx scripts/midnight-cleanup.ts  # Fermer les tickets ouverts

# QR Code
# /api/qrcode?serviceId=ID         -> QR code SVG d'un service
# /api/qrcode                      -> Liste des services et URLs
```

## Architecture du projet

```
wooznext/
├── prisma/              # Schema et migrations
├── scripts/             # Scripts utilitaires (purge RGPD, nettoyage minuit)
├── tests/               # Tests End-to-End (Playwright)
├── src/
│   ├── app/             # Pages et API (App Router)
│   │   ├── admin/       # Interface admin
│   │   ├── agent/       # Interface agent + login
│   │   ├── display/     # Affichage public
│   │   ├── ticket/      # Suivi visiteur
│   │   └── api/         # Endpoints REST
│   │       ├── feed/    # Flux d'actualites + proxy images
│   │       └── ...
│   ├── components/      # Composants React
│   ├── hooks/           # Hooks Socket.IO
│   ├── lib/             # Services, auth, audit, rate-limit, utilitaires
│   └── types/           # Declarations TypeScript supplementaires
├── server.ts            # Serveur custom (Next.js + Socket.IO)
├── Dockerfile           # Build multi-stage production (Node.js 22)
├── docker-compose.yml   # Production (app + db)
└── docker-compose.dev.yml  # Dev (db seule)
```

## Licence

Open source — usage libre pour les collectivites et services publics.
