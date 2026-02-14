'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Check, X, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { InventoryApplication } from '@/types/inventory';

interface ApplicationListProps {
  applications: InventoryApplication[];
  loading: boolean;
  isApprover?: boolean;
  onRefresh: () => void;
}

export function ApplicationList({ applications, loading, isApprover, onRefresh }: ApplicationListProps) {
  const [selectedApp, setSelectedApp] = useState<InventoryApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const handleApprove = async (app: InventoryApplication) => {
    if (!confirm(`确认批准申请单 ${app.number} 吗？批准后将自动扣减库存。`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/inventory/applications/${app.id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '操作失败');
      }
      toast.success('已批准');
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/inventory/applications/${selectedApp.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '操作失败');
      }
      toast.success('已拒绝');
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedApp(null);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">已批准</Badge>;
      case 'rejected':
        return <Badge variant="destructive">已拒绝</Badge>;
      default:
        return <Badge variant="secondary">待审批</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'transfer': return '调拨';
      default: return '自用';
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <FileText className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">暂无申请记录</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 rounded-md border">
      <Table stickyHeader scrollAreaClassName="max-h-[calc(100vh-250px)] custom-scrollbar">
        <TableHeader>
          <TableRow>
            <TableHead>单号</TableHead>
            <TableHead>申请人</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>物品明细</TableHead>
            <TableHead>仓库</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>申请时间</TableHead>
            {isApprover && <TableHead className="text-right">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-mono text-xs">{app.number}</TableCell>
              <TableCell>
                <div>{app.applicantName}</div>
                {app.department && <div className="text-xs text-muted-foreground">{app.department}</div>}
              </TableCell>
              <TableCell>{getTypeLabel(app.type)}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  {app.items.map((item) => (
                    <div key={item.id} className="text-sm">
                      {item.itemName} <span className="text-muted-foreground">x {item.quantity} {item.unit}</span>
                    </div>
                  ))}
                  {app.items.length > 2 && <div className="text-xs text-muted-foreground">...共 {app.items.length} 项</div>}
                </div>
              </TableCell>
              <TableCell>{app.warehouseName}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {getStatusBadge(app.status)}
                  {app.status === 'rejected' && app.rejectionReason && (
                     <span className="text-xs text-destructive" title={app.rejectionReason}>原因: {app.rejectionReason}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(app.createdAt), 'yyyy-MM-dd HH:mm')}
              </TableCell>
              {isApprover && (
                <TableCell className="text-right">
                  {app.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleApprove(app)}
                        disabled={actionLoading}
                        title="批准"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setSelectedApp(app);
                          setRejectDialogOpen(true);
                        }}
                        disabled={actionLoading}
                        title="拒绝"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {app.status === 'approved' && (
                    <div className="text-xs text-green-600">
                      已由 {app.approverName} 批准
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝申请 {selectedApp?.number}</DialogTitle>
            <DialogDescription>
              请输入拒绝原因，申请人将收到通知。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="例如：库存不足，或申请理由不充分..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || actionLoading}>
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
