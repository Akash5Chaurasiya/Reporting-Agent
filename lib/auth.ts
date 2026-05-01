/**
 * Simple authentication utilities
 * Note: This is a mock implementation for demonstration
 * In production, replace with proper backend authentication
 */

const AUTH_STORAGE_KEY = 'azalio_auth';
const USER_STORAGE_KEY = 'azalio_user';
const TOKEN_STORAGE_KEY = 'azalio_token';

// Password constants
const ADMIN_PASSWORD = 'admin123';
const SME_PASSWORD = 'password123';

export interface AuthUser {
  smeId: string;
  loginTime: string;
}

// Generate a simple token based on SME ID and timestamp
// For admin users, use empty string to indicate no SME filter
function generateToken(smeId: string): string {
  const timestamp = Date.now();
  // If admin, use empty string to indicate no SME filter
  const tokenSmeId = smeId === 'admin@azalio.io' ? '' : smeId;
  const payload = `${tokenSmeId}:${timestamp}`;
  // Simple base64 encoding (in production, use JWT)
  return btoa(payload);
}

export function validateCredentials(smeId: string, password: string): boolean {
  // Admin user (email format with @azalio.io)
  if (smeId === 'admin@azalio.io') {
    return password === ADMIN_PASSWORD;
  }

  // SME users - accept any numeric SME ID with SME_PASSWORD
  const numericPattern = /^\d+$/;
  if (numericPattern.test(smeId)) {
    return password === SME_PASSWORD;
  }

  return false;
}

export function isValidSmeIdFormat(smeId: string): boolean {
  // SME ID can be:
  // - Numeric string: 10001001
  // - Email format: admin@azalio.io
  const numericPattern = /^\d+$/;
  const emailPattern = /^[\w.-]+@[\w.-]+\.\w+$/;

  return numericPattern.test(smeId) || emailPattern.test(smeId);
}

export function login(smeId: string): void {
  const user: AuthUser = {
    smeId,
    loginTime: new Date().toISOString(),
  };
  const token = generateToken(smeId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_STORAGE_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as AuthUser;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// Ensure token exists, regenerate if missing (for users logged in before token was added)
export function ensureAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  const userStr = localStorage.getItem(USER_STORAGE_KEY);
  if (!userStr) return null;

  try {
    const user = JSON.parse(userStr) as AuthUser;
    if (user && user.smeId) {
      // Use empty string for admin to indicate no SME filter
      const tokenSmeId = user.smeId === 'admin@azalio.io' ? '' : user.smeId;
      const token = generateToken(tokenSmeId);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      return token;
    }
  } catch {
    return null;
  }

  return null;
}
