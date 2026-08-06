import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DashboardProvider } from '@/contexts/DashboardContext';

export default function ArchivePage() {
  return (
    <DashboardProvider>
      <DashboardLayout initialTab="archive">
        <div className="w-full h-full bg-[#0a0e1a]" />
      </DashboardLayout>
    </DashboardProvider>
  );
}
