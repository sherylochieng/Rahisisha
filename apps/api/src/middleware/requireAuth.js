import jwt from 'jsonwebtoken';

// requireAuth — the bouncer
// Runs before any protected route
// Reads the JWT cookie, verifies it, stamps the request
export function requireAuth(req, res, next) {
  // Read the token from the cookie the browser sends automatically
  const token = req.cookies.token;

  // No cookie = not logged in
  if (!token) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    // Verify the token was signed with our secret and hasn't expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Stamp the request so every route knows who is asking
    req.userId   = decoded.user_id;
    req.tenantId = decoded.tenant_id;
    req.role     = decoded.role;

    // Open the next door
    next();

  } catch (err) {
    // Token is fake, expired, or tampered with
    return res.status(401).json({ error: 'Session expired — please log in again' });
  }
}