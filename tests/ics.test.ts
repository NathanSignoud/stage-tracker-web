import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, wallTimeToDate } from "@/lib/ics";

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

describe("fuseau horaire (serveur en UTC)", () => {
  it("lit l'heure dans le fuseau donné, heure d'hiver comme d'été", () => {
    expect(wallTimeToDate("2026-11-03T14:30", "Europe/Paris").toISOString()).toBe("2026-11-03T13:30:00.000Z");
    expect(wallTimeToDate("2026-07-01T14:30", "Europe/Paris").toISOString()).toBe("2026-07-01T12:30:00.000Z");
    // Juste après le passage à l'heure d'été (29 mars 2026, 2 h → 3 h).
    expect(wallTimeToDate("2026-03-29T03:30", "Europe/Paris").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("le .ics du serveur place l'entretien à la bonne heure", () => {
    const ics = buildCalendar([{ uid: "x", start: "2026-11-03T14:30", durationMinutes: 45, title: "Entretien" }], { name: "Test", timeZone: "Europe/Paris" });
    expect(ics).toContain("DTSTART:20261103T133000Z");
    expect(ics).toContain("DTEND:20261103T141500Z");
  });
});
