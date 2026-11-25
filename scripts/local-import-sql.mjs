// Fabrique le script SQL d'import des données de la version locale (voir scripts/local-import.ts).
// Usage : node --experimental-strip-types scripts/local-import-sql.mjs <sauvegarde.json> <sortie.sql>
// La sortie contient des données personnelles : la garder hors du dépôt et la supprimer après l'import.
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { importSql } from "./local-import.ts";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage : node --experimental-strip-types scripts/local-import-sql.mjs <sauvegarde.json> <sortie.sql>");
  process.exit(1);
}
const { sql, summary } = importSql(JSON.parse(readFileSync(input, "utf8")), `sauvegarde ${basename(input)}`);
writeFileSync(output, sql);
console.log("Lignes importées :", summary.counts);
console.log("Lignes ignorées :", summary.skipped.length ? summary.skipped : "aucune");
console.log(`Script écrit : ${output} (${Math.round(sql.length / 1024)} Ko)`);
