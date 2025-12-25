// パスワードハッシュ化・検証ユーティリティ

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("パスワードは8文字以上である必要があります");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("パスワードには大文字を含める必要があります");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("パスワードには小文字を含める必要があります");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("パスワードには数字を含める必要があります");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
