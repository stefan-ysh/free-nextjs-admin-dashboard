import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import MobileTaskDetailClient from '@/components/mobile-workflow/MobileTaskDetailClient';

export default async function MobileTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireCurrentUser();
  const permissionUser = await toPermissionUser(context.user);

  const [canApprove, canReject, canPay] = await Promise.all([
    checkPermission(permissionUser, Permissions.PURCHASE_APPROVE),
    checkPermission(permissionUser, Permissions.PURCHASE_REJECT),
    checkPermission(permissionUser, Permissions.PURCHASE_PAY),
  ]);

  return (
    <MobileTaskDetailClient
      purchaseId={id}
      currentUserId={context.user.id}
      canApprove={canApprove.allowed}
      canReject={canReject.allowed}
      canPay={canPay.allowed}
    />
  );
}
