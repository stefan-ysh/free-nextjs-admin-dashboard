'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown, Loader2, Plus, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDateTimeLocal } from '@/lib/dates';

export type ClientSuggestion = {
	name: string;
	projectCount: number;
	lastProjectAt: string | null;
};

type ClientSelectorProps = {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	helperText?: string;
	allowCustom?: boolean;
	placeholder?: string;
};

const FETCH_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

function formatDate(value: string | null): string {
	if (!value) return '—';
	return formatDateTimeLocal(value) ?? value;
}

export default function ClientSelector({
	value,
	onChange,
	disabled = false,
	helperText = '展示最近使用的客户名称，可按客户名关键字筛选',
	allowCustom = true,
	placeholder = '请选择客户',
}: ClientSelectorProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [options, setOptions] = useState<ClientSuggestion[]>([]);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		if (!open) return;
		let aborted = false;
		const controller = new AbortController();
		async function loadOptions() {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams({ limit: String(FETCH_LIMIT) });
				if (debouncedSearch) params.set('search', debouncedSearch);
				const response = await fetch(`/api/projects/clients?${params.toString()}`, {
					cache: 'no-store',
					signal: controller.signal,
				});
				const payload = (await response.json()) as { success: boolean; data?: ClientSuggestion[]; error?: string };
				if (!response.ok || !payload.success || !payload.data) {
					throw new Error(payload.error ?? '获取客户失败');
				}
				if (aborted) return;
				setOptions(payload.data);
			} catch (optionError) {
				if (controller.signal.aborted || aborted) return;
				if (optionError instanceof DOMException && optionError.name === 'AbortError') return;
				setError(optionError instanceof Error ? optionError.message : '获取客户失败');
				setOptions([]);
			} finally {
				if (!aborted) setLoading(false);
			}
		}
		loadOptions();
		return () => {
			aborted = true;
			controller.abort();
		};
	}, [open, debouncedSearch]);

	const showCustomAction = allowCustom && Boolean(debouncedSearch && debouncedSearch !== value);

	const emptyText = useMemo(() => {
		if (error) return error;
		if (debouncedSearch) return '没有匹配的客户，可创建新客户名称';
		return '暂无客户数据；提交项目后会自动积累';
	}, [debouncedSearch, error]);

	const helper = helperText;

	const handleSelect = (name: string) => {
		onChange(name);
		setOpen(false);
	};

	const triggerLabel = value ? value : placeholder;

	return (
		<div className="space-y-2">
			<Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className={cn('w-full justify-between text-left font-normal', !value && 'text-muted-foreground')}
						disabled={disabled}
					>
						<span className="truncate">{triggerLabel}</span>
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[360px] p-3" align="start">
					<div className="space-y-3">
						<Input
							autoFocus
							type="search"
							placeholder="搜索客户名称"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						<div className="rounded-lg border">
							{loading && (
								<div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" /> 正在加载客户...
								</div>
							)}
							{!loading && options.length === 0 && (
								<div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
							)}
							{options.length > 0 && (
								<ScrollArea className="max-h-64">
									<div className="divide-y">
										{options.map((option) => {
											const isActive = option.name === value;
											return (
												<button
													key={option.name}
													type="button"
													onClick={() => handleSelect(option.name)}
													className={cn(
														'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-muted/50',
														isActive && 'bg-primary/5 text-primary'
													)}
												>
													<div className="flex flex-col">
														<span className="font-medium">{option.name}</span>
														<span className="text-xs text-muted-foreground">
															关联项目 {option.projectCount}
															{option.lastProjectAt ? ` · 最近更新 ${formatDate(option.lastProjectAt)}` : ''}
														</span>
													</div>
												</button>
											);
										})}
									</div>
								</ScrollArea>
							)}
						</div>
						{showCustomAction && (
							<Button type="button" variant="ghost" className="w-full justify-start" onClick={() => handleSelect(debouncedSearch)}>
								<Plus className="mr-2 h-4 w-4" /> 使用“{debouncedSearch}”
							</Button>
						)}
					</div>
				</PopoverContent>
			</Popover>
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<span>{helper}</span>
				{value && (
					<button type="button" className="inline-flex items-center text-rose-500 hover:underline" onClick={() => onChange('')} disabled={disabled}>
						<XCircle className="mr-1 h-3.5 w-3.5" />清除
					</button>
				)}
			</div>
			{value && (
				<div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
					当前选择：{value}
				</div>
			)}
		</div>
	);
}
