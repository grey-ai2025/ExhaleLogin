const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
    generateAuthUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    getUserEmail,
    isTokenExpiringSoon
} = require('../services/google');

const {
    upsertFamilyTokens,
    getFamilyTokens,
    updateAccessToken,
    getConnectionStatus
} = require('../services/supabase');

const { validateApiKey } = require('../middleware/apiKey');

// Rate limiter for the refresh endpoint (60 requests per minute per IP)
const refreshRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * GET /api/auth/start
 * Initiates the OAuth flow by redirecting to Google's consent screen
 */
router.get('/start', (req, res) => {
    const { familyId, familyName } = req.query;

    console.log(`[Auth] Starting OAuth flow for family: ${familyId}`);

    if (!familyId) {
        console.warn('[Auth] Missing familyId parameter');
        return res.redirect('/error.html?message=' + encodeURIComponent('Missing family ID'));
    }

    try {
        const authUrl = generateAuthUrl(familyId, familyName);
        console.log(`[Auth] Redirecting to Google consent screen`);
        res.redirect(authUrl);
    } catch (error) {
        console.error('[Auth] Error generating auth URL:', error);
        res.redirect('/error.html?message=' + encodeURIComponent('Failed to start authentication'));
    }
});

/**
 * GET /api/auth/callback
 * Handles the OAuth callback from Google
 */
router.get('/callback', async (req, res) => {
    const { code, state, error: oauthError } = req.query;

    console.log('[Auth] Received OAuth callback');

    // Handle OAuth errors
    if (oauthError) {
        console.error(`[Auth] OAuth error: ${oauthError}`);
        return res.redirect('/error.html?message=' + encodeURIComponent(`Authentication failed: ${oauthError}`));
    }

    if (!code) {
        console.error('[Auth] Missing authorization code');
        return res.redirect('/error.html?message=' + encodeURIComponent('Missing authorization code'));
    }

    if (!state) {
        console.error('[Auth] Missing state parameter');
        return res.redirect('/error.html?message=' + encodeURIComponent('Missing state parameter'));
    }

    try {
        // Decode state to get familyId and familyName
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        const { familyId, familyName } = stateData;

        console.log(`[Auth] Processing callback for family: ${familyId}`);

        if (!familyId) {
            console.error('[Auth] Invalid state: missing familyId');
            return res.redirect('/error.html?message=' + encodeURIComponent('Invalid state parameter'));
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);

        if (!tokens.refresh_token) {
            console.error('[Auth] No refresh token received');
            return res.redirect('/error.html?message=' + encodeURIComponent('Failed to get refresh token. Please try again.'));
        }

        // Get user's email address
        const email = await getUserEmail(tokens.access_token);

        // Calculate token expiry
        const tokenExpiry = new Date(tokens.expiry_date);

        // Store tokens in Supabase
        await upsertFamilyTokens({
            familyId,
            familyName,
            email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiry
        });

        console.log(`[Auth] Successfully stored tokens for family: ${familyId}`);

        // Redirect to success page
        res.redirect(`/success.html?email=${encodeURIComponent(email)}&familyName=${encodeURIComponent(familyName || '')}`);

    } catch (error) {
        console.error('[Auth] Error processing OAuth callback:', error);
        res.redirect('/error.html?message=' + encodeURIComponent('Failed to complete authentication. Please try again.'));
    }
});

/**
 * POST /api/auth/refresh
 * Refreshes the access token for a family (called by n8n)
 * Protected by API key
 */
router.post('/refresh', validateApiKey, refreshRateLimiter, async (req, res) => {
    const { family_id } = req.body;

    console.log(`[Auth] Token refresh requested for family: ${family_id}`);

    if (!family_id) {
        console.warn('[Auth] Missing family_id in request body');
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Missing family_id in request body'
        });
    }

    try {
        // Get current tokens from Supabase
        const tokenData = await getFamilyTokens(family_id);

        if (!tokenData) {
            console.warn(`[Auth] No tokens found for family: ${family_id}`);
            return res.status(404).json({
                error: 'Not Found',
                message: 'No tokens found for this family. Please connect Gmail first.'
            });
        }

        // Check if token needs refreshing
        if (!isTokenExpiringSoon(tokenData.token_expiry)) {
            console.log(`[Auth] Token still valid for family: ${family_id}`);
            return res.json({
                access_token: tokenData.access_token,
                expires_at: tokenData.token_expiry,
                refreshed: false
            });
        }

        console.log(`[Auth] Token expiring soon, refreshing for family: ${family_id}`);

        // Refresh the token
        const newTokens = await refreshAccessToken(tokenData.refresh_token);
        const newExpiry = new Date(newTokens.expiry_date);

        // Update Supabase with new access token
        await updateAccessToken(family_id, newTokens.access_token, newExpiry);

        console.log(`[Auth] Successfully refreshed token for family: ${family_id}`);

        res.json({
            access_token: newTokens.access_token,
            expires_at: newExpiry.toISOString(),
            refreshed: true
        });

    } catch (error) {
        console.error(`[Auth] Error refreshing token for family ${family_id}:`, error);

        // Check if it's a refresh token invalid error
        if (error.message && error.message.includes('invalid_grant')) {
            return res.status(401).json({
                error: 'Token Invalid',
                message: 'Refresh token is invalid or expired. Please reconnect Gmail.'
            });
        }

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to refresh token. Please try again.'
        });
    }
});

/**
 * GET /api/auth/status
 * Returns connection status for a family
 */
router.get('/status', async (req, res) => {
    const { familyId } = req.query;

    console.log(`[Auth] Status check for family: ${familyId}`);

    if (!familyId) {
        console.warn('[Auth] Missing familyId parameter');
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Missing familyId parameter'
        });
    }

    try {
        const status = await getConnectionStatus(familyId);
        console.log(`[Auth] Status for family ${familyId}: connected=${status.connected}`);
        res.json(status);
    } catch (error) {
        console.error(`[Auth] Error checking status for family ${familyId}:`, error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to check connection status'
        });
    }
});

module.exports = router;
