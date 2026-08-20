import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Authenticated identity attached to `req.user` by the `authenticate` middleware.
 * Mirrors the UI's AuthUser shape (see albion-os/src/lib/auth-context.tsx).
 */
export interface UserIdentity {
  id: string;
  email: string;
  full_name: string;
  role: string;
  location_id: string | null;
  location_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  isSuperAdmin: boolean;
}

export interface AuthRequest extends Request {
  user?: UserIdentity;
}

/**
 * Guards a route so JWT_SECRET must exist. Authentication always fails closed.
 */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  return secret;
};

/** Signs a session token from a profile row (including denormalized super-admin flag). */
export const signSession = (identity: Omit<UserIdentity, 'isSuperAdmin'>) => {
  const token = jwt.sign(
    {
      id: identity.id,
      email: identity.email,
      full_name: identity.full_name,
      role: identity.role,
      location_id: identity.location_id,
      location_name: identity.location_name,
      avatar_url: identity.avatar_url,
      phone: identity.phone,
      isSuperAdmin: identity.role === 'super_admin',
    },
    getJwtSecret(),
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  );
  return token;
};

/** Raw profile row shape (with locations join folded in), as returned by `query`. */
interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  location_id: string | null;
  avatar_url: string | null;
  location_name?: string | null;
  location?: { name: string | null } | null;
  locations?: { name: string | null }[] | null;
}

/** Builds a UserIdentity from a raw profiles row (with locations join folded in). */
export const toIdentity = (row: ProfileRow): UserIdentity => {
  const name = Array.isArray(row.locations)
    ? row.locations[0]?.name
    : row.location_name || row.location?.name || null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    location_id: row.location_id || null,
    location_name: name || null,
    avatar_url: row.avatar_url || null,
    phone: row.phone || null,
    isSuperAdmin: row.role === 'super_admin',
  };
};

/**
 * JWT verification middleware. Decodes the Bearer token and attaches the
 * decoded identity (including isSuperAdmin) to `req.user`.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    let secret: string;
    try {
      secret = getJwtSecret();
    } catch {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    const decoded = jwt.verify(token, secret) as UserIdentity;
    if (
      !decoded ||
      typeof decoded.id !== 'string' ||
      typeof decoded.role !== 'string' ||
      typeof decoded.isSuperAdmin !== 'boolean'
    ) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Role-based authorization middleware. Super admins bypass all role checks.
 *
 * Must be used AFTER `authenticate`.
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (req.user.isSuperAdmin) {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

export const superAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Super Admin access required' });
  }
  next();
};
