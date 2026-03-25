# CLAUDE.md — Mémoire du projet cparfait

> Fichier de référence pour l'assistant IA. Contient toutes les règles, contraintes et décisions d'architecture à respecter tout au long du développement.

---

## Contexte du projet

Outil de gestion de file d'attente physique pour une collectivité (mairie / service public).
Le visiteur scanne un QR code, saisit son numéro de téléphone, et reçoit un ticket numérique.
L'agent appelle les visiteurs depuis une interface dédiée. Un écran public (Chromecast) affiche le numéro en cours.

---

## Environnement de développement

**Statut actuel : développement local sur machine Windows.**

- L'application tourne via **Docker Desktop for Windows** + **Docker Compose**
- Commande de démarrage (base de données seule) : `docker-compose -f docker-compose.dev.yml up -d`
- L'app Next.js tourne nativement avec : `npm run dev`
- La base de données PostgreSQL est exposée sur `localhost:5432`
- En production (VPS Hostinger), on utilisera `docker-compose.yml` (app + db tout-en-un)
- **Ne jamais commiter le fichier `.env`** — utiliser `.env.example` comme référence

---

## Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.x |
| Langage | TypeScript | 5.x |
| Style | Tailwind CSS | 3.x |
| Base de données | PostgreSQL | 16 |
| ORM | Prisma | 5.x |
| Temps réel | Socket.IO | 4.x |
| Authentification | NextAuth.js | 4.x |
| Hachage | bcryptjs | 2.x |
| QR Code | qrcode | 1.x |
| Validation | Zod | 3.x |
| Conteneurs | Docker + Docker Compose | — |

---

## Règles de design (à respecter absolument)

### Principes généraux
- **Mobile-first** : la vue visiteur est conçue pour un smartphone, pas un desktop
- **Épuré** : pas de sidebar, pas de navbar complexe — chaque vue est mono-fonction
- **Lisible de loin** : la vue Affichage public utilise des typographies très grandes (écran Chromecast)
- **Pas d'emojis** dans le code ou les interfaces sauf si demandé explicitement

### Palette de couleurs
- Fond agent : `bg-gray-400`
- Fond visiteur : `bg-gray-50` (blanc cassé)
- Fond affichage public : `bg-white`
- Bouton principal : `bg-primary-500` (bleu `#4272b8`)
- Texte principal : `text-gray-900`
- Texte secondaire : `text-gray-600`
- Indicateur actif / positif : `text-green-500`

### Format des numéros de ticket
- Toujours sur **3 chiffres avec zéro padding** : `001`, `042`, `100`
- Avec préfixe de service (optionnel) : `EC-001`, `UR-042`
- Réinitialisation **chaque jour** par service

### Composants UI attendus (inspirés des maquettes)
- Cercle de progression (vue visiteur) pour indiquer la position en file
- Bottom sheet (vue agent) pour sélectionner un visiteur spécifique
- Modale de confirmation avant actions sensibles (renvoyer en file, annuler)
- Popup festive avec confetti quand c'est le tour du visiteur

---

## Logique métier critique

### Identification par téléphone (règle anti-doublon)
- Le **numéro de téléphone est l'identifiant unique du visiteur**
- Avant de créer un ticket, on vérifie s'il existe un ticket `WAITING` ou `SERVING` lié à ce numéro
- Si oui → on retourne le ticket existant (pas de doublon)
- Si non → on crée un nouveau ticket
- La recherche de ticket actif se fait via : `Ticket.status IN ['WAITING', 'SERVING']` + `Visitor.phone`

### Machine à états du ticket
```
WAITING → SERVING → COMPLETED
                 ↘ NO_SHOW
WAITING → CANCELLED
SERVING → WAITING  (retour en file — confirmation requise)
```

### Numérotation quotidienne (sans conflit concurrent)
- La table `DailySequence` contient le dernier numéro attribué par service et par jour
- L'incrémentation se fait dans une **transaction SQL atomique** pour éviter les collisions
- Le numéro repart de `001` chaque jour (minuit)

### Services et guichets
- Un service = une file d'attente indépendante (ex : État civil, Urbanisme)
- Un guichet (Counter) appartient à un service et est opéré par un agent
- Un agent est rattaché à un service mais peut changer de guichet

---

## Architecture des routes

| Route | Vue | Accès |
|---|---|---|
| `/` | Saisie téléphone + prise de ticket | Public |
| `/ticket/[id]` | Suivi du ticket en temps réel | Public (lien unique) |
| `/agent` | Dashboard agent (appel file) | Privé (session agent) |
| `/agent/login` | Connexion agent | Public |
| `/admin` | Gestion services / agents / stats | Privé (session admin) |
| `/display` | Écran public Chromecast | Public (lecture seule) |
| `/display/[serviceId]` | Écran public par service | Public (lecture seule) |
| `/api/...` | API REST + Socket.IO | Selon endpoint |

---

## Sécurité

