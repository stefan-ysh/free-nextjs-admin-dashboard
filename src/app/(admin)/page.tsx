import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  ClipboardList,
  TrendingUp,
  Users,
} from 'lucide-react';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import type { UserProfile } from '@/types/user';
import { formatDateTimeLocal } from '@/lib/dates';
import { getInventoryStats } from '@/lib/db/inventory';
import { getStats as getFinanceStats } from '@/lib/db/finance';
import { getProjectStats } from '@/lib/db/projects';
import { getClientStats } from '@/lib/db/clients';
import { getEmployeeDashboardStats } from '@/lib/hr/employees';
import InventoryStatsCards from '@/components/inventory/InventoryStatsCards';
import InventoryLowStockList from '@/components/inventory/InventoryLowStockList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { USER_ROLE_LABELS } from '@/constants/user-roles';

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
  title: '宇元新材管理后台 - 运营概览',
  description: '根据权限展示库存、财务、合同、人事与客户关键指标。',
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
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-600 dark:text-rose-400'
        : tone === 'info'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-900 dark:text-white';

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

  const [inventoryPermission, financePermission, hrPermission, clientPermission, projectPermission] = await Promise.all([
    checkPermission(profile, Permissions.INVENTORY_VIEW_DASHBOARD),
    checkPermission(profile, Permissions.FINANCE_VIEW_ALL),
    checkPermission(profile, Permissions.USER_VIEW_ALL),
    checkPermission(profile, Permissions.CLIENT_VIEW),
    checkPermission(profile, Permissions.PROJECT_VIEW_ALL),
  ]);

  const [inventoryStats, financeStats, hrStats, clientStats, projectStats] = await Promise.all([
    inventoryPermission.allowed ? getInventoryStats() : null,
    financePermission.allowed ? getFinanceStats() : null,
    hrPermission.allowed ? getEmployeeDashboardStats() : null,
    clientPermission.allowed ? getClientStats() : null,
    projectPermission.allowed ? getProjectStats() : null,
  ]);

  const hasAnySection = [
    inventoryPermission.allowed,
    financePermission.allowed,
    hrPermission.allowed,
    clientPermission.allowed,
    projectPermission.allowed,
  ].some(Boolean);

  const greetingName = profile.displayName || profile.firstName || profile.email;
  const primaryRole = profile.primaryRole ? USER_ROLE_LABELS[profile.primaryRole] : '员工';
  const lastLogin = formatDateTimeLocal(profile.lastLoginAt) ?? '暂无登录记录';
  const accessibleModules = (
    [
      inventoryPermission.allowed && '库存',
      financePermission.allowed && '财务',
      hrPermission.allowed && '人事',
      clientPermission.allowed && '客户',
      projectPermission.allowed && '项目',
    ].filter(Boolean) as string[]
  ).join(' / ');
  const quickFacts = [
    { label: '当前主角色', value: primaryRole },
    { label: '上次登录', value: lastLogin },
    { label: '可访问模块', value: accessibleModules || '基础权限' },
  ];

  return (
    <div className="space-y-10 p-6">
      <Card className="bg-gradient-to-br from-indigo-50 via-white to-white/40 dark:from-indigo-950/40 dark:via-gray-900 dark:to-gray-900/40 border-none">
        <CardHeader className="space-y-2 pb-0">
          <CardTitle className="text-3xl font-semibold text-foreground">
            你好，{greetingName}！
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0 mt-5">
          <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {quickFacts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur transition hover:border-indigo-200 dark:border-white/10 dark:bg-slate-900/40"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{fact.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{fact.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
        <div className="space-y-12">
          {inventoryPermission.allowed && (
            <DashboardSection title="进销存总览" description="实时统计 SKU、仓库与今日出入库情况">
              <div className="space-y-4">
                <InventoryStatsCards stats={inventoryStats} />
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <InventoryLowStockList items={inventoryStats?.lowStockItems ?? []} />
                  </div>
                  <Card className="hidden lg:block border-none">
                    <CardHeader>
                      <CardTitle className="text-base">任务贴士</CardTitle>
                      <CardDescription>根据库存提醒安排补货或调拨。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <p>· 低于安全线的 SKU 优先补货，标记责任仓库。</p>
                      <p>· 今日出入库摘要可帮助排查异常调拨。</p>
                      <p>· 查看左侧菜单可进入商品、仓库与流水详情。</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </DashboardSection>
          )}

          {financePermission.allowed && (
            <DashboardSection title="财务概览" description="汇总收入、支出与分类贡献">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="总收入" value={formatCurrency(financeStats?.totalIncome)} icon={<ArrowUpRight className="h-5 w-5 text-emerald-500" />} tone="positive" />
                <MetricCard label="总支出" value={formatCurrency(financeStats?.totalExpense)} icon={<ArrowDownRight className="h-5 w-5 text-rose-500" />} tone="negative" />
                <MetricCard label="净收支" value={formatCurrency(financeStats?.balance)} icon={<TrendingUp className="h-5 w-5 text-blue-500" />} tone={financeStats && financeStats.balance >= 0 ? 'positive' : 'negative'} />
                <MetricCard label="记录数量" value={formatNumber(financeStats?.recordCount)} icon={<ClipboardList className="h-5 w-5 text-purple-500" />} helper="财务流水条目" />
              </div>
              {financeStats?.categoryStats?.length ? (
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">分类排名（前 5）</CardTitle>
                    <CardDescription>按金额排序的主要收入/支出分类。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {financeStats.categoryStats.slice(0, 5).map((category) => (
                      <div key={category.category} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-foreground">{category.category}</p>
                          <p className="text-xs text-muted-foreground">贡献 {category.percentage.toFixed(1)}%</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(category.amount)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </DashboardSection>
          )}

          {projectPermission.allowed && (
            <DashboardSection title="合同与项目" description="项目执行进度与成本结构">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="项目总数" value={formatNumber(projectStats?.totalProjects)} icon={<Briefcase className="h-5 w-5 text-slate-500" />} />
                <MetricCard label="进行中" value={formatNumber(projectStats?.activeProjects)} helper="Active" tone="info" />
                <MetricCard label="已完成" value={formatNumber(projectStats?.completedProjects)} helper="Completed" tone="positive" />
                <MetricCard label="预算总额" value={formatCurrency(projectStats?.totalBudget)} helper="含全部项目" />
                <MetricCard label="实际成本" value={formatCurrency(projectStats?.totalActualCost)} helper="累计成本" />
                <MetricCard label="成本使用率" value={`${projectStats ? projectStats.costUtilization.toFixed(1) : '0.0'}%`} helper="Actual / Budget" tone="info" />
              </div>
            </DashboardSection>
          )}

          {clientPermission.allowed && (
            <DashboardSection title="客户与信用" description="客户状态、授信与占款情况">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="客户总数" value={formatNumber(clientStats?.totalClients)} icon={<Users className="h-5 w-5 text-slate-500" />} />
                <MetricCard label="活跃客户" value={formatNumber(clientStats?.activeClients)} helper="Active" tone="positive" />
                <MetricCard label="近期新增" value={formatNumber(clientStats?.newClients30d)} helper="近 30 天" tone="info" />
                <MetricCard label="待回款" value={formatCurrency(clientStats?.outstanding)} helper="Outstanding" tone="negative" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className='border-none'>
                  <CardHeader>
                    <CardTitle className="text-base">授信额度</CardTitle>
                    <CardDescription>当前所有客户授信总额。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold text-foreground">{formatCurrency(clientStats?.totalCredit)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">包含公司与个人客户</p>
                  </CardContent>
                </Card>
                <Card className='border-none'>
                  <CardHeader>
                    <CardTitle className="text-base">占款排名</CardTitle>
                    <CardDescription>Outstanding Top 5</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {clientStats?.topOutstandingClients?.length ? (
                      clientStats.topOutstandingClients.slice(0, 5).map((client) => (
                        <div key={client.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-foreground">{client.displayName}</p>
                            <p className="text-xs text-muted-foreground">状态：{client.status}</p>
                          </div>
                          <p className="font-semibold text-rose-500">{formatCurrency(client.outstandingAmount)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无待回款客户。</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </DashboardSection>
          )}

          {hrPermission.allowed && (
            <DashboardSection title="人员动态" description="员工状态与近 30 天变动">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="员工总数" value={formatNumber(hrStats?.totalEmployees)} icon={<Users className="h-5 w-5 text-slate-500" />} />
                <MetricCard label="在职" value={formatNumber(hrStats?.activeEmployees)} helper="Active" tone="positive" />
                <MetricCard label="近 30 天入职" value={formatNumber(hrStats?.newHires30d)} helper="New hires" tone="info" />
                <MetricCard label="近 30 天离职" value={formatNumber(hrStats?.departures30d)} helper="Departures" tone="negative" />
              </div>
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">最新状态变更</CardTitle>
                  <CardDescription>最多展示 6 条记录。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hrStats?.recentChanges?.length ? (
                    hrStats.recentChanges.map((change) => {
                      const previous = EMPLOYMENT_STATUS_META[change.previousStatus];
                      const next = EMPLOYMENT_STATUS_META[change.nextStatus];
                      return (
                        <div key={change.id} className="rounded-lg border border-border p-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-foreground">{change.employeeName}</p>
                              <p className="text-xs text-muted-foreground">{change.department ?? '未分配部门'}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDateTimeLocal(change.createdAt)}</p>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant={previous?.badge ?? 'outline'}>{previous?.label ?? change.previousStatus}</Badge>
                            <span className="text-xs text-muted-foreground">→</span>
                            <Badge variant={next?.badge ?? 'outline'}>{next?.label ?? change.nextStatus}</Badge>
                          </div>
                          {change.note ? <p className="mt-2 text-xs text-muted-foreground">备注：{change.note}</p> : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">近期没有状态变更。</p>
                  )}
                </CardContent>
              </Card>
            </DashboardSection>
          )}
        </div>
      )}
    </div>
  );
}
