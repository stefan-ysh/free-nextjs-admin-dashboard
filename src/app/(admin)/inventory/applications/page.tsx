'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApplicationList } from '@/components/inventory/ApplicationList';
import { InventoryApplication } from '@/types/inventory';

export default function InventoryApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<InventoryApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/applications');
      if (res.ok) {
        const data = await res.json();
        setApplications(data.items ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch applications', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">领用申请</h2>
          <p className="text-muted-foreground">
            查看您的领用记录。
          </p>
        </div>
        <Button onClick={() => router.push('/inventory/applications/new')}>
          <Plus className="mr-2 h-4 w-4" />
          发起申请
        </Button>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <ApplicationList
            applications={applications}
            loading={loading}
            onRefresh={fetchApplications}
          />
        </div>
      </div>
    </div>
  );
}
