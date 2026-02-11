'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DataState from '@/components/common/DataState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PurchaseWorkflowConfig } from '@/types/purchase-workflow';

type ApproverCandidate = {
  id: string;
  name: string;
  primaryRole: string | null;
  roles: string[];
};

type WorkflowResponse = {
  success: boolean;
  data?: {
    config: PurchaseWorkflowConfig;
    approvers: ApproverCandidate[];
  };
  error?: string;
};

export default function PurchaseWorkflowList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<PurchaseWorkflowConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/purchases/workflow', { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as WorkflowResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '加载流程列表失败');
      }
      setConfig(payload.data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载流程列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <DataState variant="loading" title="加载中" description="正在读取流程列表" className="min-h-[220px]" />;
  }

  if (error) {
    return (
      <DataState
        variant="error"
        title="流程列表加载失败"
        description={error}
        className="min-h-[220px]"
        action={<Button onClick={() => void load()}>重试</Button>}
      />
    );
  }

  if (!config) {
    return <DataState variant="empty" title="暂无流程" description="请先创建流程" className="min-h-[220px]" />;
  }

  return (
    <div className="space-y-4">
      <div className="surface-toolbar flex items-center justify-between p-4 sm:p-5">
        <div>
          <h1 className="text-lg font-semibold">流程列表</h1>
          <p className="mt-1 text-sm text-muted-foreground">在此查看流程，点击编辑进入独立设计页面。</p>
        </div>
        <Button asChild>
          <Link href="/workflow-designer">编辑流程</Link>
        </Button>
      </div>

      <div className="surface-card overflow-hidden border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>流程名称</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>节点数</TableHead>
              <TableHead>最后更新</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">{config.name}</TableCell>
              <TableCell>
                <Badge variant={config.enabled ? 'success' : 'secondary'}>
                  {config.enabled ? '已启用' : '已停用'}
                </Badge>
              </TableCell>
              <TableCell>{config.nodes.length}</TableCell>
              <TableCell>{new Date(config.updatedAt).toLocaleString('zh-CN')}</TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="outline">
                  <Link href="/workflow-designer">编辑</Link>
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
