// Support dynamic backend URL via environment variable or localStorage in production
// Falls back to relative '/api' which works seamlessly with Vite dev proxy and production reverse proxies
let rawBackendUrl = (
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.localStorage?.getItem('BACKEND_URL')) ||
  ''
).trim().replace(/\/+$/, '');

if (rawBackendUrl && !rawBackendUrl.startsWith('http://') && !rawBackendUrl.startsWith('https://')) {
  rawBackendUrl = `https://${rawBackendUrl}`;
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
