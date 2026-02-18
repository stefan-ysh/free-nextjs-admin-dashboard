import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import PaymentQueueClient from '@/components/finance/PaymentQueueClient';

export default async function FinancePaymentsPage() {
  const context = await requireCurrentUser();
  const permissionUser = await toPermissionUser(context.user);
  const canPay = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY);

  if (!canPay.allowed) {
    return (
      <section className="surface-panel p-6">
        <p className="text-sm text-muted-foreground">无权访问报销付款处理。</p>
      </section>
    );
  }

  return <PaymentQueueClient />;
}
