import { lazy } from "react";
import { Route, Routes } from "react-router";
import { RequireAuth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ComingSoon, NotFound } from "@/pages/coming-soon";
import { InvitationsPage } from "@/pages/invitations";
import { LoginPage } from "@/pages/login";
import { PrivacyPage } from "@/pages/privacy";

// Pages chargées à la demande : le premier affichage (connexion) reste léger.
const ApplicationsPage = lazy(() => import("@/pages/applications").then((m) => ({ default: m.ApplicationsPage })));
const ApplicationPage = lazy(() => import("@/pages/application").then((m) => ({ default: m.ApplicationPage })));
const TodayPage = lazy(() => import("@/pages/today").then((m) => ({ default: m.TodayPage })));
const CalendarPage = lazy(() => import("@/pages/calendar").then((m) => ({ default: m.CalendarPage })));
const TasksPage = lazy(() => import("@/pages/tasks").then((m) => ({ default: m.TasksPage })));
const ContactsPage = lazy(() => import("@/pages/contacts").then((m) => ({ default: m.ContactsPage })));
const ContactPage = lazy(() => import("@/pages/contact").then((m) => ({ default: m.ContactPage })));
const CompaniesPage = lazy(() => import("@/pages/companies").then((m) => ({ default: m.CompaniesPage })));
const DocumentsPage = lazy(() => import("@/pages/documents").then((m) => ({ default: m.DocumentsPage })));

const SOON: [string, string][] = [
  ["reglages", "Réglages"],
  ["corbeille", "Corbeille"],
];

export function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/confidentialite" element={<PrivacyPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="candidatures" element={<ApplicationsPage />} />
          <Route path="candidatures/:id" element={<ApplicationPage />} />
          <Route path="entreprises" element={<CompaniesPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/:id" element={<ContactPage />} />
          <Route path="calendrier" element={<CalendarPage />} />
          <Route path="taches" element={<TasksPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          {SOON.map(([path, title]) => (
            <Route key={path} path={path} element={<ComingSoon title={title} />} />
          ))}
          <Route path="invitations" element={<InvitationsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
