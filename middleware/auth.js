const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT sent in the Authorization header.
 * Expects header format: Authorization: Bearer <token>
 *
 * On success, attaches the decoded token payload to req.user
 * (e.g. req.user.userId, req.user.role) and calls next().
 * On failure, responds with 401 and stops the request.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = verifyToken;