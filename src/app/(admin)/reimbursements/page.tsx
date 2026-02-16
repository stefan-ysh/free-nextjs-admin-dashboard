'use client';

import { useMemo } from 'react';

import ReimbursementsClient from '@/components/reimbursements/ReimbursementsClient';
import { usePermissions } from '@/hooks/usePermissions';

export default function ReimbursementsPage() {
  const { loading, hasPermission } = usePermissions();

  const canAccess = useMemo(() => {
    if (loading) return false;
    return (
      hasPermission('REIMBURSEMENT_CREATE') ||
      hasPermission('REIMBURSEMENT_VIEW_ALL') ||
      hasPermission('REIMBURSEMENT_APPROVE') ||
      hasPermission('REIMBURSEMENT_REJECT') ||
      hasPermission('REIMBURSEMENT_PAY')
    );
  }, [hasPermission, loading]);

  if (loading) {
    return <div className="panel-frame p-6 text-sm text-muted-foreground">正在加载权限信息...</div>;
  }

  if (!canAccess) {
    return <div className="alert-box alert-danger">当前账户无权访问报销中心，请联系管理员开通权限。</div>;
  }

  return (
    <section className="space-y-6">
      <ReimbursementsClient />
    </section>
  );
}

