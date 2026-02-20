import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, ClipboardList, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';

import { formatDateOnly, formatDateTimeLocal } from '@/lib/dates';
import { getInventoryStats } from '@/lib/db/inventory';
import { getRecords, getStats as getFinanceStats } from '@/lib/db/finance';
import { getEmployeeDashboardStats } from '@/lib/hr/employees';
import { getPurchaseStats, listPurchases } from '@/lib/db/purchases';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { USER_ROLE_LABELS } from '@/constants/user-roles';
import { TransactionType } from '@/types/finance';
import { UserRole } from '@/types/user';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('zh-CN');

const EMPLOYMENT_STATUS_META = {
  active: { label: '在职', badge: 'success' as const },
  on_leave: { label: '请假', badge: 'warning' as const },
  terminated: { label: '离职', badge: 'destructive' as const },
};

export const metadata: Metadata = {
  title: '管理后台 - 运营概览',
  description: '根据权限展示采购、库存、财务与人事关键指标。',
};

function formatCurrency(value?: number | null) {
  return currencyFormatter.format(value ?? 0);
}

function formatNumber(value?: number | null) {
  return numberFormatter.format(value ?? 0);
}

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  tone?: 'default' | 'positive' | 'negative' | 'info';
};

function MetricCard({ label, value, helper, icon, tone = 'default' }: MetricCardProps) {
  const toneClass =
    tone === 'positive'
      ? 'text-chart-5'
      : tone === 'negative'
        ? 'text-destructive'
        : tone === 'info'
          ? 'text-chart-2'
          : 'text-foreground';

  return (
    <Card className="shadow-sm border-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className={`text-xl font-semibold ${toneClass}`}>{value}</div>
        {helper ? <p className="mt-1 text-[10px] text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

function DashboardSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function AdminDashboardPage() {
  const { user } = await requireCurrentUser();
  const profile = await toPermissionUser(user);
  const activeRole = profile.primaryRole ?? UserRole.EMPLOYEE;
  const isSuperAdmin = activeRole === UserRole.SUPER_ADMIN;
  const isApprovalAdmin = activeRole === UserRole.FINANCE;
  const isFinanceOperator = activeRole === UserRole.FINANCE_SCHOOL || activeRole === UserRole.FINANCE_COMPANY;
  const isEmployee = activeRole === UserRole.EMPLOYEE;

  const [
    inventoryPermission,
    financePermission,
    hrPermission,
    purchaseCreatePermission,
    purchaseViewAllPermission,
    // purchaseViewDepartmentPermission,
    purchaseApprovePermission,
  ] = await Promise.all([
    checkPermission(profile, Permissions.INVENTORY_VIEW_DASHBOARD),
    checkPermission(profile, Permissions.FINANCE_VIEW_ALL),
    checkPermission(profile, Permissions.USER_VIEW_ALL),
    checkPermission(profile, Permissions.PURCHASE_CREATE),
    checkPermission(profile, Permissions.PURCHASE_VIEW_ALL),
    // checkPermission(profile, Permissions.PURCHASE_VIEW_DEPARTMENT),
    checkPermission(profile, Permissions.PURCHASE_APPROVE),
  ]);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartText = formatDateOnly(monthStart) ?? monthStart.toISOString().slice(0, 10);
  const todayText = formatDateOnly(today) ?? today.toISOString().slice(0, 10);

  const purchasePermissionAllowed =
    (isApprovalAdmin || isEmployee || isSuperAdmin) &&
    (
      purchaseCreatePermission.allowed ||
      purchaseViewAllPermission.allowed ||
      // purchaseViewDepartmentPermission.allowed ||
      purchaseApprovePermission.allowed
    );
  const showFinanceOverview = financePermission.allowed && (isFinanceOperator || isSuperAdmin);
  const showPurchaseOverview = purchasePermissionAllowed && (isApprovalAdmin || isEmployee || isSuperAdmin);
  const showApprovalTodo = purchaseApprovePermission.allowed && (isApprovalAdmin || isSuperAdmin);
  const showOtherOverview = (inventoryPermission.allowed || hrPermission.allowed) && isSuperAdmin;

  const [inventoryStats, financeStats, recentFinanceRecords, hrStats, purchaseStats, pendingPurchases] = await Promise.all([
    inventoryPermission.allowed ? getInventoryStats() : null,
    showFinanceOverview ? getFinanceStats({ startDate: monthStartText, endDate: todayText }) : null,
    showFinanceOverview ? getRecords({ startDate: monthStartText, endDate: todayText, limit: 6, offset: 0 }) : [],
    hrPermission.allowed ? getEmployeeDashboardStats() : null,
    showPurchaseOverview
      ? getPurchaseStats(
          purchaseViewAllPermission.allowed
            ? {}
            : { purchaserId: user.id }
        )
      : null,
    // Pending purchase approvals for current user
    showApprovalTodo
      ? listPurchases({
          status: 'pending_approval',
          pendingApproverId: user.id,
          includeUnassignedApprovals: true,
          pageSize: 5,
        })
      : null,
  ]);

  const hasAnySection = [showFinanceOverview, showPurchaseOverview, showApprovalTodo, showOtherOverview].some(Boolean);

  const greetingName = profile.displayName || profile.email;
  const lastLogin = formatDateTimeLocal(profile.lastLoginAt) ?? '暂无登录记录';

  const now = new Date();
  const hour = now.getHours();
  const greetingText = hour < 5 ? '🌙 凌晨好' : hour < 9 ? '☕️ 早上好' : hour < 12 ? '🌞 上午好' : hour < 18 ? '🌞 下午好' : '🌙 晚上好';

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">运营概览</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{greetingText}，{greetingName}</span>
            <span className="hidden sm:inline">|</span>
            <span>上次登录 {lastLogin}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isFinanceOperator ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/finance">查看财务</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/workflow/todo">财务待办</Link>
              </Button>
            </>
          ) : isApprovalAdmin ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/purchases/approvals">审批处理</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/workflow/todo">审批待办</Link>
              </Button>
            </>
          ) : isSuperAdmin ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/workflow/todo">查看流程</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/purchases">查看采购</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/purchases">我的采购</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/workflow/todo">流程待办</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {!hasAnySection ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>暂未配置仪表盘模块</CardTitle>
            <CardDescription>
              当前账号没有可查看的业务权限，请联系管理员授予库存、财务、人事或客户等模块的访问权限。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-8">
          {showFinanceOverview && (
            <DashboardSection title="财务概览" description="本月收支与最新记录">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="本月收入" value={formatCurrency(financeStats?.totalIncome)} icon={<ArrowUpRight className="h-5 w-5 text-chart-5" />} tone="positive" />
                <MetricCard label="本月支出" value={formatCurrency(financeStats?.totalExpense)} icon={<ArrowDownRight className="h-5 w-5 text-destructive" />} tone="negative" />
                <MetricCard label="本月净额" value={formatCurrency(financeStats?.balance)} icon={<TrendingUp className="h-5 w-5 text-chart-2" />} tone={financeStats && financeStats.balance >= 0 ? 'positive' : 'negative'} />
                <MetricCard label="记录数量" value={formatNumber(financeStats?.recordCount)} icon={<ClipboardList className="h-5 w-5 text-muted-foreground" />} helper="本月流水" />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="border-none shadow-sm lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">最近记录</CardTitle>
                    <CardDescription>显示本月最新 6 笔</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentFinanceRecords.length ? (
                      recentFinanceRecords.map((record) => (
                        <div key={record.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-foreground">{record.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {record.category} · {record.date?.slice(0, 10)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={record.type === TransactionType.INCOME ? 'text-chart-5' : 'text-destructive'}>
                              {record.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(record.totalAmount)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无财务记录。</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">分类 Top 5</CardTitle>
                    <CardDescription>本月金额排序</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {financeStats?.categoryStats?.length ? (
                      financeStats.categoryStats.slice(0, 5).map((category) => (
                        <div key={category.category} className="flex items-center justify-between">
                          <span className="text-foreground">{category.category}</span>
                          <span className="text-muted-foreground">{formatCurrency(category.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无分类统计。</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </DashboardSection>
          )}

          {showPurchaseOverview && (
            <DashboardSection title="采购与流程" description="采购申请与审批进度概览">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="采购总额"
                  value={formatCurrency(purchaseStats?.totalAmount)}
                  helper={`共 ${formatNumber(purchaseStats?.totalPurchases)} 条`}
                  icon={<ClipboardList className="h-5 w-5 text-muted-foreground" />}
                />
                <MetricCard
                  label="待审批金额"
                  value={formatCurrency(purchaseStats?.pendingAmount)}
                  helper={`待审批 ${formatNumber(purchaseStats?.pendingCount)} 条`}
                  icon={<ArrowDownRight className="h-5 w-5 text-chart-3" />}
                  tone="negative"
                />
                <MetricCard
                  label="已入库金额"
                  value={formatCurrency(purchaseStats?.approvedAmount)}
                  helper={`已入库 ${formatNumber(purchaseStats?.approvedCount)} 条`}
                  icon={<ArrowUpRight className="h-5 w-5 text-chart-2" />}
                  tone="info"
                />
                <MetricCard
                  label="历史已完成金额"
                  value={formatCurrency(purchaseStats?.paidAmount)}
                  helper={`历史已完成 ${formatNumber(purchaseStats?.paidCount)} 条`}
                  icon={<TrendingUp className="h-5 w-5 text-chart-5" />}
                  tone="positive"
                />
              </div>
            </DashboardSection>
          )}

          {/* My Approvals Section */}
          {showApprovalTodo && pendingPurchases && pendingPurchases.items.length > 0 && (
            <DashboardSection title="我的待办" description="需要您处理的审批事项">
              <div className="grid gap-4">
                {/* Pending Purchase Approvals */}
                {pendingPurchases && pendingPurchases.items.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-base">采购审批</CardTitle>
                        <CardDescription>共 {pendingPurchases.total} 条待审批</CardDescription>
                      </div>
                      <Clock className="h-5 w-5 text-chart-3" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pendingPurchases.items.map((p) => (
                        <Link key={p.id} href={`/purchases/${p.id}`} className="flex items-center justify-between rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors hover:border-border hover:bg-muted/50">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{p.itemName}</p>
                            <p className="text-xs text-muted-foreground">{p.purchaseNumber} · {p.purchaseDate?.slice(0, 10)}</p>
                          </div>
                          <span className="ml-3 shrink-0 text-sm font-semibold text-chart-3">{formatCurrency(p.totalAmount)}</span>
                        </Link>
                      ))}
                      {pendingPurchases.total > 5 && (
                        <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                          <Link href="/workflow/todo">查看全部 {pendingPurchases.total} 条 →</Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </DashboardSection>
          )}

          {showOtherOverview && (
            <DashboardSection title="其他概览" description="模块精简展示，避免干扰">
              <div className="grid gap-4 md:grid-cols-2">
                {inventoryPermission.allowed && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-base">库存预警</CardTitle>
                        <CardDescription>低于安全库存的物品</CardDescription>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </CardHeader>
                    <CardContent>
                      {inventoryStats?.lowStockItems?.length ? (
                        <div className="space-y-2">
                          {inventoryStats.lowStockItems.slice(0, 5).map((item) => (
                            <div key={item.itemId} className="flex items-center justify-between text-sm">
                              <span className="truncate text-foreground">{item.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-destructive font-semibold">{formatNumber(item.available)}</span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-muted-foreground">{formatNumber(item.safetyStock)}</span>
                              </div>
                            </div>
                          ))}
                          {inventoryStats.lowStockItems.length > 5 && (
                            <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                              <Link href="/inventory">查看全部 {inventoryStats.lowStockItems.length} 个预警 →</Link>
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">所有物品库存充足 ✓</p>
                      )}
                    </CardContent>
                  </Card>
                )}
                {hrPermission.allowed && (
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">员工状态</CardTitle>
                      <CardDescription>在职/休假/离职</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 text-xs">
                      <Badge variant={EMPLOYMENT_STATUS_META.active.badge}>在职 {formatNumber(hrStats?.activeEmployees)}</Badge>
                      <Badge variant={EMPLOYMENT_STATUS_META.on_leave.badge}>休假 {formatNumber(hrStats?.onLeaveEmployees)}</Badge>
                      <Badge variant={EMPLOYMENT_STATUS_META.terminated.badge}>离职 {formatNumber(hrStats?.terminatedEmployees)}</Badge>
                    </CardContent>
                  </Card>
                )}
              </div>
            </DashboardSection>
          )}
        </div>
      )}
    </div>
  );
}
