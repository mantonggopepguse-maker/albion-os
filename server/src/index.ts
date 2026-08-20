/**
 * AlbionOS Express entry point.
 * @module index
 */
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';

// Rate Limiters
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' }
});

// Import routes
import authRoutes from './routes/auth.js';

const app = express();
const PORT = Number(process.env.PORT) || 5001;

const defaultAllowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const allowedOrigins = configuredAllowedOrigins.length > 0
    ? configuredAllowedOrigins
    : defaultAllowedOrigins;

app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        const corsError = new Error('Origin is not allowed by CORS') as Error & { status?: number };
        corsError.status = 403;
        callback(corsError);
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Health check endpoint
app.get('/health', async (req, res) => {
    let dbStatus = 'ok';
    try {
        await pool.query('SELECT 1');
    } catch (e) {
        dbStatus = 'error';
        console.error('Health check DB error:', e instanceof Error ? e.message : e);
    }
    res.status(dbStatus === 'ok' ? 200 : 503).json({
        status: dbStatus === 'ok' ? 'ok' : 'degraded',
        db: dbStatus,
        timestamp: new Date().toISOString(),
    });
});

// Rate limiting for the API surface
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authLimiter, authRoutes);

// Error handling middleware (sanitized for production)
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express error middleware requires all 4 params
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err);
    const serverError = err as { message?: string; code?: unknown; status?: number; stack?: string };
    let clientMessage = serverError.message || 'Internal server error';
    if (process.env.NODE_ENV === 'production') {
        if (serverError.code && typeof serverError.code === 'string' && serverError.code.startsWith('2')) {
            clientMessage = 'A database constraint error occurred.';
        }
        if (serverError.status === 500 || !serverError.status) {
            clientMessage = 'Internal server error';
        }
    }
    res.status(serverError.status || 500).json({
        error: clientMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: serverError.stack })
    });
});

// 404 handler for API routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// Start server (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`AlbionOS API running on http://0.0.0.0:${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

export default app;

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    await pool.end();
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
