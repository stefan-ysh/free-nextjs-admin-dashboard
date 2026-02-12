"use client";

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type SearchableEntityOption<T> = {
  id: string;
  label: string;
  description?: string;
  data: T;
};

type TriggerRendererArgs<T> = {
  selected: SearchableEntityOption<T> | null;
  loading: boolean;
  placeholder: string;
  resolving: boolean;
};

type OptionRendererArgs<T> = {
  option: SearchableEntityOption<T>;
  isSelected: boolean;
};

type FooterRendererArgs<T> = {
  items: SearchableEntityOption<T>[];
  clear: () => void;
  value: string;
};

type SearchableEntitySelectProps<T> = {
  value: string;
  onChange: (id: string, entity?: T | null) => void;
  fetchEntities: (search: string) => Promise<T[]>;
  mapOption: (entity: T) => SearchableEntityOption<T>;
  resolveEntity?: (id: string) => Promise<T | null>;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  panelClassName?: string;
  searchDebounceMs?: number;
  renderTrigger?: (args: TriggerRendererArgs<T>) => React.ReactNode;
  renderOption?: (args: OptionRendererArgs<T>) => React.ReactNode;
  renderSummary?: (entity: T) => React.ReactNode;
  renderFooter?: (args: FooterRendererArgs<T>) => React.ReactNode;
};

const DEFAULT_DEBOUNCE = 350;

export function SearchableEntitySelect<T>({
  value,
  onChange,
  fetchEntities,
  mapOption,
  resolveEntity,
  disabled = false,
  placeholder = '请选择',
  helperText,
  searchPlaceholder = '输入关键词搜索',
  emptyText = '暂无可选数据',
  panelClassName,
  searchDebounceMs = DEFAULT_DEBOUNCE,
  renderTrigger,
  renderOption,
  renderSummary,
  renderFooter,
}: SearchableEntitySelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Array<SearchableEntityOption<T>>>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOption, setSelectedOption] = useState<SearchableEntityOption<T> | null>(null);
  const [resolvingSelection, setResolvingSelection] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), searchDebounceMs);
    return () => window.clearTimeout(timer);
  }, [search, searchDebounceMs]);

  useEffect(() => {
    if (!open) return;
    let aborted = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const entities = await fetchEntities(debouncedSearch);
        if (aborted) return;
        const mapped = entities.map((entity) => mapOption(entity));
        setOptions(mapped);
      } catch (err) {
        if (controller.signal.aborted || aborted) return;
        console.error('[SearchableEntitySelect] fetch failed', err);
        setError(err instanceof Error ? err.message : '加载失败');
        setOptions([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [open, debouncedSearch, refreshKey, fetchEntities, mapOption]);

  useEffect(() => {
    if (!value) {
      setSelectedOption(null);
      setResolvingSelection(false);
      return;
    }
    const match = options.find((option) => option.id === value);
    if (match) {
      setSelectedOption(match);
      setResolvingSelection(false);
      return;
    }
    if (!resolveEntity) {
      setResolvingSelection(false);
      return;
    }
    let aborted = false;
    setResolvingSelection(true);
    resolveEntity(value)
      .then((entity) => {
        if (aborted) return;
        if (entity) {
          setSelectedOption(mapOption(entity));
        } else {
          setSelectedOption(null);
        }
      })
      .catch((err) => {
        if (aborted) return;
        console.warn('[SearchableEntitySelect] resolve failed', err);
        setSelectedOption(null);
      })
      .finally(() => {
        if (!aborted) setResolvingSelection(false);
      });
    return () => {
      aborted = true;
    };
  }, [value, options, resolveEntity, mapOption]);

  const emptyStateText = useMemo(() => {
    if (error) return error;
    if (debouncedSearch) return '没有找到匹配结果';
    return emptyText;
  }, [debouncedSearch, emptyText, error]);

  const handleSelect = (option: SearchableEntityOption<T>) => {
    onChange(option.id, option.data);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('', null);
    setOpen(false);
  };

  const trigger = renderTrigger ? (
    renderTrigger({ selected: selectedOption, loading, placeholder, resolving: resolvingSelection })
  ) : (
    <DefaultTrigger selected={selectedOption} placeholder={placeholder} loading={loading} resolving={resolvingSelection} />
  );

  const footer = renderFooter ? (
    renderFooter({ items: options, clear: handleClear, value })
  ) : (
    <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
      <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={!value}>
        清除选择
      </Button>
      <span>当前展示 {options.length} 条</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              !selectedOption && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            {trigger}
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <ChevronIcon />}
          </button>
        </PopoverTrigger>
        <PopoverContent className={cn('surface-card w-[380px] p-0', panelClassName)} align="start">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full pl-9"
                autoFocus
              />
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => setRefreshKey((prev) => prev + 1)} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
          <ScrollArea className="h-64">
            <div className="divide-y divide-border">
              {loading && options.length === 0 ? (
                <div className="flex items-center justify-center px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载...
                </div>
              ) : options.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyStateText}</div>
              ) : (
                options.map((option) => {
                  const isSelected = option.id === value;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={cn('flex w-full px-4 py-3 text-left text-sm transition hover:bg-muted/60', isSelected && 'bg-primary/10')}
                    >
                      {renderOption ? (
                        renderOption({ option, isSelected })
                      ) : (
                        <DefaultOption option={option} isSelected={isSelected} />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
          {footer}
        </PopoverContent>
      </Popover>

      {selectedOption && renderSummary && <div className="surface-panel p-4 text-sm">{renderSummary(selectedOption.data)}</div>}

      {value && resolvingSelection && (
        <div className="surface-panel px-4 py-3 text-sm text-muted-foreground">
          正在同步已选项...
        </div>
      )}

      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function DefaultTrigger<T>({ selected, placeholder, loading, resolving }: { selected: SearchableEntityOption<T> | null; placeholder: string; loading: boolean; resolving: boolean }) {
  if (selected) {
    return (
      <div className="flex flex-col text-left">
        <span className="text-sm font-medium text-foreground">{selected.label}</span>
        {selected.description && <span className="text-xs text-muted-foreground">{selected.description}</span>}
      </div>
    );
  }
  if (resolving) {
    return <span className="text-sm text-muted-foreground">正在加载已选项...</span>;
  }
  return <span className="text-sm text-muted-foreground">{loading ? '加载中...' : placeholder}</span>;
}

function DefaultOption<T>({ option, isSelected }: OptionRendererArgs<T>) {
  return (
    <div className="flex w-full items-start gap-3">
      <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary">{isSelected && <CheckmarkIcon />}</span>
      <div className="flex flex-1 flex-col">
        <span className="font-medium text-foreground">{option.label}</span>
        {option.description && <span className="text-xs text-muted-foreground">{option.description}</span>}
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckmarkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.414L8.5 11.586l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}
