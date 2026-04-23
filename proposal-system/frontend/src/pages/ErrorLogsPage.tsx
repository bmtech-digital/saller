import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Loading } from '../components/ui/Loading';
import { useToast } from '../components/ui/Toast';
import {
  Lock,
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  CheckCircle,
  Copy,
  Trash2,
  RefreshCw,
  LogOut,
  Cpu
} from 'lucide-react';
import { api } from '../services/api';

interface ErrorLog {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  stack_trace?: string;
  user_agent?: string;
  url?: string;
  user_email?: string;
  ip_address?: string;
  meta?: Record<string, unknown>;
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

export function ErrorLogsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [logsToken, setLogsToken] = useState<string | null>(null);

  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const { showToast } = useToast();

  // Check for stored token
  useEffect(() => {
    const storedToken = sessionStorage.getItem('logs_token');
    if (storedToken) {
      setLogsToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  // Load logs when authenticated
  useEffect(() => {
    if (isAuthenticated && logsToken) {
      loadLogs();
    }
  }, [isAuthenticated, logsToken, filter, severityFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');

    try {
      const response = await api.logsAuth(password);
      if (response.success && response.token) {
        setLogsToken(response.token);
        sessionStorage.setItem('logs_token', response.token);
        setIsAuthenticated(true);
        setPassword('');
      }
    } catch (error) {
      setAuthError('סיסמה שגויה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('logs_token');
    setLogsToken(null);
    setIsAuthenticated(false);
    setLogs([]);
  };

  const loadLogs = async () => {
    if (!logsToken) return;

    setLoadingLogs(true);
    try {
      const params: Record<string, string> = {};
      if (filter === 'unresolved') params.resolved = 'false';
      if (filter === 'resolved') params.resolved = 'true';
      if (severityFilter !== 'all') params.severity = severityFilter;

      const response = await api.getLogs(logsToken, params);
      setLogs((response.logs || []) as ErrorLog[]);
      setTotal(response.total || 0);
    } catch (error) {
      showToast('error', 'שגיאה בטעינת הלוגים');
      // Token might be expired
      if ((error as Error).message.includes('401')) {
        handleLogout();
      }
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleResolve = async (logId: string) => {
    if (!logsToken) return;

    try {
      await api.resolveLog(logsToken, logId);
      showToast('success', 'התקלה סומנה כפתורה');
      loadLogs();
    } catch (error) {
      showToast('error', 'שגיאה בעדכון סטטוס');
    }
  };

  const copyForClaude = (log: ErrorLog) => {
    const text = `
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

    navigator.clipboard.writeText(text);
    showToast('success', 'התקלה הועתקה - הדבק בקלוד לתיקון');
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-700" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'critical':
        return 'bg-red-200 text-red-900 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-dark-900">מערכת לוגים</h1>
              <p className="text-dark-500 mt-2">גישה למנהל בלבד</p>
            </div>

            <form onSubmit={handleLogin}>
              <Input
                type="password"
                placeholder="הזן סיסמת מנהל"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mb-4"
                autoFocus
              />

              {authError && (
                <p className="text-red-500 text-sm mb-4 text-center">{authError}</p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading || !password}>
                {isLoading ? <Loading size="sm" /> : 'כניסה'}
              </Button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  // Logs dashboard
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark-900">מערכת לוגים</h1>
            <p className="text-dark-500">סה"כ {total} תקלות</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadLogs} disabled={loadingLogs}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loadingLogs ? 'animate-spin' : ''}`} />
              רענן
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm flex gap-4 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('unresolved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unresolved'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              פתוחות
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'resolved'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              נפתרו
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              הכל
            </button>
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm"
          >
            <option value="all">כל הרמות</option>
            <option value="critical">קריטי</option>
            <option value="error">שגיאה</option>
            <option value="warning">אזהרה</option>
            <option value="info">מידע</option>
          </select>
        </div>

        {/* Logs list */}
        {loadingLogs ? (
          <div className="flex justify-center py-12">
            <Loading size="lg" text="טוען לוגים..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-sm text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-dark-900 mb-2">אין תקלות</h3>
            <p className="text-dark-500">המערכת פועלת תקין</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`bg-white p-4 rounded-lg shadow-sm border-r-4 cursor-pointer hover:shadow-md transition-shadow ${
                  log.resolved ? 'border-r-green-500 opacity-60' : getSeverityColor(log.severity).split(' ')[0].replace('bg-', 'border-r-')
                }`}
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(log.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(log.severity)}`}>
                          {log.severity}
                        </span>
                        <span className="text-sm font-medium text-dark-700">{log.source}</span>
                        {log.resolved && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            נפתר
                          </span>
                        )}
                      </div>
                      <p className="text-dark-900 truncate">{log.message}</p>
                      <p className="text-sm text-dark-400 mt-1">
                        {new Date(log.created_at).toLocaleString('he-IL')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => copyForClaude(log)}
                      className="p-2 rounded-lg bg-primary-100 text-primary-600 hover:bg-primary-200 transition-colors"
                      title="העתק לקלוד"
                    >
                      <Cpu className="w-4 h-4" />
                    </button>
                    {!log.resolved && (
                      <button
                        onClick={() => handleResolve(log.id)}
                        className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                        title="סמן כנפתר"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log detail modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="פרטי תקלה"
        size="lg"
      >
        {selectedLog && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              {getSeverityIcon(selectedLog.severity)}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(selectedLog.severity)}`}>
                {selectedLog.severity}
              </span>
              {selectedLog.resolved && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  נפתר
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-dark-500">מקור</label>
                <p className="font-medium">{selectedLog.source}</p>
              </div>
              <div>
                <label className="text-sm text-dark-500">זמן</label>
                <p className="font-medium">{new Date(selectedLog.created_at).toLocaleString('he-IL')}</p>
              </div>
              {selectedLog.url && (
                <div className="col-span-2">
                  <label className="text-sm text-dark-500">כתובת</label>
                  <p className="font-medium text-sm break-all">{selectedLog.url}</p>
                </div>
              )}
              {selectedLog.user_email && (
                <div>
                  <label className="text-sm text-dark-500">משתמש</label>
                  <p className="font-medium">{selectedLog.user_email}</p>
                </div>
              )}
              {selectedLog.ip_address && (
                <div>
                  <label className="text-sm text-dark-500">IP</label>
                  <p className="font-medium">{selectedLog.ip_address}</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-dark-500">הודעה</label>
              <p className="bg-dark-100 p-3 rounded-lg mt-1">{selectedLog.message}</p>
            </div>

            {selectedLog.stack_trace && (
              <div>
                <label className="text-sm text-dark-500">Stack Trace</label>
                <pre className="bg-dark-900 text-red-400 p-4 rounded-lg mt-1 text-xs overflow-auto max-h-64 direction-ltr">
                  {selectedLog.stack_trace}
                </pre>
              </div>
            )}

            {selectedLog.meta && (
              <div>
                <label className="text-sm text-dark-500">מידע נוסף</label>
                <pre className="bg-dark-100 p-3 rounded-lg mt-1 text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.meta, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.user_agent && (
              <div>
                <label className="text-sm text-dark-500">דפדפן</label>
                <p className="text-sm text-dark-600 break-all">{selectedLog.user_agent}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={() => copyForClaude(selectedLog)} className="flex-1">
                <Cpu className="w-4 h-4 ml-2" />
                העתק לקלוד לתיקון
              </Button>
              {!selectedLog.resolved && (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleResolve(selectedLog.id);
                    setSelectedLog(null);
                  }}
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  סמן כנפתר
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
