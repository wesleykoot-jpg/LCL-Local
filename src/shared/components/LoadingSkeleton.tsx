import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  const skeletonProps = {
    role: 'status' as const,
    'aria-busy': true as const,
    'aria-label': 'Loading',
  };

  if (className) {
    return (
      <div
        {...skeletonProps}
        className={cn('animate-pulse bg-muted rounded-xl', className)}
      />
    );
  }

  return (
    <div
      {...skeletonProps}
      className="min-h-screen bg-[#F8F9FA] flex items-center justify-center"
    >
      <div className="text-center">
        <div className="inline-block bg-[#B4FF39] rounded-2xl px-6 py-3 mb-4">
          <h1 className="text-3xl font-bold text-zinc-900">LCL</h1>
        </div>
        <div className="w-8 h-8 border-4 border-[#B4FF39] border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}
