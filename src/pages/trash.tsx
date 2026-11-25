import { PageHeader } from "@/components/page-header";
import { TrashList } from "@/components/trash-list";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { listTrash } from "@/services/trash";

export function TrashPage() {
  const { data: items, error } = useData(listTrash);
  if (!items) return <PageLoading error={error} />;
  return (
    <div className="mx-auto max-w-4xl">
      <title>Corbeille · Stage Tracker</title>
      <PageHeader
        title="Corbeille"
        description="Rien n'est effacé tant que tu ne le supprimes pas définitivement ici."
      />
      <TrashList items={items} />
    </div>
  );
}
