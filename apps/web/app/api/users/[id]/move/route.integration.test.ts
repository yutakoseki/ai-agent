import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import type { Session } from '@shared/auth';
import { getSession } from '@/lib/auth/session';
import { findTenantById } from '@/lib/repos/tenantRepo';
import { findUserByUserId, moveUserToTenant } from '@/lib/repos/userRepo';

vi.mock('@/lib/auth/session');
const mockGetSession = vi.mocked(getSession);
vi.mock('@/lib/repos/tenantRepo');
const mockFindTenantById = vi.mocked(findTenantById);
vi.mock('@/lib/repos/userRepo');
const mockFindUserByUserId = vi.mocked(findUserByUserId);
const mockMoveUserToTenant = vi.mocked(moveUserToTenant);

const adminSession: Session = {
  userId: 'admin-1',
  tenantId: 'tenant-admin',
  role: 'Admin',
  email: 'admin@example.com',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
};

const headers = {
  'Content-Type': 'application/json',
  Origin: 'http://localhost:3000',
};

describe('POST /api/users/:id/move', () => {
  it('Adminはユーザーを別テナントへ移動できる', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUserByUserId.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'u@example.com',
      role: 'Member',
      name: 'U',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockFindTenantById.mockResolvedValue({
      id: 'tenant-b',
      name: 'B',
      plan: 'Basic',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockMoveUserToTenant.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-b',
      email: 'u@example.com',
      role: 'Member',
      name: 'U',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest('http://localhost:3000/api/users/user-1/move', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId: 'tenant-b' }),
    });

    const res = await POST(request, { params: Promise.resolve({ id: 'user-1' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.tenantId).toBe('tenant-b');
  });
});


