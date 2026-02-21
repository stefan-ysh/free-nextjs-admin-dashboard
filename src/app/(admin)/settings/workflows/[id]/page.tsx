import { Suspense } from 'react';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { notFound } from 'next/navigation';
import WorkflowDesignerClient from '@/components/settings/WorkflowDesignerClient';

export const metadata = {
  title: '流程设计器 - Admin Setup',
};

export default async function WorkflowDesignerPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user } = await requireCurrentUser();
  if (user.primary_role !== 'super_admin') {
    notFound();
  }

  // The id is now a UUID from the database, not a hardcoded string.
  // We just pass it down to the client component to fetch its configuration.
  return (
    <div className="flex h-full flex-col bg-background">
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">加载设计器中...</div>}>
        <WorkflowDesignerClient configId={params.id} />
      </Suspense>
    </div>
  );
}
