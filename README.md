# WoozNext

Outil open source de gestion de file d'attente physique pour collectivites (mairie, service public).

Le visiteur scanne un QR code, saisit son numero de telephone, et recoit un ticket numerique. L'agent appelle les visiteurs depuis une interface dediee. Un ecran public (Chromecast) affiche le numero en cours.

## Fonctionnalites

- **Vue Visiteur** (mobile) : prise de ticket par QR code, suivi en temps reel, notification quand c'est son tour
- **Vue Agent** : appel du suivant, appel manuel, retour en file, marquage absent
- **Vue Admin** : gestion des services et agents, statistiques du jour, reinitialisation de la file
- **Affichage Public** (Chromecast) : numero en cours en grand format, mise a jour instantanee
- **QR Code** : generation automatique via `/api/qrcode`
- **Temps reel** : Socket.IO pour toutes les mises a jour
- **RGPD** : purge automatique des donnees visiteurs apres 30 jours

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript |
| Style | Tailwind CSS |
| Base de donnees | PostgreSQL 16 |
| ORM | Prisma |
| Temps reel | Socket.IO |
| Authentification | NextAuth.js |
| Conteneurs | Docker + Docker Compose |

## Prerequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)
- [Node.js 20 LTS](https://nodejs.org/)
- [Git](https://git-scm.com/)

## Installation locale (Windows / Mac / Linux)

### 1. Cloner le projet

```bash
git clone https://github.com/cparfait/wooznext.git
cd wooznext
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Editez le fichier `.env` :

```env
DATABASE_URL=postgresql://cparfait:cparfait_dev@localhost:5432/cparfait
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

### 5. Lancer l'application

```bash
npm run dev
```

L'application est accessible sur **http://localhost:3000**.

## Tester les 4 interfaces

| Interface | URL | Acces |
|---|---|---|
| Visiteur | http://localhost:3000 | Public |
| Connexion Agent | http://localhost:3000/agent/login | Public |
| Dashboard Agent | http://localhost:3000/agent | Apres connexion |
| Admin | http://localhost:3000/admin | Compte admin |
| Affichage Public | http://localhost:3000/display | Public |
| QR Code | http://localhost:3000/api/qrcode | Public |

### Comptes de test

| Role | Email | Mot de passe |
|---|---|---|
| Admin | admin@mairie.fr | admin123 |
| Agent | agent@mairie.fr | agent123 |

### Parcours de test recommande

1. **Visiteur** : ouvrez http://localhost:3000 sur votre telephone (meme reseau Wi-Fi) ou dans un onglet mobile. Saisissez un numero de telephone, selectionnez un service, prenez un ticket.
2. **Agent** : dans un autre onglet, connectez-vous sur http://localhost:3000/agent/login avec `agent@mairie.fr` / `agent123`. Cliquez "Suivant" pour appeler le visiteur.
3. **Temps reel** : observez la mise a jour instantanee sur la vue visiteur (popup "C'est votre tour !").
4. **Affichage public** : ouvrez http://localhost:3000/display dans un troisieme onglet pour voir le numero appele en grand format.
5. **Admin** : connectez-vous sur http://localhost:3000/admin avec `admin@mairie.fr` / `admin123` pour voir les statistiques et gerer les services/agents.

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
DATABASE_URL=postgresql://cparfait:MOT_DE_PASSE_FORT@db:5432/cparfait
DB_PASSWORD=MOT_DE_PASSE_FORT
NEXTAUTH_SECRET=secret_genere_avec_openssl
NEXTAUTH_URL=https://votre-domaine.fr
```

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

# RGPD
npx tsx scripts/purge-rgpd.ts     # Purge manuelle des donnees > 30 jours

# QR Code
# Acceder a /api/qrcode?url=https://votre-domaine.fr
```

## Architecture du projet

```
wooznext/
├── prisma/              # Schema et migrations
├── scripts/             # Scripts utilitaires (purge RGPD)
├── src/
│   ├── app/             # Pages et API (App Router)
│   │   ├── admin/       # Interface admin
│   │   ├── agent/       # Interface agent + login
│   │   ├── display/     # Affichage public
│   │   ├── ticket/      # Suivi visiteur
│   │   └── api/         # Endpoints REST
│   ├── components/      # Composants React
│   ├── hooks/           # Hooks Socket.IO
│   └── lib/             # Services, auth, utilitaires
├── server.ts            # Serveur custom (Next.js + Socket.IO)
├── Dockerfile           # Build multi-stage production
├── docker-compose.yml   # Production (app + db)
└── docker-compose.dev.yml  # Dev (db seule)
```

## Licence

Open source — usage libre pour les collectivites et services publics.
