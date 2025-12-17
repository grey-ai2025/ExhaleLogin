const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
}

// Create Supabase client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Upsert (insert or update) Gmail tokens for a family
 * @param {Object} params - Token parameters
 * @param {string} params.familyId - Unique family identifier
 * @param {string} params.familyName - Display name for the family
 * @param {string} params.email - Connected Gmail address
 * @param {string} params.accessToken - Gmail API access token
 * @param {string} params.refreshToken - Gmail API refresh token
 * @param {Date} params.tokenExpiry - Token expiration timestamp
 * @returns {Promise<Object>} The upserted record
 */
async function upsertFamilyTokens({ familyId, familyName, email, accessToken, refreshToken, tokenExpiry }) {
    console.log(`[Supabase] Upserting tokens for family: ${familyId}`);

    const { data, error } = await supabase
        .from('family_gmail_tokens')
        .upsert({
            family_id: familyId,
            family_name: familyName,
            email: email,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expiry: tokenExpiry
        }, {
            onConflict: 'family_id'
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error upserting tokens:', error);
        throw error;
    }

    console.log(`[Supabase] Successfully upserted tokens for family: ${familyId}`);
    return data;
}

/**
 * Get tokens for a specific family
 * @param {string} familyId - Unique family identifier
 * @returns {Promise<Object|null>} The token record or null if not found
 */
async function getFamilyTokens(familyId) {
    console.log(`[Supabase] Fetching tokens for family: ${familyId}`);

    const { data, error } = await supabase
        .from('family_gmail_tokens')
        .select('*')
        .eq('family_id', familyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No rows returned
            console.log(`[Supabase] No tokens found for family: ${familyId}`);
            return null;
        }
        console.error('[Supabase] Error fetching tokens:', error);
        throw error;
    }

    console.log(`[Supabase] Found tokens for family: ${familyId}`);
    return data;
}

/**
 * Update access token for a family
 * @param {string} familyId - Unique family identifier
 * @param {string} accessToken - New access token
 * @param {Date} tokenExpiry - New token expiration timestamp
 * @returns {Promise<Object>} The updated record
 */
async function updateAccessToken(familyId, accessToken, tokenExpiry) {
    console.log(`[Supabase] Updating access token for family: ${familyId}`);

    const { data, error } = await supabase
        .from('family_gmail_tokens')
        .update({
            access_token: accessToken,
            token_expiry: tokenExpiry
        })
        .eq('family_id', familyId)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating access token:', error);
        throw error;
    }

    console.log(`[Supabase] Successfully updated access token for family: ${familyId}`);
    return data;
}

/**
 * Check if a family has connected their Gmail
 * @param {string} familyId - Unique family identifier
 * @returns {Promise<Object>} Connection status object
 */
async function getConnectionStatus(familyId) {
    console.log(`[Supabase] Checking connection status for family: ${familyId}`);

    const { data, error } = await supabase
        .from('family_gmail_tokens')
        .select('email, created_at')
        .eq('family_id', familyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return { connected: false };
        }
        console.error('[Supabase] Error checking connection status:', error);
        throw error;
    }

    return {
        connected: true,
        email: data.email,
        connectedAt: data.created_at
    };
}

module.exports = {
    supabase,
    upsertFamilyTokens,
    getFamilyTokens,
    updateAccessToken,
    getConnectionStatus
};
