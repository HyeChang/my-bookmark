export type ActionMenuPlacement = "below" | "above";

export type ActionMenuPlacementOptions = {
  triggerTop: number;
  triggerBottom: number;
  viewportHeight: number;
  estimatedMenuHeight: number;
  viewportMargin?: number;
};

export function getActionMenuPlacement(
  options: ActionMenuPlacementOptions
): ActionMenuPlacement {
  const viewportMargin = options.viewportMargin ?? 12;
  const menuHeight = Math.max(0, options.estimatedMenuHeight);
  const spaceAbove = Math.max(0, options.triggerTop - viewportMargin);
  const spaceBelow = Math.max(0, options.viewportHeight - options.triggerBottom - viewportMargin);

  if (spaceBelow >= menuHeight) {
    return "below";
  }

  return spaceAbove > spaceBelow ? "above" : "below";
}
