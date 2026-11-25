import type {
  CompanyStatus,
  DocumentKind,
  InteractionType,
  InterviewKind,
  PrepQuestionKind,
  Priority,
  RemoteMode,
  Source,
  Status,
  TaskOrigin,
  TemplateKind,
} from "@/lib/domain/constants";

// Lignes des tables telles que le code les manipule (camelCase, voir lib/db.ts) ; même contenu que la version
// locale, plus userId. Formats de dates : voir l'en-tête de supabase/migrations/20261125000000_schema.sql.

type Owned = { userId: string };

export type Application = Owned & {
  id: number;
  company: string;
  title: string;
  offerUrl: string | null;
  offerText: string | null;
  source: Source | null;
  location: string | null;
  remote: RemoteMode | null;
  duration: string | null;
  startDate: string | null;
  stipend: string | null;
  deadline: string | null;
  sentDate: string | null;
  status: Status;
  priority: Priority;
  matchScore: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type StatusChange = Owned & {
  id: number;
  applicationId: number;
  fromStatus: Status | null;
  toStatus: Status;
  changedAt: string;
};

export type Tag = Owned & { id: number; name: string };

export type Contact = Owned & {
  id: number;
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  howWeMet: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Interaction = Owned & {
  id: number;
  applicationId: number | null;
  contactId: number | null;
  date: string;
  type: InteractionType;
  summary: string;
  content: string | null;
  location: string | null;
  interviewKind: InterviewKind | null;
  durationMinutes: number | null;
  nextAction: string | null;
  nextActionDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Document = Owned & {
  id: number;
  kind: DocumentKind;
  label: string;
  content: string | null;
  filePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  isBase: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type Task = Owned & {
  id: number;
  title: string;
  dueDate: string | null;
  applicationId: number | null;
  interactionId: number | null;
  origin: TaskOrigin;
  doneAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type Keyword = Owned & { id: number; label: string; aliases: string[]; category: string | null; mine: boolean };

export type Template = Owned & {
  id: number;
  kind: TemplateKind;
  key: string;
  name: string;
  subject: string | null;
  body: string;
  updatedAt: string;
};

export type InterviewPrep = Owned & { applicationId: number; companyNotes: string | null; updatedAt: string };

export type PrepQuestion = Owned & {
  id: number;
  applicationId: number;
  kind: PrepQuestionKind;
  question: string;
  answer: string | null;
  confidence: number;
  reviewCount: number;
  lastReviewedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type Company = Owned & {
  id: number;
  name: string;
  careersUrl: string | null;
  location: string | null;
  sector: string | null;
  notes: string | null;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
