import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  colorScheme?: 'blue' | 'green' | 'amber' | 'purple' | 'slate';
  className?: string;
}

export function StatsCard({ title, value, subtext, icon, colorScheme = 'blue', className }: StatsCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  const iconColors = colors[colorScheme];

  return (
    <div className={cn("bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col", className)}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
        {icon && (
          <div className={cn("p-3 rounded-lg", iconColors)}>
            {icon}
          </div>
        )}
      </div>
      {subtext && (
        <div className="mt-4">
          <p className="text-sm text-slate-500">{subtext}</p>
        </div>
      )}
    </div>
  );
}
