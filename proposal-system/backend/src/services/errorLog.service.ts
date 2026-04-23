import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../utils/supabase.js';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorLogEntry {
  severity: ErrorSeverity;
  source: string;
  message: string;
  stack_trace?: string;
  user_agent?: string;
  url?: string;
  user_id?: string;
  user_email?: string;
  ip_address?: string;
  meta?: Record<string, unknown>;
}

// Admin email for error notifications - PRIVATE, only for you
const ADMIN_ERROR_EMAIL = 'orenshp77@gmail.com';

class ErrorLogService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  /**
   * Log an error to the database and optionally send email notification
   */
  async logError(entry: ErrorLogEntry): Promise<string | null> {
    try {
      // Insert to database
      const { data, error } = await supabaseAdmin
        .from('error_logs')
        .insert({
          severity: entry.severity,
          source: entry.source,
          message: entry.message,
          stack_trace: entry.stack_trace,
          user_agent: entry.user_agent,
          url: entry.url,
          user_id: entry.user_id,
          user_email: entry.user_email,
          ip_address: entry.ip_address,
          meta: entry.meta
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to save error log:', error);
        return null;
      }

      // Send email notification for errors and critical issues
      if (entry.severity === 'error' || entry.severity === 'critical') {
        await this.sendErrorNotification(entry, data.id);
      }

      return data.id;
    } catch (err) {
      console.error('Error logging service failure:', err);
      return null;
    }
  }

  /**
   * Send private email notification to admin
   */
  private async sendErrorNotification(entry: ErrorLogEntry, logId: string): Promise<void> {
    if (!this.transporter) {
      console.log(`[ERROR NOTIFICATION] ${entry.severity.toUpperCase()}: ${entry.message}`);
      return;
    }

    const severityColors: Record<ErrorSeverity, string> = {
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      critical: '#991b1b'
    };

    const severityEmoji: Record<ErrorSeverity, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: ADMIN_ERROR_EMAIL,
      subject: `${severityEmoji[entry.severity]} [${entry.severity.toUpperCase()}] תקלה במערכת - ${entry.source}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              direction: rtl;
              padding: 20px;
              background-color: #1a1a1a;
              color: #ffffff;
            }
            .container {
              max-width: 700px;
              margin: 0 auto;
              background: #2d2d2d;
              padding: 30px;
              border-radius: 10px;
              border-right: 5px solid ${severityColors[entry.severity]};
            }
            h1 {
              color: ${severityColors[entry.severity]};
              margin-bottom: 20px;
            }
            .info-row {
              background: #3d3d3d;
              padding: 12px 15px;
              margin: 8px 0;
              border-radius: 6px;
            }
            .label {
              color: #888;
              font-size: 12px;
              display: block;
              margin-bottom: 4px;
            }
            .value {
              color: #fff;
              font-size: 14px;
              word-break: break-all;
            }
            .stack-trace {
              background: #1a1a1a;
              padding: 15px;
              border-radius: 6px;
              font-family: monospace;
              font-size: 12px;
              white-space: pre-wrap;
              max-height: 300px;
              overflow-y: auto;
              color: #ff6b6b;
            }
            .copy-btn {
              display: inline-block;
              background: #f97316;
              color: white;
              padding: 12px 25px;
              text-decoration: none;
              border-radius: 6px;
              margin-top: 20px;
              font-weight: bold;
            }
            .footer {
              color: #666;
              font-size: 11px;
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #444;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${severityEmoji[entry.severity]} התראת ${entry.severity === 'critical' ? 'קריטית' : 'תקלה'}</h1>

            <div class="info-row">
              <span class="label">מקור</span>
              <span class="value">${entry.source}</span>
            </div>

            <div class="info-row">
              <span class="label">הודעה</span>
              <span class="value">${entry.message}</span>
            </div>

            <div class="info-row">
              <span class="label">זמן</span>
              <span class="value">${new Date().toLocaleString('he-IL')}</span>
            </div>

            ${entry.url ? `
            <div class="info-row">
              <span class="label">כתובת</span>
              <span class="value">${entry.url}</span>
            </div>
            ` : ''}

            ${entry.user_email ? `
            <div class="info-row">
              <span class="label">משתמש</span>
              <span class="value">${entry.user_email}</span>
            </div>
            ` : ''}

            ${entry.ip_address ? `
            <div class="info-row">
              <span class="label">IP</span>
              <span class="value">${entry.ip_address}</span>
            </div>
            ` : ''}

            ${entry.stack_trace ? `
            <div class="info-row">
              <span class="label">Stack Trace</span>
              <div class="stack-trace">${entry.stack_trace}</div>
            </div>
            ` : ''}

            ${entry.meta ? `
            <div class="info-row">
              <span class="label">מידע נוסף</span>
              <div class="stack-trace">${JSON.stringify(entry.meta, null, 2)}</div>
            </div>
            ` : ''}

            <div class="footer">
              <p>מזהה לוג: ${logId}</p>
              <p>הודעה זו נשלחה אוטומטית ממערכת הלוגים הפרטית.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Error notification sent to ${ADMIN_ERROR_EMAIL}`);
    } catch (err) {
      console.error('Failed to send error notification:', err);
    }
  }

  /**
   * Get all error logs (admin only)
   */
  async getLogs(options: {
    severity?: ErrorSeverity;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: unknown[]; total: number }> {
    const { severity, resolved, limit = 50, offset = 0 } = options;

    let query = supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact' });

    if (severity) {
      query = query.eq('severity', severity);
    }

    if (resolved !== undefined) {
      query = query.eq('resolved', resolved);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch logs:', error);
      return { logs: [], total: 0 };
    }

    return { logs: data || [], total: count || 0 };
  }

  /**
   * Mark error as resolved
   */
  async resolveError(logId: string, resolvedBy: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('error_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy
      })
      .eq('id', logId);

    return !error;
  }

  /**
   * Delete old logs (cleanup)
   */
  async cleanupOldLogs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabaseAdmin
      .from('error_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .eq('resolved', true)
      .select('id');

    if (error) {
      console.error('Failed to cleanup logs:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Verify admin password
   */
  async verifyAdminPassword(password: string): Promise<boolean> {
    // Simple password check - the password is "AdminLogs2024!"
    // In production, you would hash and compare properly
    const ADMIN_PASSWORD = 'AdminLogs2024!';
    return password === ADMIN_PASSWORD;
  }

  /**
   * Format error for Claude copy
   */
  formatErrorForClaude(log: {
    id: string;
    severity: string;
    source: string;
    message: string;
    stack_trace?: string;
    url?: string;
    user_agent?: string;
    meta?: Record<string, unknown>;
    created_at: string;
  }): string {
    return `
=== תקלה במערכת ===
מזהה: ${log.id}
חומרה: ${log.severity}
מקור: ${log.source}
זמן: ${new Date(log.created_at).toLocaleString('he-IL')}
${log.url ? `כתובת: ${log.url}` : ''}
${log.user_agent ? `דפדפן: ${log.user_agent}` : ''}

הודעת שגיאה:
${log.message}

${log.stack_trace ? `Stack Trace:
${log.stack_trace}` : ''}

${log.meta ? `מידע נוסף:
${JSON.stringify(log.meta, null, 2)}` : ''}

=== סוף תקלה ===

אנא עזור לי לתקן את התקלה הזו.
    `.trim();
  }
}

export const errorLogService = new ErrorLogService();
