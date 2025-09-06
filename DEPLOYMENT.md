# Deployment Guide

This guide covers deploying the Strava Activity Visualizer to Cloudflare Pages (frontend) and Cloudflare Workers (backend).

## Prerequisites

1. **Cloudflare Account**: Free tier is sufficient
2. **Strava API Application**: Create at https://www.strava.com/settings/api
3. **GitHub Repository**: For Cloudflare Pages integration
4. **Node.js 18+** and **pnpm**
5. **Wrangler CLI**: `npm install -g wrangler`

## Quick Deployment

Use the automated deployment script:

```bash
./deploy.sh
```

## Manual Deployment

### 1. Backend (Cloudflare Worker)

#### Install Dependencies

```bash
cd be-pinggerr
npm install
```

#### Set Environment Variables

```bash
# Set Strava secrets
wrangler secret put STRAVA_CLIENT_ID
wrangler secret put STRAVA_CLIENT_SECRET
```

#### Deploy Worker

```bash
npm run deploy
```

The worker will be available at: `https://be-pingerr.fauzanebd.workers.dev`

### 2. Frontend (Cloudflare Pages)

#### Option A: GitHub Integration (Recommended)

1. Push your code to GitHub
2. Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
3. Click "Create a project" → "Connect to Git"
4. Select your repository
5. Configure build settings:
   - **Framework preset**: Vite
   - **Build command**: `pnpm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `frontend`

#### Option B: Direct Upload

```bash
cd frontend
pnpm install
pnpm run build
wrangler pages deploy dist --project-name strava-activity-visualizer
```

#### Set Environment Variables

In Cloudflare Pages dashboard, add these environment variables:

```
VITE_WORKER_URL=https://be-pingerr.fauzanebd.workers.dev
VITE_STRAVA_CLIENT_ID=<your-strava-client-id>
VITE_STRAVA_REDIRECT_URI=https://fe-pingerr.pages.dev/auth/callback
```

### 3. Configure Strava App

Update your Strava application settings:

1. Go to https://www.strava.com/settings/api
2. Edit your application
3. Set **Authorization Callback Domain**: `<your-pages-domain>.pages.dev`
4. Add **Redirect URI**: `https://<your-pages-domain>.pages.dev/auth/callback`

## Environment Variables

### Backend (Cloudflare Worker)

- `STRAVA_CLIENT_ID`: Your Strava application Client ID
- `STRAVA_CLIENT_SECRET`: Your Strava application Client Secret

### Frontend (Cloudflare Pages)

- `VITE_WORKER_URL`: URL of your deployed Cloudflare Worker
- `VITE_STRAVA_CLIENT_ID`: Your Strava application Client ID
- `VITE_STRAVA_REDIRECT_URI`: Full OAuth callback URL

## Production Checklist

### Security

- [ ] Strava Client Secret is stored as Cloudflare Worker secret
- [ ] Client Secret is never exposed to frontend
- [ ] CORS headers are properly configured
- [ ] OAuth redirect URI matches exactly

### Performance

- [ ] Frontend assets are minified and optimized
- [ ] Images are properly compressed
- [ ] Canvas rendering is optimized for mobile

### Functionality

- [ ] OAuth flow works end-to-end
- [ ] Activity fetching works correctly
- [ ] Graphics generation works across devices
- [ ] Download functionality works
- [ ] Share functionality works

## Monitoring and Debugging

### Worker Logs

```bash
wrangler tail
```

### Pages Deployment Logs

- Available in Cloudflare Pages dashboard
- Check Functions tab for deployment status

### Common Issues

1. **OAuth Errors**

   - Verify redirect URI exactly matches Strava app settings
   - Check that Client ID is correct in frontend environment

2. **CORS Errors**

   - Ensure Worker CORS headers include your Pages domain
   - Check that frontend is calling correct Worker URL

3. **Token Exchange Failures**
   - Verify Client Secret is set correctly in Worker
   - Check Worker logs for detailed error messages

## Custom Domain (Optional)

### Pages Custom Domain

1. Go to Pages → Custom domains
2. Add your domain
3. Update Strava app redirect URI

### Worker Custom Domain

1. Go to Workers → Routes
2. Add route pattern: `api.yourdomain.com/*`
3. Update frontend VITE_WORKER_URL

## Updating

### Backend Updates

```bash
cd be-pinggerr
npm run deploy
```

### Frontend Updates

- GitHub integration: Push to main branch (auto-deploys)
- Direct upload: Run `wrangler pages deploy dist`

## Scaling

The current setup handles:

- **100,000 requests/day** on Cloudflare free tier
- **Unlimited bandwidth** for Pages
- **Automatic global CDN** distribution

For higher traffic, upgrade to Cloudflare Pro or Business plans.

## Support

- **Cloudflare Docs**: https://developers.cloudflare.com/
- **Strava API Docs**: https://developers.strava.com/
- **Issues**: Create an issue in the GitHub repository
