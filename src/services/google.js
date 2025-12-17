const { google } = require('googleapis');

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/gmail.modify'
];

/**
 * Create an OAuth2 client configured with credentials
 * @returns {OAuth2Client} Configured OAuth2 client
 */
function createOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.BASE_URL}/api/auth/callback`;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Google OAuth configuration. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate the Google OAuth authorization URL
 * @param {string} familyId - The family identifier to include in state
 * @param {string} familyName - The family name to include in state
 * @returns {string} The authorization URL
 */
function generateAuthUrl(familyId, familyName) {
    const oauth2Client = createOAuth2Client();

    // Encode state as JSON containing familyId and familyName
    const state = Buffer.from(JSON.stringify({
        familyId,
        familyName: familyName || ''
    })).toString('base64');

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force consent screen to always get refresh token
        state: state
    });

    console.log(`[Google] Generated auth URL for family: ${familyId}`);
    return authUrl;
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - The authorization code from Google
 * @returns {Promise<Object>} Token response containing access_token, refresh_token, expiry_date
 */
async function exchangeCodeForTokens(code) {
    const oauth2Client = createOAuth2Client();

    console.log('[Google] Exchanging authorization code for tokens');

    const { tokens } = await oauth2Client.getToken(code);

    console.log('[Google] Successfully obtained tokens');
    console.log(`[Google] Access token expires at: ${new Date(tokens.expiry_date).toISOString()}`);

    return tokens;
}

/**
 * Refresh an access token using a refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} New token response
 */
async function refreshAccessToken(refreshToken) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    console.log('[Google] Refreshing access token');

    const { credentials } = await oauth2Client.refreshAccessToken();

    console.log('[Google] Successfully refreshed access token');
    console.log(`[Google] New access token expires at: ${new Date(credentials.expiry_date).toISOString()}`);

    return credentials;
}

/**
 * Get the user's email address from Gmail API
 * @param {string} accessToken - Valid access token
 * @returns {Promise<string>} The user's email address
 */
async function getUserEmail(accessToken) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    console.log('[Google] Fetching user email address');

    const response = await gmail.users.getProfile({ userId: 'me' });
    const email = response.data.emailAddress;

    console.log(`[Google] User email: ${email}`);
    return email;
}

/**
 * Check if a token is expired or expiring within a given threshold
 * @param {Date|string} tokenExpiry - Token expiration timestamp
 * @param {number} thresholdMinutes - Minutes before expiry to consider as "expiring soon"
 * @returns {boolean} True if token is expired or expiring soon
 */
function isTokenExpiringSoon(tokenExpiry, thresholdMinutes = 5) {
    if (!tokenExpiry) return true;

    const expiryDate = new Date(tokenExpiry);
    const now = new Date();
    const thresholdMs = thresholdMinutes * 60 * 1000;

    return (expiryDate.getTime() - now.getTime()) < thresholdMs;
}

module.exports = {
    createOAuth2Client,
    generateAuthUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    getUserEmail,
    isTokenExpiringSoon,
    SCOPES
};
