import { DEFAULT_TEMPLATES } from "@/lib/domain/default-templates";
import { DEFAULT_SETTINGS } from "@/lib/domain/settings";
import { row, upsert } from "@/lib/db";

// Données de départ de chaque personne (réglages, mots-clés, gabarits), créées à sa première visite.
// Nouvelles données livrées plus tard : les ajouter ici et incrémenter SEED_VERSION (rien d'existant n'est écrasé).
export const SEED_VERSION = 1;

const STARTER_KEYWORDS: { label: string; category: string; aliases?: string[] }[] = [
  { label: "Python", category: "Langages" },
  { label: "C++", category: "Langages", aliases: ["cpp"] },
  { label: "Java", category: "Langages" },
  { label: "R", category: "Langages" },
  { label: "SQL", category: "Langages" },
  { label: "Scala", category: "Langages" },
  { label: "Machine Learning", category: "ML / DL", aliases: ["ML", "apprentissage automatique"] },
  { label: "Deep Learning", category: "ML / DL", aliases: ["apprentissage profond"] },
  { label: "PyTorch", category: "ML / DL", aliases: ["torch"] },
  { label: "TensorFlow", category: "ML / DL" },
  { label: "Keras", category: "ML / DL" },
  { label: "JAX", category: "ML / DL" },
  { label: "scikit-learn", category: "ML / DL", aliases: ["sklearn", "scikit learn"] },
  { label: "XGBoost", category: "ML / DL" },
  { label: "Reinforcement Learning", category: "ML / DL", aliases: ["apprentissage par renforcement", "RL"] },
  { label: "NLP", category: "NLP / LLM", aliases: ["natural language processing", "traitement automatique du langage", "traitement du langage naturel", "TALN"] },
  { label: "LLM", category: "NLP / LLM", aliases: ["LLMs", "large language model", "large language models", "grands modèles de langage"] },
  { label: "Transformers", category: "NLP / LLM" },
  { label: "Hugging Face", category: "NLP / LLM", aliases: ["HuggingFace"] },
  { label: "RAG", category: "NLP / LLM", aliases: ["retrieval-augmented generation", "retrieval augmented generation"] },
  { label: "LangChain", category: "NLP / LLM" },
  { label: "Fine-tuning", category: "NLP / LLM", aliases: ["fine tuning", "finetuning"] },
  { label: "IA générative", category: "NLP / LLM", aliases: ["generative AI", "GenAI", "IA gen"] },
  { label: "Prompt engineering", category: "NLP / LLM" },
  { label: "Computer Vision", category: "Vision", aliases: ["vision par ordinateur"] },
  { label: "OpenCV", category: "Vision" },
  { label: "Détection d'objets", category: "Vision", aliases: ["object detection"] },
  { label: "Segmentation", category: "Vision" },
  { label: "pandas", category: "Data" },
  { label: "NumPy", category: "Data" },
  { label: "Spark", category: "Data", aliases: ["PySpark", "Apache Spark"] },
  { label: "Statistiques", category: "Data", aliases: ["statistics", "statistique"] },
  { label: "Séries temporelles", category: "Data", aliases: ["time series"] },
  { label: "Databricks", category: "Data" },
  { label: "MLOps", category: "MLOps / Cloud" },
  { label: "MLflow", category: "MLOps / Cloud" },
  { label: "Airflow", category: "MLOps / Cloud" },
  { label: "Docker", category: "MLOps / Cloud" },
  { label: "Kubernetes", category: "MLOps / Cloud", aliases: ["k8s"] },
  { label: "CI/CD", category: "MLOps / Cloud" },
  { label: "FastAPI", category: "MLOps / Cloud" },
  { label: "AWS", category: "MLOps / Cloud" },
  { label: "GCP", category: "MLOps / Cloud", aliases: ["Google Cloud"] },
  { label: "Azure", category: "MLOps / Cloud" },
  { label: "Git", category: "Outils" },
  { label: "Linux", category: "Outils" },
];

/** Crée les données de départ manquantes de la personne connectée. */
export async function ensureSeed(): Promise<void> {
  const done = await row<{ value: number }>("settings", { key: "seedVersion" });
  if (Number(done?.value ?? 0) >= SEED_VERSION) return;

  // Chaque insertion ignore ce qui existe déjà : après une coupure, la visite suivante complète sans doublon.
  await upsert("settings", Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })), ["userId", "key"], { ignore: true });
  await upsert(
    "keywords",
    STARTER_KEYWORDS.map((k) => ({ label: k.label, category: k.category, aliases: k.aliases ?? [] })),
    ["userId", "label"],
    { ignore: true },
  );
  await upsert(
    "templates",
    DEFAULT_TEMPLATES.map((t) => ({ kind: t.kind, key: t.key, name: t.name, subject: t.subject ?? null, body: t.body })),
    ["userId", "kind", "key"],
    { ignore: true },
  );
  await upsert("settings", [{ key: "seedVersion", value: SEED_VERSION }], ["userId", "key"]);
}
