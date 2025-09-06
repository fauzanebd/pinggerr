/**
 * Strava OAuth Handler for Cloudflare Workers
 *
 * Handles secure token exchange and refresh operations for Strava API integration
 * Keeps client_secret secure on the backend while allowing frontend to make authenticated requests
 */

interface StravaTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_at: number;
	expires_in: number;
	token_type: string;
}

interface StravaTokenRefreshResponse {
	access_token: string;
	refresh_token: string;
	expires_at: number;
	expires_in: number;
}

// CORS headers for frontend communication
const corsHeaders = {
	'Access-Control-Allow-Origin': '*', // In production, replace with your frontend domain
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Route handlers
		switch (url.pathname) {
			case '/exchange':
				return handleTokenExchange(request, env);
			case '/refresh':
				return handleTokenRefresh(request, env);
			case '/':
				return new Response('Strava OAuth Worker - Endpoints: /exchange, /refresh', {
					headers: corsHeaders,
				});
			default:
				return new Response('Not Found', {
					status: 404,
					headers: corsHeaders,
				});
		}
	},
} satisfies ExportedHandler<Env>;

/**
 * Exchange authorization code for access token
 */
async function handleTokenExchange(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		const { code } = (await request.json()) as { code: string };

		if (!code) {
			return new Response(JSON.stringify({ error: 'Missing authorization code' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Exchange code for tokens with Strava
		const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				client_id: env.STRAVA_CLIENT_ID,
				client_secret: env.STRAVA_CLIENT_SECRET,
				code: code,
				grant_type: 'authorization_code',
			}),
		});

		if (!tokenResponse.ok) {
			const errorData = await tokenResponse.text();
			console.error('Strava token exchange failed:', errorData);
			return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		const tokenData: StravaTokenResponse = await tokenResponse.json();

		// Return tokens to frontend (access_token is short-lived, refresh_token for later use)
		return new Response(
			JSON.stringify({
				access_token: tokenData.access_token,
				refresh_token: tokenData.refresh_token,
				expires_at: tokenData.expires_at,
				expires_in: tokenData.expires_in,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Token exchange error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Refresh expired access token using refresh token
 */
async function handleTokenRefresh(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		const { refresh_token } = (await request.json()) as { refresh_token: string };

		if (!refresh_token) {
			return new Response(JSON.stringify({ error: 'Missing refresh token' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Refresh the access token with Strava
		const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				client_id: env.STRAVA_CLIENT_ID,
				client_secret: env.STRAVA_CLIENT_SECRET,
				refresh_token: refresh_token,
				grant_type: 'refresh_token',
			}),
		});

		if (!refreshResponse.ok) {
			const errorData = await refreshResponse.text();
			console.error('Strava token refresh failed:', errorData);
			return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		const refreshData: StravaTokenRefreshResponse = await refreshResponse.json();

		// Return new tokens to frontend
		return new Response(
			JSON.stringify({
				access_token: refreshData.access_token,
				refresh_token: refreshData.refresh_token,
				expires_at: refreshData.expires_at,
				expires_in: refreshData.expires_in,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Token refresh error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}
