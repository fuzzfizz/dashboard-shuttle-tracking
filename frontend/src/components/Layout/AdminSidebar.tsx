'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Bus, History, Navigation, BarChart3, LogOut, Globe } from 'lucide-react';
import { api } from '@/lib/api';

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/admin', label: 'ภาพรวม (Overview)', icon: LayoutDashboard },
    { href: '/admin/vehicles', label: 'ยานพาหนะ (Vehicles)', icon: Bus },
    { href: '/admin/trips', label: 'ประวัติเที่ยววิ่ง (Trips)', icon: History },
    { href: '/admin/routes', label: 'เส้นทางเดินรถ (Routes)', icon: Navigation },
    { href: '/admin/reports', label: 'รายงานสรุป (Reports)', icon: BarChart3 },
  ];

  const handleLogout = () => {
    api.auth.logout();
    router.push('/login');
  };

  return (
    <aside className="w-68 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80">
        <Link href="/admin" className="flex items-center gap-3 group">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight leading-tight">
              Fleet Admin
            </h2>
            <p className="text-xs text-slate-400">
              Shuttle Management
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-xs font-semibold tracking-wider uppercase text-slate-400">
          เมนูหลัก (Main Menu)
        </div>

        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 px-3 pb-2 text-xs font-semibold tracking-wider uppercase text-slate-400">
          ภายนอก (External)
        </div>
        <Link
          href="/"
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:bg-slate-800/70 hover:text-white transition-all"
        >
          <Globe className="w-4 h-4 text-slate-400" />
          <span>แผนที่สด (Public Map)</span>
        </Link>
      </div>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 mt-auto">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs flex items-center justify-center">
            AD
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">Admin User</p>
            <p className="text-xs text-slate-400 truncate">admin@example.com</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors border border-rose-500/20"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>ออกจากระบบ (Logout)</span>
        </button>
      </div>
    </aside>
  );
}
