/**
 * Middleware to validate API key for protected endpoints
 * Expects the API key in the x-api-key header
 */
function validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.API_SECRET_KEY;

    if (!expectedApiKey) {
        console.error('[API Key] API_SECRET_KEY environment variable is not set');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'API key validation is not properly configured'
        });
    }

    if (!apiKey) {
        console.warn('[API Key] Request missing x-api-key header');
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing API key. Please provide x-api-key header.'
        });
    }

    if (apiKey !== expectedApiKey) {
        console.warn('[API Key] Invalid API key provided');
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid API key'
        });
    }

    console.log('[API Key] Valid API key provided');
    next();
}

module.exports = {
    validateApiKey
};
