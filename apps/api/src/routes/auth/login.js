// import { Router } from 'express';
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';
// import { z } from 'zod';
// import { pool } from '../../db/pool.js';

// const router = Router();

// const loginSchema = z.object({
//   phone:    z.string().min(10).max(20),
//   password: z.string().min(8).max(72),
// });

// router.post('/login', async (req, res) => {
//   const result = loginSchema.safeParse(req.body);
//   if (!result.success) {
//     return res.status(400).json({
//       error:   'Validation failed',
//       details: result.error.flatten().fieldErrors,
//     });
//   }

//   const { phone, password } = result.data;

//   try {
//     const userResult = await pool.query(
//       `SELECT id, password_hash FROM users WHERE phone = $1`,
//       [phone],
//     );

//     if (userResult.rows.length === 0) {
//       return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     const user = userResult.rows[0];
//     const valid = await bcrypt.compare(password, user.password_hash);

//     if (!valid) {
//       return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     const membershipResult = await pool.query(
//       `SELECT tenant_id, role FROM memberships WHERE user_id = $1 LIMIT 1`,
//       [user.id],
//     );

//     if (membershipResult.rows.length === 0) {
//       return res.status(403).json({ error: 'No tenant found for this account' });
//     }

//     const { tenant_id, role } = membershipResult.rows[0];

//     const token = jwt.sign(
//       { user_id: user.id, tenant_id, role },
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' },
//     );

//     res.cookie('token', token, {
//       httpOnly: true,
//       secure:   process.env.NODE_ENV === 'production',
//       sameSite: 'strict',
//       maxAge:   7 * 24 * 60 * 60 * 1000,
//     });

//     return res.status(200).json({
//       message:   'Logged in',
//       user_id:   user.id,
//       tenant_id,
//       role,
//     });

//   } catch (err) {
//     console.error('[login] failed:', err);
//     return res.status(500).json({ error: 'Login failed — please try again' });
//   }
// });

// export default router;

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
    // --- TENANT ISOLATION: this is the part YOU must write and understand ---
    // Read the Host header to find which tenant's door was knocked on
    // e.g. "acme.rahisisha.co.ke" → slug is "acme"
    // In development, Host is "localhost:3000" — we default to the first tenant
    const host = req.headers.host || '';
    const subdomain = host.split('.')[0]; // "acme" from "acme.rahisisha.co.ke"

    let tenantResult;

    if (subdomain === 'localhost:3000' || subdomain === 'localhost') {
      // Development: no subdomain — find tenant from the user's membership directly
      tenantResult = null;
    } else {
      // Production: find the tenant that owns this subdomain slug
      tenantResult = await pool.query(
        'SELECT id FROM tenants WHERE slug = $1',
        [subdomain],
      );

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
    }
    // --- END TENANT ISOLATION ---

    // Find the user by phone
    const userResult = await pool.query(
      'SELECT id, password_hash FROM users WHERE phone = $1',
      [phone],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password — never compare plain text
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Find this user's membership
    const membershipQuery = tenantResult
      ? // Production: must belong to THIS specific tenant
        await pool.query(
          'SELECT tenant_id, role FROM memberships WHERE user_id = $1 AND tenant_id = $2 LIMIT 1',
          [user.id, tenantResult.rows[0].id],
        )
      : // Development: take their first membership
        await pool.query(
          'SELECT tenant_id, role FROM memberships WHERE user_id = $1 LIMIT 1',
          [user.id],
        );

    if (membershipQuery.rows.length === 0) {
      // User exists but does not belong to this tenant — REJECT
      return res.status(403).json({ error: 'Invalid credentials' });
    }

    const { tenant_id, role } = membershipQuery.rows[0];

    // Sign the JWT
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

    return res.status(200).json({ message: 'Logged in', tenant_id, user_id: user.id });

  } catch (err) {
    console.error('[login] failed:', err);
    return res.status(500).json({ error: 'Login failed — please try again' });
  }
});

export default router;