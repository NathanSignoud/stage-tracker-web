import { Route, Routes } from "react-router";
import { RequireAuth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ComingSoon, NotFound } from "@/pages/coming-soon";
import { InvitationsPage } from "@/pages/invitations";
import { LoginPage } from "@/pages/login";
import { PrivacyPage } from "@/pages/privacy";

const SOON: [string, string][] = [
  ["candidatures", "Candidatures"],
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
