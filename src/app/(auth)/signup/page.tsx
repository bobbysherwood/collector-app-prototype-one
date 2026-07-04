"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { PasswordRequirements } from "@/components/password-requirements";
import {
  AvailabilityIndicator,
  useSignUpAvailability,
} from "@/components/signup-availability";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isPasswordValid,
  validateSignUpFields,
} from "@/lib/password-validation";
import {
  ACTIVATION_CODE_LENGTH,
  isActivationCodeFormatValid,
  normalizeActivationCode,
} from "@/lib/activation-code";
import { cn } from "@/lib/utils";

export default function SignUpPage() {
  const [activationCode, setActivationCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { emailStatus, displayNameStatus, availabilityError } =
    useSignUpAvailability(email, displayName);

  const emailsMatch =
    emailConfirm.length > 0 &&
    email.trim().toLowerCase() === emailConfirm.trim().toLowerCase();
  const passwordsMatch =
    passwordConfirm.length > 0 && password === passwordConfirm;
  const passwordValid = isPasswordValid(password);
  const activationCodeValid = isActivationCodeFormatValid(activationCode);
  const displayNameValid = displayName.trim().length >= 2;
  const emailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const availabilityBlocking =
    emailStatus === "taken" ||
    displayNameStatus === "taken" ||
    emailStatus === "checking" ||
    displayNameStatus === "checking";

  const canSubmit = useMemo(() => {
    if (
      !activationCodeValid ||
      !displayNameValid ||
      !emailFormatValid ||
      !emailConfirm ||
      !password ||
      !passwordConfirm
    ) {
      return false;
    }

    return (
      emailsMatch &&
      passwordsMatch &&
      passwordValid &&
      !availabilityBlocking &&
      !loading
    );
  }, [
    activationCodeValid,
    displayNameValid,
    emailFormatValid,
    emailConfirm,
    password,
    passwordConfirm,
    emailsMatch,
    passwordsMatch,
    passwordValid,
    availabilityBlocking,
    loading,
  ]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const validationError = validateSignUpFields({
      email,
      emailConfirm,
      password,
      passwordConfirm,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!displayNameValid) {
      setError("Display name must be at least 2 characters.");
      return;
    }

    if (!activationCodeValid) {
      setError("Enter a valid 4-digit activation code.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("activation_code", normalizeActivationCode(activationCode));
    formData.append("display_name", displayName.trim());
    formData.append("email", email.trim());
    formData.append("email_confirm", emailConfirm.trim());
    formData.append("password", password);
    formData.append("password_confirm", passwordConfirm);

    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
          CP
        </div>
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>
          Enter your activation code to start tracking your card portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {availabilityError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Could not verify availability: {availabilityError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name *</Label>
            <Input
              id="display_name"
              name="display_name"
              type="text"
              required
              minLength={2}
              maxLength={50}
              placeholder="Your unique display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
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
            {displayName.length > 0 && displayName.trim().length < 2 && (
              <p className="text-xs text-muted-foreground">
                Display name must be at least 2 characters.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailStatus === "taken"}
              className={cn(
                emailStatus === "taken" &&
                  "border-destructive aria-invalid:border-destructive"
              )}
            />
            <AvailabilityIndicator
              status={emailStatus}
              availableMessage="Email is available"
              takenMessage="An account with this email already exists"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_confirm">Confirm Email *</Label>
            <Input
              id="email_confirm"
              name="email_confirm"
              type="email"
              required
              autoComplete="off"
              placeholder="Re-enter your email"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              aria-invalid={emailConfirm.length > 0 && !emailsMatch}
              className={cn(
                emailConfirm.length > 0 &&
                  !emailsMatch &&
                  "border-destructive aria-invalid:border-destructive"
              )}
            />
            {emailConfirm.length > 0 && !emailsMatch && (
              <p className="text-xs text-destructive">Email addresses do not match.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="new-password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <PasswordRequirements password={password} />

          <div className="space-y-2">
            <Label htmlFor="password_confirm">Confirm Password *</Label>
            <PasswordInput
              id="password_confirm"
              name="password_confirm"
              required
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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

          <div className="space-y-2">
            <Label htmlFor="activation_code">Activation Code *</Label>
            <Input
              id="activation_code"
              name="activation_code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="off"
              maxLength={ACTIVATION_CODE_LENGTH}
              placeholder="4-digit code"
              value={activationCode}
              onChange={(e) =>
                setActivationCode(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              aria-invalid={activationCode.length > 0 && !activationCodeValid}
              className={cn(
                activationCode.length > 0 &&
                  !activationCodeValid &&
                  "border-destructive aria-invalid:border-destructive"
              )}
            />
            {activationCode.length > 0 && !activationCodeValid && (
              <p className="text-xs text-destructive">
                Activation code must be exactly 4 digits.
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
          {!canSubmit && !loading && (
            <p className="text-xs text-center text-muted-foreground">
              {emailStatus === "checking" || displayNameStatus === "checking"
                ? "Checking availability..."
                : !activationCodeValid
                  ? "Enter a valid 4-digit activation code."
                  : !displayNameValid
                  ? "Enter a display name (at least 2 characters)."
                  : !emailFormatValid
                    ? "Enter a valid email address."
                    : !emailsMatch
                      ? "Email addresses must match."
                      : !passwordValid
                        ? "Password must meet all requirements."
                        : !passwordsMatch
                          ? "Passwords must match."
                          : emailStatus === "taken"
                            ? "This email is already registered."
                            : displayNameStatus === "taken"
                              ? "This display name is already taken."
                              : "Complete all required fields."}
            </p>
          )}
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
