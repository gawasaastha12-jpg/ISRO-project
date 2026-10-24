/**
 * Dynamic API Base URL resolution for both Local and Deployed Cloud (Render/Vercel) environments.
 */
function resolveBackendUrl(): string {
  // 1. Check Vite build-time environment variable
  const envUrl = (import.meta.env.VITE_BACKEND_URL || '').trim();
  if (envUrl) {
    if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
      return envUrl.replace(/\/+$/, '');
    }
    return `https://${envUrl.replace(/\/+$/, '')}`;
  }

  // 2. Automatically detect when running on Render cloud domain
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return 'https://aditya-l1-solar-backend.onrender.com';
  }

  // 3. Local development fallback
  return 'http://127.0.0.1:8000';
}

export const BACKEND_URL = resolveBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;
export const API_GRID_URL = `${BACKEND_URL}/api`;

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
