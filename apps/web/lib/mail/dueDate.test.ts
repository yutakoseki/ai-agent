import { describe, expect, it } from "vitest";
import { inferDueAtISO } from "./dueDate";

describe("inferDueAtISO", () => {
  it("extracts deadline like 1/31までに", () => {
    const iso = inferDueAtISO({
      text: "1/31（金）までに、2/5 10:00-10:30・2/6 14:00-14:30のいずれか希望日時を返信する。",
      now: new Date("2026-01-08T23:44:00.000Z"),
    });
    expect(iso).toBe("2026-01-31T00:00:00.000Z");
  });
});


