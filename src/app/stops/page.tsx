'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const StopsPageContent = dynamic(() => import('@/components/stops/StopsPageContent'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
        <div className="lg:col-span-3">
          <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    </div>
  ),
});

export default function StopsPage() {
  return <StopsPageContent />;
}
