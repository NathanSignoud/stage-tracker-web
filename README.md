# Stage Tracker (version en ligne)

Suivi de candidatures de stage, sur invitation : Kanban et tableau des candidatures, relances automatiques,
entretiens, tâches, contacts, entreprises cibles, documents (CV, lettres), préparation d'entretien, prompts et
messages prêts à copier, abonnement agenda. Interface en français.

Site statique (Vite + React) servi par Cloudflare Workers, avec un petit serveur pour les adresses `/api/*` ;
base de données, connexion et fichiers chez Supabase. **Chaque compte ne voit que ses propres données** : toutes
les tables sont protégées par des règles RLS, vérifiées par les tests.

## Développement

Prérequis : Node.js 22 ou plus.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests (Vitest), dont la base sur un vrai Postgres en mémoire (PGlite)
npm run build      # vérifie les types puis construit dist/
```

Le fichier `.env` contient l'adresse du projet Supabase et sa clé **publique** (aucun secret dans ce dépôt) ;
`wrangler.jsonc` reprend les deux mêmes valeurs pour le serveur.

**Page d'essai sans compte** : `npm run dev`, puis http://localhost:5173/tests/e2e/local.html. C'est le vrai site,
sur une base en mémoire dans le navigateur, connecté en personne fictive (jamais publié). Les scénarios
Playwright de `tests/e2e/*.mjs` s'en servent.

## Mise en place de Supabase (une fois)

1. **SQL Editor** : exécuter dans l'ordre les fichiers de `supabase/migrations/` :
   - `20261123000000_invitations.sql` (remplacer l'adresse du premier administrateur à la dernière ligne) ;
   - `20261125000000_schema.sql` (tables, règles RLS, écritures groupées) ;
   - `20261126000000_fichiers_agenda.sql` (stockage des fichiers, abonnement agenda).
2. **Vérifier** : exécuter `supabase/tests/verification.sql`. Il crée deux personnes fictives, contrôle que
   chacune ne voit que ses données, puis annule tout. Résultat attendu : « Tout est bon ».
3. **Authentication → Hooks → Before User Created** : choisir `public.hook_before_user_created`. Toute création de
   compte hors de la liste d'invitations est alors refusée (Google comme lien par email).
4. **Authentication → URL Configuration** : *Site URL* = l'adresse du site ; *Redirect URLs* = `<adresse du site>/**`
   et `http://localhost:5173/**`.
5. **Authentication → Sign In / Providers** : Google (identifiants du client OAuth) et Email ; pour envoyer les liens
   à d'autres personnes que soi, configurer un SMTP (ex. Gmail + mot de passe d'application).

## Déploiement

Cloudflare → Workers & Pages → le Worker relié à ce dépôt (branche `main`) : commande de build `npm run build`,
commande de déploiement `npx wrangler deploy`. Chaque `git push` sur `main` met le site à jour.

- `worker/` : serveur des adresses `/api/*` (le reste est servi depuis `dist/`) : import d'une offre par lien
  (réservé aux personnes connectées ; robots.txt respecté, LinkedIn refusé, redirections vérifiées) et abonnement
  agenda (`/api/calendar/<jeton>.ics`).
- `public/_headers` (copié dans `dist/`) : politique de sécurité (CSP limitée au projet Supabase, pas d'iframe,
  HSTS…). Vérifier : `curl -sI <adresse> | grep -i content-security`.

## Structure

- `src/pages/` : écrans ; `src/components/` : interface (composants shadcn, design « Atelier »)
- `src/services/` : lecture et écriture des données ; `src/actions/` : actions appelées par l'interface
- `src/lib/db.ts` : accès à la base (Supabase sur le site, PGlite dans les tests) ; écritures groupées
  « tout ou rien » via la fonction SQL `apply_plan`
- `src/lib/domain/` : règles métier pures (relances, score de matching, gabarits…), testées
- `supabase/migrations/` : schéma et règles de la base ; `supabase/tests/verification.sql` : contrôle de sécurité
- `scripts/local-import.ts` : import unique d'une sauvegarde de la version locale (script SQL généré)
- `tests/` : Vitest ; `tests/e2e/` : page d'essai et scénarios d'interface

## Licence

MIT
