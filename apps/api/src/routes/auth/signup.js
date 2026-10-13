import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../../db/pool.js';

const router = Router();

const signupSchema = z.object({
  phone:       z.string().min(10).max(20),
  name:        z.string().min(2).max(100),
  password:    z.string().min(8).max(72),
  tenant_name: z.string().min(2).max(100),
  slug:        z.string().regex(/^[a-z0-9-]{3,30}$/, {
                 message: 'Slug must be 3-30 lowercase letters, digits, or hyphens',
               }),
});

const RESERVED_SLUGS = new Set(['www', 'app', 'admin', 'api', 'staging']);

router.post('/signup', async (req, res) => {
  const result = signupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error:   'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { phone, password, tenant_name, slug, name } = result.data;

  if (RESERVED_SLUGS.has(slug)) {
    return res.status(422).json({
      error: `"${slug}" is a reserved slug and cannot be used`,
    });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
      [tenant_name, slug],
    );
    const tenant_id = tenantResult.rows[0].id;

    const userResult = await client.query(
      `INSERT INTO users (phone, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [phone, name, password_hash],
    );
    const user_id = userResult.rows[0].id;

    await client.query(
      `INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [tenant_id, user_id],
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      { user_id, tenant_id, role: 'owner' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: 'Account created',
      tenant_id,
      user_id,
    });

  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('slug'))
        return res.status(409).json({ error: 'That slug is already taken' });
      if (err.constraint && err.constraint.includes('phone'))
        return res.status(409).json({ error: 'An account with that phone number already exists' });
      return res.status(409).json({ error: 'Duplicate value' });
    }

    console.error('[signup] transaction failed:', err);
    return res.status(500).json({ error: 'Signup failed — please try again' });

  } finally {
    client.release();
  }
});

export default router;