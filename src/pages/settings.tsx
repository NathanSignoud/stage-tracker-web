import { Link, useSearchParams } from "react-router";
import { PageHeader, Panel } from "@/components/page-header";
import { DownloadDataButton, SettingsForm } from "@/components/settings-form";
import { KeywordsManager } from "@/components/settings/keywords-manager";
import { TemplatesEditor } from "@/components/settings/templates-editor";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { cn } from "@/lib/utils";
import { listKeywords } from "@/services/keywords";
import { getSettings } from "@/services/settings";
import { listTemplates } from "@/services/templates";

const TABS = [
  ["profil", "Profil et suivi"],
  ["mots-cles", "Mots-clés"],
  ["gabarits", "Gabarits"],
  ["donnees", "Mes données"],
] as const;
type Tab = (typeof TABS)[number][0];

export function SettingsPage() {
  const onglet = useSearchParams()[0].get("onglet");
  const tab: Tab = TABS.some(([key]) => key === onglet) ? (onglet as Tab) : "profil";

  return (
    <div className="mx-auto max-w-5xl">
      <title>Réglages · Stage Tracker</title>
      <PageHeader title="Réglages" />
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Sections des réglages">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            to={`/reglages?onglet=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent px-3 py-2 text-[13px] whitespace-nowrap text-muted-foreground hover:text-foreground",
              tab === key && "border-foreground font-medium text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "profil" && <Loaded load={getSettings}>{(settings) => <SettingsForm settings={settings} />}</Loaded>}
      {tab === "mots-cles" && <Loaded load={listKeywords}>{(keywords) => <KeywordsManager keywords={keywords} />}</Loaded>}
      {tab === "gabarits" && <Loaded load={() => listTemplates()}>{(templates) => <TemplatesEditor templates={templates} />}</Loaded>}
      {tab === "donnees" && <MyData />}
    </div>
  );
}

/** Charge les données d'un onglet. */
function Loaded<T>({ load, children }: { load: () => Promise<T>; children: (data: T) => React.ReactNode }) {
  const { data, error } = useData(load);
  return data === undefined ? <PageLoading error={error} /> : children(data);
}

function MyData() {
  return (
    <Panel title="Mes données" actions={<DownloadDataButton />}>
      <p className="py-2 text-[13px] text-muted-foreground">
        Tes données sont enregistrées en ligne (Supabase), visibles par toi seul. Télécharge-en une copie quand tu veux : un fichier JSON
        avec toutes tes candidatures, contacts, tâches, documents et réglages.
      </p>
    </Panel>
  );
}
