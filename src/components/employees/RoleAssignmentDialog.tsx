'use client';

import { useEffect, useMemo, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import ModalShell from '@/components/common/ModalShell';
import type { Employee } from './types';
import type { UserRole } from '@/types/user';
import { ASSIGNABLE_USER_ROLES, USER_ROLE_OPTIONS } from '@/constants/user-roles';
import { cn } from '@/lib/utils';

const ROLE_CAPABILITIES: Partial<Record<UserRole, { menus: string; actions: string }>> = {
  super_admin: {
    menus: '全部模块',
    actions: '全局只读、人员管理、配置',
  },
  approver: {
    menus: '工作台、采购中心',
    actions: '采购审批、转审、驳回、用户管理',
  },
  finance_director: {
    menus: '工作台、财务中心、采购中心、库存管理',
    actions: '报销审批与打款（学校+单位）、收支管理、库存操作',
  },
  finance_school: {
    menus: '工作台、财务中心、采购中心、库存管理',
    actions: '学校组织报销审批与打款、收支管理、库存操作',
  },
  finance_company: {
    menus: '工作台、财务中心、采购中心、库存管理',
    actions: '单位组织报销审批与打款、收支管理、库存操作',
  },
  employee: {
    menus: '工作台、采购中心、个人中心',
    actions: '发起采购、发起报销、查看进度',
  },
};

export type RoleAssignmentPayload = {
  roles: UserRole[];
  primaryRole: UserRole;
};

type RoleAssignmentDialogProps = {
  open: boolean;
  employee: Employee | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: RoleAssignmentPayload) => Promise<void> | void;
};

export default function RoleAssignmentDialog({
  open,
  employee,
  saving = false,
  onOpenChange,
  onSubmit,
}: RoleAssignmentDialogProps) {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<UserRole | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedRoles([]);
      setPrimaryRole(null);
      setLocalError(null);
      return;
    }
    if (!employee) {
      setSelectedRoles([]);
      setPrimaryRole(null);
      setLocalError(null);
      return;
    }
    const roleSet = new Set<UserRole>(ASSIGNABLE_USER_ROLES);
    const roles = (Array.isArray(employee.userRoles) ? employee.userRoles : []).filter((role) => roleSet.has(role));
    setSelectedRoles(roles);
    const nextPrimary = employee.userPrimaryRole && roleSet.has(employee.userPrimaryRole) ? employee.userPrimaryRole : null;
    setPrimaryRole(nextPrimary ?? roles[0] ?? null);
    setLocalError(null);
  }, [open, employee]);

  const canSubmit = Boolean(employee?.userId && selectedRoles.length > 0);

  const handleToggleRole = (role: UserRole, checked: boolean) => {
    setLocalError(null);
    setSelectedRoles((prev) => {
      if (checked) {
        if (prev.includes(role)) {
          return prev;
        }
        return [...prev, role];
      }
      const next = prev.filter((item) => item !== role);
      if (primaryRole && primaryRole === role) {
        setPrimaryRole(next[0] ?? null);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!employee?.userId) {
      setLocalError('该员工尚未绑定系统登录账号，无法设置角色');
      return;
    }
    if (selectedRoles.length === 0) {
      setLocalError('至少选择一个角色');
      return;
    }
    const resolvedPrimary = primaryRole && selectedRoles.includes(primaryRole) ? primaryRole : selectedRoles[0];
    onSubmit({ roles: selectedRoles, primaryRole: resolvedPrimary });
  };

  const roleCards = useMemo(
    () =>
      USER_ROLE_OPTIONS.map((option) => {
        const checked = selectedRoles.includes(option.value);
        const isPrimary = checked && primaryRole === option.value;
        const controlId = `role-${option.value}`;
        return (
          <div
            key={option.value}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              checked ? 'border-primary/60 bg-primary/5' : 'border-border/80 bg-card'
            )}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                id={controlId}
                checked={checked}
                onCheckedChange={(value) => handleToggleRole(option.value, Boolean(value))}
                aria-describedby={`${controlId}-desc`}
              />
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor={controlId} className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {option.label}
                  {isPrimary && <Badge variant="default" className="text-[10px]">主角色</Badge>}
                </label>
                <p id={`${controlId}-desc`} className="text-xs text-muted-foreground">
                  {option.description}
                </p>
                {ROLE_CAPABILITIES[option.value] ? (
                  <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                    <p>菜单：{ROLE_CAPABILITIES[option.value]?.menus}</p>
                    <p>动作：{ROLE_CAPABILITIES[option.value]?.actions}</p>
                  </div>
                ) : null}
                {checked && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant={isPrimary ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setPrimaryRole(option.value);
                        setLocalError(null);
                      }}
                    >
                      {isPrimary ? '当前主角色' : '设为主角色'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }),
    [primaryRole, selectedRoles]
  );

  const employeeName = employee?.displayName || employee?.email || employee?.employeeCode || '未命名';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <ModalShell
          title="设置角色"
          description={
            employee
              ? `为 ${employeeName} 指定可以访问的系统角色，并选择主角色决定登录后的默认权限。`
              : '请选择员工后再设置角色。'
          }
          className="max-h-[85vh]"
          bodyClassName="space-y-4"
          footer={
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit || saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存角色
              </Button>
            </DialogFooter>
          }
        >
          {!employee?.userId && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100">
              该员工尚未绑定系统登录账号，请先在「员工详情」中完成账号同步后再分配角色。
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {roleCards}
          </div>
          {localError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {localError}
            </div>
          )}
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
