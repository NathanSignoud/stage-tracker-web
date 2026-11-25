import { useNavigate } from "react-router";
import { useState } from "react";
import { Field } from "@/components/field";
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
import type { Contact } from "@/lib/types";
import { createAndLinkContactAction } from "@/actions/applications";
import { createContactAction, updateContactAction } from "@/actions/records";

type FormState = Record<"name" | "role" | "company" | "email" | "phone" | "linkedin" | "howWeMet" | "notes", string>;

function toForm(c: Contact | null, defaultCompany?: string): FormState {
  return {
    name: c?.name ?? "",
    role: c?.role ?? "",
    company: c?.company ?? defaultCompany ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    linkedin: c?.linkedin ?? "",
    howWeMet: c?.howWeMet ?? "",
    notes: c?.notes ?? "",
  };
}

export function ContactFormDialog({
  contact = null,
  linkToApplication,
  trigger,
  openAfterCreate = false,
}: {
  contact?: Contact | null;
  /** Crée le contact et le lie directement à cette candidature. */
  linkToApplication?: { id: number; company: string };
  trigger: React.ReactNode;
  openAfterCreate?: boolean;
}) {
  const navigate = useNavigate();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(contact, linkToApplication?.company));
  const [relation, setRelation] = useState("");
  const input = (key: keyof FormState) => ({
    id: `ct-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const done = { onSuccess: (id: number | null) => {
      setOpen(false);
      if (openAfterCreate && id) navigate(`/contacts/${id}`);
    } };
    if (contact) run(() => updateContactAction(contact.id, form), { success: "Contact mis à jour", onSuccess: () => setOpen(false) });
    else if (linkToApplication) run(() => createAndLinkContactAction(linkToApplication.id, form, relation), { success: "Contact ajouté", ...done });
    else run(() => createContactAction(form), { success: "Contact créé", ...done });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setForm(toForm(contact, linkToApplication?.company));
          setRelation("");
        }
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? `Modifier · ${contact.name}` : "Nouveau contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom *" htmlFor="ct-name">
            <Input {...input("name")} required autoFocus />
          </Field>
          <Field label="Rôle" htmlFor="ct-role">
            <Input {...input("role")} placeholder="Talent acquisition, ML lead…" />
          </Field>
          <Field label="Entreprise" htmlFor="ct-company">
            <Input {...input("company")} />
          </Field>
          {linkToApplication && (
            <Field label={`Rôle pour ${linkToApplication.company}`} htmlFor="ct-relation">
              <Input id="ct-relation" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Recruteur, recommandation…" />
            </Field>
          )}
          <Field label="Email" htmlFor="ct-email">
            <Input {...input("email")} type="email" />
          </Field>
          <Field label="Téléphone" htmlFor="ct-phone">
            <Input {...input("phone")} type="tel" />
          </Field>
          <Field label="LinkedIn" htmlFor="ct-linkedin" className="sm:col-span-2">
            <Input {...input("linkedin")} placeholder="https://www.linkedin.com/in/…" />
          </Field>
          <Field label="Comment je l'ai rencontré·e" htmlFor="ct-howWeMet" className="sm:col-span-2">
            <Input {...input("howWeMet")} placeholder="Forum entreprises CY Tech, alumni…" />
          </Field>
          <Field label="Notes" htmlFor="ct-notes" className="sm:col-span-2">
            <Textarea {...input("notes")} rows={3} />
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
