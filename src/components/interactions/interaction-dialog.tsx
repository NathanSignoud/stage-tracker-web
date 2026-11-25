import { useState } from "react";
import { Field, OptionSelect } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { localDateTime } from "@/lib/dates";
import { DURATION_OPTIONS } from "@/components/interviews/schedule-interview-dialog";
import {
  INTERACTION_LABELS,
  INTERVIEW_KIND_LABELS,
  type InteractionType,
  type InterviewKind,
} from "@/lib/domain/constants";
import type { Interaction } from "@/lib/types";
import { createInteractionAction, updateInteractionAction } from "@/actions/records";

export type ContactOption = { id: number; name: string; detail?: string | null };

type FormState = {
  type: InteractionType;
  date: string;
  contactId: string | null;
  summary: string;
  content: string;
  location: string;
  interviewKind: InterviewKind;
  durationMinutes: string;
  nextAction: string;
  nextActionDate: string;
};

function toForm(i: Interaction | null, defaultContactId: number | null): FormState {
  return {
    type: i?.type ?? "email_sent",
    date: i?.date ?? localDateTime(),
    contactId: i ? (i.contactId ? String(i.contactId) : null) : defaultContactId ? String(defaultContactId) : null,
    summary: i?.summary ?? "",
    content: i?.content ?? "",
    location: i?.location ?? "",
    interviewKind: i?.interviewKind ?? "other",
    durationMinutes: i?.durationMinutes ? String(i.durationMinutes) : "",
    nextAction: i?.nextAction ?? "",
    nextActionDate: i?.nextActionDate ?? "",
  };
}

/** Création / modification d'un échange (timeline d'une candidature ou d'un contact). */
export function InteractionDialog({
  interaction = null,
  applicationId,
  defaultContactId = null,
  contacts,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  interaction?: Interaction | null;
  applicationId: number | null;
  defaultContactId?: number | null;
  contacts: ContactOption[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { pending, run } = useAction();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [form, setForm] = useState(() => toForm(interaction, defaultContactId));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      applicationId: interaction?.applicationId ?? applicationId,
      contactId: form.contactId,
      interviewKind: form.type === "interview" ? form.interviewKind : null,
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
    };
    run<number | void>(
      () => (interaction ? updateInteractionAction(interaction.id, payload) : createInteractionAction(payload)),
      {
        success: form.nextAction ? "Échange enregistré · tâche créée pour la prochaine action" : "Échange enregistré",
        onSuccess: () => setOpen(false),
      },
    );
  }

  const appointment = form.type === "interview" || form.type === "call" || form.type === "meeting";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setForm(toForm(interaction, defaultContactId));
        setOpen(o);
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{interaction ? "Modifier l'échange" : "Nouvel échange"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" htmlFor="it-type">
            <OptionSelect id="it-type" value={form.type} options={INTERACTION_LABELS} onChange={(v) => set("type", v ?? "email_sent")} />
          </Field>
          <Field label="Date et heure" htmlFor="it-date" hint="Une date future = entretien à venir.">
            <Input id="it-date" type="datetime-local" required value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Contact" htmlFor="it-contact" className="sm:col-span-2">
            <OptionSelect
              id="it-contact"
              value={form.contactId}
              allowEmpty
              placeholder="Aucun"
              options={contacts.map((c) => [String(c.id), c.detail ? `${c.name} · ${c.detail}` : c.name] as const)}
              onChange={(v) => set("contactId", v)}
            />
          </Field>
          <Field label="Résumé *" htmlFor="it-summary" className="sm:col-span-2">
            <Input
              id="it-summary"
              required
              autoFocus
              value={form.summary}
              placeholder="Ex. Premier échange RH, très positif"
              onChange={(e) => set("summary", e.target.value)}
            />
          </Field>
          {form.type === "interview" && (
            <Field label="Type d'entretien" htmlFor="it-kind">
              <OptionSelect
                id="it-kind"
                value={form.interviewKind}
                options={INTERVIEW_KIND_LABELS}
                onChange={(v) => set("interviewKind", v ?? "other")}
              />
            </Field>
          )}
          {appointment && (
            <Field label="Durée" htmlFor="it-duration" className={form.type === "interview" ? "" : "sm:col-span-2"}>
              <OptionSelect
                id="it-duration"
                value={(form.durationMinutes || null) as (typeof DURATION_OPTIONS)[number][0] | null}
                options={DURATION_OPTIONS}
                allowEmpty
                placeholder="Par défaut"
                onChange={(v) => set("durationMinutes", v ?? "")}
              />
            </Field>
          )}
          {appointment && (
            <Field label="Lieu ou lien visio" htmlFor="it-location" className="sm:col-span-2">
              <Input id="it-location" value={form.location} onChange={(e) => set("location", e.target.value)} />
            </Field>
          )}
          <Field label="Contenu brut (email, notes…)" htmlFor="it-content" className="sm:col-span-2">
            <Textarea id="it-content" rows={5} value={form.content} onChange={(e) => set("content", e.target.value)} />
          </Field>
          <Field label="Prochaine action" htmlFor="it-next" hint="Crée une tâche liée.">
            <Input id="it-next" value={form.nextAction} placeholder="Ex. Envoyer mon GitHub" onChange={(e) => set("nextAction", e.target.value)} />
          </Field>
          <Field label="Pour le" htmlFor="it-next-date">
            <Input id="it-next-date" type="date" value={form.nextActionDate} onChange={(e) => set("nextActionDate", e.target.value)} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending || !form.summary.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
