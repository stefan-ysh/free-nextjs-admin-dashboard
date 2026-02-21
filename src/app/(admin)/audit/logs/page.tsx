'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Pagination from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeLocal } from '@/lib/dates';
import { usePermissions } from '@/hooks/usePermissions';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'QUERY' | 'EXPORT' | 'IMPORT' | 'APPROVE' | 'REJECT' | 'REVOKE' | 'SUBMIT' | 'PAY';
type AuditEntityType = 
  | 'PURCHASE'
  | 'INVENTORY_ITEM'
  | 'INVENTORY_MOVEMENT'
  | 'FINANCE_RECORD'
  | 'BUDGET_ADJUSTMENT'
  | 'REIMBURSEMENT'
  | 'EMPLOYEE'
  | 'VENDOR'
  | 'WAREHOUSE'
  | 'AUTH'
  | 'SYSTEM'
  | 'REPORT';

interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const entityTypeLabels: Record<AuditEntityType, string> = {
  PURCHASE: '采购单',
  INVENTORY_ITEM: '库存商品',
  INVENTORY_MOVEMENT: '库存流水',
  FINANCE_RECORD: '财务记录',
  BUDGET_ADJUSTMENT: '预算调整',
  REIMBURSEMENT: '报销',
  EMPLOYEE: '员工',
  VENDOR: '供应商',
  WAREHOUSE: '仓库',
  AUTH: '认证',
  SYSTEM: '系统',
  REPORT: '报表',
};

const actionLabels: Record<AuditAction, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  DELETE: '删除',
  LOGIN: '登录',
  LOGOUT: '登出',
  QUERY: '查询',
  EXPORT: '导出',
  IMPORT: '导入',
  APPROVE: '审批通过',
  REJECT: '驳回',
  REVOKE: '撤回',
  SUBMIT: '提交',
  PAY: '支付',
};

