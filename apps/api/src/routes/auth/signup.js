import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { isDatabaseDown } from '../../utils/dbDown.js';
import { seedSampleData } from '../../services/sampleData.service.js';

const router = Router();

const signupSchema = z.object({
  phone:       z.string().min(10).max(20),
  name:        z.string().min(2).max(100),
  password:    z.string().min(8).max(72),
  tenant_name: z.string().min(2).max(100),
});


function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

async function findUniqueSlug(client, base) {
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? base : `${base}-${attempt}`;
    const { rows } = await client.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [candidate],
    );
    if (rows.length === 0) return candidate;
    attempt++;
    if (attempt > 100) throw new Error('Could not find unique slug');
  }
}

router.post('/signup', async (req, res) => {
  const result = signupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error:   'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { phone, password, tenant_name, name } = result.data;

  const password_hash = await bcrypt.hash(password, 12);
  // `client` starts empty. If the database is down, pool.connect() fails
  // and `client` stays empty, so the code below knows there is nothing
  // to roll back or release.
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const baseSlug = slugify(tenant_name);
  const uniqueSlug = await findUniqueSlug(client, baseSlug);

    const tenantResult = await client.query(
  `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
  [tenant_name, uniqueSlug],
    );
  const tenant_id = tenantResult.rows[0].id;
      // Stamp this transaction with the new shop, so the memberships lock lets us in.
    // true = the stamp lasts only until COMMIT or ROLLBACK, so it can never leak
    // into another request that reuses this connection
      // true = the stamp disappears by itself when signup finishes
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenant_id]);

    const userResult = await client.query(
      `INSERT INTO users (phone, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [phone, name, password_hash],
    );
    const user_id = userResult.rows[0].id;

    await client.query(
      `INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [tenant_id, user_id],
    );

    // Seed sample data for the new tenant
        // Fill the new shop with 3 sample products and 2 sample customers.
    // WHY here: the shop and the tenant stamp (set_config above) exist,
    // and we are still inside the transaction. So the shop, the owner,
    // the membership AND the samples are saved together at COMMIT,
    // or none of them are (if anything fails, ROLLBACK undoes it all).
    // We pass `client`, never `pool`, so it joins this transaction.
    await seedSampleData(client, tenant_id);

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
       // domain: which addresses the badge is valid for.
      // ".lvh.me" = lvh.me AND every shop address under it (skirt-shirt.lvh.me).
      // If COOKIE_DOMAIN is not set, this stays undefined and the badge works
      // only at the address that gave it, exactly like before
      domain:   process.env.COOKIE_DOMAIN || undefined,
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: 'Account created',
      tenant_id,
      user_id,
    });

    } catch (err) {
    // Undo half-finished work, but only if we ever got a connection.
    // If the connection is already dead, ROLLBACK fails too. We ignore
    // that on purpose: a dead connection has nothing left to undo.
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // connection already dead, nothing to undo
      }
    }

    // DATABASE DOWN: friendly 503 instead of a hang or a vague 500.
    // Same { error: 'text' } style as the other signup errors.
    if (isDatabaseDown(err)) {
      console.error('[signup] database unavailable:', err.code || err.message);
      res.set('Retry-After', '10');
      return res.status(503).json({
        error: "We're having trouble right now. Please try again in a moment.",
      });
    }

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
    // Only give back a connection we actually borrowed
    if (client) client.release();
  }
});

export default router;