import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { InterviewKind } from "@/lib/domain/constants";

export type ScheduleTarget = { applicationId: number; company: string; kind: InterviewKind };
/** Message à rédiger ; sans `templateKey`, le gabarit est choisi selon l'étape de la candidature. */
export type MessageTarget = { applicationId: number; templateKey?: string };

type UiState = {
  quickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  /** Candidature dont on planifie l'entretien (dialogue global), ou null. */
  scheduleTarget: ScheduleTarget | null;
  setScheduleTarget: (target: ScheduleTarget | null) => void;
  messageTarget: MessageTarget | null;
  setMessageTarget: (target: MessageTarget | null) => void;
};

const UiContext = createContext<UiState | null>(null);

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi doit être utilisé dans <UiProvider>");
  return ctx;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<ScheduleTarget | null>(null);
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);

  // Raccourcis globaux : N = ajout rapide, Ctrl/Cmd+K = recherche.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
        return;
      }
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        if (document.querySelector("[role=dialog]")) return;
        e.preventDefault();
        setQuickAddOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({
      quickAddOpen,
      setQuickAddOpen,
      searchOpen,
      setSearchOpen,
      scheduleTarget,
      setScheduleTarget,
      messageTarget,
      setMessageTarget,
    }),
    [quickAddOpen, searchOpen, scheduleTarget, messageTarget],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}
