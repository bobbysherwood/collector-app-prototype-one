import { Check, X } from "lucide-react";
import { getPasswordStrength } from "@/lib/password-validation";
import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const requirements = getPasswordStrength(password);

  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-4 shadow-sm space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Password requirements
      </p>
      <ul className="space-y-1.5">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              requirement.met ? "text-primary" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                requirement.met
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {requirement.met ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3 opacity-50" />
              )}
            </span>
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
