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
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Access-Control-Max-Age': '86400', // 24 hours
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
			case '/count-pgs-download':
				return handleTrackPgsDownload(request, env);

			case '/count-mm-download':
				return handleTrackMmDownload(request, env);
			case '/count-lg-download':
				return handleTrackLgDownload(request, env);

			case '/count-3ds-download':
				return handleTrack3dsDownload(request, env);
			case '/stats':
				return handleGetStats(request, env);
			case '/count-map-load':
				return handleTrackMapLoad(request, env);
			case '/check-map-limit':
				return handleCheckMapLimit(request, env);
			case '/':
				return new Response(
					'Strava OAuth Worker - Endpoints: /exchange, /refresh, /count-pgs-download, /count-3ds-download, /stats, /count-map-load, /check-map-limit',
					{
						headers: corsHeaders,
					}
				);
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

/**
 * Track a Pink Green activity download event by incrementing the counter
 */
async function handleTrackPgsDownload(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		const downloadCountKey = 'total_pgs_downloads';

		// Get current count, default to 0 if not exists
		const currentCountString = await env.PINGGERR_STATS.get(downloadCountKey);
		const currentCount = currentCountString ? parseInt(currentCountString, 10) : 0;

		// Increment and store the new count
		const newCount = currentCount + 1;
		await env.PINGGERR_STATS.put(downloadCountKey, newCount.toString());

		// Return the new count
		return new Response(
			JSON.stringify({
				success: true,
				total_pgs_downloads: newCount,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('PGS download tracking error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Track a Modern Minimalist activity download event by incrementing the counter
 */
async function handleTrackMmDownload(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		const downloadCountKey = 'total_mm_downloads';

		// Get current count, default to 0 if not exists
		const currentCountString = await env.PINGGERR_STATS.get(downloadCountKey);
		const currentCount = currentCountString ? parseInt(currentCountString, 10) : 0;

		// Increment and store the new count
		const newCount = currentCount + 1;
		await env.PINGGERR_STATS.put(downloadCountKey, newCount.toString());

		// Return the new count
		return new Response(
			JSON.stringify({
				success: true,
				total_mm_downloads: newCount,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('MM download tracking error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Track a Liquid Glass activity download event by incrementing the counter
 */
async function handleTrackLgDownload(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		const downloadCountKey = 'total_lg_downloads';

		// Get current count, default to 0 if not exists
		const currentCountString = await env.PINGGERR_STATS.get(downloadCountKey);
		const currentCount = currentCountString ? parseInt(currentCountString, 10) : 0;

		// Increment and store the new count
		const newCount = currentCount + 1;
		await env.PINGGERR_STATS.put(downloadCountKey, newCount.toString());

		// Return the new count
		return new Response(
			JSON.stringify({
				success: true,
				total_lg_downloads: newCount,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('LG download tracking error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Track a 3D Stories download event by incrementing the counter
 */
async function handleTrack3dsDownload(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		const downloadCountKey = 'total_3ds_downloads';

		// Get current count, default to 0 if not exists
		const currentCountString = await env.PINGGERR_STATS.get(downloadCountKey);
		const currentCount = currentCountString ? parseInt(currentCountString, 10) : 0;

		// Increment and store the new count
		const newCount = currentCount + 1;
		await env.PINGGERR_STATS.put(downloadCountKey, newCount.toString());

		// Return the new count
		return new Response(
			JSON.stringify({
				success: true,
				total_3ds_downloads: newCount,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('3DS download tracking error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Get download statistics
 */
async function handleGetStats(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'GET') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		// Get all download counts
		const pgsDownloadsString = await env.PINGGERR_STATS.get('total_pgs_downloads');
		const mmDownloadsString = await env.PINGGERR_STATS.get('total_mm_downloads');
		const lgDownloadsString = await env.PINGGERR_STATS.get('total_lg_downloads');
		const threeDsDownloadsString = await env.PINGGERR_STATS.get('total_3ds_downloads');

		const pgsDownloads = pgsDownloadsString ? parseInt(pgsDownloadsString, 10) : 0;
		const mmDownloads = mmDownloadsString ? parseInt(mmDownloadsString, 10) : 0;
		const lgDownloads = lgDownloadsString ? parseInt(lgDownloadsString, 10) : 0;
		const threeDsDownloads = threeDsDownloadsString ? parseInt(threeDsDownloadsString, 10) : 0;

		// Get current month's map loads
		const now = new Date();
		const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const mapLoadCountKey = `map_loads_${monthKey}`;
		const mapLoadsString = await env.PINGGERR_STATS.get(mapLoadCountKey);
		const mapLoads = mapLoadsString ? parseInt(mapLoadsString, 10) : 0;

		// Return the current stats
		return new Response(
			JSON.stringify({
				total_pgs_downloads: pgsDownloads,
				total_mm_downloads: mmDownloads,
				total_lg_downloads: lgDownloads,
				total_3ds_downloads: threeDsDownloads,
				map_loads_this_month: mapLoads,
				month_key: monthKey,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Stats retrieval error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Track a map load event by incrementing the monthly counter
 */
async function handleTrackMapLoad(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		// Generate monthly key (YYYY-MM format)
		const now = new Date();
		const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const mapLoadCountKey = `map_loads_${monthKey}`;

		// Get current count for this month, default to 0 if not exists
		const currentCountString = await env.PINGGERR_STATS.get(mapLoadCountKey);
		const currentCount = currentCountString ? parseInt(currentCountString, 10) : 0;

		// Increment and store the new count
		const newCount = currentCount + 1;
		await env.PINGGERR_STATS.put(mapLoadCountKey, newCount.toString());

		// Return the new count and monthly key
		return new Response(
			JSON.stringify({
				success: true,
				map_loads_this_month: newCount,
				month_key: monthKey,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Map load tracking error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Check if map loading is allowed (under 50,000 monthly limit)
 */
async function handleCheckMapLimit(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'GET') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders,
		});
	}

	try {
		// Generate monthly key (YYYY-MM format)
		const now = new Date();
		const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const mapLoadCountKey = `map_loads_${monthKey}`;

		// Get current count for this month, default to 0 if not exists
		const currentCountString = await env.PINGGERR_STATS.get(mapLoadCountKey);
		const currentCount = currentCountString ? parseInt(currentCountString, 10) : 0;

		const MONTHLY_LIMIT = 50000;
		const canLoadMap = currentCount < MONTHLY_LIMIT;

		// Return the limit check result
		return new Response(
			JSON.stringify({
				can_load_map: canLoadMap,
				map_loads_this_month: currentCount,
				monthly_limit: MONTHLY_LIMIT,
				remaining_loads: Math.max(0, MONTHLY_LIMIT - currentCount),
				month_key: monthKey,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Map limit check error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}
