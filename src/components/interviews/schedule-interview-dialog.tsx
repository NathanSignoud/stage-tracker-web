import { CalendarPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, OptionSelect } from "@/components/field";
import { useUi, type ScheduleTarget } from "@/components/ui-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { INTERVIEW_KIND_LABELS, INTERVIEW_KIND_SHORT, INTERVIEW_KINDS, type InterviewKind } from "@/lib/domain/constants";
import { downloadText } from "@/lib/download";
import { buildCalendar } from "@/lib/ics";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import { getInteractionIcsEvent } from "@/services/calendar";
import { interviewContactsAction } from "@/actions/applications";
import { createInteractionAction } from "@/actions/records";

export const DURATION_OPTIONS = [
  ["30", "30 min"],
  ["45", "45 min"],
  ["60", "1 h"],
  ["90", "1 h 30"],
  ["120", "2 h"],
  ["180", "3 h"],
] as const;

type ContactOption = { id: number; name: string; detail?: string | null };

/** Télécharge le .ics de l'entretien (fabriqué dans le navigateur) : Outlook / Apple Calendrier proposent de l'ajouter. */
export async function downloadIcs(interactionId: number) {
  const event = await getInteractionIcsEvent(interactionId, window.location.origin);
  if (!event) return toast.error("Entretien introuvable");
  const slug = normalizeText(event.title).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadText(`${slug || "entretien"}-${event.start.slice(0, 10)}.ics`, buildCalendar([event], { name: "Stage Tracker" }), "text/calendar;charset=utf-8");
}

/**
 * Dialogue global « Planifier l'entretien » : ouvert automatiquement quand une candidature
 * passe en Entretien RH / technique sans date, ou depuis un bouton « Planifier ».
 */
export function ScheduleInterviewDialog() {
  const { scheduleTarget: target, setScheduleTarget } = useUi();
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) setScheduleTarget(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Planifier l&apos;entretien{target ? ` · ${target.company}` : ""}</DialogTitle>
          <DialogDescription>La date alimente le calendrier et ton agenda Apple / Outlook.</DialogDescription>
        </DialogHeader>
        {/* Clé : un formulaire neuf à chaque ouverture. */}
        {target && (
          <ScheduleForm key={`${target.applicationId}-${target.kind}`} target={target} onDone={() => setScheduleTarget(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({ target, onDone }: { target: ScheduleTarget; onDone: () => void }) {
  const { pending, run } = useAction();
  const [kind, setKind] = useState<InterviewKind>(target.kind);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState<string>(target.kind === "test" ? "90" : "60");
  const [location, setLocation] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    interviewContactsAction(target.applicationId).then((list) => {
      if (cancelled) return;
      setContacts(list);
      setContactId((current) => current ?? (list[0] ? String(list[0].id) : null));
    });
    return () => {
      cancelled = true;
    };
  }, [target.applicationId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        createInteractionAction({
          applicationId: target.applicationId,
          contactId,
          type: "interview",
          interviewKind: kind,
          date: `${date}T${time}`,
          durationMinutes: Number(duration),
          summary: INTERVIEW_KIND_LABELS[kind],
          location,
          content: notes,
        }),
      {
        onSuccess: (id) => {
          onDone();
          toast.success(`${INTERVIEW_KIND_LABELS[kind]} avec ${target.company} planifié`, {
            description: "Ajoute-le à Outlook ou Apple Calendrier :",
            action: { label: "Ajouter à mon agenda", onClick: () => downloadIcs(id) },
            duration: 10_000,
          });
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid grid-cols-4 gap-1 rounded-lg border p-0.5" role="radiogroup" aria-label="Type d'entretien">
        {INTERVIEW_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "rounded-md px-1 py-1.5 text-xs text-muted-foreground transition-colors",
              kind === k && "bg-muted font-medium text-foreground",
            )}
          >
            {INTERVIEW_KIND_SHORT[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label="Date *" htmlFor="si-date">
          <Input id="si-date" type="date" required autoFocus value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure *" htmlFor="si-time">
          <Input id="si-time" type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Durée" htmlFor="si-duration">
          <OptionSelect
            id="si-duration"
            value={duration as (typeof DURATION_OPTIONS)[number][0]}
            options={DURATION_OPTIONS}
            onChange={(v) => setDuration(v ?? "60")}
          />
        </Field>
        <Field label="Lieu ou lien visio" htmlFor="si-location">
          <Input id="si-location" value={location} placeholder="Teams, adresse…" onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </div>
      <Field label="Avec" htmlFor="si-contact">
        <OptionSelect
          id="si-contact"
          value={contactId}
          onChange={setContactId}
          allowEmpty
          placeholder="Personne pas encore connue"
          options={contacts.map((c) => [String(c.id), c.detail ? `${c.name} · ${c.detail}` : c.name] as const)}
        />
      </Field>
      <Field label="Notes" htmlFor="si-notes">
        <Textarea id="si-notes" rows={2} value={notes} placeholder="Format, interlocuteurs, à préparer…" onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onDone} title="Le tableau de bord te rappellera de fixer la date">
          Date pas encore connue
        </Button>
        <Button type="submit" disabled={pending || !date || !time}>
          <CalendarPlus /> Planifier
        </Button>
      </DialogFooter>
    </form>
  );
}
