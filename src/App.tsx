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

const SOON: [string, string][] = [
  ["entreprises", "Entreprises"],
  ["contacts", "Contacts"],
  ["calendrier", "Calendrier"],
  ["taches", "Tâches"],
  ["documents", "Documents"],
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
          <Route index element={<ComingSoon title="Aujourd'hui" />} />
          <Route path="candidatures" element={<ApplicationsPage />} />
          <Route path="candidatures/:id" element={<ApplicationPage />} />
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
