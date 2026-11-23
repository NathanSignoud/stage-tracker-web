import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

const CONTACT_EMAIL = "signoudnat@cy-tech.fr";
const UPDATED = "23 novembre 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 grid gap-2 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/** Page publique (sans connexion), exigée par Google pour la connexion « Continuer avec Google ». */
export function PrivacyPage() {
  const mail = (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline">
      {CONTACT_EMAIL}
    </a>
  );
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Stage Tracker
      </Link>
      <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight">Règles de confidentialité</h1>
      <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : {UPDATED}</p>

      <Section title="Qui gère ce site">
        <p>
          Stage Tracker est un outil de suivi de candidatures de stage, géré par Nathan Signoud à titre personnel et non
          commercial, pour un petit groupe de personnes invitées. Contact : {mail}.
        </p>
      </Section>

      <Section title="Les données concernées">
        <p>
          <strong className="text-foreground">Pour te connecter</strong> : ton adresse email. Avec « Continuer avec Google »,
          Google nous transmet uniquement ton nom, ton adresse email et ta photo de profil. Nous n&apos;avons accès à rien
          d&apos;autre de ton compte Google (ni Gmail, ni Drive, ni Agenda, ni tes contacts).
        </p>
        <p>
          <strong className="text-foreground">Ce que tu saisis</strong> : tes candidatures, les entreprises, les contacts
          (noms, emails, téléphones de recruteurs), les échanges, les tâches et les documents que tu ajoutes (CV, lettres).
        </p>
      </Section>

      <Section title="À quoi elles servent">
        <p>
          Uniquement à faire fonctionner l&apos;application pour toi : afficher ton suivi, te rappeler les relances, préparer
          tes entretiens. Pas de publicité, pas de revente, pas de mesure d&apos;audience. Chaque compte ne voit que ses
          propres données.
        </p>
        <p>
          L&apos;utilisation des informations reçues des API Google respecte le règlement sur les données utilisateur des
          services d&apos;API Google (Google API Services User Data Policy), y compris les exigences d&apos;utilisation
          limitée (Limited Use).
        </p>
      </Section>

      <Section title="Où elles sont stockées">
        <p>
          Chez Supabase (base de données, connexion, fichiers) ; le site lui-même est diffusé par Cloudflare. En tant
          qu&apos;administrateur du projet, Nathan Signoud peut techniquement accéder aux données stockées : il ne le fait
          que pour la maintenance du service ou à ta demande.
        </p>
      </Section>

      <Section title="Cookies et stockage local">
        <p>
          Aucun cookie publicitaire ni de mesure d&apos;audience. Ton navigateur garde seulement ta session de connexion et
          ton choix de thème clair ou sombre.
        </p>
      </Section>

      <Section title="Durée de conservation et suppression">
        <p>
          Tes données sont gardées tant que ton compte existe. Sur simple demande à {mail}, ton compte et toutes tes données
          sont supprimés sous 30 jours.
        </p>
      </Section>

      <Section title="Tes droits">
        <p>
          Tu peux demander l&apos;accès à tes données, leur correction, leur export ou leur suppression en écrivant à {mail}.
          Tu peux aussi adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </Section>
    </main>
  );
}
