import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import PaymentQueueClient from '@/components/finance/PaymentQueueClient';

export default async function FinancePaymentsPage() {
  const context = await requireCurrentUser();
  const permissionUser = await toPermissionUser(context.user);
  const [canPay, canViewFinance] = await Promise.all([
    checkPermission(permissionUser, Permissions.PURCHASE_PAY),
    checkPermission(permissionUser, Permissions.FINANCE_VIEW_ALL),
  ]);

  if (!canPay.allowed && !canViewFinance.allowed) {
    return (
      <section className="surface-panel p-6">
        <p className="text-sm text-muted-foreground">无权访问付款任务队列。</p>
      </section>
    );
  }

  return <PaymentQueueClient />;
}
