// ユーザー管理関連の型定義

import type { UserRole } from "./auth";

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
  users: Array<{
    id: string;
    email: string;
    role: UserRole;
    name?: string;
    createdAt: Date;
  }>;
  total: number;
}
