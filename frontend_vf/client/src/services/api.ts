// Support dynamic backend URL via environment variable in production
// Falls back to relative '/api' which works seamlessly with Vite dev proxy and production reverse proxies
const RAW_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');

export const API_BASE_URL = RAW_BACKEND_URL ? `${RAW_BACKEND_URL}/api/v1` : '/api/v1';
export const ROOT_API_URL = RAW_BACKEND_URL ? `${RAW_BACKEND_URL}/api` : '/api';

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

