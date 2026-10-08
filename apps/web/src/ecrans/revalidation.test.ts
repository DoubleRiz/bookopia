import type { ShouldRevalidateFunctionArgs } from "react-router";
import { describe, expect, it } from "vitest";
import { revaliderSaufPageCourante } from "./revalidation";

const LIVRE = "http://localhost/livre/1";

function args(
  avant: string,
  apres: string,
  autres: Partial<ShouldRevalidateFunctionArgs> = {},
): ShouldRevalidateFunctionArgs {
  return {
    currentUrl: new URL(avant),
    currentParams: { id: "1" },
    nextUrl: new URL(apres),
    nextParams: { id: "1" },
    defaultShouldRevalidate: true,
    ...autres,
  };
}

describe("revaliderSaufPageCourante", () => {
  it("ne recharge pas quand seule la double page courante change", () => {
    expect(revaliderSaufPageCourante(args(LIVRE, `${LIVRE}?page=a`))).toBe(
      false,
    );
    expect(
      revaliderSaufPageCourante(args(`${LIVRE}?page=a`, `${LIVRE}?page=b`)),
    ).toBe(false);
    expect(revaliderSaufPageCourante(args(`${LIVRE}?page=a`, LIVRE))).toBe(
      false,
    );
  });

  it("recharge après un revalidate() explicite, à la même adresse", () => {
    expect(
      revaliderSaufPageCourante(args(`${LIVRE}?page=a`, `${LIVRE}?page=a`)),
    ).toBe(true);
  });

  it("recharge après une action, même si la page change", () => {
    expect(
      revaliderSaufPageCourante(
        args(`${LIVRE}?page=a`, `${LIVRE}?page=b`, { formMethod: "POST" }),
      ),
    ).toBe(true);
  });

  it("garde le comportement par défaut pour les autres navigations", () => {
    expect(
      revaliderSaufPageCourante(args(`${LIVRE}?page=a`, `${LIVRE}?page=b&x=1`)),
    ).toBe(true);
    expect(
      revaliderSaufPageCourante(
        args(`${LIVRE}?page=a`, "http://localhost/livre/2?page=b", {
          nextParams: { id: "2" },
        }),
      ),
    ).toBe(true);
    expect(
      revaliderSaufPageCourante(
        args(`${LIVRE}?page=a`, `${LIVRE}/import`, {
          defaultShouldRevalidate: false,
        }),
      ),
    ).toBe(false);
  });
});
