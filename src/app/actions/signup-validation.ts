"use server";

import { createClient } from "@/lib/supabase/server";

export interface SignUpAvailability {
  emailAvailable: boolean;
  displayNameAvailable: boolean;
}

export async function checkSignUpAvailability(
  email: string,
  displayName: string
): Promise<SignUpAvailability | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_signup_availability", {
    p_email: email.trim(),
    p_display_name: displayName.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as {
    email_available: boolean;
    display_name_available: boolean;
  };

  return {
    emailAvailable: result.email_available,
    displayNameAvailable: result.display_name_available,
  };
}
