import { cmp, rows } from "@/lib/db";
import { normalizeText } from "@/lib/text";
import type { Application, Company, Contact, Interaction } from "@/lib/types";

export type SearchResults = {
  applications: { id: number; company: string; title: string; status: string }[];
  companies: { id: number; name: string; detail: string }[];
  contacts: { id: number; name: string; detail: string }[];
  interactions: { id: number; applicationId: number | null; contactId: number | null; summary: string; detail: string; date: string }[];
};

/**
 * Recherche globale (Ctrl+K), insensible à la casse et aux accents ; tous les mots doivent
 * apparaître. Volume de données modeste : le filtrage se fait en mémoire.
 */
export async function search(query: string, limit = 8): Promise<SearchResults> {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return { applications: [], companies: [], contacts: [], interactions: [] };
  const matches = (...fields: (string | null | undefined)[]) => {
    const haystack = normalizeText(fields.filter(Boolean).join(" "));
    return terms.every((t) => haystack.includes(t));
  };
  const [apps, companies, contacts, interactions] = await Promise.all([
    rows<Application>("applications", { deletedAt: null }),
    rows<Company>("companies", { deletedAt: null }),
    rows<Contact>("contacts"),
    rows<Interaction>("interactions", { deletedAt: null }),
  ]);
  const company = (id: number | null) => (id && apps.find((a) => a.id === id)?.company) || null;
  const contactName = (id: number | null) => (id && contacts.find((c) => c.id === id)?.name) || null;

  return {
    applications: apps
      .filter((a) => matches(a.company, a.title, a.location, a.notes, a.offerText))
      .slice(0, limit)
      .map((a) => ({ id: a.id, company: a.company, title: a.title, status: a.status })),
    companies: companies
      .filter((c) => matches(c.name, c.location, c.sector, c.notes))
      .slice(0, limit)
      .map((c) => ({ id: c.id, name: c.name, detail: [c.sector, c.location].filter(Boolean).join(" · ") })),
    contacts: contacts
      .filter((c) => !c.deletedAt && matches(c.name, c.role, c.company, c.email, c.howWeMet, c.notes))
      .slice(0, limit)
      .map((c) => ({ id: c.id, name: c.name, detail: [c.role, c.company].filter(Boolean).join(" · ") })),
    interactions: interactions
      .filter((i) => matches(i.summary, i.content, company(i.applicationId), contactName(i.contactId)))
      .sort((a, b) => cmp(b.date, a.date))
      .slice(0, limit)
      .map((i) => ({
        id: i.id,
        applicationId: i.applicationId,
        contactId: i.contactId,
        summary: i.summary,
        detail: [company(i.applicationId), contactName(i.contactId)].filter(Boolean).join(" · "),
        date: i.date,
      })),
  };
}
