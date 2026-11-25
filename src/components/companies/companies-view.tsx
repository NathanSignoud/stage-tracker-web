import { ExternalLink, MoreHorizontal, Pencil, Plus, Send, Trash2, Users } from "lucide-react";
import { Link } from "react-router";
import { useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { CompanyMark } from "@/components/company-mark";
import { ConfirmDialog } from "@/components/confirm-button";
import { OptionSelect } from "@/components/field";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/components/use-action";
import { COMPANY_STATUS_LABELS, type CompanyStatus } from "@/lib/domain/constants";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import { createApplicationFromCompanyAction, setCompanyStatusAction } from "@/actions/companies";
import { moveToTrashAction } from "@/actions/records";
import type { CompanyListItem } from "@/services/companies";

type Filter = "all" | "to_explore" | "interesting" | "applied" | "dismissed";

const FILTERS: [Filter, string][] = [
  ["all", "Toutes"],
  ["to_explore", "À explorer"],
  ["interesting", "Intéressantes"],
  ["applied", "Avec candidature"],
  ["dismissed", "Écartées"],
];

function matches(c: CompanyListItem, filter: Filter): boolean {
  const applied = c.applications.length > 0;
  if (filter === "all") return true;
  if (filter === "applied") return applied;
  if (filter === "dismissed") return c.status === "dismissed";
  return !applied && c.status === filter;
}

const domain = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export function CompaniesView({ companies, initialQuery = "" }: { companies: CompanyListItem[]; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const query = normalizeText(q.trim());
  const visible = useMemo(
    () =>
      companies.filter(
        (c) =>
          matches(c, filter) &&
          (!query || normalizeText([c.name, c.location, c.sector, c.notes].filter(Boolean).join(" ")).includes(query)),
      ),
    [companies, filter, query],
  );

  return (
    // grid-cols-1 = minmax(0, 1fr) : le tableau défile dans son cadre au lieu d'élargir la page.
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrer les entreprises">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "h-9 rounded-full bg-card px-3.5 text-[13px] text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground",
                filter === key && "bg-primary font-medium text-primary-foreground ring-primary hover:text-primary-foreground",
              )}
            >
              {label} <span className="text-xs font-semibold tabular-nums">{companies.filter((c) => matches(c, key)).length}</span>
            </button>
          ))}
        </div>
        <Input placeholder="Rechercher (nom, ville, secteur…)" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-full sm:ml-auto sm:w-64" />
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus /> Ajouter
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-9 text-xs">Entreprise</TableHead>
              <TableHead className="h-9 text-xs">Localisation</TableHead>
              <TableHead className="h-9 text-xs">Site carrière</TableHead>
              <TableHead className="h-9 text-xs">Statut</TableHead>
              <TableHead className="h-9 text-xs">Notes</TableHead>
              <TableHead className="h-9 w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((c) => (
              <CompanyRow key={c.id} company={c} />
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {companies.length ? "Aucune entreprise ne correspond." : "Ta liste est vide : importe la liste que Claude t'a préparée."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <CompanyFormDialog company={null} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function CompanyRow({ company: c }: { company: CompanyListItem }) {
  const navigate = useNavigate();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const first = c.applications[0];

  return (
    <TableRow className={cn(c.status === "dismissed" && "opacity-60")}>
      <TableCell className="py-2">
        <div className="flex items-center gap-3">
          <CompanyMark name={c.name} className="size-8 rounded-lg text-[11px]" />
          <div className="min-w-0">
            <p className="font-medium">{c.name}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {c.sector}
              {c.contactCount > 0 && (
                <span className="flex items-center gap-0.5" title="Contacts dans cette entreprise">
                  <Users className="size-3" /> {c.contactCount}
                </span>
              )}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-2 text-[13px]">{c.location}</TableCell>
      <TableCell className="max-w-52 py-2">
        {c.careersUrl ? (
          <a href={c.careersUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-[13px] hover:underline">
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">{domain(c.careersUrl)}</span>
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-2">
        {first ? (
          <Link
            to={`/candidatures/${first.id}`}
            title="Statut de ta candidature (clic : ouvrir la fiche)"
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            <StatusBadge status={first.status} />
            {c.applications.length > 1 && <span className="text-xs text-muted-foreground">+{c.applications.length - 1}</span>}
          </Link>
        ) : (
          <OptionSelect
            value={c.status}
            options={COMPANY_STATUS_LABELS}
            onChange={(v) => v && run(() => setCompanyStatusAction(c.id, v as CompanyStatus))}
            className="h-7 w-36 text-xs"
          />
        )}
      </TableCell>
      <TableCell className="max-w-72 py-2">
        <p className="line-clamp-2 text-xs text-muted-foreground" title={c.notes ?? undefined}>
          {c.notes}
        </p>
      </TableCell>
      <TableCell className="py-2">
        <div className="flex justify-end gap-1">
          <Button
            size="xs"
            variant="outline"
            disabled={pending}
            title="Crée une candidature « À explorer » pré-remplie (page carrière, lieu, notes)"
            onClick={() =>
              run(() => createApplicationFromCompanyAction(c.id), {
                success: `Candidature ${c.name} créée`,
                onSuccess: (id) => navigate(`/candidatures/${id}`),
              })
            }
          >
            <Send /> Candidater
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={`Actions pour ${c.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmTrash(true)}>
                <Trash2 /> Mettre à la corbeille
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CompanyFormDialog company={c} open={editing} onOpenChange={setEditing} />
        <ConfirmDialog
          open={confirmTrash}
          onOpenChange={setConfirmTrash}
          title={`Mettre « ${c.name} » à la corbeille ?`}
          description="Ses candidatures et contacts ne sont pas touchés. Restaurable depuis la corbeille."
          confirmLabel="Mettre à la corbeille"
          destructive
          onConfirm={() => run(() => moveToTrashAction("company", c.id), { success: "Entreprise mise à la corbeille" })}
        />
      </TableCell>
    </TableRow>
  );
}
