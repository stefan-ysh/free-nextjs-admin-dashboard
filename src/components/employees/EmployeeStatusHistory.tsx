"use client";

import { useEffect, useMemo, useState } from 'react';
import { History, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EMPLOYMENT_STATUS_LABELS, EmployeeStatusLog, EmployeeStatusLogResponse } from './types';
import { formatDateTimeLocal } from '@/lib/dates';

const STATUS_BADGE_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  on_leave: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
  terminated: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
};

function formatTimestamp(value: string) {
  return formatDateTimeLocal(value) ?? value;
}

type EmployeeStatusHistoryProps = {
  employeeId?: string | null;
  refreshSignal?: number;
};

export default function EmployeeStatusHistory({ employeeId, refreshSignal = 0 }: EmployeeStatusHistoryProps) {
  const [logs, setLogs] = useState<EmployeeStatusLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const hasData = logs.length > 0;

  useEffect(() => {
    if (!employeeId) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    async function fetchLogs() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/employees/${employeeId}/status-logs?limit=25`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error('获取状态记录失败');
        }
        const payload: EmployeeStatusLogResponse = await response.json();
        if (!payload.success || !Array.isArray(payload.data)) {
          throw new Error(payload.error || '获取状态记录失败');
        }
        if (!cancelled) {
          setLogs(payload.data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('加载状态变更记录失败', err);
          setError(err instanceof Error ? err.message : '未知错误');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [employeeId, refreshIndex, refreshSignal]);

  const handleRefresh = () => {
    if (!employeeId) return;
    setRefreshIndex((index) => index + 1);
  };

  const timeline = useMemo(() => {
    return logs.map((log) => ({
      id: log.id,
      timestamp: formatTimestamp(log.createdAt),
      previousLabel: EMPLOYMENT_STATUS_LABELS[log.previousStatus],
      nextLabel: EMPLOYMENT_STATUS_LABELS[log.nextStatus],
      nextStatus: log.nextStatus,
      note: log.note,
    }));
  }, [logs]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <History className="h-4 w-4 text-muted-foreground" />
          状态变更记录
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={handleRefresh}
          disabled={loading || !employeeId}
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </Button>
      </div>

      {!employeeId && <p className="text-xs text-muted-foreground">保存后将记录状态变更。</p>}

      {employeeId && !loading && !hasData && !error && (
        <p className="text-xs text-muted-foreground">暂无状态变更，尝试更新员工状态后即可在此处查看历史。</p>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {employeeId && hasData && (
        <div className="space-y-3 text-sm">
          {timeline.map((entry, index) => (
            <div key={entry.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{entry.timestamp}</span>
                <span># {timeline.length - index}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{entry.previousLabel}</span>
                <span className="text-muted-foreground">→</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_COLORS[entry.nextStatus] ?? 'bg-muted text-foreground'}`}
                >
                  {entry.nextLabel}
                </span>
              </div>
              {entry.note && (
                <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{entry.note}</p>
              )}
              {index < timeline.length - 1 && <Separator className="opacity-50" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
