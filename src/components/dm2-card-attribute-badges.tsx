import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Dm2CardAttributeBadges({
  names,
  className,
  size = "default",
}: {
  names: string[];
  className?: string;
  size?: "default" | "sm";
}) {
  if (names.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {names.map((name) => (
        <Badge
          key={name}
          variant="secondary"
          className={cn(
            "font-normal",
            size === "sm" ? "text-[10px]" : "text-xs"
          )}
        >
          {name}
        </Badge>
      ))}
    </div>
  );
}
