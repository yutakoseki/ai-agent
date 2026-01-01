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
  /**
   * Adminのみ任意指定可能。未指定時は（API側で）セッションの tenantId が使われる。
   * Manager/Member は指定しても無視または拒否される。
   */
  tenantId?: string;
}

export interface UpdateUserRequest {
  email?: string;
  role?: UserRole;
  name?: string;
}

export interface UserListResponse {
  users: Array<User>;
  total: number;
  nextCursor?: string;
}
