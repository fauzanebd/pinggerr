# Local Development Guide

This guide explains how to set up and test the Strava Activity Visualizer locally.

## Prerequisites

Before starting, make sure you have:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher)
- **wrangler** (Cloudflare CLI): `npm install -g wrangler`

## Quick Start

1. **Install dependencies:**

   ```bash
   make install
   ```

2. **Set up Strava App:**

   - Go to https://www.strava.com/settings/api
   - Create a new app or use existing one
   - Set Authorization Callback Domain to: `localhost`
   - Note your Client ID and Client Secret

3. **Configure local environment:**

   **Frontend (.env.local):**
   Create `frontend/.env.local` with:

   ```
   VITE_WORKER_URL=http://localhost:8787
   VITE_STRAVA_CLIENT_ID=your_actual_client_id
   VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/callback
   ```

   **Backend (Wrangler secrets):**

   ```bash
   cd backend
   wrangler secret put STRAVA_CLIENT_ID --local
   wrangler secret put STRAVA_CLIENT_SECRET --local
   ```

4. **Start development servers:**
   ```bash
   make dev
   ```

## Available Commands

Run `make help` to see all available commands. Key commands:

### Development

- `make dev` - Start both frontend and backend
- `make dev-frontend` - Start only frontend (http://localhost:5173)
- `make dev-backend` - Start only backend (http://localhost:8787)

### Building

- `make build` - Build both projects
- `make preview` - Preview built frontend

### Testing

- `make test` - Run tests
- `make lint` - Run linting

### Utilities

- `make status` - Check environment status
- `make clean` - Clean build artifacts
- `make stop` - Stop all development servers

## Local Testing Workflow

1. **Start the development servers:**

   ```bash
   make dev
   ```

2. **Open your browser to:**

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8787

3. **Test the OAuth flow:**

   - Click "Connect with Strava"
   - You'll be redirected to Strava for authorization
   - After authorization, you'll be redirected back to localhost:5173/auth/callback
   - The app should fetch and display your recent activities

4. **Test activity visualization:**
   - Select an activity from the list
   - View the generated visualization
   - Test download and sharing features

## Environment Configuration

### Frontend Environment Variables

The frontend uses these environment variables (create `frontend/.env.local`):

```bash
# Required: Cloudflare Worker URL
VITE_WORKER_URL=http://localhost:8787

# Required: Your Strava Client ID
VITE_STRAVA_CLIENT_ID=12345

# Optional: Custom redirect URI (defaults to current origin + /auth/callback)
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/callback
```

### Backend Secrets

The backend uses Cloudflare Worker secrets:

```bash
# Set these with wrangler
cd backend
echo "your_client_id" | wrangler secret put STRAVA_CLIENT_ID --local
echo "your_client_secret" | wrangler secret put STRAVA_CLIENT_SECRET --local
```

## Troubleshooting

### Common Issues

1. **"Cannot connect to backend"**

   - Make sure backend is running: `make dev-backend`
   - Check if wrangler secrets are set properly
   - Verify VITE_WORKER_URL in frontend/.env.local

2. **OAuth redirect issues**

   - Check Strava app settings: Authorization Callback Domain = `localhost`
   - Verify VITE_STRAVA_REDIRECT_URI matches your setup

3. **Build errors**

   - Run `make clean` and `make install`
   - Check TypeScript errors with `make lint`

4. **Strava API errors**
   - Verify your Strava Client ID and Secret are correct
   - Check if your Strava app has the right permissions
   - Make sure you've authorized the app for the required scopes

### Useful Commands

```bash
# Check if everything is set up correctly
make status

# View running processes
make logs

# Fresh start (clean + install + dev)
make fresh-start

# Quick build and test
make quick-test
```

## API Endpoints (Local)

When running locally, your backend exposes these endpoints:

- `http://localhost:8787/` - Health check
- `http://localhost:8787/exchange` - OAuth token exchange
- `http://localhost:8787/refresh` - Token refresh

## Development Tips

1. **Hot Reload**: Both frontend and backend support hot reload during development
2. **CORS**: The backend is configured to allow requests from localhost:5173
3. **Debugging**: Use browser dev tools and wrangler logs for debugging
4. **Testing**: Test OAuth flow in incognito mode to ensure clean state

## Next Steps

Once local development is working:

1. Test all features thoroughly
2. Run tests: `make test`
3. Build for production: `make build`
4. Deploy when ready: `make deploy`
