import { describe, expect, it } from "vitest";
import { mailtoUrl, missingVariables, renderTemplate } from "@/lib/domain/templates";

describe("rendu des variables", () => {
  it("remplace, signale les vides, laisse les accolades inconnues", () => {
    const vars = { entreprise: "Mistral", contact: "", poste: null };
    expect(renderTemplate("Bonjour {contact}, chez {entreprise} ({poste}) {inconnue}", vars)).toBe(
      "Bonjour [contact], chez Mistral ([poste]) {inconnue}",
    );
    expect(missingVariables("{entreprise} {contact} {poste} {contact}", vars)).toEqual(["contact", "poste"]);
  });

  it("construit un lien mailto encodé", () => {
    expect(mailtoUrl({ to: "a@b.fr", subject: "Stage — NLP", body: "Bonjour,\nMerci & à bientôt" })).toBe(
      "mailto:a%40b.fr?subject=Stage%20%E2%80%94%20NLP&body=Bonjour%2C%0AMerci%20%26%20%C3%A0%20bient%C3%B4t",
    );
  });
});
