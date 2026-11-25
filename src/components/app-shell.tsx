import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  Ellipsis,
  FileText,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  SunMedium,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Suspense, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useAuth } from "@/auth";
import { ScheduleInterviewDialog } from "@/components/interviews/schedule-interview-dialog";
import { PageLoading } from "@/components/page-loading";
import { QuickAddDialog } from "@/components/quick-add-dialog";
import { useUi } from "@/components/ui-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof SunMedium };

const NAV: NavItem[] = [
  { href: "/", label: "Aujourd'hui", icon: SunMedium },
  { href: "/candidatures", label: "Candidatures", icon: Briefcase },
  { href: "/entreprises", label: "Entreprises", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDays },
  { href: "/taches", label: "Tâches", icon: CheckSquare },
  { href: "/documents", label: "Documents", icon: FileText },
];

/** Menu ⋯ (ordinateur) et panneau « Plus » (téléphone) ; les invitations ne s'affichent que pour un admin. */
function useMoreItems(): NavItem[] {
  const { isAdmin } = useAuth();
  return [
    { href: "/reglages", label: "Réglages", icon: Settings },
    { href: "/corbeille", label: "Corbeille", icon: Trash2 },
    ...(isAdmin ? [{ href: "/invitations", label: "Invitations", icon: UserPlus }] : []),
  ];
}

/** Onglets du téléphone : les pages du quotidien ; le reste est dans « Plus ». */
const TABS = ["/", "/candidatures", "/calendrier"];

function useIsActive() {
  const { pathname } = useLocation();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

const signOut = () => supabase.auth.signOut();

function Brand() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-1 rounded-lg font-heading text-[15px] font-bold tracking-tight">
      stage
      <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />
      tracker
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Changer de thème" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

/** Ordinateur : navigation en pilule ; libellés à partir de 1360 px, icônes seules (avec infobulle) en dessous. */
function TopNav() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Navigation principale" className="hidden min-w-0 items-center gap-0.5 rounded-full bg-card p-1 ring-1 ring-border lg:flex">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            to={href}
            title={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-primary font-medium text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="sr-only min-[1360px]:not-sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MoreMenu() {
  const { session } = useAuth();
  const items = useMoreItems();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Plus : réglages, corbeille, déconnexion" className="hidden lg:inline-flex">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{session?.user.email}</DropdownMenuLabel>
        {items.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link to={href}>
              <Icon /> {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Téléphone et tablette : barre d'onglets en bas, à portée de pouce, avec l'ajout au centre. */
function BottomTabs() {
  const isActive = useIsActive();
  const { setQuickAddOpen } = useUi();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = NAV.filter((n) => TABS.includes(n.href));
  const others = [...NAV.filter((n) => !TABS.includes(n.href)), ...useMoreItems()];
  const moreActive = others.some((n) => isActive(n.href));

  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[11px] text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      active && "font-semibold text-foreground",
    );
  const pill = (active: boolean) => cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-tile-interview");
  const tab = ({ href, label, icon: Icon }: NavItem) => (
    <Link key={href} to={href} aria-current={isActive(href) ? "page" : undefined} className={tabClass(isActive(href))}>
      <span className={pill(isActive(href))}>
        <Icon className="size-5" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <>
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-1 px-2">
          {tabs.slice(0, 2).map(tab)}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              aria-label="Nouvelle candidature"
              className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
            >
              <Plus className="size-6" />
            </button>
          </div>
          {tabs.slice(2).map(tab)}
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={tabClass(moreActive)}>
            <span className={pill(moreActive)}>
              <Ellipsis className="size-5" />
            </span>
            Plus
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetTitle className="px-5 pt-5 font-heading text-base">Plus</SheetTitle>
          <div className="grid grid-cols-3 gap-2 p-4">
            {others.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                onClick={() => setMoreOpen(false)}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn("flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-[13px] font-medium", isActive(href) && "bg-tile-interview")}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            ))}
            <button type="button" onClick={signOut} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-[13px] font-medium">
              <LogOut className="size-5" />
              Se déconnecter
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function AppShell() {
  const { setQuickAddOpen } = useUi();
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6 xl:gap-4">
          <Brand />
          <TopNav />
          <div className="flex-1" />
          <Button onClick={() => setQuickAddOpen(true)} className="hidden h-10 px-4 lg:inline-flex" aria-label="Nouvelle candidature (N)">
            <Plus />
            <span className="2xl:hidden">Nouvelle</span>
            <span className="hidden 2xl:inline">Nouvelle candidature</span>
          </Button>
          <ThemeToggle />
          <MoreMenu />
        </div>
      </header>

      {/* pb : la barre d'onglets du téléphone ne doit jamais masquer la fin de la page. */}
      <main id="contenu" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-2 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:px-6 lg:pt-4 lg:pb-10">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>

      <BottomTabs />
      <QuickAddDialog />
      <ScheduleInterviewDialog />
    </div>
  );
}
