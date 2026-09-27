// Support dynamic backend URL via environment variable in production
// Falls back to relative '/api' which works seamlessly with Vite dev proxy and production reverse proxies
let rawBackendUrl = (import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/+$/, '');
if (rawBackendUrl && !rawBackendUrl.startsWith('http://') && !rawBackendUrl.startsWith('https://')) {
  rawBackendUrl = `https://${rawBackendUrl}`;
}

export const API_BASE_URL = rawBackendUrl ? `${rawBackendUrl}/api/v1` : '/api/v1';
export const ROOT_API_URL = rawBackendUrl ? `${rawBackendUrl}/api` : '/api';

export async function fetchDashboard() {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    throw error;
  }
}
