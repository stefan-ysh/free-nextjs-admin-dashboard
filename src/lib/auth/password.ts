import bcrypt from 'bcryptjs';

const PASSWORD_MIN_LENGTH = 12;

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `密码至少需要 ${PASSWORD_MIN_LENGTH} 个字符` };
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
    return {
      valid: false,
      message: '密码需同时包含大写字母、小写字母、数字与特殊字符',
    };
  }

  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
