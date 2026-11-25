import { useUi } from "@/components/ui-state";
import { StatusDot } from "@/components/status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/components/use-action";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/domain/constants";
import { changeStatusAction } from "@/actions/applications";

const HINTS: Partial<Record<Status, string>> = {
  sent: "Relance planifiée",
  followed_up: "Relance notée",
};

export function StatusSelect({
  applicationId,
  company,
  status,
}: {
  applicationId: number;
  company: string;
  status: Status;
}) {
  const { pending, run } = useAction();
  const { setScheduleTarget } = useUi();
  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(to) =>
        run(() => changeStatusAction(applicationId, to), {
          success: `Statut : ${STATUS_LABELS[to as Status]}${HINTS[to as Status] ? ` · ${HINTS[to as Status]}` : ""}`,
          // Arrivée en entretien sans date : on la demande tout de suite.
          onSuccess: ({ scheduleKind }) => scheduleKind && setScheduleTarget({ applicationId, company, kind: scheduleKind }),
        })
      }
    >
      <SelectTrigger size="sm" className="w-auto gap-2 font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <StatusDot status={s} /> {STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
