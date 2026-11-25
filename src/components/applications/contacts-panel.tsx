import { ExternalLink, Link2, Mail, Plus, UserPlus, X } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAction } from "@/components/use-action";
import type { Contact } from "@/lib/types";
import { linkContactAction, unlinkContactAction } from "@/actions/applications";

type LinkedContact = Contact & { relation: string | null };

export function ContactsPanelActions({
  application,
  linkedIds,
  allContacts,
}: {
  application: { id: number; company: string };
  linkedIds: number[];
  allContacts: Pick<Contact, "id" | "name" | "role" | "company">[];
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [relation, setRelation] = useState("");
  const candidates = allContacts.filter((c) => !linkedIds.includes(c.id));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Lier un contact existant" title="Lier un contact existant">
            <Link2 />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b p-2">
            <Input
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="Rôle pour cette candidature (facultatif)"
              className="h-8"
            />
          </div>
          <Command>
            <CommandInput placeholder="Chercher un contact…" />
            <CommandList>
              <CommandEmpty>Aucun contact.</CommandEmpty>
              <CommandGroup>
                {candidates.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.company ?? ""} ${c.id}`}
                    disabled={pending}
                    onSelect={() =>
                      run(() => linkContactAction(application.id, c.id, relation), {
                        success: `${c.name} lié·e`,
                        onSuccess: () => {
                          setOpen(false);
                          setRelation("");
                        },
                      })
                    }
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{[c.role, c.company].filter(Boolean).join(" · ")}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <ContactFormDialog
        linkToApplication={application}
        trigger={
          <Button variant="ghost" size="icon-xs" aria-label="Nouveau contact" title="Nouveau contact">
            <UserPlus />
          </Button>
        }
      />
    </>
  );
}

export function LinkedContactsList({ applicationId, contacts }: { applicationId: number; contacts: LinkedContact[] }) {
  const { pending, run } = useAction();
  if (!contacts.length) {
    return (
      <p className="flex items-center gap-1.5 py-2 text-[13px] text-muted-foreground">
        <Plus className="size-3.5" /> Aucun contact lié.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {contacts.map((c) => (
        <li key={c.id} className="group flex items-center gap-2 py-2">
          <div className="min-w-0 flex-1">
            <Link to={`/contacts/${c.id}`} className="font-medium hover:underline">
              {c.name}
            </Link>
            {c.relation && <span className="ml-1.5 rounded-full bg-muted px-2 text-[11px] text-muted-foreground">{c.relation}</span>}
            <p className="truncate text-xs text-muted-foreground">{[c.role, c.company].filter(Boolean).join(" · ")}</p>
          </div>
          {c.email && (
            <Button variant="ghost" size="icon-xs" asChild>
              <a href={`mailto:${c.email}`} aria-label={`Écrire à ${c.name}`}>
                <Mail />
              </a>
            </Button>
          )}
          {c.linkedin && (
            <Button variant="ghost" size="icon-xs" asChild>
              <a href={c.linkedin} target="_blank" rel="noreferrer" aria-label="Profil LinkedIn">
                <ExternalLink />
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={pending}
            aria-label="Délier"
            title="Délier de cette candidature (le contact est conservé)"
            className="opacity-50 group-hover:opacity-100"
            onClick={() => run(() => unlinkContactAction(applicationId, c.id))}
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}
