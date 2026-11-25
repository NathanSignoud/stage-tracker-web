import { useNavigate } from "react-router";
import { useState } from "react";
import { Field, OptionSelect } from "@/components/field";
import { TagsInput } from "@/components/tags-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImportOfferButton } from "@/components/offer/import-offer-button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import {
  PRIORITY_LABELS,
  REMOTE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  type Priority,
  type RemoteMode,
  type Source,
  type Status,
} from "@/lib/domain/constants";
import type { Application } from "@/lib/types";
import { createApplicationAction, updateApplicationAction } from "@/actions/applications";

type FormState = {
  company: string;
  title: string;
  offerUrl: string;
  offerText: string;
  source: Source | null;
  location: string;
  remote: RemoteMode | null;
  duration: string;
  startDate: string;
  stipend: string;
  deadline: string;
  sentDate: string;
  priority: Priority;
  notes: string;
  tags: string[];
  status: Status;
};

function toForm(app: Application | null, tags: string[]): FormState {
  return {
    company: app?.company ?? "",
    title: app?.title ?? "",
    offerUrl: app?.offerUrl ?? "",
    offerText: app?.offerText ?? "",
    source: app?.source ?? null,
    location: app?.location ?? "",
    remote: app?.remote ?? null,
    duration: app?.duration ?? "6 mois",
    startDate: app?.startDate ?? "",
    stipend: app?.stipend ?? "",
    deadline: app?.deadline ?? "",
    sentDate: app?.sentDate ?? "",
    priority: app?.priority ?? 2,
    notes: app?.notes ?? "",
    tags,
    status: app?.status ?? "to_explore",
  };
}

const PRIORITY_OPTIONS = ([1, 2, 3] as const).map((p) => [String(p) as "1" | "2" | "3", `P${p} · ${PRIORITY_LABELS[p]}`] as const);

function ApplicationFormDialog({
  application,
  tags = [],
  tagSuggestions = [],
  trigger,
}: {
  application: Application | null;
  tags?: string[];
  tagSuggestions?: string[];
  trigger: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(application, tags));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key: keyof FormState) => ({
    id: `app-${key}`,
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (application) {
      run(() => updateApplicationAction(application.id, form), {
        success: "Candidature mise à jour",
        onSuccess: () => setOpen(false),
      });
    } else {
      run(() => createApplicationAction({ ...form }), {
        onSuccess: (id) => {
          setOpen(false);
          navigate(`/candidatures/${id}`);
        },
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setForm(toForm(application, tags));
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{application ? `Modifier · ${application.company}` : "Nouvelle candidature"}</DialogTitle>
          <DialogDescription>Seule l&apos;entreprise est obligatoire.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Entreprise *" htmlFor="app-company">
            <Input {...text("company")} required autoFocus />
          </Field>
          <Field label="Intitulé du poste" htmlFor="app-title">
            <Input {...text("title")} />
          </Field>
          <Field label="Lien de l'offre" htmlFor="app-offerUrl" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input {...text("offerUrl")} type="url" placeholder="https://…" />
              <ImportOfferButton
                url={form.offerUrl}
                onImported={(o) =>
                  setForm((f) => ({
                    ...f,
                    company: f.company || o.company || "",
                    title: f.title || o.title || "",
                    location: f.location || o.location || "",
                    deadline: f.deadline || o.deadline || "",
                    remote: f.remote ?? o.remote,
                    offerText: o.offerText ?? f.offerText,
                  }))
                }
              />
            </div>
          </Field>
          {!application && (
            <Field label="Statut" htmlFor="app-status">
              <OptionSelect id="app-status" value={form.status} options={STATUS_LABELS} onChange={(v) => set("status", v ?? "to_explore")} />
            </Field>
          )}
          <Field label="Priorité" htmlFor="app-priority">
            <OptionSelect
              id="app-priority"
              value={String(form.priority) as "1" | "2" | "3"}
              options={PRIORITY_OPTIONS}
              onChange={(v) => set("priority", Number(v ?? 2) as Priority)}
            />
          </Field>
          <Field label="Source" htmlFor="app-source">
            <OptionSelect id="app-source" value={form.source} options={SOURCE_LABELS} allowEmpty onChange={(v) => set("source", v)} />
          </Field>
          <Field label="Lieu" htmlFor="app-location">
            <Input {...text("location")} placeholder="Paris, Saclay…" />
          </Field>
          <Field label="Télétravail" htmlFor="app-remote">
            <OptionSelect id="app-remote" value={form.remote} options={REMOTE_LABELS} allowEmpty onChange={(v) => set("remote", v)} />
          </Field>
          <Field label="Durée" htmlFor="app-duration">
            <Input {...text("duration")} />
          </Field>
          <Field label="Date de début" htmlFor="app-startDate">
            <Input {...text("startDate")} placeholder="février 2027" />
          </Field>
          <Field label="Gratification" htmlFor="app-stipend">
            <Input {...text("stipend")} placeholder="1 400 € / mois" />
          </Field>
          <Field label="Date limite de candidature" htmlFor="app-deadline">
            <Input {...text("deadline")} type="date" />
          </Field>
          <Field
            label="Date d'envoi"
            htmlFor="app-sentDate"
            hint={application?.status === "sent" ? "Modifier cette date recale la relance en attente." : undefined}
          >
            <Input {...text("sentDate")} type="date" />
          </Field>
          <Field label="Tags" htmlFor="app-tags" className="sm:col-span-2">
            <TagsInput id="app-tags" value={form.tags} onChange={(t) => set("tags", t)} suggestions={tagSuggestions} />
          </Field>
          <Field label="Notes" htmlFor="app-notes" className="sm:col-span-2">
            <Textarea {...text("notes")} rows={3} />
          </Field>
          <Field label="Texte complet de l'offre (copié-collé)" htmlFor="app-offerText" className="sm:col-span-2">
            <Textarea {...text("offerText")} rows={6} className="font-mono text-xs" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending || !form.company.trim()}>
              {application ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewApplicationButton({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationFormDialog
      application={null}
      trigger={
        <Button variant="outline" size="sm">
          {children}
        </Button>
      }
    />
  );
}

export function EditApplicationButton({
  application,
  tags,
  tagSuggestions,
  children,
}: {
  application: Application;
  tags: string[];
  tagSuggestions: string[];
  children: React.ReactNode;
}) {
  return (
    <ApplicationFormDialog
      application={application}
      tags={tags}
      tagSuggestions={tagSuggestions}
      trigger={
        <Button variant="outline" size="sm">
          {children}
        </Button>
      }
    />
  );
}
