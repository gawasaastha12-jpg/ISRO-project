import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchDashboard } from '../services/api';

// Define context type
interface DashboardContextType {
  data: any;
  loading: boolean;
  error: Error | null;
  lastUpdated: string | null;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState(10000);

  const loadData = async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
      setLastUpdated(result.mission_status.utc);
      setError(null);
    } catch (err) {
      console.error("Dashboard Provider error:", err);
      // Fallback to null or partial data if API fails. For now we just set error.
      setError(err as Error);
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    if (data?.alerts?.current_alert) {
      const level = data.alerts.current_alert;
      if (level === 'SEVERE') setPollingInterval(1000);
      else if (level === 'ALERT') setPollingInterval(2000);
      else if (level === 'WARNING') setPollingInterval(5000);
      else setPollingInterval(10000);
    }
  }, [data]);

  useEffect(() => {
    // Initial fetch
    if (!data && loading) loadData();

    // Set up invisible polling
    const interval = setInterval(loadData, pollingInterval);
    return () => clearInterval(interval);
  }, [pollingInterval]);

  return (
    <DashboardContext.Provider value={{ data, loading, error, lastUpdated }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
