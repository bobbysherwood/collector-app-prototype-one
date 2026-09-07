"use client";

import { cloneElement, type ReactElement } from "react";
import { cn } from "@/lib/utils";

type ChartSizeProps = {
  width?: number | string;
  height?: number | string;
  responsive?: boolean;
};

export function MeasuredChart({
  height,
  className,
  children,
}: {
  height: number;
  className?: string;
  children: ReactElement<ChartSizeProps>;
}) {
  return (
    <div
      className={cn("w-full overflow-visible", className)}
      style={{ width: "100%", height }}
    >
      {cloneElement(children, {
        width: 640,
        height,
        responsive: false,
      })}
    </div>
  );
}
