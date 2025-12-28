// ユーザー管理関連の型定義

import type { UserRole } from "./auth";

export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  name?: string;
}

export interface UpdateUserRequest {
  email?: string;
  role?: UserRole;
  name?: string;
}

export interface UserListResponse {
  users: Array<User>;
  total: number;
}
