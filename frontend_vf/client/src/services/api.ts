// Support dynamic backend URL via environment variable or localStorage in production
// Falls back to relative '/api' which works seamlessly with Vite dev proxy and production reverse proxies
let rawBackendUrl = (
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.localStorage?.getItem('BACKEND_URL')) ||
  ''
).trim().replace(/\/+$/, '');

// If protocol is missing, add https://
if (rawBackendUrl && !rawBackendUrl.startsWith('http://') && !rawBackendUrl.startsWith('https://')) {
  rawBackendUrl = `https://${rawBackendUrl}`;
}

// If someone provided a service name without a TLD/dot (e.g. aditya-l1-solar-backend),
// append .onrender.com so it resolves to a valid public Render domain!
if (rawBackendUrl) {
  try {
    const parsed = new URL(rawBackendUrl);
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      parsed.hostname = `${parsed.hostname}.onrender.com`;
      rawBackendUrl = parsed.toString().replace(/\/+$/, '');
    }
  } catch (e) {
    if (!rawBackendUrl.includes('.') && !rawBackendUrl.includes('localhost')) {
      rawBackendUrl = `${rawBackendUrl}.onrender.com`;
    }
  }
}

// Strip accidental trailing /api or /api/v1 from base URL
rawBackendUrl = rawBackendUrl.replace(/\/api(\/v1)?\/?$/, '');

export const API_BASE_URL = rawBackendUrl ? `${rawBackendUrl}/api/v1` : '/api/v1';
export const ROOT_API_URL = rawBackendUrl ? `${rawBackendUrl}/api` : '/api';

export async function fetchDashboard() {
  try {
    const targetUrl = `${API_BASE_URL}/dashboard`;
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} from ${targetUrl}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch dashboard data from ${API_BASE_URL}/dashboard:`, error);
    throw error;
  }
}
