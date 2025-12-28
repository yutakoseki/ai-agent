export type TenantItem = {
  PK: `TENANT#${string}`;
  SK: `TENANT#${string}`;
  name: string;
  plan: "Basic" | "Pro" | "Enterprise";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserItem = {
  PK: `TENANT#${string}`;
  SK: `USER#${string}`;
  email: string;
  role: "Admin" | "Manager" | "Member";
  name?: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditItem = {
  PK: `TENANT#${string}`;
  SK: `AUDIT#${string}`;
  action: string;
  resource: string;
  actorUserId: string;
  traceId?: string;
  createdAt: string;
};

