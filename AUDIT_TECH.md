# AUDIT_TECH.md — Audit de sécurité et technique complet

> Généré le 2026-03-29 | Branche : `claude/nodejs-security-audit-cU3Bx`
> Aucun fichier source n'a été modifié lors de cet audit.

---

## Résumé exécutif

| Catégorie | Critique | Haute | Moyenne | Faible | Info |
|-----------|----------|-------|---------|--------|------|
| Vulnérabilités npm | 0 | 4 | 1 | 0 | — |
| Sécurité applicative | 0 | 2 | 4 | 3 | 4 |
| **Total** | **0** | **6** | **5** | **3** | **4** |

---

## 1. Dépendances — Vulnérabilités connues (`npm audit`)

### 1.1 Résultats bruts

```
5 vulnérabilités trouvées (4 high, 1 moderate)
```

### 1.2 Détail par package

#### [HIGH] `next` v14.2.35 — 4 CVEs actifs

| CVE / Advisory | Titre | CVSS | Impact |
|---|---|---|---|
| GHSA-h25m-26qc-wcjf | HTTP request deserialization DoS avec React Server Components | **7.5** | Déni de service |
| GHSA-9g9p-9gw9-jx7f | DoS via Image Optimizer (remotePatterns) | 5.9 | Déni de service |
| GHSA-ggv3-7p47-pfv8 | HTTP request smuggling dans les rewrites | — | Contournement proxy |
| GHSA-3x4c-7xq6-9pq8 | Croissance illimitée du cache disque `next/image` | — | Épuisement stockage |

**Vecteur :** Réseau, sans authentification
**Version corrigée :** Next.js 15.5.14+ (ou 16.x)
**Statut :** ACTIF en production

#### [HIGH] `glob` v10.2.0–10.4.5 — Command injection

| CVE / Advisory | Titre | CVSS | CWE |
|---|---|---|---|
| GHSA-5j98-mcp5-4vw2 | Command injection via `--cmd` dans la CLI glob | **7.5** | CWE-78 |

**Note :** Transitif via `@next/eslint-plugin-next` (devDependency uniquement).
Aucun risque en production si `npm ci --omit=dev` est utilisé dans le Dockerfile.
**Version corrigée :** `glob >= 10.5.0`

#### [HIGH] `eslint-config-next` v14.2.35 + `@next/eslint-plugin-next`

Dépendances transitives vulnérables via `glob`. Même correctif que ci-dessus.

#### [MODERATE] `brace-expansion` — DoS par séquence zéro-pas

| CVE / Advisory | Titre | CVSS | CWE |
|---|---|---|---|
| GHSA-f886-m6hf-6m8v | Séquence `{0..0}` cause blocage du processus | **6.5** | CWE-400 |

**Affecte :** `brace-expansion < 1.1.13` et `>= 2.0.0 < 2.0.3`
**Version corrigée :** `>= 1.1.13` ou `>= 2.0.3`

---

## 2. Dépendances — Versions obsolètes (`npm outdated`)

| Package | Installée | Dernière stable | Saut | Priorité |
|---|---|---|---|---|
| `next` | 14.2.35 | **16.2.1** | Majeur | CRITIQUE |
| `@prisma/client` | 5.22.0 | **7.6.0** | Majeur | Haute |
| `prisma` (dev) | 5.22.0 | **7.6.0** | Majeur | Haute |
| `react` | 18.3.1 | **19.2.4** | Majeur | Haute |
| `react-dom` | 18.3.1 | **19.2.4** | Majeur | Haute |
| `bcryptjs` | 2.4.3 | **3.0.3** | Majeur | Haute |
| `zod` | 3.25.76 | **4.3.6** | Majeur | Moyenne |
| `tailwindcss` | 3.4.19 | **4.2.2** | Majeur | Moyenne |
| `tailwind-merge` | 2.6.1 | **3.5.0** | Majeur | Faible |
| `eslint` | 8.57.1 | **10.1.0** | Majeur | Faible |
| `eslint-config-next` | 14.2.35 | **16.2.1** | Majeur | Faible |
| `typescript` | 5.9.3 | **6.0.2** | Majeur | Faible |
| `@types/node` | 20.19.37 | 25.5.0 | Majeur | Info |
| `@types/react` | 18.3.28 | 19.2.14 | Majeur | Info |
| `@types/react-dom` | 18.3.7 | 19.2.3 | Majeur | Info |

