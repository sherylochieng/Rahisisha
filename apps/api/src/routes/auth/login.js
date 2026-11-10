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
import { isDatabaseDown } from '../../utils/dbDown.js';
import { getShopSlug } from '../../utils/getShopSlug.js';

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
    //
    // BEFORE (Task 8): we read the API's OWN address:
    //   const host = req.headers.host || '';
    //   const subdomain = host.split('.')[0];
    //   Online the browser calls api.rahisishabiashara.com, so the shop word
    //   was ALWAYS "api" and every login ended in "Tenant not found".
    //
    // AFTER (Task 8): getShopSlug() reads the address the VISITOR is on (the
    //   Origin header) when ROOT_DOMAIN is set. On a laptop (no ROOT_DOMAIN)
    //   it behaves exactly like the old code. See utils/getShopSlug.js.
    //
    // slug === null means "main entrance, no shop": we take the user's first
    // membership (the same thing the laptop already does).
    // The shop word only picks WHICH shop to check. The password and the
    // membership check below still decide who gets in.
    const slug = getShopSlug(req);

    let tenantResult;

    if (slug === null) {
      // Main entrance: no shop word, find the tenant from the membership
      tenantResult = null;
    } else {
      // Shop address: find the tenant that owns this slug
      tenantResult = await pool.query(
        'SELECT id FROM tenants WHERE slug = $1',
        [slug],
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

       // Find this user's membership.
    // memberships is locked by shop, and at login no shop is stamped yet. So we
    // open a short transaction and tell the database WHO is logging in. This
    // happens ONLY AFTER the password was verified above. The migration 022 rule
    // (login_lookup) then lets this one person see their OWN membership rows.
    // true = the note disappears by itself when the transaction ends, so it can
    // never leak to another request that reuses this connection
    const client = await pool.connect();
    let membershipQuery;
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.login_user', $1, true)", [user.id]);

      membershipQuery = tenantResult
        ? // Production: must belong to THIS specific tenant
          await client.query(
            'SELECT tenant_id, role FROM memberships WHERE user_id = $1 AND tenant_id = $2 LIMIT 1',
            [user.id, tenantResult.rows[0].id],
          )
        : // Development: take their first membership
          await client.query(
            'SELECT tenant_id, role FROM memberships WHERE user_id = $1 LIMIT 1',
            [user.id],
          );

      await client.query('COMMIT');
    } catch (err) {
      // Something failed: undo, then let the outer catch answer 500
      await client.query('ROLLBACK');
      throw err;
    } finally {
      // Always give the connection back to the pool, exactly once
      client.release();
    }

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
            // domain: which addresses the badge is valid for. ".lvh.me" covers lvh.me
      // and every shop address under it. Unset = works only at the giving address
      domain:   process.env.COOKIE_DOMAIN || undefined,
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ message: 'Logged in', tenant_id, user_id: user.id });

    } catch (err) {
    // DATABASE DOWN: answer 503 with a friendly message, not a vague 500.
    // We keep login's own reply style ({ error: 'text' }) so the login
    // page can show it exactly like the other login errors.
    if (isDatabaseDown(err)) {
      console.error('[login] database unavailable:', err.code || err.message);
      res.set('Retry-After', '10');
      return res.status(503).json({
        error: "We're having trouble right now. Please try again in a moment.",
      });
    }

    // Anything else is our own bug: keep the old 500 behaviour
    console.error('[login] failed:', err);
    return res.status(500).json({ error: 'Login failed — please try again' });
  }
});

export default router;