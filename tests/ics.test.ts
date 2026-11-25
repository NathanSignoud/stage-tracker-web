import { describe, expect, it } from "vitest";
import { escapeText, foldLine } from "@/lib/ics";

describe("export iCalendar", () => {
  it("échappe le texte et replie les lignes longues sans couper un caractère", () => {
    expect(escapeText("Entretien; RH, Paris\nNotes \\ ok")).toBe("Entretien\\; RH\\, Paris\\nNotes \\\\ ok");
    const folded = foldLine(`DESCRIPTION:${"é".repeat(80)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(`DESCRIPTION:${"é".repeat(80)}`);
  });
});
