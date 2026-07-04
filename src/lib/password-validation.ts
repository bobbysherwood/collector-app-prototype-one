export interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password) => /[0-9]/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function getPasswordStrength(password: string) {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));
}

export function validateSignUpFields(fields: {
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
}): string | null {
  if (fields.email.trim().toLowerCase() !== fields.emailConfirm.trim().toLowerCase()) {
    return "Email addresses do not match.";
  }

  if (fields.password !== fields.passwordConfirm) {
    return "Passwords do not match.";
  }

  if (!isPasswordValid(fields.password)) {
    return "Password does not meet all requirements.";
  }

  return null;
}

export function validatePasswordChangeFields(fields: {
  password: string;
  passwordConfirm: string;
}): string | null {
  if (fields.password !== fields.passwordConfirm) {
    return "Passwords do not match.";
  }

  if (!isPasswordValid(fields.password)) {
    return "Password does not meet all requirements.";
  }

  return null;
}
