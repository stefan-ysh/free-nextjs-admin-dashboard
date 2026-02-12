"use client";

import { useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown, Loader2, RefreshCw, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/sonner';
import type { EmployeeRecord } from '@/lib/hr/employees';

type EmployeesResponse = {
	success: boolean;
	data: {
		items: EmployeeRecord[];
		total: number;
		page: number;
		pageSize: number;
	};
	error?: string;
};

type EmployeeDetailResponse = {
	success: boolean;
	data?: EmployeeRecord;
	error?: string;
};

type EmployeeSelectorProps = {
	value: string;
	onChange: (userId: string, employee?: EmployeeRecord | null) => void;
	disabled?: boolean;
	helperText?: string;
	showSelectionSummary?: boolean;
	showHelperText?: boolean;
};

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const statusLabels: Record<EmployeeRecord['employmentStatus'], string> = {
	active: '在职',
	on_leave: '休假',
	terminated: '已离职',
};

const statusClasses: Record<EmployeeRecord['employmentStatus'], string> = {
	active: 'bg-chart-5/15 text-chart-5',
	on_leave: 'bg-chart-3/15 text-chart-3',
	terminated: 'bg-destructive/15 text-destructive',
};

function getEmployeeName(employee: EmployeeRecord): string {
	if (employee.displayName) return employee.displayName;
	const fullName = `${employee.lastName ?? ''}${employee.firstName ?? ''}`.trim();
	if (fullName) return fullName;
	if (employee.email) return employee.email;
	return employee.id;
}

export default function EmployeeSelector({
	value,
	onChange,
	disabled = false,
	helperText,
	showSelectionSummary = true,
	showHelperText = true,
}: EmployeeSelectorProps) {
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
	const [resolvingSelection, setResolvingSelection] = useState(false);
	const [open, setOpen] = useState(false);
	const [bindingEmployeeId, setBindingEmployeeId] = useState<string | null>(null);

useEffect(() => {
		const timer = window.setTimeout(() => {
			setDebouncedSearch(search.trim());
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		let aborted = false;

		async function loadEmployees() {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams();
				params.set('page', '1');
				params.set('pageSize', String(PAGE_SIZE));
				params.set('status', 'active');
				params.set('sortBy', 'updatedAt');
				params.set('sortOrder', 'desc');
				if (debouncedSearch) {
					params.set('search', debouncedSearch);
				}
				const response = await fetch(`/api/employees?${params.toString()}`, {
					cache: 'no-store',
				});
				const payload = (await response.json()) as EmployeesResponse;
				if (!response.ok || !payload.success) {
					throw new Error(payload.error ?? '加载员工失败');
				}
				if (aborted) return;
				setEmployees(payload.data.items);
			} catch (employeeError) {
				if (aborted) return;
				setError(employeeError instanceof Error ? employeeError.message : '加载员工失败');
				setEmployees([]);
			} finally {
				if (!aborted) setLoading(false);
			}
		}

		loadEmployees();
		return () => {
			aborted = true;
		};
	}, [debouncedSearch, refreshKey]);

		useEffect(() => {
			if (!value) {
				setSelectedEmployee(null);
				setResolvingSelection(false);
				return;
			}

			const matched = employees.find((employee) => employee.userId === value);
			if (matched) {
				setSelectedEmployee(matched);
				setResolvingSelection(false);
				return;
			}

			let aborted = false;
			setResolvingSelection(true);

			async function resolveEmployee(userId: string) {
				try {
					const response = await fetch(`/api/employees/by-user/${userId}`, {
						cache: 'no-store',
					});
					const payload = (await response.json()) as EmployeeDetailResponse;
					if (!response.ok || !payload.success || !payload.data) {
						throw new Error(payload.error ?? '无法加载负责人信息');
					}
					if (aborted) return;
					setSelectedEmployee(payload.data);
				} catch (detailError) {
					if (aborted) return;
					console.warn('无法解析负责人 userId', detailError);
					setSelectedEmployee(null);
				} finally {
					if (!aborted) setResolvingSelection(false);
				}
			}

			resolveEmployee(value);
			return () => {
				aborted = true;
			};
		}, [value, employees]);

	const helper = helperText ?? '支持按姓名、邮箱搜索；首次选择将自动为员工生成账号（账号/初始密码=员工编号）。';

	const emptyStateText = useMemo(() => {
		if (error) return error;
		if (debouncedSearch) return '未找到匹配的员工，尝试更换关键字';
		return '暂无可用员工或缺少查看权限';
	}, [debouncedSearch, error]);

	const handleSelect = async (employee: EmployeeRecord) => {
			if (disabled || bindingEmployeeId) return;
			let targetUserId = employee.userId;
			let updatedEmployee = employee;

			if (!targetUserId) {
				setBindingEmployeeId(employee.id);
				try {
					const response = await fetch('/api/employees/auto-bind', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ employeeId: employee.id }),
					});
					const payload = await response.json();
					if (!response.ok || !payload.success || !payload.data?.userId) {
						throw new Error(payload.error ?? '无法生成账号');
					}
					targetUserId = payload.data.userId as string;
					updatedEmployee = { ...employee, userId: targetUserId };
					setEmployees((prev) => prev.map((item) => (item.id === employee.id ? updatedEmployee : item)));
					toast('已为员工生成账号', {
						description: `账号：${payload.data.loginAccount}（初始密码同账号）`,
					});
				} catch (bindingError) {
					toast.error('生成账号失败', {
						description: bindingError instanceof Error ? bindingError.message : '请稍后再试',
					});
					return;
				} finally {
					setBindingEmployeeId(null);
				}
			}

			if (!targetUserId) {
				toast.error('无法选择负责人', { description: '系统账号创建失败，请稍后再试' });
				return;
			}

			setSelectedEmployee(updatedEmployee);
			onChange(targetUserId, updatedEmployee);
			setOpen(false);
		};

		const handleClear = () => {
			if (disabled) return;
			setSelectedEmployee(null);
			onChange('', null);
			setOpen(false);
		};

		const triggerLabel = selectedEmployee ? getEmployeeName(selectedEmployee) : value ? `用户 ID：${value}` : '请选择负责人';
		const triggerSubLabel = selectedEmployee?.jobTitle ?? selectedEmployee?.department ?? '';

		return (
			<div className="space-y-3">
				<Popover open={open} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							role="combobox"
							aria-expanded={open}
							disabled={disabled}
							className="w-full justify-between"
						>
							<div className="flex flex-col text-left">
								<span className={cn('truncate text-sm', !value && 'text-muted-foreground')}>{triggerLabel}</span>
								{triggerSubLabel && <span className="text-xs text-muted-foreground">{triggerSubLabel}</span>}
							</div>
							<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="surface-card w-[420px] p-3" align="start">
						<div className="space-y-3">
							<div className="flex gap-2">
								<Input
									type="search"
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="搜索姓名、邮箱"
									className="flex-1"
									autoFocus
								/>
								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={() => setRefreshKey((prev) => prev + 1)}
									disabled={loading}
								>
									<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
								</Button>
								<Button type="button" variant="ghost" size="icon" onClick={handleClear} disabled={!value}>
									<XCircle className="h-4 w-4" />
								</Button>
							</div>
							<div className="surface-panel">
								{loading && (
									<div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
										<Loader2 className="h-4 w-4 animate-spin" /> 正在加载员工...
									</div>
								)}
								{!loading && employees.length === 0 && (
									<div className="px-4 py-3 text-sm text-muted-foreground">{emptyStateText}</div>
								)}
								{employees.length > 0 && (
									<ScrollArea className="max-h-72">
										<div className="divide-y">
											{employees.map((employee) => {
												const isSelected = Boolean(value && employee.userId === value);
												const name = getEmployeeName(employee);
												const isBinding = bindingEmployeeId === employee.id;
												return (
													<button
														key={employee.id}
														type="button"
														onClick={() => void handleSelect(employee)}
														className={cn(
															'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60',
															isSelected && 'bg-primary/5'
														)}
														disabled={isBinding}
													>
														<Avatar className="h-10 w-10 border">
															<AvatarImage src={employee.avatarUrl ?? undefined} alt={name} />
															<AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
														</Avatar>
														<div className="flex flex-1 flex-col">
															<div className="flex flex-wrap items-center gap-2">
																<p className="text-sm font-medium">{name}</p>
																{employee.jobTitle && <span className="text-xs text-muted-foreground">{employee.jobTitle}</span>}
															</div>
															<p className="text-xs text-muted-foreground">
																{employee.department || '未分配部门'}
																{employee.email ? ` · ${employee.email}` : ''}
															</p>
														</div>
														<div className="flex flex-col items-end gap-1 text-xs">
															<span className={`rounded-full px-2 py-0.5 ${statusClasses[employee.employmentStatus]}`}>
																{statusLabels[employee.employmentStatus]}
															</span>
															{isBinding ? (
																<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
															) : (
																!employee.userId && (
																	<span className="rounded-full bg-chart-3/15 px-2 py-0.5 text-chart-3">未绑定账号</span>
																)
															)}
														</div>
													</button>
												);
											})}
									</div>
								</ScrollArea>
							)}
						</div>
					</div>
				</PopoverContent>
			</Popover>

			{value && resolvingSelection && (
				<div className="rounded-xl border border-muted-foreground/20 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
					正在同步负责人信息...
				</div>
			)}

			{showSelectionSummary && selectedEmployee && (
				<div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p className="font-semibold text-foreground">{getEmployeeName(selectedEmployee)}</p>
							{selectedEmployee.jobTitle && <p className="text-xs text-muted-foreground">{selectedEmployee.jobTitle}</p>}
						</div>
						<span className={`rounded-full px-2 py-0.5 text-xs ${statusClasses[selectedEmployee.employmentStatus]}`}>
							{statusLabels[selectedEmployee.employmentStatus]}
						</span>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">
						部门：{selectedEmployee.department || '未分配'} · 用户 ID：{selectedEmployee.userId ?? '未绑定'}
					</p>
				</div>
			)}

			{showHelperText ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
		</div>
	);
}
