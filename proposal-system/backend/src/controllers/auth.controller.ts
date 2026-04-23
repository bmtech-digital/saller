import { Request, Response } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';

const isDevMode = process.env.DEV_MODE === 'true';
const DEV_USER = {
  id: 'dev-user-001',
  email: process.env.DEV_USER_EMAIL || 'admin@demo.com',
  password: process.env.DEV_USER_PASSWORD || '123456'
};
const DEV_TOKEN = 'dev-token-' + Date.now();

export class AuthController {
  // Login with email and password
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'נא למלא אימייל וסיסמה' });
        return;
      }

      // Dev mode - bypass Supabase
      if (isDevMode) {
        if (email === DEV_USER.email && password === DEV_USER.password) {
          res.json({
            user: {
              id: DEV_USER.id,
              email: DEV_USER.email
            },
            access_token: DEV_TOKEN,
            refresh_token: 'dev-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours
          });
          return;
        } else {
          res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
          return;
        }
      }

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
        return;
      }

      res.json({
        user: {
          id: data.user.id,
          email: data.user.email
        },
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Refresh token
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        res.status(400).json({ error: 'חסר refresh token' });
        return;
      }

      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token
      });

      if (error || !data.session) {
        res.status(401).json({ error: 'לא ניתן לרענן את ההתחברות' });
        return;
      }

      res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Logout
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // Client should discard tokens
      res.json({ message: 'התנתקת בהצלחה' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Get current user
  async me(req: Request, res: Response): Promise<void> {
    try {
      res.json({ user: req.user });
    } catch (error) {
      console.error('Me error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Register new user (admin only in production)
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'נא למלא אימייל וסיסמה' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' });
        return;
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json({
        user: {
          id: data.user.id,
          email: data.user.email
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }
}

export const authController = new AuthController();
