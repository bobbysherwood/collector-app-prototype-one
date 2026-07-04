"use client";

import { useEffect, useState } from "react";
import { checkSignUpAvailability } from "@/app/actions/signup-validation";
import { cn } from "@/lib/utils";
import { Check, Loader2, X } from "lucide-react";

export type FieldAvailability = "idle" | "checking" | "available" | "taken" | "error";

interface AvailabilityIndicatorProps {
  status: FieldAvailability;
  availableMessage?: string;
  takenMessage: string;
}

export function AvailabilityIndicator({
  status,
  availableMessage = "Available",
  takenMessage,
}: AvailabilityIndicatorProps) {
  if (status === "idle" || status === "error") return null;

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs",
        status === "checking" && "text-muted-foreground",
        status === "available" && "text-primary",
        status === "taken" && "text-destructive"
      )}
    >
      {status === "checking" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking availability...
        </>
      )}
      {status === "available" && (
        <>
          <Check className="h-3 w-3" />
          {availableMessage}
        </>
      )}
      {status === "taken" && (
        <>
          <X className="h-3 w-3" />
          {takenMessage}
        </>
      )}
    </p>
  );
}

function useDebouncedValue<T>(value: T, delayMs = 500): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useSignUpAvailability(email: string, displayName: string) {
  const debouncedEmail = useDebouncedValue(email.trim().toLowerCase());
  const debouncedDisplayName = useDebouncedValue(displayName.trim());

  const [emailStatus, setEmailStatus] = useState<FieldAvailability>("idle");
  const [displayNameStatus, setDisplayNameStatus] =
    useState<FieldAvailability>("idle");
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null
  );

  const emailReady = debouncedEmail.length > 0 && EMAIL_PATTERN.test(debouncedEmail);
  const displayNameReady = debouncedDisplayName.length >= 2;

  useEffect(() => {
    if (!emailReady) setEmailStatus("idle");
    if (!displayNameReady) setDisplayNameStatus("idle");

    if (!emailReady && !displayNameReady) {
      setAvailabilityError(null);
      return;
    }

    let cancelled = false;

    if (emailReady) setEmailStatus("checking");
    if (displayNameReady) setDisplayNameStatus("checking");
    setAvailabilityError(null);

    checkSignUpAvailability(
      emailReady ? debouncedEmail : " ",
      displayNameReady ? debouncedDisplayName : " "
    ).then((result) => {
      if (cancelled) return;

      if ("error" in result) {
        setAvailabilityError(result.error);
        if (emailReady) setEmailStatus("error");
        if (displayNameReady) setDisplayNameStatus("error");
        return;
      }

      if (emailReady) {
        setEmailStatus(result.emailAvailable ? "available" : "taken");
      }
      if (displayNameReady) {
        setDisplayNameStatus(
          result.displayNameAvailable ? "available" : "taken"
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedEmail, debouncedDisplayName, emailReady, displayNameReady]);

  return { emailStatus, displayNameStatus, availabilityError };
}

export function useDisplayNameAvailability(
  displayName: string,
  currentDisplayName: string
) {
  const debouncedDisplayName = useDebouncedValue(displayName.trim());

  const [displayNameStatus, setDisplayNameStatus] =
    useState<FieldAvailability>("idle");
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null
  );

  const displayNameReady = debouncedDisplayName.length >= 2;
  const unchanged =
    debouncedDisplayName.toLowerCase() ===
    currentDisplayName.trim().toLowerCase();

  useEffect(() => {
    if (!displayNameReady) {
      setDisplayNameStatus("idle");
      setAvailabilityError(null);
      return;
    }

    if (unchanged) {
      setDisplayNameStatus("available");
      setAvailabilityError(null);
      return;
    }

    let cancelled = false;
    setDisplayNameStatus("checking");
    setAvailabilityError(null);

    checkSignUpAvailability(" ", debouncedDisplayName).then((result) => {
      if (cancelled) return;

      if ("error" in result) {
        setAvailabilityError(result.error);
        setDisplayNameStatus("error");
        return;
      }

      setDisplayNameStatus(
        result.displayNameAvailable ? "available" : "taken"
      );
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedDisplayName, displayNameReady, unchanged]);

  return { displayNameStatus, availabilityError };
}
