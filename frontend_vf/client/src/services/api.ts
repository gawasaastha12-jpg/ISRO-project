export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

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
