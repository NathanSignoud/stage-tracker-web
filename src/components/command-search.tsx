import { Briefcase, Building2, CalendarDays, CheckSquare, FileText, MessageSquare, Plus, Settings, SunMedium, Trash2, User, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { useUi } from "@/components/ui-state";
import { StatusDot } from "@/components/status";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatDayTime } from "@/lib/dates";
import { isStatus } from "@/lib/domain/constants";
import { searchAction } from "@/actions/records";
import type { SearchResults } from "@/services/search";

const PAGES = [
  { href: "/", label: "Aujourd'hui", icon: SunMedium },
  { href: "/candidatures", label: "Candidatures (Kanban)", icon: Briefcase },
  { href: "/candidatures?vue=tableau", label: "Candidatures (tableau)", icon: Briefcase },
  { href: "/entreprises", label: "Entreprises", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDays },
  { href: "/taches", label: "Tâches", icon: CheckSquare },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/reglages", label: "Réglages", icon: Settings },
  { href: "/corbeille", label: "Corbeille", icon: Trash2 },
];

/** Recherche globale (Ctrl+K) : candidatures, contacts, échanges + navigation. */
export function CommandSearch() {
  const { searchOpen, setSearchOpen, setQuickAddOpen } = useUi();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchAction(query);
      if (!cancelled && res.ok) setResults(res.data);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    setSearchOpen(false);
    setQuery("");
    setResults(null);
    navigate(href);
  }

  const searching = query.trim().length > 0;
  const shown = searching ? results : null;

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={(open) => {
        setSearchOpen(open);
        if (!open) {
          setQuery("");
          setResults(null);
        }
      }}
      title="Recherche"
      description="Candidatures, contacts et échanges"
    >
      {/* Filtrage fait côté serveur (insensible aux accents) : cmdk ne filtre pas. */}
      <Command shouldFilter={false}>
      <CommandInput placeholder="Rechercher une entreprise, un contact, un échange…" value={query} onValueChange={setQuery} />
      <CommandList className="max-h-[60vh]">
        {searching && <CommandEmpty>Aucun résultat.</CommandEmpty>}
        {!searching && (
          <>
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  setSearchOpen(false);
                  setQuickAddOpen(true);
                }}
              >
                <Plus /> Nouvelle candidature
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Aller à">
              {PAGES.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={href} onSelect={() => go(href)}>
                  <Icon /> {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {shown && shown.applications.length > 0 && (
          <CommandGroup heading="Candidatures">
            {shown.applications.map((a) => (
              <CommandItem key={`a${a.id}`} value={`a${a.id}`} onSelect={() => go(`/candidatures/${a.id}`)}>
                {isStatus(a.status) ? <StatusDot status={a.status} /> : <Briefcase />}
                <span className="font-medium">{a.company}</span>
                <span className="truncate text-muted-foreground">{a.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {shown && shown.companies.length > 0 && (
          <CommandGroup heading="Entreprises">
            {shown.companies.map((c) => (
              <CommandItem key={`e${c.id}`} value={`e${c.id}`} onSelect={() => go(`/entreprises?q=${encodeURIComponent(c.name)}`)}>
                <Building2 />
                <span className="font-medium">{c.name}</span>
                <span className="truncate text-muted-foreground">{c.detail}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {shown && shown.contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {shown.contacts.map((c) => (
              <CommandItem key={`c${c.id}`} value={`c${c.id}`} onSelect={() => go(`/contacts/${c.id}`)}>
                <User />
                <span className="font-medium">{c.name}</span>
                <span className="truncate text-muted-foreground">{c.detail}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {shown && shown.interactions.length > 0 && (
          <CommandGroup heading="Échanges">
            {shown.interactions.map((i) => (
              <CommandItem
                key={`i${i.id}`}
                value={`i${i.id}`}
                onSelect={() =>
                  go(i.applicationId ? `/candidatures/${i.applicationId}` : i.contactId ? `/contacts/${i.contactId}` : "/")
                }
              >
                <MessageSquare />
                <span className="truncate">{i.summary}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {[i.detail, formatDayTime(i.date)].filter(Boolean).join(" · ")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
