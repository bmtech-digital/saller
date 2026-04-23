import { api } from './api';

type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

interface ErrorLogData {
  severity?: ErrorSeverity;
  source: string;
  message: string;
  stack_trace?: string;
  url?: string;
  meta?: Record<string, unknown>;
}

class ErrorLogger {
  private initialized = false;

  /**
   * Initialize global error handlers
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Catch unhandled errors
    window.onerror = (message, source, lineno, colno, error) => {
      this.logError({
        severity: 'error',
        source: 'window.onerror',
        message: String(message),
        stack_trace: error?.stack,
        url: window.location.href,
        meta: {
          sourceFile: source,
          line: lineno,
          column: colno
        }
      });
      return false; // Don't prevent default error handling
    };

    // Catch unhandled promise rejections
    window.onunhandledrejection = (event) => {
      const error = event.reason;
      this.logError({
        severity: 'error',
        source: 'unhandledrejection',
        message: error?.message || String(error),
        stack_trace: error?.stack,
        url: window.location.href,
        meta: {
          type: 'Promise rejection'
        }
      });
    };

    console.log('Error logger initialized');
  }

  /**
   * Log an error to the backend
   */
  async logError(data: ErrorLogData): Promise<void> {
    try {
      // Don't log errors from the logging system itself
      if (data.url?.includes('/logs')) return;

      await api.logError({
        severity: data.severity || 'error',
        source: data.source,
        message: data.message,
        stack_trace: data.stack_trace,
        url: data.url || window.location.href,
        meta: data.meta
      });
    } catch (err) {
      // Silently fail - we don't want to cause infinite loops
      console.error('Failed to log error:', err);
    }
  }

  /**
   * Log an info message
   */
  info(source: string, message: string, meta?: Record<string, unknown>) {
    this.logError({ severity: 'info', source, message, meta });
  }

  /**
   * Log a warning
   */
  warn(source: string, message: string, meta?: Record<string, unknown>) {
    this.logError({ severity: 'warning', source, message, meta });
  }

  /**
   * Log an error
   */
  error(source: string, message: string, error?: Error, meta?: Record<string, unknown>) {
    this.logError({
      severity: 'error',
      source,
      message,
      stack_trace: error?.stack,
      meta
    });
  }

  /**
   * Log a critical error
   */
  critical(source: string, message: string, error?: Error, meta?: Record<string, unknown>) {
    this.logError({
      severity: 'critical',
      source,
      message,
      stack_trace: error?.stack,
      meta
    });
  }

  /**
   * Wrap an async function with error logging
   */
  wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    source: string
  ): T {
    return (async (...args: unknown[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.error(source, (error as Error).message, error as Error, { args });
        throw error;
      }
    }) as T;
  }
}

export const errorLogger = new ErrorLogger();
