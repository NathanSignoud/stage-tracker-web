import { applyPlan, cmp, insert, ref, remove, row, rows, update, upsert } from "@/lib/db";
import type { Contact, Interaction } from "@/lib/types";
import type { ContactInput } from "@/lib/validation";
import { NotFoundError } from "./applications";
import { allApplications, allContacts } from "./tables";

type ContactLink = { applicationId: number; contactId: number; relation: string | null };

export async function createContact(input: ContactInput, now = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  return (await applyPlan([insert("contacts", { ...input, createdAt: nowIso, updatedAt: nowIso })]))[0]!;
}

export async function updateContact(id: number, input: ContactInput, now = new Date()): Promise<void> {
  await applyPlan([update("contacts", { id }, { ...input, updatedAt: now.toISOString() })]);
}

/** Nouveau contact directement lié à une candidature, d'un bloc. */
export async function createAndLinkContact(applicationId: number, input: ContactInput, relation: string | null, now = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const ids = await applyPlan([
    insert("contacts", { ...input, createdAt: nowIso, updatedAt: nowIso }),
    insert("application_contacts", { applicationId, contactId: ref(0), relation }),
  ]);
  return ids[0]!;
}

export function linkContact(applicationId: number, contactId: number, relation: string | null): Promise<void> {
  return upsert("application_contacts", [{ applicationId, contactId, relation }], ["applicationId", "contactId"]);
}

export async function unlinkContact(applicationId: number, contactId: number): Promise<void> {
  await applyPlan([remove("application_contacts", { applicationId, contactId })]);
}

export async function listContacts() {
  const [contacts, links, apps] = await Promise.all([
    allContacts().then((all) => all.filter((c) => !c.deletedAt)),
    rows<ContactLink>("application_contacts"),
    allApplications(),
  ]);
  const live = new Set(apps.filter((a) => !a.deletedAt).map((a) => a.id));
  const counts = new Map<number, number>();
  for (const l of links) if (live.has(l.applicationId)) counts.set(l.contactId, (counts.get(l.contactId) ?? 0) + 1);
  return contacts.sort((a, b) => cmp(a.name, b.name)).map((c) => ({ ...c, applicationCount: counts.get(c.id) ?? 0 }));
}

export type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];

export async function getContactDetail(id: number) {
  const contact = await row<Contact>("contacts", { id });
  if (!contact) return null;
  const [links, apps, interactions] = await Promise.all([
    rows<ContactLink>("application_contacts", { contactId: id }),
    allApplications(),
    rows<Interaction>("interactions", { contactId: id, deletedAt: null }),
  ]);
  const appById = new Map(apps.map((a) => [a.id, a]));
  return {
    contact,
    applications: links
      .flatMap((l) => {
        const a = appById.get(l.applicationId);
        return a && !a.deletedAt ? [{ id: a.id, company: a.company, title: a.title, status: a.status, relation: l.relation }] : [];
      })
      .sort((a, b) => cmp(a.company, b.company)),
    interactions: interactions
      .sort((a, b) => cmp(b.date, a.date))
      .map((i) => ({ ...i, company: (i.applicationId && appById.get(i.applicationId)?.company) || null })),
  };
}

export async function requireContact(id: number): Promise<Contact> {
  const contact = await row<Contact>("contacts", { id });
  if (!contact || contact.deletedAt) throw new NotFoundError("Contact introuvable");
  return contact;
}
