import { Request, Response } from 'express';
import { errorLogService, ErrorSeverity } from '../services/errorLog.service.js';

// Session-based admin verification (simple approach)
const adminSessions = new Map<string, { expires: number }>();

function generateSessionToken(): string {
  return `logs-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function isValidSession(token: string): boolean {
  const session = adminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

export const logsController = {
  /**
   * Verify admin password and create session
   */
  async authenticate(req: Request, res: Response): Promise<void> {
    try {
      const { password } = req.body;

      if (!password) {
        res.status(400).json({ error: 'נדרשת סיסמה' });
        return;
      }

      const isValid = await errorLogService.verifyAdminPassword(password);

      if (!isValid) {
        res.status(401).json({ error: 'סיסמה שגויה' });
        return;
      }

      // Create session token (valid for 1 hour)
      const token = generateSessionToken();
      adminSessions.set(token, { expires: Date.now() + 60 * 60 * 1000 });

      res.json({
        success: true,
        token,
        message: 'התחברת בהצלחה למערכת הלוגים'
      });
    } catch (error) {
      console.error('Logs auth error:', error);
      res.status(500).json({ error: 'שגיאה באימות' });
    }
  },

  /**
   * Get all error logs (requires valid session)
   */
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers['x-logs-token'] as string;

      if (!authHeader || !isValidSession(authHeader)) {
        res.status(401).json({ error: 'נדרש אימות למערכת הלוגים' });
        return;
      }

      const { severity, resolved, limit, offset } = req.query;

      const { logs, total } = await errorLogService.getLogs({
        severity: severity as ErrorSeverity | undefined,
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0
      });

      res.json({ logs, total });
    } catch (error) {
      console.error('Get logs error:', error);
      res.status(500).json({ error: 'שגיאה בשליפת לוגים' });
    }
  },

  /**
   * Log a new error (from frontend or internal)
   */
  async logError(req: Request, res: Response): Promise<void> {
    try {
      const { severity, source, message, stack_trace, url, meta } = req.body;

      if (!source || !message) {
        res.status(400).json({ error: 'חסרים שדות חובה' });
        return;
      }

      // Get client info
      const ip_address = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
      const user_agent = req.headers['user-agent'];

      // Get user info if authenticated
      const user = (req as unknown as { user?: { id: string; email: string } }).user;

      const logId = await errorLogService.logError({
        severity: severity || 'error',
        source,
        message,
        stack_trace,
        url,
        user_agent,
        ip_address,
        user_id: user?.id,
        user_email: user?.email,
        meta
      });

      if (logId) {
        res.json({ success: true, logId });
      } else {
        res.status(500).json({ error: 'שגיאה בשמירת הלוג' });
      }
    } catch (error) {
      console.error('Log error endpoint failed:', error);
      res.status(500).json({ error: 'שגיאה בשמירת לוג' });
    }
  },

  /**
   * Mark error as resolved
   */
  async resolveError(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers['x-logs-token'] as string;

      if (!authHeader || !isValidSession(authHeader)) {
        res.status(401).json({ error: 'נדרש אימות למערכת הלוגים' });
        return;
      }

      const { id } = req.params;

      const success = await errorLogService.resolveError(id, 'admin');

      if (success) {
        res.json({ success: true, message: 'התקלה סומנה כפתורה' });
      } else {
        res.status(500).json({ error: 'שגיאה בעדכון סטטוס' });
      }
    } catch (error) {
      console.error('Resolve error endpoint failed:', error);
      res.status(500).json({ error: 'שגיאה בעדכון' });
    }
  },

  /**
   * Get formatted error for Claude
   */
  async getErrorForClaude(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers['x-logs-token'] as string;

      if (!authHeader || !isValidSession(authHeader)) {
        res.status(401).json({ error: 'נדרש אימות למערכת הלוגים' });
        return;
      }

      const { id } = req.params;

      const { logs } = await errorLogService.getLogs({ limit: 1 });
      const log = logs.find((l: unknown) => (l as { id: string }).id === id);

      if (!log) {
        res.status(404).json({ error: 'לוג לא נמצא' });
        return;
      }

      const formatted = errorLogService.formatErrorForClaude(log as {
        id: string;
        severity: string;
        source: string;
        message: string;
        stack_trace?: string;
        url?: string;
        user_agent?: string;
        meta?: Record<string, unknown>;
        created_at: string;
      });

      res.json({ formatted });
    } catch (error) {
      console.error('Format for Claude error:', error);
      res.status(500).json({ error: 'שגיאה בעיצוב הלוג' });
    }
  },

  /**
   * Cleanup old resolved logs
   */
  async cleanupLogs(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers['x-logs-token'] as string;

      if (!authHeader || !isValidSession(authHeader)) {
        res.status(401).json({ error: 'נדרש אימות למערכת הלוגים' });
        return;
      }

      const { days } = req.query;
      const daysOld = days ? parseInt(days as string) : 30;

      const deletedCount = await errorLogService.cleanupOldLogs(daysOld);

      res.json({
        success: true,
        deletedCount,
        message: `נמחקו ${deletedCount} לוגים ישנים`
      });
    } catch (error) {
      console.error('Cleanup logs error:', error);
      res.status(500).json({ error: 'שגיאה במחיקת לוגים' });
    }
  },

  /**
   * Logout from logs system
   */
  async logout(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers['x-logs-token'] as string;

    if (authHeader) {
      adminSessions.delete(authHeader);
    }

    res.json({ success: true, message: 'התנתקת ממערכת הלוגים' });
  }
};
