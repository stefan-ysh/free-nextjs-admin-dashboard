import { Suspense } from 'react';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { notFound } from 'next/navigation';
import WorkflowsClient from '@/components/settings/WorkflowsClient';

export const metadata = {
  title: '流程配置 - Admin Setup',
};

export default async function WorkflowsPage() {
  const { user } = await requireCurrentUser();
  if (user.primary_role !== 'super_admin') {
    notFound();
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">审批流配置</h2>
      </div>
      <div className="text-muted-foreground mb-6">
        在这里可以为全系统的各个审批节点指定具体的审核人员。
        如果没有指定人员，系统将降级使用旧的默认角色池（如：采购使用 approver 角色，报销使用 finance 相关角色）。
      </div>
      
      <Suspense fallback={<div className="text-sm text-muted-foreground p-8">加载中...</div>}>
        <WorkflowsClient />
      </Suspense>
    </div>
  );
}
