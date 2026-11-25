import { Plus } from "lucide-react";
import { useState } from "react";
import { OptionSelect } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { createTaskAction } from "@/actions/records";

/** Ajout d'une tâche en une ligne (titre + échéance, et candidature si non imposée). */
export function AddTaskForm({
  applicationId,
  applications,
}: {
  applicationId?: number;
  /** Proposé uniquement quand la tâche n'est pas créée depuis une fiche. */
  applications?: { id: number; company: string }[];
}) {
  const { pending, run } = useAction();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [appId, setAppId] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(() => createTaskAction({ title, dueDate, applicationId: applicationId ?? appId }), {
      onSuccess: () => {
        setTitle("");
        setDueDate("");
      },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 pt-1">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nouvelle tâche…"
        className="h-8 min-w-40 flex-1"
      />
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 w-36" aria-label="Échéance" />
      {applications && (
        <OptionSelect
          value={appId}
          onChange={setAppId}
          allowEmpty
          placeholder="Sans candidature"
          options={applications.map((a) => [String(a.id), a.company] as const)}
          className="h-8 w-44"
        />
      )}
      <Button type="submit" size="sm" variant="outline" disabled={pending || !title.trim()}>
        <Plus /> Ajouter
      </Button>
    </form>
  );
}
