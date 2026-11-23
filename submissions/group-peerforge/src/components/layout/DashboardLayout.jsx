import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout({ children, title, onRefresh, isRefreshing }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-neutral-800">
      {/* Sidebar (Desktop persistent + Mobile drawer) */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area (Offset by sidebar on desktop) */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Topbar
          onMenuClick={() => setMobileMenuOpen(true)}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          title={title}
        />

        <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          {children}
        </main>
      </div>
    </div>
  );
}
