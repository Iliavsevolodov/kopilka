import { describe, expect, it } from "vitest";
import { ICON_LIBRARY, normalizeIconId } from "./icons";
import { DEFAULT_CATEGORIES } from "./categories";
import { categorySchema } from "../local/model";
describe("category icon library", () => {
  it("has unique stable IDs for every default category", () => {
    expect(new Set(ICON_LIBRARY.map((i) => i.id)).size).toBe(32);
    for (const c of DEFAULT_CATEGORIES)
      expect(normalizeIconId(c.icon)).toBe(c.icon);
  });
  it("migrates old backups without changing identity or ownership links", () => {
    const category = {
      id: "existing-food",
      name: "Продукты",
      kind: "expense",
      icon: "🛒",
      archived: false,
    };
    expect(categorySchema.parse(category)).toEqual({
      ...category,
      icon: "basket",
    });
    expect(normalizeIconId("📊")).toBe("chart");
    expect(normalizeIconId("custom-unknown")).toBe("other");
  });
});
