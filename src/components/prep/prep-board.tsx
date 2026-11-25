import { ListPlus, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Panel } from "@/components/page-header";
import { CONFIDENCE, Flashcards } from "@/components/prep/flashcards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { PREP_QUESTION_LABELS, type PrepQuestionKind } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import {
  addDefaultPrepQuestionsAction,
  addPrepQuestionAction,
  saveCompanyNotesAction,
  updatePrepQuestionAction,
} from "@/actions/features";
import { moveToTrashAction } from "@/actions/records";
import type { PrepQuestion } from "@/lib/types";

export function PrepBoard({
  applicationId,
  notes,
  questions,
}: {
  applicationId: number;
  notes: string | null;
  questions: PrepQuestion[];
}) {
  const { pending, run } = useAction();
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const notesDirty = draftNotes !== (notes ?? "");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Flashcards questions={questions} />
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => addDefaultPrepQuestionsAction(applicationId), {
              onSuccess: (n) => toast.success(n ? `${n} questions classiques ajoutées` : "Elles sont déjà toutes là"),
            })
          }
        >
          <ListPlus /> Ajouter les questions classiques
        </Button>
      </div>

      <Panel
        title="Notes sur l'entreprise"
        actions={
          <Button
            size="sm"
            variant={notesDirty ? "default" : "ghost"}
            disabled={pending || !notesDirty}
            onClick={() => run(() => saveCompanyNotesAction(applicationId, draftNotes), { success: "Notes enregistrées" })}
          >
            <Save /> {notesDirty ? "Enregistrer" : "Enregistré"}
          </Button>
        }
      >
        <Textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          rows={6}
          placeholder="Produit, clients, levée de fonds, équipe IA, actualités, publications, stack… (ces notes alimentent aussi le prompt de préparation)"
          className="my-2 text-[13px] leading-relaxed"
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["answer", "ask"] as PrepQuestionKind[]).map((kind) => (
          <QuestionList key={kind} applicationId={applicationId} kind={kind} questions={questions.filter((q) => q.kind === kind)} />
        ))}
      </div>
    </div>
  );
}

function QuestionList({
  applicationId,
  kind,
  questions,
}: {
  applicationId: number;
  kind: PrepQuestionKind;
  questions: PrepQuestion[];
}) {
  const { pending, run } = useAction();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  return (
    <Panel title={PREP_QUESTION_LABELS[kind]} count={questions.length}>
      <ul className="divide-y">
        {questions.map((q) => (
          <QuestionItem key={q.id} question={q} />
        ))}
      </ul>
      <form
        className="grid gap-2 border-t pt-3 pb-1"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addPrepQuestionAction(applicationId, { kind, question, answer }), {
            onSuccess: () => {
              setQuestion("");
              setAnswer("");
            },
          });
        }}
      >
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Nouvelle question…" className="h-8" />
        {kind === "answer" && question && (
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="Ma réponse (points clés)" className="text-[13px]" />
        )}
        <Button type="submit" size="sm" variant="outline" disabled={pending || !question.trim()} className="justify-self-end">
          <Plus /> Ajouter
        </Button>
      </form>
    </Panel>
  );
}

function QuestionItem({ question: q }: { question: PrepQuestion }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(q.question);
  const [answer, setAnswer] = useState(q.answer ?? "");
  const confidence = CONFIDENCE[q.confidence] ?? CONFIDENCE[0];

  if (editing) {
    return (
      <li className="grid gap-2 py-2">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="h-8" />
        {q.kind === "answer" && (
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} placeholder="Ma réponse (points clés)" className="text-[13px]" />
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={pending || !question.trim()}
            onClick={() => run(() => updatePrepQuestionAction(q.id, { question, answer }), { onSuccess: () => setEditing(false) })}
          >
            Enregistrer
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{q.question}</p>
        {q.kind === "answer" &&
          (q.answer ? (
            <p className="mt-0.5 line-clamp-3 text-xs whitespace-pre-wrap text-muted-foreground">{q.answer}</p>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="mt-0.5 text-xs text-amber-700 hover:underline dark:text-amber-300">
              Écrire ma réponse
            </button>
          ))}
      </div>
      {q.kind === "answer" && q.reviewCount > 0 && (
        <span className={cn("shrink-0 rounded border px-1.5 text-[11px]", confidence.className)} title={`Révisée ${q.reviewCount} fois`}>
          {confidence.label}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Modifier"
        className="opacity-50 group-hover:opacity-100"
        onClick={() => {
          setQuestion(q.question);
          setAnswer(q.answer ?? "");
          setEditing(true);
        }}
      >
        <Pencil />
      </Button>
      <ConfirmButton
        title="Mettre cette question à la corbeille ?"
        description={q.question}
        confirmLabel="Mettre à la corbeille"
        destructive
        onConfirm={() => run(() => moveToTrashAction("question", q.id), { success: "Question mise à la corbeille" })}
      >
        <Button variant="ghost" size="icon-xs" aria-label="Mettre à la corbeille" className="opacity-50 group-hover:opacity-100">
          <Trash2 />
        </Button>
      </ConfirmButton>
    </li>
  );
}
