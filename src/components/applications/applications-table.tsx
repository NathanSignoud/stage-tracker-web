import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Clock, Filter, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { CompanyMark } from "@/components/company-mark";
import { OptionSelect } from "@/components/field";
import { PriorityBadge, StatusBadge, StatusDot } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDay, relativeDay } from "@/lib/dates";
import {
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  STATUSES,
  type Priority,
  type Source,
  type Status,
} from "@/lib/domain/constants";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { ApplicationListItem } from "@/services/applications";

type Filters = {
  q: string;
  statuses: Status[];
  priority: Priority | null;
  source: Source | null;
  tag: string | null;
  sentFrom: string;
  sentTo: string;
};

const NO_FILTERS: Filters = { q: "", statuses: [], priority: null, source: null, tag: null, sentFrom: "", sentTo: "" };

const short = (d: string | null) => (d ? formatDay(d, "d MMM yy") : "");

export function ApplicationsTable({
  items,
  today,
  initialStatuses = [],
}: {
  items: ApplicationListItem[];
  today: string;
  initialStatuses?: Status[];
}) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, statuses: initialStatuses });
  const [sorting, setSorting] = useState<SortingState>([]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const allTags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items]);

  const rows = useMemo(() => {
    const q = normalizeText(filters.q.trim());
    return items.filter(
      (i) =>
        (!q || normalizeText(`${i.company} ${i.title} ${i.location ?? ""}`).includes(q)) &&
        (!filters.statuses.length || filters.statuses.includes(i.status)) &&
        (!filters.priority || i.priority === filters.priority) &&
        (!filters.source || i.source === filters.source) &&
        (!filters.tag || i.tags.includes(filters.tag)) &&
        (!filters.sentFrom || (i.sentDate !== null && i.sentDate >= filters.sentFrom)) &&
        (!filters.sentTo || (i.sentDate !== null && i.sentDate <= filters.sentTo)),
    );
  }, [items, filters]);

  const columns = useMemo<ColumnDef<ApplicationListItem>[]>(
    () => [
      {
        accessorKey: "company",
        header: "Entreprise / poste",
        cell: ({ row }) => (
          <div className="flex min-w-52 items-center gap-3">
            <CompanyMark name={row.original.company} className="size-8 rounded-lg text-[11px]" />
            <div className="min-w-0">
              <p className="font-medium">{row.original.company}</p>
              <p className="max-w-72 truncate text-xs text-muted-foreground">{row.original.title}</p>
            </div>
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => STATUSES.indexOf(r.status),
        header: "Statut",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "priority",
        header: "Prio.",
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      },
      {
        id: "source",
        accessorFn: (r) => (r.source ? SOURCE_LABELS[r.source] : undefined),
        header: "Source",
        sortUndefined: "last",
      },
      {
        id: "tags",
        header: "Tags",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex max-w-48 flex-wrap gap-1">
            {row.original.tags.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 text-[11px] text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        ),
      },
      { id: "location", accessorFn: (r) => r.location ?? undefined, header: "Lieu", sortUndefined: "last" },
      {
        id: "sentDate",
        accessorFn: (r) => r.sentDate ?? undefined,
        header: "Envoyée",
        sortUndefined: "last",
        cell: ({ row }) => <span className="tabular-nums">{short(row.original.sentDate)}</span>,
      },
      {
        id: "deadline",
        accessorFn: (r) => r.deadline ?? undefined,
        header: "Limite",
        sortUndefined: "last",
        cell: ({ row }) => <span className="tabular-nums">{short(row.original.deadline)}</span>,
      },
      {
        id: "lastActivity",
        accessorFn: (r) => r.lastActivity ?? undefined,
        header: "Activité",
        sortUndefined: "last",
        cell: ({ row }) =>
          row.original.lastActivity && (
            <span className={cn("flex items-center gap-1 text-xs", row.original.stale && "text-amber-600 dark:text-amber-400")}>
              {row.original.stale && <Clock className="size-3" />}
              {relativeDay(row.original.lastActivity, today)}
            </span>
          ),
      },
      {
        id: "matchScore",
        accessorFn: (r) => r.matchScore ?? undefined,
        header: "Score",
        sortUndefined: "last",
        cell: ({ row }) =>
          row.original.matchScore != null && (
            <span className="font-mono text-xs">{Math.round(row.original.matchScore * 100)}%</span>
          ),
      },
    ],
    [today],
  );

  // TanStack Table renvoie des fonctions non mémoïsables : incompatible avec le React Compiler, sans impact ici.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const active = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrer…"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          className="h-8 w-full sm:w-52"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter /> Statut
              {filters.statuses.length > 0 && (
                <span className="rounded-full bg-muted px-2 text-xs font-semibold tabular-nums">{filters.statuses.length}</span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={filters.statuses.includes(s)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) =>
                  set("statuses", checked ? [...filters.statuses, s] : filters.statuses.filter((x) => x !== s))
                }
              >
                <StatusDot status={s} /> {STATUS_LABELS[s]}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => set("statuses", [])}>Tous les statuts</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <OptionSelect
          value={filters.priority ? (String(filters.priority) as "1" | "2" | "3") : null}
          onChange={(v) => set("priority", v ? (Number(v) as Priority) : null)}
          options={Object.entries(PRIORITY_LABELS).map(([p, l]) => [p as "1" | "2" | "3", `P${p} · ${l}`] as const)}
          allowEmpty
          placeholder="Priorité"
          className="h-8 w-auto"
        />
        <OptionSelect
          value={filters.source}
          onChange={(v) => set("source", v)}
          options={SOURCE_LABELS}
          allowEmpty
          placeholder="Source"
          className="h-8 w-auto"
        />
        {allTags.length > 0 && (
          <OptionSelect
            value={filters.tag}
            onChange={(v) => set("tag", v)}
            options={allTags.map((t) => [t, t] as const)}
            allowEmpty
            placeholder="Tag"
            className="h-8 w-auto"
          />
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Envoyée du
          <Input type="date" value={filters.sentFrom} onChange={(e) => set("sentFrom", e.target.value)} className="h-8 w-36" />
          au
          <Input type="date" value={filters.sentTo} onChange={(e) => set("sentTo", e.target.value)} className="h-8 w-36" />
        </div>
        {active && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
            <X /> Réinitialiser
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} / {items.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} className="h-9 text-xs">
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => navigate(`/candidatures/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  Aucune candidature ne correspond.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
