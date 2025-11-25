'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown, Loader2, Plus, RefreshCw, XCircle } from 'lucide-react';

import type { Client } from '@/types/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusClass: Record<Client['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
  inactive: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100',
  blacklisted: 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100',
};

const statusLabel: Record<Client['status'], string> = {
  active: '正常往来',
  inactive: '暂停合作',
  blacklisted: '黑名单',
};

type PickerProps = {
  value?: string;
  onChange: (client: Client | null) => void;
  disabled?: boolean;
  helperText?: string;
  onCreateRequest?: () => void;
};

const SEARCH_DELAY = 400;

export default function CustomerPicker({ value, onChange, disabled, helperText, onCreateRequest }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    async function loadClients() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('pageSize', '20');
        if (debounced) params.set('search', debounced);
        params.set('status', 'active');
        const response = await fetch(`/api/clients?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? '加载客户失败');
        }
        if (!aborted) setClients(payload.data.items ?? []);
      } catch (error) {
        if (controller.signal.aborted || aborted) return;
        console.warn('加载客户失败', error);
        setClients([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    loadClients();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [debounced, refreshKey]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const match = clients.find((client) => client.id === value);
    if (match) {
      setSelected(match);
      return;
    }
    let aborted = false;
    const controller = new AbortController();
    async function resolveClient() {
      try {
        const response = await fetch(`/api/clients/${value}`, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? '无法加载客户信息');
        }
        if (!aborted) setSelected(payload.data as Client);
      } catch (error) {
        if (controller.signal.aborted || aborted) return;
        console.warn('resolve client failed', error);
        setSelected(null);
      }
    }
    resolveClient();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [value, clients]);

  const display = useMemo(() => {
    if (selected) return selected.displayName;
    if (value) return `客户 ID：${value}`;
    return '选择客户';
  }, [selected, value]);

  const subLabel = selected?.type === 'company' ? selected.companyName || '' : selected?.contactPerson || '';

  const handleSelect = (client: Client) => {
    if (disabled) return;
    setSelected(client);
    onChange(client);
    setOpen(false);
  };

  const handleClear = () => {
    if (disabled) return;
    setSelected(null);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
          >
            <div className="flex flex-col text-left">
              <span className={cn('truncate text-sm', !value && 'text-muted-foreground')}>{display}</span>
              {subLabel && <span className="text-xs text-muted-foreground">{subLabel}</span>}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] space-y-3" align="start">
          <div className="flex gap-2">
            <Input
              type="search"
              placeholder="搜索客户名称/手机号"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setRefreshKey((key) => key + 1)}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={handleClear} disabled={!value}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-xl border">
            {loading && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在加载客户...
              </div>
            )}
            {!loading && clients.length === 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {debounced ? '未找到匹配的客户' : '暂无客户数据'}
              </div>
            )}
            {!loading && clients.length > 0 && (
              <ScrollArea className="max-h-72">
                <div className="divide-y">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelect(client)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/60',
                        client.id === value && 'bg-primary/5'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{client.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {client.mobile || '无手机号'} · {client.email || '无邮箱'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className={statusClass[client.status]}>
                          {statusLabel[client.status]}
                        </Badge>
                        <span>{client.type === 'company' ? '企业' : '个人'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          {onCreateRequest && (
            <Button type="button" variant="secondary" className="w-full" onClick={onCreateRequest}>
              <Plus className="mr-2 h-4 w-4" /> 快速新建客户
            </Button>
          )}
        </PopoverContent>
      </Popover>
      {selected && (
        <div className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>{selected.invoiceTitle || selected.displayName}</span>
            <span>{selected.paymentTerm?.toUpperCase()}</span>
          </div>
          <div className="mt-2 space-y-1">
            <p>
              联系人：{selected.contactPerson || '—'} · {selected.mobile || '—'}
            </p>
            <p>发票税号：{selected.taxNumber || '—'}</p>
            {selected.shippingAddress?.street && <p>地址：{selected.shippingAddress.street}</p>}
          </div>
        </div>
      )}
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}
