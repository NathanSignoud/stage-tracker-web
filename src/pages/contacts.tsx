import { UserPlus } from "lucide-react";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { listContacts } from "@/services/contacts";

export function ContactsPage() {
  const { data: contacts, error } = useData(listContacts);
  if (!contacts) return <PageLoading error={error} />;
  return (
    <div className="mx-auto max-w-5xl">
      <title>Contacts · Stage Tracker</title>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} personne${contacts.length > 1 ? "s" : ""}`}
        actions={
          <ContactFormDialog
            openAfterCreate
            trigger={
              <Button variant="outline" size="sm">
                <UserPlus /> Nouveau contact
              </Button>
            }
          />
        }
      />
      <ContactsTable contacts={contacts} />
    </div>
  );
}