> Toutes les dépendances de production critiques nécessitent un saut de version majeure.
> La mise à jour de `next` 14 → 15/16 apportera des changements de rupture (App Router, RSC, caching).

---

## 3. Sécurité applicative

### 3.1 [HIGH] Absence totale de headers de sécurité HTTP

**Fichier :** `next.config.js` (ligne 1–7)
**Problème :** Aucun header de sécurité n'est configuré dans `next.config.js`. L'application est exposée à plusieurs classes d'attaques côté navigateur.

**Headers manquants :**

| Header | Risque si absent |
|---|---|
| `Content-Security-Policy` | XSS, injection de ressources tierces |
| `X-Frame-Options: DENY` | Clickjacking |
| `X-Content-Type-Options: nosniff` | MIME sniffing |
| `Strict-Transport-Security` | Downgrade HTTPS → HTTP (production) |
| `Referrer-Policy` | Fuite d'URL dans les logs tiers |
| `Permissions-Policy` | Accès non désiré à caméra/micro/géoloc |

**Code actuel :**
```js
// next.config.js — aucun headers: {}
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
};
```

---

### 3.2 [HIGH] Absence de rate limiting sur les endpoints publics

**Fichiers concernés :**
- `src/app/api/tickets/route.ts` — `POST /api/tickets`
- `src/app/api/qrcode/route.ts` — `GET /api/qrcode`
- `src/app/api/feed/route.ts` — `GET /api/feed`
- `src/app/api/display/[serviceId]/route.ts` — `GET /api/display/[serviceId]`