function formatAuditDescription(log: AuditLogEntry): string {
  if (log.description) return log.description;

  const entityTypeLabels: Record<string, string> = {
    PURCHASE: '采购单',
    INVENTORY_ITEM: '库存商品',
    INVENTORY_MOVEMENT: '库存流水',
    FINANCE_RECORD: '财务记录',
    BUDGET_ADJUSTMENT: '预算调整',
    REIMBURSEMENT: '报销',
    EMPLOYEE: '员工',
    VENDOR: '供应商',
    WAREHOUSE: '仓库',
    AUTH: '认证',
    SYSTEM: '系统',
    REPORT: '报表',
  };

  const actionLabels: Record<string, string> = {
    CREATE: '新增',
    UPDATE: '修改',
    DELETE: '删除',
    LOGIN: '登录',
    LOGOUT: '登出',
    SUBMIT: '提交',
    APPROVE: '审批通过',
    REJECT: '驳回',
    REVOKE: '撤回',
    PAY: '支付',
    QUERY: '查询',
  };

  const fieldLabels: Record<string, string> = {
    // 基础信息
    gender: '性别',
    displayName: '显示名称',
    display_name: '显示名称',
    email: '邮箱',
    phone: '手机号',
    address: '地址',
    location: '位置',
    hireDate: '入职日期',
    hire_date: '入职日期',
    terminationDate: '离职日期',
    termination_date: '离职日期',
    employmentStatus: '在职状态',
    employment_status: '在职状态',
    
    // 权限与系统
    role: '角色',
    primaryRole: '主角色',
    primary_role: '主角色',
    is_active: '是否启用',
    is_super_admin: '是否超级管理员',
    password_hash: '密码哈希',
    initialPassword: '初始密码',
    statusChangeNote: '状态变更备注',
    roles: '角色列表',
    
    // 库存
    name: '名称',
    sku: 'SKU',
    category: '类别',
    unit: '单位',
    safetyStock: '安全库存储备',
    quantity: '数量',
    specification: '规格',
    
    // 财务与采购
    status: '状态',
    totalAmount: '总金额',
    total_amount: '总金额',
    total_price: '总价',
    unitPrice: '单价',
    unit_price: '单价',
    feeAmount: '费用金额',
    fee_amount: '费用金额',
    itemName: '项目名称',
    item_name: '项目名称',
    reason: '原因',
    comment: '备注',
    notes: '备注',
    note: '备注',
    attachments: '附件',
    invoiceImages: '发票图片',
    receiptImages: '回执图片',
    vendorId: '供应商',
    vendor_id: '供应商',
    departmentId: '部门',
    department_id: '部门',
    applier_id: '申请人',
  };

  const valueLabels: Record<string, string> = {
    super_admin: '超级管理员',
    admin: '管理员',
    user: '普通用户',
    purchaser: '采购员',
    warehouse_manager: '仓库管理员',
    finance: '财务人员',
    finance_company: '财务负责人',
    hr: '人事人员',
    active: '在职',
    terminated: '离职',
    on_leave: '请假',
    draft: '草稿',
    pending_approval: '待审批',
    approved: '已通过',
    rejected: '已驳回',
    revoked: '已撤回',
    withdrawn: '已撤销',
    paid: '已支付',
    processing: '处理中',
    completed: '已完成',
    male: '男',
    female: '女',
    other: '其他',
    unknown: '未知',
    'true': '是',
    'false': '否'
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '无';
    if (typeof val === 'boolean') return val ? '是' : '否';
    if (Array.isArray(val)) {
      return val.map(v => valueLabels[String(v)] || String(v)).join(', ');
    }
    if (typeof val === 'object') return JSON.stringify(val);
    const strVal = String(val);
    return valueLabels[strVal] || strVal;
  };

  const entityName = log.entityName || log.entityId;
  const entityType = entityTypeLabels[log.entityType] || log.entityType;
  const action = actionLabels[log.action] || log.action;

  if (log.action === 'LOGIN') return '登录了系统';
  if (log.action === 'LOGOUT') return '登出了系统';
  
  if (log.action === 'QUERY' && log.newValues) {
    const params = log.newValues;
    const details = [];
    if (params.page) details.push(`第 ${params.page} 页`);
    if (params.pageSize) details.push(`每页 ${params.pageSize} 条`);
    if (params.search) details.push(`搜索关键词: "${params.search}"`);
    if (params.status && params.status !== 'all') details.push(`状态: ${valueLabels[params.status as string] || params.status}`);
    
    const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';
    return `查询了 ${entityType} 列表${detailsStr}`;
  }

  if (log.oldValues && log.newValues) {
    const changes: string[] = [];
    const isNullish = (v: unknown) => v === null || v === undefined || v === '';

    for (const key in log.newValues) {
      if (key === 'updated_at' || key === 'updatedAt') continue;

      const oldValRaw = log.oldValues[key];
      const newValRaw = log.newValues[key];
      
      if (isNullish(oldValRaw) && isNullish(newValRaw)) continue;

      const oldValFormatted = formatValue(oldValRaw);
      const newValFormatted = formatValue(newValRaw);

      if (oldValFormatted !== newValFormatted) {
        const label = fieldLabels[key] || key;
        changes.push(`将「${label}」由「${oldValFormatted}」修改为「${newValFormatted}」`);
      }
    }
    if (changes.length > 0) {
      return `${action}了 ${entityType} [${entityName}]：\n${changes.join('\n')}`;
    }
  }

  return `${action}${entityType} [${entityName}]`;
}

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { hasPermission, loading: permissionLoading } = usePermissions();
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const initialAction = searchParams.get('action') || 'all';
  const initialEntityType = searchParams.get('entityType') || 'all';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';
  
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [actionFilter, setActionFilter] = useState(initialAction);
  const [entityTypeFilter, setEntityTypeFilter] = useState(initialEntityType);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const canAccess = hasPermission('USER_VIEW_ALL');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (entityTypeFilter !== 'all') params.set('entityType', entityTypeFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      
      const res = await fetch(`/api/audit/logs?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.items);
        setTotal(data.data.total);
      } else {
        toast.error(data.error || '加载失败');
      }
    } catch (error) {
      console.error('Failed to load audit logs', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, entityTypeFilter, startDate, endDate]);

  useEffect(() => {
    if (!canAccess) return;
    fetchLogs();
  }, [canAccess, fetchLogs]);

  const syncUrl = useCallback((newPage: number, newPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    if (newPageSize !== 20) {
      params.set('pageSize', newPageSize.toString());
    } else {
      params.delete('pageSize');
    }
    router.replace(`/audit/logs?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    syncUrl(newPage, pageSize);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    syncUrl(1, newPageSize);
  };

  const handleFilterChange = () => {
    setPage(1);
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', pageSize.toString());
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (entityTypeFilter !== 'all') params.set('entityType', entityTypeFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    router.replace(`/audit/logs?${params.toString()}`, { scroll: false });
  };

  if (permissionLoading) {
    return <div className="p-4">正在校验权限...</div>;
  }

  if (!canAccess) {
    return <div className="p-4 text-red-500">无权访问</div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="surface-card p-4">
        <h1 className="text-lg font-semibold mb-4">操作日志</h1>
        
        <div className="flex flex-wrap gap-4">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="操作类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="CREATE">新增</SelectItem>
              <SelectItem value="UPDATE">修改</SelectItem>
              <SelectItem value="DELETE">删除</SelectItem>
              <SelectItem value="SUBMIT">提交</SelectItem>
              <SelectItem value="APPROVE">审批</SelectItem>
              <SelectItem value="REJECT">驳回</SelectItem>
              <SelectItem value="REVOKE">撤回</SelectItem>
              <SelectItem value="LOGIN">登录</SelectItem>
              <SelectItem value="LOGOUT">登出</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="业务类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {Object.entries(entityTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="w-[150px]"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="开始日期"
          />
          <Input
            type="date"
            className="w-[150px]"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="结束日期"
          />
          <Button variant="outline" size="sm" onClick={handleFilterChange}>查询</Button>
        </div>
      </div>

      <div className="surface-card p-4 flex-1 min-h-0 flex flex-col">
        <div className="mb-3 flex items-center justify-between shrink-0">
          <span className="text-sm text-muted-foreground">共 {total} 条记录</span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/60">
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>详情</TableHead>
                <TableHead className="w-[120px]">业务类型</TableHead>
                <TableHead className="w-[120px]">IP</TableHead>
                <TableHead className="w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    暂无记录
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeLocal(log.createdAt) ?? log.createdAt}
                    </TableCell>
                    <TableCell>{log.userName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            ['CREATE', 'SUBMIT', 'LOGIN'].includes(log.action) ? 'default' : 
                            ['DELETE', 'REJECT', 'REVOKE'].includes(log.action) ? 'destructive' : 
                            'secondary'
                          }>
                            {actionLabels[log.action] || log.action}
                          </Badge>
                          <span className="font-medium whitespace-pre-wrap">{formatAuditDescription(log)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entityTypeLabels[log.entityType] || log.entityType}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {log.ipAddress || '-'}
                    </TableCell>
                    <TableCell>
                      {log.entityId !== 'LIST' && (log.entityType === 'PURCHASE' || log.entityType === 'REIMBURSEMENT') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-chart-4 hover:text-chart-4 hover:bg-chart-4/10 px-2"
                          onClick={() => {
                            if (log.entityType === 'PURCHASE') {
                              router.push(`/purchases?focus=${log.entityId}&scope=all`);
                            } else if (log.entityType === 'REIMBURSEMENT') {
                              router.push(`/reimbursements?focus=${log.entityId}&scope=all`);
                            }
                          }}
                        >
                          查看单据
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 shrink-0">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
