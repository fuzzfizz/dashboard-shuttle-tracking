'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Bus, Lock, User, AlertCircle, ArrowLeft, Loader2, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login(username, password);
      api.setAuthToken(res.token);
      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background Accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

      <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
        {/* Back to Live Tracking */}
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            กลับสู่แผนที่สด (Public Live Map)
          </Link>
        </div>

        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-3 mb-1.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/25">
              <Bus className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Fleet Admin Portal
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            ระบบบริหารจัดการรถรับ-ส่งแบบเรียลไทม์
          </p>
        </div>

        {/* Card */}
        <div className="mt-6 bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200/80 shadow-sm">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="bg-rose-50 border border-rose-200/80 p-3.5 rounded-xl text-rose-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-snug">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email / Username
              </label>
              <div className="relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm shadow-blue-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <span>เข้าสู่ระบบ (Sign in)</span>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Credentials */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-2.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-500" />
              บัญชีทดสอบเริ่มต้น (Click to auto-fill):
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('admin@example.com', 'admin123456')}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium transition-colors"
              >
                Admin (admin@example.com)
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('viewer@example.com', 'viewer123456')}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium transition-colors"
              >
                Operator (viewer@example.com)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
