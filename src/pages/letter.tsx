import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { NotFound } from "@/pages/coming-soon";
import { LetterEditor } from "@/components/letters/letter-editor";
import { PageHeader } from "@/components/page-header";
import { PromptButton } from "@/components/prompts/prompt-button";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { getApplicationDetail } from "@/services/applications";
import { getBaseDocument, listApplicationLetters } from "@/services/documents";

async function load(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const detail = await getApplicationDetail(id);
  if (!detail || detail.application.deletedAt) return null;
  const [letters, base] = await Promise.all([listApplicationLetters(id), getBaseDocument("letter")]);
  const versions = letters.map((v) => ({ id: v.id, label: v.label, content: v.content, createdAt: v.createdAt, sentAt: v.sentAt }));
  return { detail, versions, baseText: base?.content ?? null };
}

export function LetterPage() {
  const id = Number(useParams().id);
  const { data, error } = useData(() => load(id), [id]);
  if (data === undefined) return <PageLoading error={error} />;
  if (data === null) return <NotFound />;
  const { detail, versions, baseText } = data;
  const app = detail.application;

  return (
    <div className="mx-auto max-w-7xl">
      <title>{`Lettre · ${app.company} · Stage Tracker`}</title>
      <Link to={`/candidatures/${id}`} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> {app.company}
      </Link>
      <PageHeader
        title={`Lettre de motivation · ${app.company}`}
        description="1. Prépare le prompt et fais rédiger la lettre par Claude · 2. Colle la version finale · 3. Enregistre et exporte."
        actions={<PromptButton applicationId={id} variant="letter" />}
      />
      <LetterEditor applicationId={id} company={app.company} baseText={baseText} versions={versions} />
    </div>
  );
}
