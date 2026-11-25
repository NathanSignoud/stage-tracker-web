import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";
import { ApplicationCard } from "@/components/applications/application-card";
import { useUi } from "@/components/ui-state";
import { StatusDot } from "@/components/status";
import { useAction } from "@/components/use-action";
import { CLOSED_STATUSES, OPEN_STATUSES, STATUS_LABELS, isStatus, type Status } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { changeStatusAction } from "@/actions/applications";
import type { ApplicationListItem } from "@/services/applications";

const CLOSED_KEY = "kanban.closedOpen";
const COMPACT_KEY = "kanban.compact";

export function KanbanBoard({ items, today }: { items: ApplicationListItem[]; today: string }) {
  const { run } = useAction();
  const { setScheduleTarget } = useUi();
  // Déplacements en cours d'enregistrement (affichage optimiste).
  const [pendingMoves, setPendingMoves] = useState<Record<number, Status>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- préférences locales lues après hydratation
      setClosedOpen(localStorage.getItem(CLOSED_KEY) === "1");
      setCompact(localStorage.getItem(COMPACT_KEY) === "1");
    } catch {
      // Stockage indisponible : zone repliée, cartes détaillées.
    }
  }, []);

  function toggle(key: string, set: typeof setClosedOpen) {
    set((on) => {
      try {
        localStorage.setItem(key, on ? "0" : "1");
      } catch {}
      return !on;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const board = items.map((i) => (pendingMoves[i.id] ? { ...i, status: pendingMoves[i.id] } : i));
  const byStatus = (s: Status) => board.filter((i) => i.status === s);
  const active = board.find((i) => i.id === activeId) ?? null;

  function move(id: number, to: Status) {
    const current = board.find((i) => i.id === id);
    if (!current || current.status === to) return;
    setPendingMoves((m) => ({ ...m, [id]: to }));
    const clear = () =>
      setPendingMoves((m) => Object.fromEntries(Object.entries(m).filter(([key]) => Number(key) !== id)));
    run(() => changeStatusAction(id, to), {
      onSuccess: ({ scheduleKind }) => {
        clear();
        // Déposée en « Entretien » sans date : on demande la date de l'entretien.
        if (scheduleKind) setScheduleTarget({ applicationId: id, company: current.company, kind: scheduleKind });
      },
      onError: clear,
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (over && isStatus(over.id)) move(Number(active.id), over.id);
  }

  const closedCount = CLOSED_STATUSES.reduce((n, s) => n + byStatus(s).length, 0);

  return (
    <DndContext
      // id fixe : évite un écart d'hydratation sur les attributs aria générés par dnd-kit.
      id="kanban"
      sensors={sensors}
      onDragStart={(e) => setActiveId(Number(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          aria-pressed={compact}
          onClick={() => toggle(COMPACT_KEY, setCompact)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full bg-card px-3 text-xs text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground",
            compact && "bg-primary font-medium text-primary-foreground ring-primary hover:text-primary-foreground",
          )}
          title="Une ligne par candidature : utile quand une colonne est très remplie"
        >
          <Rows3 className="size-3.5" /> Compact
        </button>
      </div>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-3 md:mx-0 md:px-0">
        {OPEN_STATUSES.map((s) => (
          <Column key={s} status={s} items={byStatus(s)} today={today} onMove={move} compact={compact} />
        ))}
      </div>

      <section className="mt-3 rounded-3xl bg-card ring-1 ring-border">
        <button
          type="button"
          onClick={() => toggle(CLOSED_KEY, setClosedOpen)}
          className="flex w-full items-center gap-2 rounded-3xl px-4 py-3 text-sm font-semibold"
        >
          {closedOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          Clôturées
          <span className="rounded-full bg-muted px-2 text-xs font-semibold tabular-nums text-muted-foreground">{closedCount}</span>
        </button>
        {closedOpen ? (
          <div className="grid gap-2 px-3 pb-3 md:grid-cols-3">
            {CLOSED_STATUSES.map((s) => (
              <Column key={s} status={s} items={byStatus(s)} today={today} onMove={move} compact={compact} wide />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 px-3 pb-3">
            {CLOSED_STATUSES.map((s) => (
              <ClosedDropZone key={s} status={s} count={byStatus(s).length} />
            ))}
          </div>
        )}
      </section>

      <DragOverlay dropAnimation={null}>
        {active && <ApplicationCard item={active} today={today} compact={compact} overlay />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  items,
  today,
  onMove,
  compact,
  wide = false,
}: {
  status: Status;
  items: ApplicationListItem[];
  today: string;
  onMove: (id: number, to: Status) => void;
  compact: boolean;
  wide?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex shrink-0 flex-col rounded-3xl bg-muted/70 transition-colors dark:bg-muted/40",
        wide ? "w-auto" : "w-[min(78vw,250px)] lg:w-auto lg:min-w-[140px] lg:flex-1 lg:shrink",
        isOver && "bg-tile-interview ring-2 ring-ring/40",
      )}
    >
      <header className="flex items-center gap-2 px-3.5 pt-3 pb-2 text-[13px] font-semibold">
        <StatusDot status={status} />
        <span className="truncate">{STATUS_LABELS[status]}</span>
        <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">{items.length}</span>
      </header>
      {/* Hauteur bornée : une colonne très remplie défile seule, sans étirer la page ni les autres colonnes. */}
      <div
        className={cn(
          "flex min-h-20 flex-col overflow-y-auto overscroll-contain px-2 pb-2",
          compact ? "gap-1" : "gap-1.5",
          wide ? "max-h-[50dvh]" : "max-h-[calc(100dvh-22rem)] lg:max-h-[calc(100dvh-17rem)]",
        )}
      >
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} today={today} onMove={onMove} compact={compact} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  item,
  today,
  onMove,
  compact,
}: {
  item: ApplicationListItem;
  today: string;
  onMove: (id: number, to: Status) => void;
  compact: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("touch-manipulation", isDragging && "opacity-30")}>
      <ApplicationCard item={item} today={today} onMove={(to) => onMove(item.id, to)} compact={compact} />
    </div>
  );
}

/** Zone de dépôt compacte quand « Clôturées » est repliée. */
function ClosedDropZone({ status, count }: { status: Status; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-dashed px-3.5 py-2.5 text-[13px] text-muted-foreground transition-colors",
        isOver && "border-solid border-ring bg-tile-interview text-foreground",
      )}
    >
      <StatusDot status={status} />
      <span className="truncate">{STATUS_LABELS[status]}</span>
      <span className="ml-auto text-xs font-semibold tabular-nums">{count}</span>
    </div>
  );
}
