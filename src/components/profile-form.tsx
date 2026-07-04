"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { PasswordRequirements } from "@/components/password-requirements";
import {
  AvailabilityIndicator,
  useDisplayNameAvailability,
} from "@/components/signup-availability";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { updateDisplayName, updatePassword } from "@/app/actions/profile";
import {
  isPasswordValid,
  validatePasswordChangeFields,
} from "@/lib/password-validation";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/data";

interface ProfileFormProps {
  profile: UserProfile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.displayName);

  useEffect(() => {
    setDisplayName(profile.displayName);
  }, [profile.displayName]);
  const [displayNameMessage, setDisplayNameMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [displayNameLoading, setDisplayNameLoading] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const { displayNameStatus, availabilityError } = useDisplayNameAvailability(
    displayName,
    profile.displayName
  );

  const displayNameValid = displayName.trim().length >= 2;
  const displayNameChanged =
    displayName.trim().toLowerCase() !==
    profile.displayName.trim().toLowerCase();
  const displayNameBlocking =
    displayNameStatus === "taken" ||
    displayNameStatus === "checking" ||
    displayNameStatus === "error";

  const canSaveDisplayName = useMemo(() => {
    return (
      displayNameValid &&
      displayNameChanged &&
      !displayNameBlocking &&
      !displayNameLoading
    );
  }, [
    displayNameValid,
    displayNameChanged,
    displayNameBlocking,
    displayNameLoading,
  ]);

  const passwordsMatch =
    passwordConfirm.length > 0 && password === passwordConfirm;
  const passwordValid = isPasswordValid(password);

  const canSavePassword = useMemo(() => {
    return (
      password.length > 0 &&
      passwordConfirm.length > 0 &&
      passwordsMatch &&
      passwordValid &&
      !passwordLoading
    );
  }, [
    password,
    passwordConfirm,
    passwordsMatch,
    passwordValid,
    passwordLoading,
  ]);

  async function handleDisplayNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDisplayNameMessage(null);

    if (!displayNameValid) {
      setDisplayNameMessage({
        type: "error",
        text: "Display name must be at least 2 characters.",
      });
      return;
    }

    setDisplayNameLoading(true);
    const result = await updateDisplayName(displayName);
    setDisplayNameLoading(false);

    if (result.error) {
      setDisplayNameMessage({ type: "error", text: result.error });
      return;
    }

    setDisplayNameMessage({
      type: "success",
      text: result.success ?? "Display name updated.",
    });
    router.refresh();
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);

    const validationError = validatePasswordChangeFields({
      password,
      passwordConfirm,
    });

    if (validationError) {
      setPasswordMessage({ type: "error", text: validationError });
      return;
    }

    setPasswordLoading(true);
    const result = await updatePassword(password, passwordConfirm);
    setPasswordLoading(false);

    if (result.error) {
      setPasswordMessage({ type: "error", text: result.error });
      return;
    }

    setPassword("");
    setPasswordConfirm("");
    setPasswordMessage({
      type: "success",
      text: result.success ?? "Password updated.",
    });
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Display Name</CardTitle>
          <CardDescription>
            Your unique name shown in the app. Must be unique across all accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDisplayNameSubmit} className="space-y-4">
            {displayNameMessage && (
              <MessageBanner
                type={displayNameMessage.type}
                text={displayNameMessage.text}
              />
            )}
            {availabilityError && (
              <MessageBanner
                type="error"
                text={`Could not verify availability: ${availabilityError}`}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="profile_email">Email</Label>
              <Input
                id="profile_email"
                type="email"
                value={profile.email}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile_display_name">Display Name *</Label>
              <Input
                id="profile_display_name"
                type="text"
                required
                minLength={2}
                maxLength={50}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setDisplayNameMessage(null);
                }}
                aria-invalid={displayNameStatus === "taken"}
                className={cn(
                  displayNameStatus === "taken" &&
                    "border-destructive aria-invalid:border-destructive"
                )}
              />
              <AvailabilityIndicator
                status={displayNameStatus}
                availableMessage="Display name is available"
                takenMessage="This display name is already taken"
              />
            </div>

            <Button type="submit" disabled={!canSaveDisplayName}>
              {displayNameLoading ? "Saving..." : "Save Display Name"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Password</CardTitle>
          <CardDescription>
            Choose a new password that meets all security requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {passwordMessage && (
              <MessageBanner
                type={passwordMessage.type}
                text={passwordMessage.text}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="profile_password">New Password</Label>
              <PasswordInput
                id="profile_password"
                autoComplete="new-password"
                placeholder="Enter a new password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordMessage(null);
                }}
              />
            </div>

            <PasswordRequirements password={password} />

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="profile_password_confirm">Confirm New Password</Label>
              <PasswordInput
                id="profile_password_confirm"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={passwordConfirm}
                onChange={(e) => {
                  setPasswordConfirm(e.target.value);
                  setPasswordMessage(null);
                }}
                aria-invalid={passwordConfirm.length > 0 && !passwordsMatch}
                className={cn(
                  passwordConfirm.length > 0 &&
                    !passwordsMatch &&
                    "border-destructive aria-invalid:border-destructive"
                )}
              />
              {passwordConfirm.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>

            <Button type="submit" disabled={!canSavePassword}>
              {passwordLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageBanner({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        type === "success"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/50 bg-destructive/10 text-destructive"
      )}
    >
      {text}
    </div>
  );
}
