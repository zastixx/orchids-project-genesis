'use client';
import ProtectedLayout from '@/components/layout/ProtectedLayout';
import AppLayout from '@/components/layout/AppLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <AppLayout>{children}</AppLayout>
    </ProtectedLayout>
  );
}
