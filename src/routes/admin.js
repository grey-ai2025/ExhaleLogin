const express = require('express');
const router = express.Router();
const path = require('path');
const { supabase, getConnectionStatus } = require('../services/supabase');

// Admin credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Simple session store (in production, use Redis or similar)
const sessions = new Map();

// Generate a simple session token
function generateSessionToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Auth middleware for admin routes
function requireAuth(req, res, next) {
    const sessionToken = req.headers['x-session-token'] || req.query.session;

    if (!sessionToken || !sessions.has(sessionToken)) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Please login first' });
    }

    // Check session expiry (24 hours)
    const session = sessions.get(sessionToken);
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        sessions.delete(sessionToken);
        return res.status(401).json({ error: 'Session expired', message: 'Please login again' });
    }

    next();
}

// Serve admin login page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin.html'));
});

// Login endpoint
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    console.log(`[Admin] Login attempt for user: ${username}`);

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateSessionToken();
        sessions.set(token, { username, createdAt: Date.now() });

        console.log(`[Admin] Login successful for user: ${username}`);
        return res.json({ success: true, token });
    }

    console.warn(`[Admin] Login failed for user: ${username}`);
    res.status(401).json({ error: 'Invalid credentials' });
});

// Logout endpoint
router.post('/logout', (req, res) => {
    const sessionToken = req.headers['x-session-token'];

    if (sessionToken) {
        sessions.delete(sessionToken);
    }

    res.json({ success: true });
});

// Check session validity
router.get('/check-session', requireAuth, (req, res) => {
    res.json({ valid: true });
});

// Get all families
router.get('/families', requireAuth, async (req, res) => {
    try {
        console.log('[Admin] Fetching all families');

        const { data, error } = await supabase
            .from('family_gmail_tokens')
            .select('family_id, family_name, email, created_at, updated_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Admin] Error fetching families:', error);
            return res.status(500).json({ error: 'Failed to fetch families' });
        }

        console.log(`[Admin] Found ${data?.length || 0} families`);
        res.json({ families: data || [] });
    } catch (error) {
        console.error('[Admin] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a family connection
router.delete('/families/:familyId', requireAuth, async (req, res) => {
    try {
        const { familyId } = req.params;
        console.log(`[Admin] Deleting family: ${familyId}`);

        const { error } = await supabase
            .from('family_gmail_tokens')
            .delete()
            .eq('family_id', familyId);

        if (error) {
            console.error('[Admin] Error deleting family:', error);
            return res.status(500).json({ error: 'Failed to delete family' });
        }

        console.log(`[Admin] Successfully deleted family: ${familyId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('[Admin] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate invite link (just returns the constructed URL)
router.post('/generate-link', requireAuth, (req, res) => {
    const { familyId, familyName } = req.body;

    if (!familyId) {
        return res.status(400).json({ error: 'Family ID is required' });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const params = new URLSearchParams({ familyId });

    if (familyName) {
        params.append('familyName', familyName);
    }

    const inviteLink = `${baseUrl}/connect?${params.toString()}`;

    console.log(`[Admin] Generated invite link for family: ${familyId}`);
    res.json({ link: inviteLink });
});

module.exports = router;
