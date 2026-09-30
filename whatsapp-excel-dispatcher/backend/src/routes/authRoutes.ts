import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signToken } from '../auth/jwt.js';
import { logger } from '../utils/logger.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await User.findOne({ email: body.email });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(body.password);

    const user = await User.create({
      email: body.email,
      passwordHash,
      name: body.name,
      role: 'client',
    });

    const token = signToken({
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    logger.info({ userId: user._id, email: user.email }, 'User registered');

    res.status(201).json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error({ error }, 'Registration failed');
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await User.findOne({ email: body.email }).select('+passwordHash');
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await verifyPassword(user.passwordHash, body.password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken({
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    logger.info({ userId: user._id, email: user.email }, 'User logged in');

    res.json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error({ error }, 'Login failed');
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    logger.error({ error }, 'Get user failed');
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
