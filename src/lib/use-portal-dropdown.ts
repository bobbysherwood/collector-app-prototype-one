import { useLayoutEffect, useState, type RefObject } from "react";

type DropdownRect = {
  top: number;
  left: number;
  width: number;
};

export function usePortalDropdown(
  open: boolean,
  inputRef: RefObject<HTMLInputElement | null>,
  layoutKey = 0
): DropdownRect | null {
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);

  useLayoutEffect(() => {
    if (!open || !inputRef.current) {
      setDropdownRect((prev) => (prev === null ? prev : null));
      return;
    }

    function updateRect() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;

      const next: DropdownRect = {
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      };

      setDropdownRect((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, inputRef, layoutKey]);

  return dropdownRect;
}
