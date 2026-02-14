'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { ApplicationList } from '@/components/inventory/ApplicationList';
import { InventoryApplication } from '@/types/inventory';
import { usePermissions } from '@/hooks/usePermissions';

export default function ApplicationApprovalsPage() {
  const { hasPermission } = usePermissions();
  const [applications, setApplications] = useState<InventoryApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // Fetch 'pending' applications for approval
      const res = await fetch('/api/inventory/applications?status=pending');
      if (res.ok) {
        const data = await res.json();
        setApplications(data.items ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch approvals', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const canApprove = hasPermission('INVENTORY_OPERATE_OUTBOUND');

  if (!canApprove && !loading) {
     return <div className="p-8 text-center text-muted-foreground">无权访问待办审批</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">待办审批</h2>
          <p className="text-muted-foreground">
            审批员工的领用申请。
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
           <ShieldCheck className="h-4 w-4" />
           <span>审批批准后将自动扣减库存</span>
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <ApplicationList
            applications={applications}
            loading={loading}
            isApprover={true}
            onRefresh={fetchApplications}
          />
        </div>
      </div>
    </div>
  );
}
