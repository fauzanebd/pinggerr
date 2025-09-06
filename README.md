# Strava Activity Visualizer

A beautiful web application that connects to your Strava account and generates shareable graphics of your activities using a pink and green theme.

## Features

- 🔐 Secure OAuth 2.0 authentication with Strava
- 📱 Responsive design built with React + TypeScript
- ⚡ Fast and secure backend using Cloudflare Workers
- 🖼️ Downloadable activity graphics
- 🔄 Automatic token refresh handling

## Architecture

- **Frontend**: React + TypeScript + Vite + Shadcn UI (hosted on Cloudflare Pages)
- **Backend**: TypeScript Cloudflare Worker for OAuth handling
- **Authentication**: Strava OAuth 2.0 with secure server-side token exchange
- **Styling**: Tailwind CSS with custom brand colors

## Setup Instructions

### Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account
- Strava application (create at https://www.strava.com/settings/api)

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Configure environment variables in `.env`:

   ```bash
   VITE_WORKER_URL=http://localhost:8787
   VITE_STRAVA_CLIENT_ID=your_strava_client_id
   VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/callback
   ```

4. Start the development server:
   ```bash
   pnpm run dev
   ```

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd be-pinggerr
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up Cloudflare secrets (for development):

   ```bash
   pnpm wrangler secret put STRAVA_CLIENT_ID
   pnpm wrangler secret put STRAVA_CLIENT_SECRET
   ```

4. Start the development server:
   ```bash
   pnpm run start
   ```

### Strava App Configuration

1. Go to https://www.strava.com/settings/api
2. Create a new application
3. Set the Authorization Callback Domain to your domain (e.g., `localhost:5173` for development)
4. Copy the Client ID and Client Secret for your environment variables

## API Endpoints

### Backend Worker Endpoints

- `POST /exchange` - Exchange authorization code for access tokens
- `POST /refresh` - Refresh expired access tokens

### Strava API Integration

The app integrates with the following Strava API endpoints:

- `GET /api/v3/athlete/activities` - Fetch recent activities
- `GET /api/v3/activities/{id}` - Get detailed activity data including full polyline

## Development

### Frontend Development

The frontend uses:

- React 19 with TypeScript
- Vite for build tooling
- Shadcn UI components with Tailwind CSS
- React Router for OAuth callback handling
- Custom hooks for Strava authentication

### Backend Development

The Cloudflare Worker provides:

- Secure OAuth token exchange
- Token refresh functionality
- CORS handling for frontend requests
- Environment variable management

## Security

- Client secret is never exposed to the frontend
- All OAuth operations happen server-side
- Access tokens are stored client-side with automatic refresh
- CORS is properly configured for cross-origin requests

## Color Scheme

- **Pink**: #F99FD2 (Primary highlights, buttons, accents)
- **Green**: #165027 (Text, success states, secondary accents)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
