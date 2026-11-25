import { RotateCcw, Save } from "lucide-react";
import { useRef, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Field } from "@/components/field";
import { Panel } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { TEMPLATE_VARIABLES } from "@/lib/domain/templates";
import { cn } from "@/lib/utils";
import { resetTemplateAction, updateTemplateAction } from "@/actions/features";
import type { Template } from "@/lib/types";

/** Gabarits de prompts (Claude) et de messages, avec insertion des {variables}. */
export function TemplatesEditor({ templates }: { templates: Template[] }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? null);
  const selected = templates.find((t) => t.id === selectedId);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <nav className="grid content-start gap-3">
        {(["prompt", "message"] as const).map((kind) => (
          <section key={kind}>
            <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">{kind === "prompt" ? "Prompts pour Claude" : "Messages"}</h3>
            <ul className="grid gap-0.5">
              {templates
                .filter((t) => t.kind === kind)
                .map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground",
                        t.id === selectedId && "bg-muted font-medium text-foreground",
                      )}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </nav>
      {selected && <TemplateForm key={`${selected.id}-${selected.updatedAt}`} template={selected} />}
    </div>
  );
}

function TemplateForm({ template }: { template: Template }) {
  const { pending, run } = useAction();
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBody] = useState(template.body);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dirty = name !== template.name || subject !== (template.subject ?? "") || body !== template.body;

  function insert(variable: string) {
    const el = bodyRef.current;
    const token = `{${variable}}`;
    if (!el) return setBody((b) => b + token);
    const { selectionStart: start, selectionEnd: end } = el;
    setBody((b) => b.slice(0, start) + token + b.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <Panel
      title={template.kind === "prompt" ? "Prompt" : "Message"}
      actions={
        <>
          <ConfirmButton
            title="Revenir au texte d'origine ?"
            description="Tes modifications de ce gabarit seront perdues."
            confirmLabel="Réinitialiser"
            onConfirm={() => run(() => resetTemplateAction(template.id), { success: "Gabarit réinitialisé" })}
          >
            <Button variant="ghost" size="sm" disabled={pending}>
              <RotateCcw /> Réinitialiser
            </Button>
          </ConfirmButton>
          <Button
            size="sm"
            disabled={pending || !dirty || !body.trim()}
            onClick={() => run(() => updateTemplateAction(template.id, { name, subject: subject || null, body }), { success: "Gabarit enregistré" })}
          >
            <Save /> Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-3 py-2">
        <div className={cn("grid gap-3", template.kind === "message" && "sm:grid-cols-2")}>
          <Field label="Nom" htmlFor="tpl-name">
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {template.kind === "message" && template.key !== "linkedin" && (
            <Field label="Objet de l'email" htmlFor="tpl-subject">
              <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Texte" htmlFor="tpl-body">
          <Textarea id="tpl-body" ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={18} className="font-mono text-xs leading-relaxed" />
        </Field>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Variables (clic pour insérer au curseur) :</p>
          <ul className="flex flex-wrap gap-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <li key={v.key}>
                <button
                  type="button"
                  title={v.label}
                  onClick={() => insert(v.key)}
                  className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] hover:bg-accent"
                >
                  {`{${v.key}}`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
