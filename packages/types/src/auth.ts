// 認証関連の型定義

export type UserRole = "Admin" | "Manager" | "Member";

export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  expiresAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: AuthToken;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}
