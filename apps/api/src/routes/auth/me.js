import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { withTenant } from '../../middleware/withTenant.js';

const router = Router();

// GET /me — returns the logged-in user's own data
// requireAuth runs first — checks the cookie, stamps req.userId + req.tenantId
// withTenant runs second — sets app.tenant_id in PostgreSQL, attaches req.db
// The handler runs last — queries using req.db so RLS is active
router.get('/me', requireAuth, withTenant, async (req, res) => {
  try {
    // req.db is the tenant-scoped connection from withTenant
    // RLS is already active — this query can ONLY return rows for req.tenantId
    const userResult = await req.db.query(
      `SELECT id, name, phone FROM users WHERE id = $1`,
      [req.userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tenantResult = await req.db.query(
      `SELECT id, name, slug FROM tenants WHERE id = $1`,
      [req.tenantId],
    );

    return res.status(200).json({
      user:   userResult.rows[0],
      tenant: tenantResult.rows[0],
    });

  } catch (err) {
    console.error('[me] failed:', err);
    return res.status(500).json({ error: 'Could not fetch user' });
  }
});

export default router;