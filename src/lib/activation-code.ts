export const ACTIVATION_CODE_LENGTH = 4;

export function normalizeActivationCode(value: string): string {
  return value.trim();
}

export function isActivationCodeFormatValid(value: string): boolean {
  return /^[0-9]{4}$/.test(normalizeActivationCode(value));
}

export const ACTIVATION_CODE_ERROR = "Invalid activation code.";
