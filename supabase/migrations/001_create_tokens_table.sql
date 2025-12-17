-- Create the family_gmail_tokens table
CREATE TABLE IF NOT EXISTS family_gmail_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id TEXT UNIQUE NOT NULL,
    family_name TEXT,
    email TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on family_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_family_gmail_tokens_family_id ON family_gmail_tokens(family_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS update_family_gmail_tokens_updated_at ON family_gmail_tokens;
CREATE TRIGGER update_family_gmail_tokens_updated_at
    BEFORE UPDATE ON family_gmail_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on the table
ALTER TABLE family_gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows the service role to perform all operations
-- This ensures only server-side access with the service key can access tokens
CREATE POLICY "Service role can manage all tokens" ON family_gmail_tokens
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE family_gmail_tokens IS 'Stores Gmail OAuth tokens for family accounts';
COMMENT ON COLUMN family_gmail_tokens.family_id IS 'Unique identifier for each family';
COMMENT ON COLUMN family_gmail_tokens.family_name IS 'Display name for the family';
COMMENT ON COLUMN family_gmail_tokens.email IS 'Connected Gmail address';
COMMENT ON COLUMN family_gmail_tokens.access_token IS 'Gmail API access token';
COMMENT ON COLUMN family_gmail_tokens.refresh_token IS 'Gmail API refresh token for obtaining new access tokens';
COMMENT ON COLUMN family_gmail_tokens.token_expiry IS 'Timestamp when the access token expires';
