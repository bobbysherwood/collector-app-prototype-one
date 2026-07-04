"use server";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIVATION_CODE_ERROR,
  isActivationCodeFormatValid,
  normalizeActivationCode,
} from "@/lib/activation-code";

export async function isActivationCodeAvailable(
  code: string
): Promise<{ available: boolean; error?: string }> {
  const normalized = normalizeActivationCode(code);

  if (!isActivationCodeFormatValid(normalized)) {
    return { available: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_activation_code_available", {
    p_code: normalized,
  });

  if (error) {
    console.error("Activation code check failed:", error.message);
    if (error.code === "PGRST202") {
      return {
        available: false,
        error:
          "Activation codes are not set up yet. Run migration 006_activation_codes.sql in Supabase.",
      };
    }
    return { available: false, error: "Could not verify activation code." };
  }

  return { available: data === true };
}

export async function consumeActivationCode(
  code: string,
  userId: string
): Promise<boolean> {
  const normalized = normalizeActivationCode(code);

  if (!isActivationCodeFormatValid(normalized)) {
    return false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_activation_code", {
    p_code: normalized,
    p_user_id: userId,
  });

  if (error) {
    console.error("Activation code consume failed:", error.message);
    return false;
  }

  return data === true;
}

export async function validateActivationCodeForSignUp(
  code: string
): Promise<string | null> {
  const normalized = normalizeActivationCode(code);

  if (!normalized) {
    return "Activation code is required.";
  }

  if (!isActivationCodeFormatValid(normalized)) {
    return ACTIVATION_CODE_ERROR;
  }

  const result = await isActivationCodeAvailable(normalized);
  if (result.error) {
    return result.error;
  }

  if (!result.available) {
    return ACTIVATION_CODE_ERROR;
  }

  return null;
}
