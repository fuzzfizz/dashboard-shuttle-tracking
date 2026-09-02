'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, Globe, Wifi, WifiOff } from 'lucide-react';
import { AdminSidebar } from '@/components/Layout/AdminSidebar';
import { api } from '@/lib/api';
import { adminWs } from '@/lib/ws';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = api.getAuthToken();
    if (!token) {
      router.replace('/login');
    } else {
      setIsAuthenticated(true);
      
      const unsubscribeConnected = adminWs.subscribe('connected', () => setWsConnected(true));
      const unsubscribeDisconnected = adminWs.subscribe('disconnected', () => setWsConnected(false));

      adminWs.connect();

      return () => {
        unsubscribeConnected();
        unsubscribeDisconnected();
        adminWs.disconnect();
      };
    }
  }, [router]);

  if (!isAuthenticated) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50">Loading...</div>;
  }

  return (
    <div className="h-screen w-full flex bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <AdminSidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-md hover:bg-slate-100 md:hidden"
            >
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800 hidden sm:block">Fleet Dashboard</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 hidden sm:inline-block">Admin Live Sync:</span>
              {wsConnected ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Disconnected</span>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-slate-200 mx-2"></div>

            <Link 
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline-block">Public Map</span>
            </Link>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
