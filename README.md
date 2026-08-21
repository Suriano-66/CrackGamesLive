# CrackGamesLive

Plateforme d'abonnement à des mini-jeux interactifs (overlays) pour les lives
TikTok. Landing page, comptes sécurisés, abonnements Stripe (mensuel /
trimestriel / annuel) et espace membre.

Stack : **Next.js 15 (App Router, TypeScript)** · **Auth.js** (mots de passe
hachés bcrypt) · **Prisma** (SQLite en dev, PostgreSQL en prod) · **Stripe**
(Checkout + portail client + webhooks).

---

## 1. Prérequis

- [Node.js 18.18+ ou 20+](https://nodejs.org)
- Un compte [Stripe](https://dashboard.stripe.com) (mode test pour démarrer)

## 2. Installation

```bash
npm install
```

## 3. Variables d'environnement

Copie `.env.example` en `.env` puis remplis les valeurs :

```bash
cp .env.example .env
```

Génère un secret Auth.js :

```bash
# macOS / Linux
openssl rand -base64 32
```

Colle le résultat dans `AUTH_SECRET`.

## 4. Base de données

En développement, la base est un simple fichier SQLite. Crée-la :

```bash
npm run db:push
```

> Pour la production, mets une URL PostgreSQL dans `DATABASE_URL` et change
> `provider = "sqlite"` en `provider = "postgresql"` dans
> `prisma/schema.prisma`, puis relance `npm run db:push`.

## 5. Configurer Stripe

1. Dans le dashboard Stripe, crée **un produit** puis **9 tarifs (prices)** :
   3 offres (Starter / Creator / Pro) × 3 périodes (mensuel / trimestriel /
   annuel). Récupère chaque `price_...` et colle-le dans le `.env`
   (`STRIPE_PRICE_*`).
2. Récupère `STRIPE_SECRET_KEY` et `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` dans
   *Developers → API keys*.
3. Pour tester les webhooks en local, installe le
   [Stripe CLI](https://docs.stripe.com/stripe-cli) puis lance :

```bash
npm run stripe:listen
```

La commande affiche un `whsec_...` : colle-le dans `STRIPE_WEBHOOK_SECRET`.

## 6. Lancer le site

```bash
npm run dev
```

Le site tourne sur http://localhost:3000.

---

## Structure

```
src/
  app/
    page.tsx              Landing page (design validé)
    login/                Connexion
    register/             Inscription
    dashboard/            Espace membre (protégé)
    api/
      register/           Création de compte (hash bcrypt)
      auth/[...nextauth]/ Auth.js
      stripe/checkout/    Création de la session de paiement
      stripe/portal/      Portail de gestion / résiliation
      stripe/webhook/     Réception des événements Stripe
  components/             Composants UI (thème, démo, tarifs…)
  lib/                    Prisma, Stripe, plans, validation
  auth.ts / auth.config.ts / middleware.ts   Authentification
prisma/schema.prisma      Modèle de données
```

## Sécurité (déjà en place)

- Mots de passe **hachés avec bcrypt** (jamais stockés en clair).
- Sessions signées (JWT httpOnly) via Auth.js, protection CSRF intégrée.
- **Aucune donnée bancaire** stockée : tout passe par Stripe (certifié PCI-DSS).
- **En-têtes de sécurité** (CSP, HSTS, X-Frame-Options…) dans `next.config.mjs`.
- **Validation stricte** des entrées (Zod) côté serveur.
- Routes `/dashboard` protégées par middleware.
- Webhooks Stripe **vérifiés par signature**.

## Déploiement

Le projet se déploie tel quel sur **Vercel** (recommandé) :
1. Pousse le code sur un repo Git.
2. Importe-le dans Vercel.
3. Ajoute toutes les variables du `.env` dans les *Environment Variables*.
4. Utilise une base **PostgreSQL** (Vercel Postgres, Neon, Supabase…).
5. Configure l'endpoint webhook Stripe sur `https://TON-DOMAINE/api/stripe/webhook`.

## À faire ensuite (idées)

- Générer les vraies pages d'overlay des jeux + URL unique par utilisateur.
- (Option) Connexion aux événements TikTok Live en temps réel.
- Vérification d'email, réinitialisation de mot de passe.
- Limitation de débit (rate limiting) sur les routes d'auth.
- Pages légales (CGV, mentions, confidentialité).
