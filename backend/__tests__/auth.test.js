import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import buildApp from '../src/app.js';

// Fixture user passwords
const ADMIN_PASSWORD = 'admin123456';
const VIEWER_PASSWORD = 'viewer123456';

function createMockDb(initialUsers = []) {
  const users = initialUsers.map((u) => ({ ...u }));

  return {
    users,
    async query(text, params = []) {
      const trimmed = text.trim();

      // SELECT user by email
      if (/SELECT.*FROM users WHERE LOWER\(email\) = LOWER\(\$1\)/i.test(trimmed)) {
        const email = params[0]?.toLowerCase();
        const user = users.find((u) => u.email.toLowerCase() === email);
        return { rows: user ? [{ ...user }] : [] };
      }

      // SELECT user by id
      if (/SELECT.*FROM users WHERE id = \$1/i.test(trimmed)) {
        const id = params[0];
        const user = users.find((u) => u.id === id);
        return { rows: user ? [{ ...user }] : [] };
      }

      // UPDATE user password_hash
      if (/UPDATE users SET password_hash = \$1.*WHERE id = \$2/i.test(trimmed)) {
        const [newHash, id] = params;
        const user = users.find((u) => u.id === id);
        if (user) {
          user.password_hash = newHash;
          user.updated_at = new Date().toISOString();
        }
        return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
      }

      return { rows: [], rowCount: 0 };
    },
  };
}

