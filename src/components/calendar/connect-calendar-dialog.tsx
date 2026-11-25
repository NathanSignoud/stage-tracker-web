import { CalendarSync, Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { regenerateCalendarTokenAction } from "@/actions/records";
import { ConfirmButton } from "@/components/confirm-button";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { copyText } from "@/lib/clipboard";
import { useData } from "@/lib/data";
import { getCalendarToken } from "@/services/calendar";

// Repris de la version locale ; en ligne, l'adresse est joignable de partout : Google Agenda, Outlook web et
// iCloud peuvent s'abonner (ce n'était pas possible quand l'app tournait sur le PC).

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-1.5">
      <Input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="h-8 font-mono text-[11px]" aria-label="Adresse d'abonnement" />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Copier"
        onClick={async () => {
          await copyText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <h3 className="text-[13px] font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Instructions() {
  const { pending, run } = useAction();
  const { data: token, error } = useData(getCalendarToken);
  if (!token) return <PageLoading error={error} />;
  const path = `/api/calendar/${token}.ics`;
  const httpsUrl = `${window.location.origin}${path}`;
  const webcalUrl = `webcal://${window.location.host}${path}`;

  return (
    <div className="grid gap-3 text-[13px]">
      <Step title="Sur cet appareil, en un clic">
        <p className="text-muted-foreground">Ouvre l&apos;abonnement dans l&apos;application d&apos;agenda de l&apos;appareil (Apple Calendrier, Outlook…).</p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <a href={webcalUrl}>
            <CalendarSync /> S&apos;abonner sur cet appareil
          </a>
        </Button>
      </Step>

      <Step title="Google Agenda">
        <p className="text-muted-foreground">
          Sur ordinateur : à gauche, <b>Autres agendas</b> → <b>+</b> → <b>À partir de l&apos;URL</b>, puis colle :
        </p>
        <CopyField value={httpsUrl} />
      </Step>

      <Step title="Outlook (web ou application)">
        <p className="text-muted-foreground">
          Calendrier → <b>Ajouter un calendrier</b> → <b>S&apos;abonner à partir du web</b>, puis colle la même adresse.
        </p>
      </Step>

      <Step title="iPhone (Apple Calendrier)">
        <p className="text-muted-foreground">
          Le plus simple : ouvre ce site sur l&apos;iPhone et touche « S&apos;abonner sur cet appareil ». Sinon : Réglages → Calendrier →
          Comptes → Ajouter un compte → Autre → <b>Ajouter un calendrier avec abonnement</b>, puis colle l&apos;adresse.
        </p>
      </Step>

      <p className="text-xs text-muted-foreground">
        Les agendas relisent l&apos;abonnement tout seuls (de quelques minutes à quelques heures selon l&apos;application).
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Le lien contient une clé secrète : ne le partage pas.</span>
        <ConfirmButton
          title="Régénérer le lien d'abonnement ?"
          description="Les agendas abonnés avec l'ancien lien cesseront de se mettre à jour : il faudra s'abonner à nouveau."
          confirmLabel="Régénérer"
          onConfirm={() => run(() => regenerateCalendarTokenAction(), { success: "Nouveau lien créé" })}
        >
          <Button variant="ghost" size="xs" disabled={pending}>
            <RefreshCw /> Régénérer le lien
          </Button>
        </ConfirmButton>
      </div>
    </div>
  );
}

export function ConnectCalendarDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarSync /> Connecter mon agenda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Connecter ton agenda</DialogTitle>
          <DialogDescription>
            Un abonnement fait apparaître tes entretiens et dates limites dans ton agenda habituel, mis à jour automatiquement.
          </DialogDescription>
        </DialogHeader>
        {/* Monté seulement à l'ouverture : le lien secret n'est créé que si on en a besoin. */}
        <Instructions />
      </DialogContent>
    </Dialog>
  );
}
