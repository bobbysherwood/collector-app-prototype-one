"use client";

import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { cn } from "@/lib/utils";

const DEFAULT_CHART_WIDTH = 640;

export function MeasuredChart({
  height,
  className,
  children,
}: {
  height: number;
  className?: string;
  children: ReactElement<{ width?: number; height?: number }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(DEFAULT_CHART_WIDTH);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const node = ref.current;
    if (!node) return;

    const updateWidth = () => {
      const next = Math.floor(node.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready]);

  if (!ready) {
    return (
      <div
        className={cn("w-full animate-pulse rounded-xl bg-muted", className)}
        style={{ height }}
        aria-hidden
      />
    );
  }

  return (
    <div
      ref={ref}
      className={cn("w-full overflow-visible", className)}
      style={{ width: "100%", height }}
    >
      {cloneElement(children, { width, height })}
    </div>
  );
}
