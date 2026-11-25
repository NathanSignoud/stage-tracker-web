import { useState } from "react";
import { Field, OptionSelect } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { COMPANY_STATUS_LABELS, type CompanyStatus } from "@/lib/domain/constants";
import type { Company } from "@/lib/types";
import { createCompanyAction, updateCompanyAction } from "@/actions/companies";

type FormState = { name: string; careersUrl: string; location: string; sector: string; notes: string; status: CompanyStatus };

function toForm(c: Company | null): FormState {
  return {
    name: c?.name ?? "",
    careersUrl: c?.careersUrl ?? "",
    location: c?.location ?? "",
    sector: c?.sector ?? "",
    notes: c?.notes ?? "",
    status: c?.status ?? "to_explore",
  };
}

/** Ajout ou modification d'une entreprise de la liste (dialogue contrôlé). */
export function CompanyFormDialog({
  company,
  open,
  onOpenChange,
}: {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { pending, run } = useAction();
  const [form, setForm] = useState(() => toForm(company));
  const input = (key: Exclude<keyof FormState, "status">) => ({
    id: `co-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setForm(toForm(company));
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{company ? `Modifier · ${company.name}` : "Nouvelle entreprise"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run<number | void>(() => (company ? updateCompanyAction(company.id, form) : createCompanyAction(form)), {
              success: company ? "Entreprise mise à jour" : `${form.name} ajoutée à ta liste`,
              onSuccess: () => onOpenChange(false),
            });
          }}
        >
          <Field label="Entreprise *" htmlFor="co-name">
            <Input {...input("name")} required autoFocus />
          </Field>
          {!company && (
            <Field label="Statut" htmlFor="co-status">
              <OptionSelect id="co-status" value={form.status} options={COMPANY_STATUS_LABELS} onChange={(v) => setForm({ ...form, status: v ?? "to_explore" })} />
            </Field>
          )}
          <Field label="Site carrière" htmlFor="co-careersUrl" className="sm:col-span-2">
            <Input {...input("careersUrl")} placeholder="https://…/careers" />
          </Field>
          <Field label="Localisation" htmlFor="co-location">
            <Input {...input("location")} placeholder="Paris, Lyon…" />
          </Field>
          <Field label="Secteur" htmlFor="co-sector">
            <Input {...input("sector")} />
          </Field>
          <Field label="Notes" htmlFor="co-notes" className="sm:col-span-2">
            <Textarea {...input("notes")} rows={3} placeholder="Pourquoi elle t'intéresse, contacts, équipe…" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending || !form.name.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