describe('Fastify App & Authentication Integration Tests', () => {
  let app;
  let mockDb;
  let adminPasswordHash;
  let viewerPasswordHash;

  before(async () => {
    adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    viewerPasswordHash = await bcrypt.hash(VIEWER_PASSWORD, 10);

    const initialUsers = [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
        password_hash: adminPasswordHash,
        role: 'admin',
        display_name: 'System Administrator',
        is_active: true,
      },
      {
        id: 'a0000000-0000-0000-0000-000000000002',
        email: 'viewer@example.com',
        password_hash: viewerPasswordHash,
        role: 'viewer',
        display_name: 'Shuttle Operator',
        is_active: true,
      },
      {
        id: 'a0000000-0000-0000-0000-000000000003',
        email: 'inactive@example.com',
        password_hash: adminPasswordHash,
        role: 'viewer',
        display_name: 'Inactive Staff',
        is_active: false,
      },
    ];

    mockDb = createMockDb(initialUsers);

    app = buildApp({
      logger: false,
      db: mockDb,
      jwtSecret: 'test_super_secret_jwt_key_32_chars_long!',
    });

    // Add sample RBAC protected test routes inside a registered plugin
    app.register(async (testScope) => {
      testScope.get(
        '/api/v1/admin/dashboard',
        { preHandler: [testScope.authenticate, testScope.requireRole('admin')] },
        async (req, reply) => {
          return { success: true, data: { message: 'Welcome Admin' } };
        }
      );

      testScope.get(
        '/api/v1/viewer/summary',
        { preHandler: [testScope.authenticate, testScope.requireRole(['admin', 'viewer'])] },
        async (req, reply) => {
          return { success: true, data: { message: 'Welcome Operator' } };
        }
      );
    });

    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns status ok with timestamp', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.status, 'ok');
      assert.ok(json.timestamp);
      assert.ok(!isNaN(Date.parse(json.timestamp)));
    });
  });

  describe('404 Handler', () => {
    it('returns 404 error envelope for undefined route', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/non-existent-route',
      });

      assert.equal(res.statusCode, 404);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'NOT_FOUND');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('successfully logs in admin with valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@example.com',
          password: ADMIN_PASSWORD,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.ok(json.data.token);
      assert.equal(json.data.user.id, 'a0000000-0000-0000-0000-000000000001');
      assert.equal(json.data.user.email, 'admin@example.com');
      assert.equal(json.data.user.role, 'admin');
      assert.equal(json.data.user.displayName, 'System Administrator');
    });

    it('successfully logs in viewer with case-insensitive email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'VIEWER@EXAMPLE.COM',
          password: VIEWER_PASSWORD,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.ok(json.data.token);
      assert.equal(json.data.user.role, 'viewer');
      assert.equal(json.data.user.displayName, 'Shuttle Operator');
    });

    it('returns 400 when email or password is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@example.com',
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('returns 401 when password is incorrect', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'wrongpassword',
        },
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns 401 when user email does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'notfound@example.com',
          password: 'anyPassword123',
        },
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns 401 when user is inactive', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'inactive@example.com',
          password: ADMIN_PASSWORD,
        },
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let adminToken;
    let viewerToken;

    before(async () => {
      const adminLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'admin@example.com', password: ADMIN_PASSWORD },
      });
      adminToken = JSON.parse(adminLogin.payload).data.token;

      const viewerLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'viewer@example.com', password: VIEWER_PASSWORD },
      });
      viewerToken = JSON.parse(viewerLogin.payload).data.token;
    });

    it('returns user profile when authenticated with valid admin token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer ' + adminToken,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.equal(json.data.user.id, 'a0000000-0000-0000-0000-000000000001');
      assert.equal(json.data.user.email, 'admin@example.com');
      assert.equal(json.data.user.role, 'admin');
      assert.equal(json.data.user.displayName, 'System Administrator');
    });

    it('returns user profile when authenticated with valid viewer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer ' + viewerToken,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.equal(json.data.user.role, 'viewer');
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'UNAUTHORIZED');
    });

    it('returns 401 when token is invalid or malformed', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer invalid.token.payload',
        },
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let adminToken;

    before(async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'admin@example.com', password: ADMIN_PASSWORD },
      });
      adminToken = JSON.parse(loginRes.payload).data.token;
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        payload: {
          currentPassword: ADMIN_PASSWORD,
          newPassword: 'newAdminPassword123',
        },
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'UNAUTHORIZED');
    });

    it('returns 400 when missing fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: 'Bearer ' + adminToken },
        payload: {
          currentPassword: ADMIN_PASSWORD,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('returns 400 when new password is too short', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: 'Bearer ' + adminToken },
        payload: {
          currentPassword: ADMIN_PASSWORD,
          newPassword: '123',
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('returns 401 when current password is incorrect', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: 'Bearer ' + adminToken },
        payload: {
          currentPassword: 'wrongCurrentPassword',
          newPassword: 'newAdminPassword123',
        },
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_CREDENTIALS');
    });

    it('successfully changes password and allows logging in with new password', async () => {
      const newPassword = 'brandNewPassword999';

      const changeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: 'Bearer ' + adminToken },
        payload: {
          currentPassword: ADMIN_PASSWORD,
          newPassword,
        },
      });

      assert.equal(changeRes.statusCode, 200);
      const changeJson = JSON.parse(changeRes.payload);
      assert.equal(changeJson.success, true);
      assert.equal(changeJson.data.message, 'Password updated successfully');

      // Old password should now fail
      const oldLoginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@example.com',
          password: ADMIN_PASSWORD,
        },
      });
      assert.equal(oldLoginRes.statusCode, 401);

      // New password should succeed
      const newLoginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@example.com',
          password: newPassword,
        },
      });
      assert.equal(newLoginRes.statusCode, 200);
      const newLoginJson = JSON.parse(newLoginRes.payload);
      assert.equal(newLoginJson.success, true);
      assert.ok(newLoginJson.data.token);
    });
  });

  describe('Role-Based Access Control (requireRole decorator)', () => {
    let adminToken;
    let viewerToken;

    before(async () => {
      const adminLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'admin@example.com', password: 'brandNewPassword999' },
      });
      adminToken = JSON.parse(adminLogin.payload).data.token;

      const viewerLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'viewer@example.com', password: VIEWER_PASSWORD },
      });
      viewerToken = JSON.parse(viewerLogin.payload).data.token;
    });

    it('allows admin to access admin-only endpoint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/dashboard',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.equal(json.data.message, 'Welcome Admin');
    });

    it('forbids viewer from accessing admin-only endpoint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/dashboard',
        headers: { authorization: 'Bearer ' + viewerToken },
      });

      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'FORBIDDEN');
    });

    it('allows viewer to access multi-role endpoint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/viewer/summary',
        headers: { authorization: 'Bearer ' + viewerToken },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.equal(json.data.message, 'Welcome Operator');
    });
  });
});
