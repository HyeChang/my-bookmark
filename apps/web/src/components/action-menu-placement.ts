import { useState, type MouseEvent } from "react";

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

export function useActionMenuPlacement(
  initialPlacement: ActionMenuPlacement,
  estimatedMenuHeight: number
) {
  const [actionMenuPlacement, setActionMenuPlacement] =
    useState<ActionMenuPlacement>(initialPlacement);

  function updateActionMenuPlacement(event: MouseEvent<HTMLElement>) {
    if (typeof window === "undefined") {
      return;
    }

    const triggerRect = event.currentTarget.getBoundingClientRect();

    setActionMenuPlacement(
      getActionMenuPlacement({
        triggerTop: triggerRect.top,
        triggerBottom: triggerRect.bottom,
        viewportHeight: window.innerHeight,
        estimatedMenuHeight
      })
    );
  }

  return { actionMenuPlacement, updateActionMenuPlacement };
}
