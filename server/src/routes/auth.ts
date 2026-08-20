/**
 * Authentication routes for AlbionOS.
 *
 * Replaces Supabase Auth: the profiles.password_hash column (pgcrypto bcrypt)
 * is verified in-process with bcryptjs, then a JWT is issued. The client
 * sends that JWT on every request.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { authenticate, signSession, superAdminOnly, toIdentity, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  full_name: z.string().min(2, 'Full name is required').max(120),
  phone: z.string().optional().nullable(),
  role: z.enum([
    'super_admin', 'sales_rep', 'finance_manager', 'inventory_manager',
    'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist',
    'regional_manager', 'ceo', 'security', 'lab_scientist',
  ]),
  location_id: z.string().optional().nullable(),
});

/** Profile SELECT that folds the location name in, matching the client AuthUser. */
const profileSelect = `
  SELECT p.id, p.email, p.full_name, p.phone, p.role, p.location_id,
         p.avatar_url, p.is_active, p.password_hash, l.name AS location_name
  FROM profiles p
  LEFT JOIN locations l ON l.id = p.location_id
`;

const fetchProfileById = async (userId: string) => {
  const { rows } = await query(`${profileSelect} WHERE p.id = $1`, [userId]);
  return rows[0] || null;
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { rows } = await query(`${profileSelect} WHERE p.email = $1`, [email.toLowerCase().trim()]);

    const row = rows[0];
    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    if (row.is_active === false) {
      return res.status(403).json({ error: 'Account disabled. Contact your administrator.', code: 'DISABLED' });
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const user = toIdentity(row);
    const token = signSession(user);
    res.json({ token, user });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const row = await fetchProfileById(req.user!.id);
    if (!row || row.is_active === false) {
      return res.status(401).json({ error: 'Profile not found or disabled' });
    }
    res.json({ user: toIdentity(row) });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// POST /api/auth/register — create staff profile (super_admin only)
router.post('/register', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
  try {
    const { email, password, full_name, phone, role, location_id } = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(password, 10);

    const { rows } = await query(
      `INSERT INTO profiles (email, password_hash, full_name, phone, role, location_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, location_id`,
      [email.toLowerCase().trim(), hash, full_name, phone || null, role, location_id || null]
    );

    res.status(201).json({ user: rows[0] });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

export default router;
