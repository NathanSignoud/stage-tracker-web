import { ExternalLink, Mail } from "lucide-react";
import { useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeText } from "@/lib/text";
import type { ContactListItem } from "@/services/contacts";
import { cleanUrl } from "@/lib/domain/company-import";

export function ContactsTable({ contacts }: { contacts: ContactListItem[] }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const query = normalizeText(q.trim());
    if (!query) return contacts;
    return contacts.filter((c) => normalizeText([c.name, c.role, c.company, c.email, c.howWeMet].filter(Boolean).join(" ")).includes(query));
  }, [contacts, q]);

  return (
    <div>
      <Input placeholder="Filtrer…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 h-8 w-full sm:w-64" />
      <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-9 text-xs">Nom</TableHead>
              <TableHead className="h-9 text-xs">Entreprise</TableHead>
              <TableHead className="h-9 text-xs">Rencontré·e</TableHead>
              <TableHead className="h-9 text-right text-xs">Candidatures</TableHead>
              <TableHead className="h-9 w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>
                <TableCell className="py-2">
                  <p className="font-medium">{c.name}</p>
                  {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                </TableCell>
                <TableCell className="py-2">{c.company}</TableCell>
                <TableCell className="max-w-56 truncate py-2 text-muted-foreground">{c.howWeMet}</TableCell>
                <TableCell className="py-2 text-right font-mono">{c.applicationCount}</TableCell>
                <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1 text-muted-foreground">
                    {c.email && (
                      <a href={`mailto:${c.email}`} aria-label="Email" className="hover:text-foreground">
                        <Mail className="size-4" />
                      </a>
                    )}
                    {c.linkedin && (
                      <a href={cleanUrl(c.linkedin) ?? undefined} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="hover:text-foreground">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Aucun contact.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
