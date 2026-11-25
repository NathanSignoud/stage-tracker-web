import { ArrowLeft, ExternalLink, Mail, MessageSquarePlus, Pencil, Phone } from "lucide-react";
import { Link } from "react-router";
import { useParams } from "react-router";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { InteractionDialog } from "@/components/interactions/interaction-dialog";
import { Timeline } from "@/components/interactions/timeline";
import { Panel } from "@/components/page-header";
import { StatusBadge } from "@/components/status";
import { RestoreBanner, TrashButton } from "@/components/trash-buttons";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { localDateTime } from "@/lib/dates";
import { NotFound } from "@/pages/coming-soon";
import { getContactDetail } from "@/services/contacts";

export function ContactPage() {
  const id = Number(useParams().id);
  const { data: detail, error } = useData(() => (Number.isInteger(id) && id > 0 ? getContactDetail(id) : Promise.resolve(null)), [id]);
  if (detail === undefined) return <PageLoading error={error} />;
  if (detail === null) return <NotFound />;
  const { contact: c } = detail;
  const self = [{ id: c.id, name: c.name, detail: c.company }];

  return (
    <div className="mx-auto max-w-5xl">
      <title>{`${c.name} · Stage Tracker`}</title>
      {c.deletedAt && <RestoreBanner kind="contact" id={c.id} />}
      <Link to="/contacts" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Contacts
      </Link>

      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-[28px]">{c.name}</h1>
          <p className="text-[13px] text-muted-foreground">{[c.role, c.company].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${c.email}`}>
                <Mail /> Email
              </a>
            </Button>
          )}
          {c.linkedin && (
            <Button variant="outline" size="sm" asChild>
              <a href={c.linkedin} target="_blank" rel="noreferrer">
                <ExternalLink /> LinkedIn
              </a>
            </Button>
          )}
          <ContactFormDialog
            contact={c}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil /> Modifier
              </Button>
            }
          />
          {!c.deletedAt && <TrashButton kind="contact" id={c.id} label={c.name} redirectTo="/contacts" />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel
          title="Échanges"
          count={detail.interactions.length}
          actions={
            <InteractionDialog
              applicationId={detail.applications.length === 1 ? detail.applications[0].id : null}
              defaultContactId={c.id}
              contacts={self}
              trigger={
                <Button variant="ghost" size="sm">
                  <MessageSquarePlus /> Échange
                </Button>
              }
            />
          }
        >
          <Timeline interactions={detail.interactions} contacts={self} now={localDateTime()} showCompany />
        </Panel>

        <div className="grid content-start gap-4">
          <Panel title="Candidatures liées" count={detail.applications.length} empty="Aucune candidature liée.">
            <ul className="divide-y">
              {detail.applications.map((a) => (
                <li key={a.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <Link to={`/candidatures/${a.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                      {a.company}
                    </Link>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[a.relation, a.title].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Infos">
            <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 py-1 text-[13px]">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{c.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Téléphone</dt>
              <dd>
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:underline">
                    <Phone className="size-3" /> {c.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Rencontré·e</dt>
              <dd>{c.howWeMet ?? "—"}</dd>
            </dl>
            {c.notes && <p className="border-t py-2 text-[13px] whitespace-pre-wrap">{c.notes}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
