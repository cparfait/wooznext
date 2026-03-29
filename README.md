# WoozNext

Outil open source de gestion de file d'attente physique pour collectivites (mairie, service public).

Le visiteur scanne un QR code, saisit son numero de telephone, et recoit un ticket numerique. L'agent appelle les visiteurs depuis une interface dediee. Un ecran public (Chromecast) affiche le numero en cours.

## Fonctionnalites

- **Vue Visiteur** (mobile-first) : prise de ticket par QR code, suivi en temps reel, son de notification, confetti quand c'est son tour
- **Vue Agent** : appel du suivant, appel manuel, rappel du visiteur, retour en file, marquage absent, ajout de ticket, cloture du guichet, changement de mot de passe
- **Vue Admin** : gestion des services (CRUD, prefixe, horaires, guichets, reinitialisation par service), agents (nom/prenom, service, role), statistiques filtrees, upload du logo, QR codes par service
- **Affichage Public** (Chromecast) : ticket en cours en grand format, dernier ticket appele persistant avec guichet, bandeau lateral avec liste des tickets appeles, flux d'actualites configurable avec images, message defilant urgent, flash + son a chaque appel
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
| Conteneurs | Docker + Docker Compose | - |

## Prerequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)
- [Node.js 22 LTS](https://nodejs.org/)
- [Git](https://git-scm.com/)

## Installation locale (Windows / Mac / Linux)

### 1. Cloner le projet

```bash
git clone https://github.com/cparfait/wooznext.git
cd wooznext
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env        # Linux/Mac
copy .env.example .env      # Windows
```

Editez le fichier `.env` :

```env
DATABASE_URL=postgresql://wooznext:wooznext_dev@localhost:5432/wooznext
NEXTAUTH_SECRET=votre_secret_ici
NEXTAUTH_URL=http://localhost:3000
```

Pour generer un secret securise :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Demarrer la base de donnees

```bash
docker compose -f docker-compose.dev.yml up -d
```

Cela lance PostgreSQL sur `localhost:5432`. Verifiez avec :

```bash
docker compose -f docker-compose.dev.yml ps
```

### 4. Installer les dependances et preparer la base

```bash
npm install
npx prisma migrate dev
npm run db:seed
```

> **Important** : ne jamais laisser `npx prisma migrate dev` creer une migration locale non commitee (ex: migration vide ou migration de seed). Cela cree des conflits lors d'un `migrate reset`. Si Prisma propose de creer une migration, assurez-vous qu'elle correspond a un vrai changement de schema avant de valider.

### 5. Lancer l'application

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

Cela demarre PostgreSQL + l'application. Les migrations s'appliquent automatiquement au demarrage.

### 4. Verifier

```bash
docker compose ps          # Etat des conteneurs
docker compose logs -f app # Logs de l'application
```

L'application est accessible sur le port **3000**. Configurez un reverse proxy (Caddy, Traefik ou Nginx) pour le HTTPS.

### Exemple avec Caddy (HTTPS automatique)

Installez Caddy sur le VPS puis creez `/etc/caddy/Caddyfile` :

```
votre-domaine.fr {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

Caddy obtient automatiquement un certificat Let's Encrypt.

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
npx prisma generate
```

A faire systematiquement apres un `git pull` qui modifie `prisma/schema.prisma`.

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
│   └── lib/             # Services, auth, audit, rate-limit, utilitaires
├── server.ts            # Serveur custom (Next.js + Socket.IO)
├── Dockerfile           # Build multi-stage production (Node.js 22)
├── docker-compose.yml   # Production (app + db)
└── docker-compose.dev.yml  # Dev (db seule)
```

## Licence

Open source — usage libre pour les collectivites et services publics.
