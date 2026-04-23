import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import type { AuthUser } from '../types/index.js';

const isDevMode = process.env.DEV_MODE === 'true';
const DEV_USER = {
  id: 'dev-user-001',
  email: process.env.DEV_USER_EMAIL || 'admin@demo.com'
};

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      accessToken?: string;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'לא נמצא טוקן אימות' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Dev mode - bypass Supabase verification
    if (isDevMode && token.startsWith('dev-token-')) {
      req.user = {
        id: DEV_USER.id,
        email: DEV_USER.email
      };
      req.accessToken = token;
      next();
      return;
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'טוקן לא תקף' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email || ''
    };
    req.accessToken = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'שגיאת שרת באימות' });
  }
};

// Middleware for client token access (no auth required)
export const clientTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.params.token || req.query.token as string;

    if (!token) {
      res.status(400).json({ error: 'חסר קוד גישה' });
      return;
    }

    // Verify token exists and is not expired
    const { data: proposal, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('client_token', token)
      .single();

    if (error || !proposal) {
      res.status(404).json({ error: 'קישור לא תקף או לא נמצא' });
      return;
    }

    if (proposal.client_token_expires_at) {
      const expiryDate = new Date(proposal.client_token_expires_at);
      if (expiryDate < new Date()) {
        res.status(410).json({ error: 'הקישור פג תוקף' });
        return;
      }
    }

    // Attach proposal to request
    (req as any).proposal = proposal;

    next();
  } catch (error) {
    console.error('Client token middleware error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
};
