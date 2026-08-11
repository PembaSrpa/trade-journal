"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

interface PopoverPlacement {
  /** Which side of the trigger the panel should open on. */
  placement: "top" | "bottom";
  /** Max height (px) that actually fits in that direction without spilling past the viewport. */
  maxHeight: number;
}

const GAP = 8; // px — matches the mt-2/mb-2 spacing used at every call site
const VIEWPORT_MARGIN = 16; // keep a little breathing room from the screen edge
const MIN_HEIGHT = 120; // never shrink a panel below something usable

/**
 * Popover/dropdown panels in this app are absolutely positioned, so opening
 * them doesn't push page content down — but a panel that always drops below
 * its trigger can still render past the bottom of the viewport when the
 * trigger itself is near the bottom of the screen (e.g. a filter row at the
 * foot of a card, or a switcher near the bottom of the sidebar). Rendered
 * content past the viewport still grows the page's total scrollable height,
 * which is what actually causes "the app stretches" when a popup opens.
 *
 * This hook measures the trigger's position when the panel opens and picks
 * whichever direction actually has room, capping the panel's height to fit.
 */
export function usePopoverPlacement(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  preferredMaxHeight: number
): PopoverPlacement {
  const [state, setState] = useState<PopoverPlacement>({
    placement: "bottom",
    maxHeight: preferredMaxHeight,
  });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function measure() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;

      // Prefer opening downward like normal. Only flip up when there's
      // genuinely not enough room below AND opening upward gives more space.
      const placement: "top" | "bottom" =
        spaceBelow < preferredMaxHeight && spaceAbove > spaceBelow ? "top" : "bottom";
      const available = placement === "top" ? spaceAbove : spaceBelow;

      setState({
        placement,
        maxHeight: Math.max(MIN_HEIGHT, Math.min(preferredMaxHeight, available)),
      });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, triggerRef, preferredMaxHeight]);

  return state;
}
