'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DataState from '@/components/common/DataState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTimeLocal } from '@/lib/dates';
import type { InventoryTransferDetail, InventoryTransferOrder } from '@/types/inventory';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function InventoryTransfersPage() {
  const [records, setRecords] = useState<InventoryTransferOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<InventoryTransferDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inventory/transfers');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '加载失败');
      }
      setRecords(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(records.length / pageSize)), [records.length, pageSize]);
  const visibleRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, page, pageSize]);

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPage((prev) => (direction === 'prev' ? Math.max(1, prev - 1) : Math.min(totalPages, prev + 1)));
  };

  const handleView = async (transferId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/inventory/transfers/${transferId}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '加载失败');
      }
      setDetail(payload.data ?? null);
    } catch (err) {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="surface-card flex-1 min-h-0 flex flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">调拨单</div>
            <p className="text-xs text-muted-foreground">按调拨单号查看双向流水与仓库对账。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchTransfers} variant="outline" size="sm" className="h-9 px-4">
              刷新
            </Button>
          </div>
        </div>

        <div className="surface-table flex-1 min-h-0">
          <Table
            stickyHeader
            scrollAreaClassName="max-h-[calc(100vh-220px)] custom-scrollbar"
            className="min-w-[960px] text-sm text-muted-foreground"
          >
            <TableHeader>
              <TableRow className="bg-muted/60 text-xs uppercase tracking-wide">
                <TableHead className="px-4 py-3">调拨单号</TableHead>
                <TableHead className="px-4 py-3">商品</TableHead>
                <TableHead className="px-4 py-3">来源仓库</TableHead>
                <TableHead className="px-4 py-3">目标仓库</TableHead>
                <TableHead className="px-4 py-3 text-right">数量</TableHead>
                <TableHead className="px-4 py-3">发生时间</TableHead>
                <TableHead className="px-4 py-3 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`loading-${idx}`} className="animate-pulse bg-muted/40">
                    {Array.from({ length: 7 }).map((__, cellIdx) => (
                      <TableCell key={cellIdx} className="px-4 py-3">
                        <span className="inline-block h-4 w-full rounded bg-muted/80" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-8">
                    <DataState variant="error" title="加载失败" description={error} />
                  </TableCell>
                </TableRow>
              ) : visibleRecords.length ? (
                visibleRecords.map((record) => (
                  <TableRow key={record.transferId} className="border-b border-border/40 hover:bg-muted/40">
                    <TableCell className="px-4 py-4 font-mono text-xs text-muted-foreground">
                      {record.transferId}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-foreground">
                      {record.itemName ?? '—'} {record.itemSku ? `(${record.itemSku})` : ''}
                    </TableCell>
                    <TableCell className="px-4 py-4">{record.sourceWarehouseName ?? '—'}</TableCell>
                    <TableCell className="px-4 py-4">{record.targetWarehouseName ?? '—'}</TableCell>
                    <TableCell className="px-4 py-4 text-right">{record.quantity}</TableCell>
                    <TableCell className="px-4 py-4">
                      {formatDateTimeLocal(record.occurredAt) ?? record.occurredAt}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => handleView(record.transferId)}>
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-8">
                    <DataState variant="empty" title="暂无调拨单" description="当前没有可查看的调拨记录。" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t border-transparent px-2 py-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>共 {records.length} 条 • 第 {page} / {totalPages} 页</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="每页数量" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    每页 {size} 条
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handlePageChange('prev')} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" /> 上一页
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePageChange('next')} disabled={page >= totalPages}>
                下一页 <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Drawer open={detailOpen} onOpenChange={setDetailOpen} direction="right">
        <DrawerContent side="right" className="w-full sm:max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>调拨详情</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            {detailLoading ? (
              <div className="py-6 text-sm text-muted-foreground">正在加载详情...</div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  调拨单号：<span className="font-mono text-foreground">{detail.transferId}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background/70 px-4 py-3 text-sm">
                    <div className="text-xs text-muted-foreground">来源仓库</div>
                    <div className="mt-1 text-foreground">{detail.sourceWarehouseName ?? '—'}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 px-4 py-3 text-sm">
                    <div className="text-xs text-muted-foreground">目标仓库</div>
                    <div className="mt-1 text-foreground">{detail.targetWarehouseName ?? '—'}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 px-4 py-3 text-sm">
                    <div className="text-xs text-muted-foreground">商品</div>
                    <div className="mt-1 text-foreground">
                      {detail.itemName ?? '—'} {detail.itemSku ? `(${detail.itemSku})` : ''}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 px-4 py-3 text-sm">
                    <div className="text-xs text-muted-foreground">数量</div>
                    <div className="mt-1 text-foreground">{detail.quantity}</div>
                  </div>
                </div>
                <div className="surface-table">
                  <Table className="text-sm text-muted-foreground">
                    <TableHeader>
                      <TableRow className="bg-muted/60 text-xs uppercase tracking-wide">
                        <TableHead className="px-4 py-3">方向</TableHead>
                        <TableHead className="px-4 py-3">仓库</TableHead>
                        <TableHead className="px-4 py-3 text-right">数量</TableHead>
                        <TableHead className="px-4 py-3">时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.movements.map((movement) => (
                        <TableRow key={movement.id} className="border-b border-border/40">
                          <TableCell className="px-4 py-3">
                            {movement.direction === 'outbound' ? '调出' : '调入'}
                          </TableCell>
                          <TableCell className="px-4 py-3">{movement.warehouseName ?? '—'}</TableCell>
                          <TableCell className="px-4 py-3 text-right">{movement.quantity}</TableCell>
                          <TableCell className="px-4 py-3">
                            {formatDateTimeLocal(movement.occurredAt) ?? movement.occurredAt}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <DataState variant="empty" title="暂无详情" description="未找到该调拨单详情。" />
            )}
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">关闭</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
