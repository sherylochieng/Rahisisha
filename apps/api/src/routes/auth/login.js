import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../../db/pool.js';

const router = Router();

const loginSchema = z.object({
  phone:    z.string().min(10).max(20),
  password: z.string().min(8).max(72),
});

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error:   'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { phone, password } = result.data;

  try {
    const userResult = await pool.query(
      `SELECT id, password_hash FROM users WHERE phone = $1`,
      [phone],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const membershipResult = await pool.query(
      `SELECT tenant_id, role FROM memberships WHERE user_id = $1 LIMIT 1`,
      [user.id],
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'No tenant found for this account' });
    }

    const { tenant_id, role } = membershipResult.rows[0];

    const token = jwt.sign(
      { user_id: user.id, tenant_id, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message:   'Logged in',
      user_id:   user.id,
      tenant_id,
      role,
    });

  } catch (err) {
    console.error('[login] failed:', err);
    return res.status(500).json({ error: 'Login failed — please try again' });
  }
});

export default router;