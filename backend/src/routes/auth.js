import bcrypt from 'bcrypt';

export default async function authRoutes(fastify, opts) {
  // POST /login
  fastify.post('/login', async (request, reply) => {
    const email = request.body?.email || request.body?.username;
    const password = request.body?.password;

    if (!email || !password) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email or username and password are required',
        },
      });
    }

    const db = fastify.db;
    const result = await db.query(
      'SELECT id, email, password_hash, role, display_name, is_active FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    const user = result.rows && result.rows[0];
    if (!user || !user.is_active) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const token = fastify.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
      },
      { expiresIn: '24h' }
    );

    return reply.code(200).send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.display_name,
        },
      },
    });
  });

  // GET /me
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = {
        id: request.user.sub || request.user.id,
        email: request.user.email,
        role: request.user.role,
        displayName: request.user.displayName,
      };

      return reply.code(200).send({
        success: true,
        data: {
          user,
        },
      });
    }
  );

  // POST /change-password
  fastify.post(
    '/change-password',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body || {};

      if (!currentPassword || !newPassword) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Current password and new password are required',
          },
        });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'New password must be at least 6 characters long',
          },
        });
      }

      const userId = request.user.sub || request.user.id;
      const db = fastify.db;
      const result = await db.query(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [userId]
      );

      const user = result.rows && result.rows[0];
      if (!user) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Current password is incorrect',
          },
        });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newHash, userId]
      );

      return reply.code(200).send({
        success: true,
        data: {
          message: 'Password updated successfully',
        },
      });
    }
  );
}
