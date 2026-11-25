import { Check, Copy, Mail, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, OptionSelect } from "@/components/field";
import { useUi, type MessageTarget } from "@/components/ui-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { copyText } from "@/lib/clipboard";
import { mailtoUrl } from "@/lib/domain/templates";
import { cn } from "@/lib/utils";
import { messageComposerAction, recordMessageSentAction, type MessageComposer } from "@/actions/features";

/** Dialogue global « Rédiger un message » (relance, remerciement, LinkedIn…). */
export function MessageDialog() {
  const { messageTarget: target, setMessageTarget } = useUi();
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && setMessageTarget(null)}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rédiger un message</DialogTitle>
          <DialogDescription>Pré-rempli depuis la candidature : relis, ajuste, puis copie ou ouvre ta messagerie.</DialogDescription>
        </DialogHeader>
        {target && <Composer key={`${target.applicationId}-${target.templateKey ?? ""}`} target={target} onDone={() => setMessageTarget(null)} />}
      </DialogContent>
    </Dialog>
  );
}

function Composer({ target, onDone }: { target: MessageTarget; onDone: () => void }) {
  const { pending, run } = useAction();
  const [data, setData] = useState<MessageComposer | null>(null);
  const [key, setKey] = useState<string>("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  function choose(composer: MessageComposer, templateKey: string) {
    const t = composer.templates.find((x) => x.key === templateKey) ?? composer.templates[0];
    if (!t) return;
    setKey(t.key);
    setSubject(t.subject ?? "");
    setBody(t.body);
  }

  useEffect(() => {
    let cancelled = false;
    messageComposerAction(target.applicationId).then((res) => {
      if (cancelled) return;
      if (!res.ok) return toast.error(res.error);
      setData(res.data);
      setContactId(res.data.contacts.find((c) => c.email)?.id.toString() ?? res.data.contacts[0]?.id.toString() ?? null);
      choose(res.data, target.templateKey ?? res.data.suggestedKey);
    });
    return () => {
      cancelled = true;
    };
  }, [target.applicationId, target.templateKey]);

  if (!data) return <Skeleton className="h-72 w-full" />;
  const template = data.templates.find((t) => t.key === key);
  const contact = data.contacts.find((c) => String(c.id) === contactId);
  const isLinkedIn = key === "linkedin";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Modèle">
        {data.templates.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={t.key === key}
            onClick={() => choose(data, t.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
              t.key === key && "border-foreground/30 bg-muted font-medium text-foreground",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      {template && template.missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            À compléter : {template.missing.map((m) => `[${m}]`).join(", ")}.{" "}
            {template.missing.some((m) => m.startsWith("mon_")) && "Renseigne ton nom et tes coordonnées dans Réglages → Profil. "}
            {template.missing.some((m) => m.startsWith("contact")) && "Ajoute un contact à la candidature."}
          </span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Destinataire" htmlFor="msg-contact">
          <OptionSelect
            id="msg-contact"
            value={contactId}
            onChange={setContactId}
            allowEmpty
            placeholder="Aucun contact"
            options={data.contacts.map((c) => [String(c.id), c.email ? `${c.name} · ${c.email}` : `${c.name} (pas d'email)`] as const)}
          />
        </Field>
        {!isLinkedIn && (
          <Field label="Objet" htmlFor="msg-subject">
            <Input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
        )}
      </div>
      <Field label="Message" htmlFor="msg-body">
        <Textarea id="msg-body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} className="text-[13px] leading-relaxed" />
      </Field>
      {isLinkedIn && <p className="text-xs text-muted-foreground">{body.length} / 300 caractères (limite d&apos;une note d&apos;invitation).</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await copyText(isLinkedIn ? body : `${subject}\n\n${body}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} Copier
        </Button>
        {!isLinkedIn && (
          <Button variant="outline" size="sm" asChild>
            <a href={mailtoUrl({ to: contact?.email, subject, body })}>
              <Mail /> Ouvrir dans ma messagerie
            </a>
          </Button>
        )}
        <Button
          size="sm"
          disabled={pending || !body.trim() || !template}
          title="Ajoute l'échange à la timeline (et coche la relance / le remerciement)"
          onClick={() =>
            run(
              () =>
                recordMessageSentAction(target.applicationId, {
                  templateKey: key,
                  templateName: template!.name,
                  contactId: contactId ? Number(contactId) : null,
                  subject: isLinkedIn ? null : subject,
                  body,
                }),
              { success: "Message enregistré dans la timeline", onSuccess: onDone },
            )
          }
        >
          <Check /> Marquer comme envoyé
        </Button>
      </div>
    </div>
  );
}
