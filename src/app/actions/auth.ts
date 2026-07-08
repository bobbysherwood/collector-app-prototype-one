"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateSignUpFields } from "@/lib/password-validation";
import { checkSignUpAvailability } from "@/app/actions/signup-validation";
import {
  consumeActivationCode,
  validateActivationCodeForSignUp,
} from "@/app/actions/activation-code";
import { ACTIVATION_CODE_ERROR, normalizeActivationCode } from "@/lib/activation-code";

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const activationCode = normalizeActivationCode(
    (formData.get("activation_code") as string) ?? ""
  );
  const email = (formData.get("email") as string)?.trim();
  const emailConfirm = (formData.get("email_confirm") as string)?.trim();
  const password = formData.get("password") as string;
  const passwordConfirm = formData.get("password_confirm") as string;
  const displayName = (formData.get("display_name") as string)?.trim();

  const activationError = await validateActivationCodeForSignUp(activationCode);
  if (activationError) {
    return { error: activationError };
  }

  if (!displayName || displayName.length < 2) {
    return { error: "Display name must be at least 2 characters." };
  }

  const validationError = validateSignUpFields({
    email,
    emailConfirm,
    password,
    passwordConfirm,
  });

  if (validationError) {
    return { error: validationError };
  }

  const availability = await checkSignUpAvailability(email, displayName);
  if ("error" in availability) {
    return { error: availability.error };
  }

  if (!availability.emailAvailable) {
    return { error: "An account with this email already exists." };
  }

  if (!availability.displayNameAvailable) {
    return { error: "This display name is already taken." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "An account with this email already exists." };
    }
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Account could not be created. Please try again." };
  }

  const consumed = await consumeActivationCode(activationCode, data.user.id);
  if (!consumed) {
    return { error: ACTIVATION_CODE_ERROR };
  }

  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