**Problème :** Aucun mécanisme de limitation de débit n'est implémenté. Un attaquant peut :
- Créer des milliers de tickets sans contrôle (inondation de file d'attente)
- Forcer la création de numéros de visiteurs fictifs (`Visitor` table)
- Provoquer des appels externes répétés au `feedUrl` (amplification)
- Énumérer les IDs de service via le endpoint display

---

### 3.3 [MEDIUM] Risque SSRF sur le fetch de flux externe

**Fichier :** `src/app/api/feed/route.ts` — ligne 22
**Problème :** L'URL `feedUrl` stockée en base de données est récupérée sans validation de destination.

```typescript
// Aucune restriction sur l'IP ou le domaine cible
const res = await fetch(service.feedUrl, {
  next: { revalidate: 300 },
  signal: AbortSignal.timeout(5000),
});
```

**Scénarios d'attaque SSRF :**
- `feedUrl = "http://127.0.0.1/admin"` → accès à services internes
- `feedUrl = "http://169.254.169.254/latest/meta-data/"` → métadonnées cloud (AWS/GCP/Azure)
- `feedUrl = "http://db:5432"` → sondage du réseau Docker interne
- `feedUrl = "file:///etc/passwd"` → lecture de fichiers locaux (selon la version de Node)

**Contexte :** L'URL est définie uniquement par un administrateur authentifié (`PATCH /api/admin/services/[id]`), ce qui réduit l'exposition. La validation Zod vérifie que c'est une URL valide (`z.string().url()`) mais n'en restreint pas la cible.

---

### 3.4 [MEDIUM] Politique de mot de passe incohérente à la création d'agent

**Fichier :** `src/app/api/admin/agents/route.ts` — ligne 16

```typescript
// Création par l'admin : minimum 6 caractères seulement
password: z.string().min(6, 'Mot de passe trop court (min 6)'),
```

**Vs. changement de mot de passe par l'agent** (`src/app/api/agent/password/route.ts`) :
- Minimum 12 caractères
- Majuscule requise
- Chiffre requis
- Caractère spécial requis

**Conséquence :** Un admin peut créer un compte avec un mot de passe faible comme `"agent1"`. L'agent n'est pas forcé de le changer. Cela contredit les exigences de la PSSI et les bonnes pratiques ANSSI.

---

### 3.5 [MEDIUM] Upload SVG sans sanitisation — risque XSS stored

**Fichier :** `src/app/api/admin/logo/route.ts` — lignes 34–65
**Problème :** Le type `image/svg+xml` est accepté et le fichier est sauvegardé tel quel sans analyse du contenu.

```typescript
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
// ...
const buffer = Buffer.from(await file.arrayBuffer());
await writeFile(filePath, buffer); // Aucune sanitisation du SVG
```

Un SVG malveillant peut contenir :
```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <script>document.cookie='stolen='+document.cookie</script>
</svg>
```

Si le fichier est servi avec `Content-Type: image/svg+xml`, le navigateur exécutera le script dans le contexte de l'origine. La route publique `GET /api/logo` expose ce fichier à tous.

**Note :** Le risque est limité par le fait que seul un admin peut uploader le logo. Mais un admin compromis (ou une erreur de configuration) pourrait exploiter cette faille.

---

### 3.6 [MEDIUM] Endpoint admin GET sans authentification (`/api/admin/ticker`)

**Fichier :** `src/app/api/admin/ticker/route.ts` — ligne 10
**Problème :** Le verbe `GET` de cet endpoint ne vérifie pas la session. N'importe quel utilisateur non authentifié peut lire le message ticker via :
```
GET /api/admin/ticker
```

```typescript
export async function GET() {
  // Aucun getAdminSession() ici
  if (!existsSync(TICKER_FILE)) {
    return NextResponse.json({ message: null });
  }
  const message = (await readFile(TICKER_FILE, 'utf-8')).trim();
  return NextResponse.json({ message: message || null });
}
```

**Contexte :** Le message ticker est une information publique (affiché sur écran d'accueil). Cela peut être intentionnel. Cependant, l'endpoint est sous le chemin `/api/admin/`, ce qui suggère une protection attendue. La confusion entre endpoint interne et public est un risque d'architecture.

---

### 3.7 [LOW] Stockage fichier plat pour données persistantes

**Fichiers :** `src/app/api/admin/ticker/route.ts`, `src/app/api/admin/feed/route.ts`

Les messages ticker et les URLs de flux sont stockés dans `data/ticker-message.txt` et `data/feed-url.txt` (sur le système de fichiers local du container).

**Problèmes :**
- Perte de données si le container redémarre sans volume Docker monté sur `/data`
- Incohérence architecturale : ces données existent déjà dans la table `Service` (champs `tickerMessage`, `feedUrl`)
- Double source de vérité : la base de données ET le système de fichiers contiennent des données ticker

**Note :** Le schéma Prisma possède `tickerMessage`, `tickerActive`, `feedUrl`, `feedActive` dans le modèle `Service`. L'utilisation de fichiers plats en parallèle crée une redondance non documentée.

---

### 3.8 [LOW] Élévation de privilèges implicite : rôle AGENT accède à `/admin`

**Fichier :** `src/middleware.ts` — ligne 9–10

```typescript
if (pathname.startsWith('/admin') && token?.role !== 'ADMIN' && token?.role !== 'AGENT') {
  return NextResponse.redirect(new URL('/agent', req.url));
}
```

Un agent (rôle `AGENT`) peut accéder à toutes les routes `/admin/*`. La délégation de contrôle est reportée sur chaque route API via `getAdminSession()`. Cette approche est fonctionnelle mais :
- Augmente la surface d'attaque si une route oublie son contrôle d'accès
- Un agent peut accéder à des statistiques globales, à la liste de tous les agents, et aux paramètres de tous les services

---

### 3.9 [LOW] Pas de journalisation d'audit des actions sensibles

Aucun log structuré des événements sensibles :
- Connexions/déconnexions d'agents
- Créations/modifications/suppressions d'agents
- Réinitialisation de file
- Changements de mot de passe
- Upload de logo

En cas d'incident de sécurité, il n'y a aucune trace pour la forensique. Ceci est particulièrement problématique pour une application de service public (traçabilité RGPD requise).

---

## 4. Architecture et bonnes pratiques

### 4.1 [INFO] Pas de CORS explicite

Next.js bloque les requêtes cross-origin par défaut pour les routes API (cookies SameSite=Strict). Toutefois, en cas d'intégration future avec un front-end séparé ou une app mobile, l'absence de configuration CORS explicite sera un point de friction.

### 4.2 [INFO] Type casting non sécurisé dans l'authentification

**Fichier :** `src/lib/auth.ts` — lignes 51, 57

```typescript
token.role = (user as any).role;   // Pas de type-safe
token.serviceId = (user as any).serviceId;
```

L'utilisation de `as any` contourne le système de types TypeScript. Le fichier `src/types/next-auth.d.ts` définit les extensions de type mais les callbacks NextAuth utilisent quand même `as any` pour y accéder.

### 4.3 [INFO] Gestion d'erreur générique sans masquage d'information

Les routes API retournent `{ error: 'Erreur serveur' }` pour les erreurs 500, ce qui est correct. Cependant, `console.error('Error ...', error)` en production expose les stack traces dans les logs système. Dans un environnement Docker avec `docker logs`, ces informations peuvent être accessibles.

### 4.4 [INFO] PrismaClient singleton — bonne pratique confirmée

**Fichier :** `src/lib/prisma.ts`

L'implémentation du singleton via `globalThis` est conforme aux recommandations Next.js/Prisma pour éviter les fuites de connexion en mode développement (HMR). Pas de problème.

---

## 5. Points positifs confirmés

| Contrôle | Statut | Détail |
|---|---|---|
| Hash des mots de passe | ✅ Correct | bcrypt, coût 12 (recommandation ANSSI : >= 10) |
| Pseudonymisation téléphone | ✅ Correct | HMAC-SHA256 + PHONE_PEPPER |
| Prévention injection SQL | ✅ Correct | Prisma ORM, aucune requête raw |
| Validation des entrées | ✅ Correct | Zod sur toutes les routes publiques et admin |
| Validation couleurs (hex) | ✅ Correct | `z.string().regex(/^#[0-9a-fA-F]{6}$/)` |
| Session JWT sécurisée | ✅ Correct | HttpOnly, SameSite=Strict, expiration 8h |
| Protection des routes | ✅ Correct | Middleware NextAuth sur `/agent` et `/admin` |
| Gestion de doublon ticket | ✅ Correct | Vérification par hash téléphone + statut actif |
| Numérotation atomique | ✅ Correct | Transaction `upsert` sur `DailySequence` |
| DB non exposée en prod | ✅ Correct | Réseau Docker interne, pas de port mappé |
| Variables sensibles | ✅ Correct | `.env` dans `.gitignore`, `.env.example` documenté |
| Purge RGPD | ✅ Correct | Script `purge-rgpd.ts`, données > 30 jours |
| Anti-doublon ticket | ✅ Correct | Retour ticket existant si WAITING/SERVING |

---

## 6. Plan de correction proposé

> **Important :** Ce plan est une proposition. Aucune modification n'a été apportée au code source. Votre validation est requise avant toute implémentation.

### Priorité 1 — Immédiat (risque actif)

#### P1.1 — Mettre à jour Next.js pour corriger les CVEs

```bash
# Commande de mise à jour (Next.js 15.x, LTS)
npm install next@15 eslint-config-next@15
# Tester la compatibilité du build
npm run build
```

**Impact :** Breaking changes potentiels sur le caching, les Server Components, et les API routes.
**Effort estimé :** 1–3 jours (audit de compatibilité + tests)

#### P1.2 — Ajouter les headers de sécurité HTTP

Dans `next.config.js`, ajouter un bloc `headers()` avec CSP, HSTS, X-Frame-Options, etc.
**Effort estimé :** 2–4 heures

#### P1.3 — Implémenter le rate limiting sur les endpoints publics

Utiliser `@upstash/ratelimit` + Redis, ou un middleware Express/custom sur le serveur Socket.IO.
Cibles : `POST /api/tickets` (ex: 3 req/min par IP), `GET /api/feed` (1 req/5min par IP).
**Effort estimé :** 4–8 heures

---

### Priorité 2 — Court terme (< 2 semaines)

#### P2.1 — Renforcer la politique de mot de passe à la création d'agent

Aligner la validation Zod de `POST /api/admin/agents` sur celle de `POST /api/agent/password` (12 chars minimum, complexité).
**Effort estimé :** 30 minutes

#### P2.2 — Protéger ou déplacer le GET du ticker

Deux options :
- **Option A :** Ajouter `getAdminSession()` au GET et créer un endpoint public séparé `/api/display/[serviceId]/ticker`
- **Option B :** Documenter explicitement que le GET est volontairement public

**Effort estimé :** 1 heure

#### P2.3 — Corriger le risque SSRF sur le feed

Ajouter une validation de l'URL avant le fetch : bloquer les IPs privées, les schémas non-HTTPS, les métadonnées cloud.
**Effort estimé :** 2–3 heures

#### P2.4 — Sanitiser les SVG uploadés

Utiliser la bibliothèque `dompurify` (côté serveur via jsdom) ou `svgo` pour nettoyer les SVG. Alternativement, refuser `image/svg+xml` et n'accepter que les rasters (PNG, JPG, WebP).
**Effort estimé :** 2–4 heures

---

### Priorité 3 — Moyen terme (< 1 mois)

#### P3.1 — Migrer ticker/feedUrl du système de fichiers vers la base de données

Les champs `tickerMessage`, `tickerActive`, `feedUrl`, `feedActive` existent déjà dans le modèle `Service`. Supprimer les routes de stockage fichier et utiliser directement Prisma.
**Effort estimé :** 4–6 heures

#### P3.2 — Ajouter un journal d'audit

Logger les actions sensibles (connexion, création agent, reset file, changement de mot de passe) dans une table `AuditLog` ou dans un service de logs externe.
**Effort estimé :** 1–2 jours

#### P3.3 — Mettre à jour les autres dépendances majeures

- `@prisma/client` + `prisma` : 5.x → 7.x (vérifier les migrations)
- `bcryptjs` : 2.x → 3.x (API compatible)
- `zod` : 3.x → 4.x (changements de rupture sur les messages d'erreur)
- `react` + `react-dom` : 18 → 19 (vérifier `use client`/`use server` patterns)

**Effort estimé :** 2–4 jours (avec tests de non-régression)

---

## 7. Références

| Advisory | URL |
|---|---|
| GHSA-h25m-26qc-wcjf | https://github.com/advisories/GHSA-h25m-26qc-wcjf |
| GHSA-9g9p-9gw9-jx7f | https://github.com/advisories/GHSA-9g9p-9gw9-jx7f |
| GHSA-ggv3-7p47-pfv8 | https://github.com/advisories/GHSA-ggv3-7p47-pfv8 |
| GHSA-3x4c-7xq6-9pq8 | https://github.com/advisories/GHSA-3x4c-7xq6-9pq8 |
| GHSA-5j98-mcp5-4vw2 | https://github.com/advisories/GHSA-5j98-mcp5-4vw2 |
| GHSA-f886-m6hf-6m8v | https://github.com/advisories/GHSA-f886-m6hf-6m8v |
| OWASP SSRF | https://owasp.org/www-community/attacks/Server_Side_Request_Forgery |
| OWASP Clickjacking | https://owasp.org/www-community/attacks/Clickjacking |
| ANSSI Mots de passe | https://cyber.gouv.fr/publications/recommandations-relatives-lauthentification-multifacteur-et-aux-mots-de-passe |

---

*Audit réalisé par Claude Code — Aucune modification de code n'a été effectuée.*
