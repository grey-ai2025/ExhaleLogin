# Family Assistant Gmail OAuth

A Gmail OAuth connection system for the Family Assistant SaaS product. This allows families to connect their Gmail accounts so n8n automation can read their school-related emails.

## Features

- Simple web interface for families to connect their Gmail
- Secure OAuth 2.0 flow with Google
- Token storage in Supabase with automatic refresh
- API endpoint for n8n to get valid access tokens
- Rate limiting and API key protection

## Tech Stack

- **Frontend**: Vanilla HTML/JS with Tailwind CSS
- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Railway

## Setup Instructions

### 1. Database Setup

Run the migration in your Supabase SQL Editor:

```sql
-- Copy contents of supabase/migrations/001_create_tokens_table.sql
```

### 2. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Gmail API
4. Go to "Credentials" and create OAuth 2.0 Client ID
5. Set the authorized redirect URI to: `https://YOUR_RAILWAY_DOMAIN/api/auth/callback`
6. Note your Client ID and Client Secret

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
API_SECRET_KEY=generate-a-secure-random-string
BASE_URL=https://your-railway-domain.railway.app
NODE_ENV=production
PORT=3000
```

### 4. Railway Deployment

1. Push this code to a GitHub repository
2. Connect the repo to Railway
3. Add all environment variables in Railway dashboard
4. Deploy!

### 5. Update Google OAuth Redirect URI

After deploying to Railway, update your Google OAuth credentials with the correct redirect URI:
```
https://your-app.railway.app/api/auth/callback
```

## API Endpoints

### `GET /connect?familyId=xxx&familyName=xxx`

Landing page for families to connect their Gmail.

**Parameters:**
- `familyId` (required): Unique identifier for the family
- `familyName` (optional): Display name for the family

### `GET /api/auth/start?familyId=xxx&familyName=xxx`

Initiates the OAuth flow. Redirects to Google consent screen.

### `GET /api/auth/callback`

OAuth callback handler. Exchanges code for tokens and stores in Supabase.

### `POST /api/auth/refresh`

Refreshes access token for a family. **Protected by API key.**

**Headers:**
- `x-api-key`: Your API_SECRET_KEY

**Body:**
```json
{
  "family_id": "xxx"
}
```

**Response:**
```json
{
  "access_token": "xxx",
  "expires_at": "2024-01-01T00:00:00.000Z",
  "refreshed": true
}
```

### `GET /api/auth/status?familyId=xxx`

Check connection status for a family.

**Response:**
```json
{
  "connected": true,
  "email": "user@gmail.com",
  "connectedAt": "2024-01-01T00:00:00.000Z"
}
```

### `GET /health`

Health check endpoint.

## n8n Integration

In your n8n workflow, before making Gmail API requests:

1. **HTTP Request Node** to refresh token:
   - Method: POST
   - URL: `https://your-app.railway.app/api/auth/refresh`
   - Headers: `x-api-key: YOUR_API_SECRET_KEY`
   - Body: `{ "family_id": "xxx" }`

2. Use the returned `access_token` for Gmail API calls

### Example n8n Workflow

```
[Trigger] → [HTTP Request: Refresh Token] → [Gmail API Request]
```

## Usage Flow

1. Send family the connect link: `https://your-app.railway.app/connect?familyId=family123&familyName=Smith%20Family`
2. Family clicks "Connect Gmail" and authorizes access
3. Tokens are stored in Supabase
4. n8n calls `/api/auth/refresh` before Gmail operations
5. n8n uses the access token to read emails

## Security Notes

- All tokens are stored server-side in Supabase
- The `/api/auth/refresh` endpoint requires an API key
- Row Level Security (RLS) is enabled on the tokens table
- Tokens are never exposed to the frontend
- Rate limiting is applied to the refresh endpoint (60 req/min)

## Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your values

# Start development server
npm run dev
```

The server will start on `http://localhost:3000`

## Troubleshooting

### "No refresh token received"
- Make sure `prompt=consent` and `access_type=offline` are set (already configured)
- The user may need to revoke access and reconnect

### "Invalid grant" error
- The refresh token has expired or been revoked
- User needs to reconnect their Gmail

### Rate limit exceeded
- The refresh endpoint is limited to 60 requests per minute
- Cache the access token and only refresh when needed

## License

MIT
