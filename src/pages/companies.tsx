import { useSearchParams } from "react-router";
import { CompaniesView } from "@/components/companies/companies-view";
import { ImportCompaniesDialog } from "@/components/companies/import-companies-dialog";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { listCompanies } from "@/services/companies";

export function CompaniesPage() {
  const q = useSearchParams()[0].get("q") ?? "";
  const { data: companies, error } = useData(listCompanies);
  if (!companies) return <PageLoading error={error} />;
  const withApplication = companies.filter((c) => c.applications.length).length;
  const toExplore = companies.filter((c) => !c.applications.length && c.status === "to_explore").length;

  return (
    <div className="mx-auto max-w-7xl">
      <title>Entreprises · Stage Tracker</title>
      <PageHeader
        title="Entreprises"
        description={`Ta liste d'entreprises cibles · ${toExplore} à explorer · ${withApplication} avec candidature`}
        actions={<ImportCompaniesDialog existingNames={companies.map((c) => c.name)} />}
      />
      <CompaniesView key={q} companies={companies} initialQuery={q} />
    </div>
  );
}
