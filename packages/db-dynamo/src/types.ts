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

export type TenantApplicationItem = {
  PK: `TENANT#${string}`;
  SK: `TENANT_APPLICATION#${string}`;
  tenantName: string;
  plan: "Basic" | "Pro" | "Enterprise";
  contactEmail: string;
  contactName?: string;
  note?: string;
  status: "Pending" | "Approved" | "Rejected";
  decisionNote?: string;
  decidedAt?: string;
  decidedByUserId?: string;
  createdTenantId?: string;
  createdAt: string;
  updatedAt: string;
  GSI1PK: "TENANT_APPLICATION";
  GSI1SK: string;
};