- Mots de passe hashés avec **bcrypt, coût 12**
- Sessions JWT via NextAuth, cookie **HttpOnly + SameSite=Strict**
- Middleware Next.js protège toutes les routes `/agent` et `/admin`
- Rôles : `ADMIN` (gestion globale) et `AGENT` (opérations file)
- Rate limiting sur la saisie du numéro de téléphone (anti-spam)
- PostgreSQL **non exposé** sur le réseau public en production (réseau Docker interne)
- Purge automatique des données visiteurs après 30 jours (RGPD)
- Variables sensibles dans `.env`, jamais commitées

---

## Variables d'environnement requises

Voir `.env.example` pour la liste complète. Les variables critiques :

```
DATABASE_URL          # URL de connexion PostgreSQL
NEXTAUTH_SECRET       # Secret JWT (générer avec: openssl rand -base64 32)
NEXTAUTH_URL          # URL publique de l'app (ex: http://localhost:3000)
DB_PASSWORD           # Mot de passe PostgreSQL
```

---

## Prochaines étapes (check-list de développement)

### Phase 2 — Base de données
- [x] Schéma Prisma complet (Service, Agent, Visitor, Ticket, Counter, DailySequence)
- [ ] Migration initiale (`npx prisma migrate dev --name init`)
- [ ] Seed de données de test (`npm run db:seed`)
- [ ] Tester les relations et contraintes en studio (`npm run db:studio`)

### Phase 3 — Authentification agents
- [ ] Configurer NextAuth.js avec `CredentialsProvider`
- [ ] Page de login `/agent/login`
- [ ] Middleware de protection des routes `/agent` et `/admin`
- [ ] Hash des mots de passe au seed et à la création

### Phase 4 — API REST
- [ ] `POST /api/tickets` — Créer un ticket (avec anti-doublon téléphone)
- [ ] `GET /api/tickets/[id]` — Lire un ticket
- [ ] `POST /api/agent/next` — Appeler le visiteur suivant
- [ ] `POST /api/agent/call/[id]` — Appeler un visiteur spécifique
- [ ] `POST /api/agent/complete` — Marquer comme terminé
- [ ] `POST /api/agent/return/[id]` — Renvoyer en file
- [ ] `GET /api/display/[serviceId]` — Données pour l'écran public

### Phase 5 — Temps réel (Socket.IO)
- [ ] Serveur Socket.IO custom intégré à Next.js
- [ ] Événements : `ticket:called`, `queue:updated`, `ticket:completed`
- [ ] Rooms par service pour cibler les bonnes connexions
- [ ] Reconnexion automatique côté client

### Phase 6 — Vue Visiteur Mobile
- [ ] Formulaire de saisie du téléphone (page `/`)
- [ ] Sélection du service
- [ ] Affichage du ticket (`/ticket/[id]`) avec position en file
- [ ] Cercle de progression animé
- [ ] Popup festive "C'est votre tour !" avec confetti

### Phase 7 — Vue Agent
- [ ] Compteur "Actuellement en service" (grand format)
- [ ] Bandeau "X visiteur(s) en attente"
- [ ] Bouton "Suivant" (appel automatique)
- [ ] Bottom sheet "Choisir visiteur" (appel manuel)
- [ ] Modale de confirmation "Retour à la file"
- [ ] Bouton "Ajouter" (ticket manuel sans QR code)

### Phase 8 — Vue Affichage Public (Chromecast)
- [ ] Numéro en cours (très grand format)
- [ ] Numéro suivant (format moyen)
- [ ] Compteur de visiteurs en attente
- [ ] Mise à jour instantanée via Socket.IO
- [ ] Mode plein écran automatique

### Phase 9 — Admin
- [ ] Gestion des services (CRUD)
- [ ] Gestion des agents (créer, désactiver)
- [ ] Gestion des guichets
- [ ] Statistiques du jour (tickets traités, temps moyen)
- [ ] Réinitialisation manuelle de la file

### Phase 10 — Production
- [ ] Générer le QR code pointant vers `/`
- [ ] Configurer Traefik ou Caddy (HTTPS / Let's Encrypt)
- [ ] Tester le build Docker complet
- [ ] Documenter le déploiement sur VPS Hostinger
- [ ] Mettre en place la purge RGPD automatique

---

## Commandes utiles

```bash
# Développement local
docker-compose -f docker-compose.dev.yml up -d   # Démarrer PostgreSQL
npm run dev                                       # Démarrer Next.js
npm run db:migrate                                # Appliquer les migrations
npm run db:seed                                   # Injecter les données de test
npm run db:studio                                 # Ouvrir Prisma Studio (UI BDD)

# Production
docker-compose up -d --build                      # Build et démarrer tout
docker-compose logs -f app                        # Voir les logs de l'app
docker-compose exec app npx prisma migrate deploy # Appliquer migrations en prod
```

---

## Comptes de test (après seed)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@mairie.fr | admin123 |
| Agent | agent@mairie.fr | agent123 |
