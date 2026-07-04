"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateSignUpFields } from "@/lib/password-validation";
import { checkSignUpAvailability } from "@/app/actions/signup-validation";

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string)?.trim();
  const emailConfirm = (formData.get("email_confirm") as string)?.trim();
  const password = formData.get("password") as string;
  const passwordConfirm = formData.get("password_confirm") as string;
  const displayName = (formData.get("display_name") as string)?.trim();

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

  const { error } = await supabase.auth.signUp({
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

  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
