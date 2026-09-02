'use client';

import dynamic from 'next/dynamic';
import type { GpsPoint } from '@/lib/types';

const TrackPlaybackMap = dynamic(() => import('./TrackPlaybackMap'), { 
  ssr: false,
  loading: () => <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-100 animate-pulse text-gray-500">Loading Map...</div>
});

interface PlaybackMapWrapperProps {
  track: GpsPoint[];
  currentIndex: number;
  vehiclePlate?: string;
}

export default function PlaybackMapWrapper(props: PlaybackMapWrapperProps) {
  return <TrackPlaybackMap {...props} />;
}
