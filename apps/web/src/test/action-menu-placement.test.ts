import { describe, expect, it } from "vitest";
import { getActionMenuPlacement } from "../components/action-menu-placement";

describe("getActionMenuPlacement", () => {
  it("opens below the trigger when there is enough lower viewport space", () => {
    expect(
      getActionMenuPlacement({
        triggerTop: 92,
        triggerBottom: 132,
        viewportHeight: 640,
        estimatedMenuHeight: 112
      })
    ).toBe("below");
  });

  it("opens above the trigger when the lower viewport space would clip the menu", () => {
    expect(
      getActionMenuPlacement({
        triggerTop: 486,
        triggerBottom: 526,
        viewportHeight: 560,
        estimatedMenuHeight: 112
      })
    ).toBe("above");
  });

  it("uses the side with more space when neither side fully fits", () => {
    expect(
      getActionMenuPlacement({
        triggerTop: 152,
        triggerBottom: 192,
        viewportHeight: 260,
        estimatedMenuHeight: 180
      })
    ).toBe("above");
  });
});
