import React from 'react';

export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block bg-[#B4FF39] rounded-2xl px-6 py-3 mb-4">
          <h1 className="text-3xl font-bold text-zinc-900">LCL</h1>
        </div>
        <div className="w-8 h-8 border-4 border-[#B4FF39] border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="w-full min-h-[520px] rounded-[2.5rem] overflow-hidden bg-gray-200 animate-pulse">
      <div className="absolute inset-0 bg-gradient-to-t from-gray-300 to-transparent" />
    </div>
  );
}

export function NicheCardSkeleton() {
  return (
    <div className="w-full aspect-square rounded-[2rem] bg-gray-200 animate-pulse" />
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="h-6 bg-gray-200 rounded-lg w-32 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded-lg w-48 animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded-lg w-full animate-pulse" />
        <div className="h-4 bg-gray-200 rounded-lg w-5/6 animate-pulse" />
      </div>
    </div>
  );
}
