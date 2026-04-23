import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { errorLogService } from './services/errorLog.service.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());

// CORS configuration - allow multiple origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow all netlify.app subdomains
    if (origin.endsWith('.netlify.app')) {
      return callback(null, true);
    }

    // Check against allowed origins list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log rejected origins for debugging
    console.log('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'נתיב לא נמצא' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);

  // Log error to database and send email notification
  errorLogService.logError({
    severity: 'error',
    source: 'Backend Server',
    message: err.message,
    stack_trace: err.stack,
    url: req.originalUrl,
    user_agent: req.headers['user-agent'],
    ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
    meta: {
      method: req.method,
      body: req.body
    }
  }).catch(console.error);

  res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API available at /api`);
  console.log(`🔋 Health check at /api/health`);
});

export default app;
