import { describe, expect, it } from "vitest";
import { ErreurMetier } from "./erreurs";
import { placer } from "./ordre-interieures";

describe("placer", () => {
  it("déplace un élément vers l'avant", () => {
    expect(placer(["a", "b", "c", "d"], "d", 2)).toEqual(["a", "d", "b", "c"]);
  });

  it("déplace un élément vers l'arrière", () => {
    expect(placer(["a", "b", "c", "d"], "a", 3)).toEqual(["b", "c", "a", "d"]);
  });

  it("accepte le dernier rang", () => {
    expect(placer(["a", "b", "c"], "a", 3)).toEqual(["b", "c", "a"]);
  });

  it("refuse un rang au-delà du dernier", () => {
    expect(() => placer(["a", "b", "c"], "a", 4)).toThrow(ErreurMetier);
  });

  it("refuse le rang 0", () => {
    expect(() => placer(["a", "b"], "a", 0)).toThrow(ErreurMetier);
  });
});
