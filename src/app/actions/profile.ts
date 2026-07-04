"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkSignUpAvailability } from "@/app/actions/signup-validation";
import { validatePasswordChangeFields } from "@/lib/password-validation";

export async function updateDisplayName(
  displayName: string
): Promise<{ error?: string; success?: string }> {
  const trimmed = displayName.trim();

  if (!trimmed || trimmed.length < 2) {
    return { error: "Display name must be at least 2 characters." };
  }

  if (trimmed.length > 50) {
    return { error: "Display name must be 50 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return { error: profileError.message };
  }

  const currentName = profile?.display_name?.trim() ?? "";
  if (trimmed.toLowerCase() === currentName.toLowerCase()) {
    return { success: "Display name is unchanged." };
  }

  const availability = await checkSignUpAvailability(" ", trimmed);
  if ("error" in availability) {
    return { error: availability.error };
  }

  if (!availability.displayNameAvailable) {
    return { error: "This display name is already taken." };
  }

  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({ display_name: trimmed })
    .eq("id", user.id);

  if (updateProfileError) {
    if (updateProfileError.message.toLowerCase().includes("unique")) {
      return { error: "This display name is already taken." };
    }
    return { error: updateProfileError.message };
  }

  const { error: updateUserError } = await supabase.auth.updateUser({
    data: { display_name: trimmed },
  });

  if (updateUserError) {
    return { error: updateUserError.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  return { success: "Display name updated." };
}

export async function updatePassword(
  password: string,
  passwordConfirm: string
): Promise<{ error?: string; success?: string }> {
  const validationError = validatePasswordChangeFields({
    password,
    passwordConfirm,
  });

  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  return { success: "Password updated." };
}
