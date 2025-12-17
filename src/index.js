require('dotenv').config();

const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Connect page - serves landing page or redirects to OAuth
app.get('/connect', async (req, res) => {
    const { familyId, familyName } = req.query;

    console.log(`[Connect] Request for family: ${familyId}`);

    if (!familyId) {
        console.warn('[Connect] Missing familyId parameter');
        return res.redirect('/error.html?message=' + encodeURIComponent('Missing family ID. Please use a valid connection link.'));
    }

    // Serve the connect page with query parameters preserved
    res.sendFile(path.join(__dirname, '../public/connect.html'));
});

// Auth API routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Error]', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║     Family Assistant Gmail OAuth Server               ║
╠═══════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                          ║
║  Environment: ${process.env.NODE_ENV || 'development'}                       ║
║  Base URL: ${process.env.BASE_URL || 'http://localhost:' + PORT}
╚═══════════════════════════════════════════════════════╝
    `);

    // Validate required environment variables
    const requiredEnvVars = [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'API_SECRET_KEY',
        'BASE_URL'
    ];

    const missingVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        console.warn('⚠️  Warning: Missing environment variables:', missingVars.join(', '));
    } else {
        console.log('✓ All required environment variables are set');
    }
});
