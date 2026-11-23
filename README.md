# Stage Tracker (version en ligne)

Suivi de candidatures de stage, sur invitation. Site statique (Vite + React) servi par Cloudflare Workers ;
base de données, connexion et fichiers chez Supabase. Chaque compte ne voit que ses propres données.

> En cours de portage depuis la version locale : connexion et invitations sont prêtes, les autres pages arrivent.

## Développement

Prérequis : Node.js 22 ou plus.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # vérifie les types puis construit dist/
```

Le fichier `.env` contient l'adresse du projet Supabase et sa clé **publique** (pas de secret dans ce dépôt).

## Mise en place de Supabase (une fois)

1. **SQL Editor** : coller `supabase/migrations/20261123000000_invitations.sql`, en remplaçant l'adresse du premier
   administrateur à la dernière ligne, puis exécuter.
2. **Authentication → Hooks → Before User Created** : choisir la fonction `public.hook_before_user_created`. Toute
   création de compte hors de la liste d'invitations est alors refusée (Google comme lien par email).
3. **Authentication → URL Configuration** : *Site URL* = l'adresse du site ; *Redirect URLs* = `<adresse du site>/**`
   et `http://localhost:5173/**`.
4. **Authentication → Sign In / Providers** : Google (identifiants du client OAuth) et Email ; pour envoyer les liens
   à d'autres personnes que soi, configurer un SMTP (ex. Gmail + mot de passe d'application).

## Déploiement

Cloudflare → Workers & Pages → le Worker relié à ce dépôt (branche `main`) : commande de build `npm run build`,
commande de déploiement `npx wrangler deploy`. Chaque `git push` sur `main` met le site à jour.
`public/_headers` (copié dans `dist/`) applique la politique de sécurité (CSP limitée au projet Supabase, pas
d'iframe, HSTS…). Vérifier : `curl -sI <adresse> | grep -i content-security`.

## Structure

- `src/pages/` : écrans (connexion, confidentialité, invitations…)
- `src/components/` : interface (navigation, composants shadcn)
- `src/auth.tsx` : session, accès réservé aux personnes connectées, droit admin
- `src/lib/supabase.ts` : client Supabase
- `supabase/migrations/` : schéma et règles de la base
