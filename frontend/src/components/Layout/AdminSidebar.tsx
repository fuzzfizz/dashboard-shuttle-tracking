'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Bus, History, Navigation, BarChart3, LogOut } from 'lucide-react';
import { api } from '@/lib/api';

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/vehicles', label: 'Vehicles', icon: Bus },
    { href: '/admin/trips', label: 'Trips', icon: History },
    { href: '/admin/routes', label: 'Routes', icon: Navigation },
    { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  ];

  const handleLogout = () => {
    api.auth.logout();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800">
      <div className="p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bus className="w-6 h-6 text-blue-400" />
          Fleet Admin
        </h2>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 mt-auto">
        <div className="mb-4 px-3">
          <p className="text-sm font-medium text-slate-200">Admin User</p>
          <p className="text-xs text-slate-500">Administrator</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          ออกจากระบบ / Logout
        </button>
      </div>
    </aside>
  );
}
