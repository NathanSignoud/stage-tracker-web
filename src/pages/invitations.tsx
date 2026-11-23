import { Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth";
import { ConfirmDialog } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

type Invitation = { email: string; is_admin: boolean; created_at: string };

/** Réservée aux administrateurs : la liste des adresses autorisées à créer un compte. */
export function InvitationsPage() {
  const { session, isAdmin } = useAuth();
  const [rows, setRows] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [toRemove, setToRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("invitations").select("email, is_admin, created_at").order("created_at");
    if (error) toast.error(error.message);
    else setRows(data);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    const { error } = await supabase.from("invitations").insert({ email: address, invited_by: session!.user.id });
    if (error) {
      toast.error(error.code === "23505" ? `${address} est déjà invitée.` : error.message);
      return;
    }
    toast.success(`${address} peut maintenant créer son compte`);
    setEmail("");
    load();
  }

  async function remove(address: string) {
    const { error } = await supabase.from("invitations").delete().eq("email", address);
    if (error) toast.error(error.message);
    else {
      toast.success(`Invitation de ${address} retirée`);
      load();
    }
  }

  if (!isAdmin) {
    return <p className="mx-auto max-w-2xl py-10 text-muted-foreground">Cette page est réservée à l&apos;administrateur.</p>;
  }

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-1 gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-[28px]">Invitations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seules ces adresses peuvent créer un compte. Envoie le lien du site à la personne : elle se connecte avec Google ou
          reçoit un lien par email, avec cette adresse.
        </p>
      </div>

      <form onSubmit={invite} className="flex flex-wrap gap-2 rounded-3xl bg-tile-send p-4">
        <label htmlFor="invite" className="sr-only">
          Adresse à inviter
        </label>
        <Input
          id="invite"
          type="email"
          required
          placeholder="adresse@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-[1_1_14rem] bg-card"
        />
        <Button type="submit">
          <UserPlus /> Inviter
        </Button>
      </form>

      <ul className="divide-y rounded-3xl bg-card ring-1 ring-border">
        {rows.map((r) => (
          <li key={r.email} className="flex items-center gap-3 px-5 py-3">
            <span className="min-w-0 flex-1 truncate">{r.email}</span>
            {r.is_admin ? (
              <span className="rounded-full bg-tile-interview px-2.5 py-0.5 text-xs font-semibold">Admin</span>
            ) : (
              <Button variant="ghost" size="icon-sm" aria-label={`Retirer l'invitation de ${r.email}`} onClick={() => setToRemove(r.email)}>
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Aucune invitation.</li>}
      </ul>

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title={`Retirer l'invitation de ${toRemove} ?`}
        description="La personne ne pourra plus créer de compte. Un compte déjà créé n'est pas supprimé."
        confirmLabel="Retirer"
        destructive
        onConfirm={() => toRemove && remove(toRemove)}
      />
    </div>
  );
}
