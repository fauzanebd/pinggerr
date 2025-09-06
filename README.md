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
