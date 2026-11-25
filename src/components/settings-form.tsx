import { DatabaseBackup } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Panel } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import type { AppSettings } from "@/lib/domain/settings";
import { updateSettingsAction } from "@/actions/records";
import { errorMessage } from "@/actions/result";
import { downloadText } from "@/lib/download";
import { exportMyData } from "@/services/backup";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState(settings);
  const setProfile = (key: keyof AppSettings["profile"], value: string) =>
    setForm((f) => ({ ...f, profile: { ...f.profile, [key]: value } }));
  const setNumber = (key: Exclude<keyof AppSettings, "profile" | "thankYouReminder">, value: string) =>
    setForm((f) => ({ ...f, [key]: value === "" ? ("" as unknown as number) : Number(value) }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateSettingsAction(form), { success: "Réglages enregistrés" });
      }}
      className="grid gap-4"
    >
      <Panel title="Mon profil">
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <Field label="Nom complet" htmlFor="st-name" hint="Signe les messages, nomme les lettres exportées.">
            <Input id="st-name" value={form.profile.fullName} onChange={(e) => setProfile("fullName", e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="st-email">
            <Input id="st-email" type="email" value={form.profile.email} onChange={(e) => setProfile("email", e.target.value)} />
          </Field>
          <Field label="Téléphone" htmlFor="st-phone">
            <Input id="st-phone" type="tel" value={form.profile.phone} onChange={(e) => setProfile("phone", e.target.value)} />
          </Field>
          <Field label="LinkedIn" htmlFor="st-linkedin">
            <Input id="st-linkedin" value={form.profile.linkedin} placeholder="https://www.linkedin.com/in/…" onChange={(e) => setProfile("linkedin", e.target.value)} />
          </Field>
          <Field
            label="Présentation courte"
            htmlFor="st-summary"
            className="sm:col-span-2"
            hint="Formation, spécialité, points forts, projets marquants : transmis à Claude dans les prompts."
          >
            <Textarea id="st-summary" rows={3} value={form.profile.summary} onChange={(e) => setProfile("summary", e.target.value)} />
          </Field>
          <Field label="Début de stage souhaité" htmlFor="st-start">
            <Input id="st-start" value={form.profile.startDate} placeholder="février 2027" onChange={(e) => setProfile("startDate", e.target.value)} />
          </Field>
          <Field label="Localisation souhaitée" htmlFor="st-location">
            <Input id="st-location" value={form.profile.location} placeholder="Île-de-France, remote" onChange={(e) => setProfile("location", e.target.value)} />
          </Field>
          <Field label="Domaines visés" htmlFor="st-domains" className="sm:col-span-2">
            <Textarea id="st-domains" rows={2} value={form.profile.domains} placeholder="ML, NLP, vision, MLOps…" onChange={(e) => setProfile("domains", e.target.value)} />
          </Field>
          <Field label="Compétences clés" htmlFor="st-skills" className="sm:col-span-2" hint="Utilisé dans les prompts. Les compétences du score de matching se gèrent dans l'onglet Mots-clés.">
            <Textarea id="st-skills" rows={3} value={form.profile.skills} onChange={(e) => setProfile("skills", e.target.value)} />
          </Field>
        </div>
      </Panel>

      <Panel title="Relances et suivi">
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <Field label="1re relance après l'envoi (jours)" htmlFor="st-fu1" hint="0 = pas de relance automatique.">
            <Input id="st-fu1" type="number" min={0} max={365} value={form.followUpDelayDays} onChange={(e) => setNumber("followUpDelayDays", e.target.value)} />
          </Field>
          <Field label="2e relance après « Relancée » (jours)" htmlFor="st-fu2" hint="0 = désactivée.">
            <Input id="st-fu2" type="number" min={0} max={365} value={form.secondFollowUpDelayDays} onChange={(e) => setNumber("secondFollowUpDelayDays", e.target.value)} />
          </Field>
          <Field label="« Sans nouvelles » au bout de (jours)" htmlFor="st-stale">
            <Input id="st-stale" type="number" min={1} max={365} value={form.staleAfterDays} onChange={(e) => setNumber("staleAfterDays", e.target.value)} />
          </Field>
          <Field label="Objectif de candidatures envoyées par semaine" htmlFor="st-goal">
            <Input id="st-goal" type="number" min={0} max={100} value={form.weeklyGoal} onChange={(e) => setNumber("weeklyGoal", e.target.value)} />
          </Field>
          <Field label="Relance après un entretien (jours)" htmlFor="st-fu-int" hint="0 = désactivée. Annulée dès que la candidature bouge.">
            <Input id="st-fu-int" type="number" min={0} max={365} value={form.postInterviewFollowUpDays} onChange={(e) => setNumber("postInterviewFollowUpDays", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
            <Checkbox checked={form.thankYouReminder} onCheckedChange={(v) => setForm((f) => ({ ...f, thankYouReminder: v === true }))} />
            Tâche « Envoyer un remerciement » le lendemain de chaque entretien
          </label>
        </div>
      </Panel>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/** Télécharge toutes tes données (JSON) : une copie à garder, ou à réimporter plus tard. */
export function DownloadDataButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const data = await exportMyData();
          downloadText(`stage-tracker-${data.exportedAt.slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setPending(false);
        }
      }}
    >
      <DatabaseBackup /> Télécharger mes données (JSON)
    </Button>
  );
}
