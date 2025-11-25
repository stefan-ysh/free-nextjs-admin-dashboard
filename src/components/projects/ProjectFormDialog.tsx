'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePicker from '@/components/ui/DatePicker';
import { toast } from '@/components/ui/sonner';
import EmployeeSelector from '@/components/common/EmployeeSelector';
import ClientSelector from '@/components/common/ClientSelector';
import { projectPriorityOptions, projectStatusOptions } from './constants';
import type { CurrencyCode, ProjectPriority, ProjectRecord, ProjectStatus } from '@/types/project';
import ModalShell from '@/components/common/ModalShell';

const currencyOptions = ['CNY', 'USD', 'HKD', 'EUR', 'JPY', 'GBP', 'OTHER'] as const satisfies readonly [CurrencyCode, ...CurrencyCode[]];

const RequiredMark = () => <span className="ml-1 text-destructive">*</span>;

function getFriendlyErrorMessage(message?: string | null, status?: number): string {
	if (status === 401) return '登录状态已过期，请重新登录后再试';
	if (status === 403) return '您没有权限执行该操作';
	if (status === 404) return '相关项目不存在或已被删除';
	if (status === 409 && message) return message;
	if (status && status >= 500) return '服务器暂时开小差，请稍后再试';

	if (!message) {
		return '保存失败，请稍后再试';
	}

	const normalized = message.toLowerCase();
	if (normalized.includes('fk_projects_manager') || normalized.includes('project_manager_id')) {
		return '负责人信息无效，请选择已有的系统用户作为负责人';
	}
	if (normalized.includes('foreign key')) {
		return '填写的信息存在无效关联，请检查表单内容后重试';
	}
	if (normalized.includes('project_code_exists')) {
		return '项目编号已存在，请更换一个新的编号';
	}
	if (normalized.includes('contract_number_exists')) {
		return '合同编号已存在，请检查后重试';
	}
	if (normalized.includes('failed to fetch') || normalized.includes('networkerror')) {
		return '网络连接异常，请检查网络后重新提交';
	}
	if (normalized.includes('server error') || normalized.includes('服务器错误')) {
		return '服务器暂时不可用，请稍后再试';
	}

	return message;
}

const formSchema = z.object({
	projectName: z.string().min(1, '请输入项目名称'),
	projectCode: z.string().min(1, '请输入项目编号'),
	clientName: z.string().optional(),
	projectManagerId: z.string().min(1, '请输入负责人用户 ID'),
	status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled'] as [ProjectStatus, ...ProjectStatus[]]),
	priority: z.enum(['low', 'medium', 'high', 'urgent'] as [ProjectPriority, ...ProjectPriority[]]),
	budget: z.string().optional(),
	contractAmount: z.string().optional(),
	currency: z.enum(currencyOptions),
	startDate: z.string().optional(),
	expectedEndDate: z.string().optional(),
	description: z.string().optional(),
	contractNumber: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const buildDefaultValues = (project?: ProjectRecord | null): FormValues => ({
	projectName: project?.projectName ?? '',
	projectCode: project?.projectCode ?? '',
	clientName: project?.clientName ?? '',
	projectManagerId: project?.projectManagerId ?? '',
	status: project?.status ?? 'planning',
	priority: project?.priority ?? 'medium',
	budget: project?.budget != null ? String(project.budget) : '',
	contractAmount: project?.contractAmount != null ? String(project.contractAmount) : '',
	currency: project?.currency ?? 'CNY',
	startDate: project?.startDate?.slice(0, 10) ?? '',
	expectedEndDate: project?.expectedEndDate?.slice(0, 10) ?? '',
	description: project?.description ?? '',
	contractNumber: project?.contractNumber ?? '',
});

type ProjectResponse = {
	success: boolean;
	data?: ProjectRecord;
	error?: string;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
	projectId?: string | null;
};

export default function ProjectFormDialog({ open, onOpenChange, onSuccess, projectId }: Props) {
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: buildDefaultValues(),
	});
	const [initialLoading, setInitialLoading] = useState(false);
	const isEditMode = Boolean(projectId);

	useEffect(() => {
		if (!isEditMode || !projectId || !open) {
			form.reset(buildDefaultValues());
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		async function loadProject() {
			setInitialLoading(true);
			try {
				const response = await fetch(`/api/projects/${projectId}`, {
					cache: 'no-store',
					signal: controller.signal,
				});
				const payload = (await response.json()) as ProjectResponse;
				if (!response.ok || !payload.success || !payload.data) {
					throw new Error(payload.error ?? '无法获取项目');
				}
				if (!cancelled) {
					form.reset(buildDefaultValues(payload.data));
				}
			} catch (err) {
				if (controller.signal.aborted || cancelled) return;
				toast.error('无法加载项目', { description: err instanceof Error ? err.message : '请稍后再试' });
			} finally {
				if (!cancelled) setInitialLoading(false);
			}
		}

		loadProject();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [isEditMode, projectId, open, form, toast]);

	useEffect(() => {
		if (!open) {
			form.reset(buildDefaultValues());
		}
	}, [open, form]);

	const handleSubmit = form.handleSubmit(async (values) => {
		try {
			const payload: Record<string, unknown> = {
				projectName: values.projectName.trim(),
				projectCode: values.projectCode.trim(),
				projectManagerId: values.projectManagerId.trim(),
				status: values.status,
				priority: values.priority,
				currency: values.currency,
			};
			if (values.clientName?.trim()) payload.clientName = values.clientName.trim();
			if (values.contractNumber?.trim()) payload.contractNumber = values.contractNumber.trim();
			if (values.description?.trim()) payload.description = values.description.trim();
			if (values.startDate) payload.startDate = values.startDate;
			if (values.expectedEndDate) payload.expectedEndDate = values.expectedEndDate;
			if (values.budget) payload.budget = Number(values.budget);
			if (values.contractAmount) payload.contractAmount = Number(values.contractAmount);

			const endpoint = isEditMode && projectId ? `/api/projects/${projectId}` : '/api/projects';
			const method = isEditMode && projectId ? 'PATCH' : 'POST';

			const response = await fetch(endpoint, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const result = (await response.json()) as ProjectResponse;
			if (!response.ok || !result.success) {
				const friendly = getFriendlyErrorMessage(result.error, response.status);
				throw new Error(friendly);
			}
			onSuccess?.();
			toast.success(isEditMode ? '项目已更新' : '项目已创建');
			onOpenChange(false);
		} catch (error) {
			const friendly = getFriendlyErrorMessage(error instanceof Error ? error.message : undefined);
			toast.error(friendly || '提交失败', { description: friendly ? undefined : '请稍后再试' });
		}
	});

	const disableSubmit = form.formState.isSubmitting || initialLoading;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl overflow-hidden p-0">
				<Form {...form}>
					<form onSubmit={handleSubmit}>
						<ModalShell
							title={isEditMode ? '编辑项目' : '新建项目'}
							footer={
								<DialogFooter>
									<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={disableSubmit}>
										取消
									</Button>
									<Button type="submit" disabled={disableSubmit}>
										{form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
										{isEditMode ? '保存修改' : '创建项目'}
									</Button>
								</DialogFooter>
							}
						>
							{initialLoading ? (
								<div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
									<Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载...
								</div>
							) : (
								<div className="space-y-6">
							<div className="grid gap-4 md:grid-cols-2">
								<FormField
									control={form.control}
									name="projectName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												项目名称
												<RequiredMark />
											</FormLabel>
											<FormControl>
												<Input placeholder="例如：华东数据中心升级" required {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="projectCode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												项目编号
												<RequiredMark />
											</FormLabel>
											<FormControl>
												<Input placeholder="例如：PRJ-2025-001" required {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="clientName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>客户名称</FormLabel>
											<FormControl>
												<ClientSelector
													value={field.value ?? ''}
													onChange={(client) => {
														field.onChange(client);
														field.onBlur();
													}}
													disabled={disableSubmit}
													helperText="可搜索历史客户，或直接输入新的客户名称"
												/>
											</FormControl>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="projectManagerId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												负责人用户 ID
												<RequiredMark />
											</FormLabel>
											<FormControl>
												<EmployeeSelector
													value={field.value}
													onChange={(userId) => {
														field.onChange(userId);
														field.onBlur();
													}}
													disabled={disableSubmit}
												/>
											</FormControl>
											<FormDescription>请选择一位在职员工作为负责人，系统会自动关联其账号。</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<FormField
									control={form.control}
									name="status"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												状态
												<RequiredMark />
											</FormLabel>
											<FormControl>
												<Select onValueChange={field.onChange} value={field.value}>
													<SelectTrigger>
														<SelectValue placeholder="请选择状态" />
													</SelectTrigger>
													<SelectContent>
														{projectStatusOptions.map((option) => (
															<SelectItem key={option.value} value={option.value}>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="priority"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												优先级
												<RequiredMark />
											</FormLabel>
											<FormControl>
												<Select onValueChange={field.onChange} value={field.value}>
													<SelectTrigger>
														<SelectValue placeholder="请选择优先级" />
													</SelectTrigger>
													<SelectContent>
														{projectPriorityOptions.map((option) => (
															<SelectItem key={option.value} value={option.value}>
																{option.label}
															</SelectItem>
														))}
												</SelectContent>
											</Select>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-3">
								<FormField
									control={form.control}
									name="budget"
									render={({ field }) => (
										<FormItem>
											<FormLabel>预算 (¥)</FormLabel>
											<FormControl>
												<Input type="number" min="0" step="1000" placeholder="可选" {...field} />
											</FormControl>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="contractAmount"
									render={({ field }) => (
										<FormItem>
											<FormLabel>合同金额 (¥)</FormLabel>
											<FormControl>
												<Input type="number" min="0" step="1000" placeholder="可选" {...field} />
											</FormControl>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="currency"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												货币
												<RequiredMark />
											</FormLabel>
											<FormControl>
												<Select onValueChange={field.onChange} value={field.value}>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{currencyOptions.map((option) => (
															<SelectItem key={option} value={option}>
																{option}
															</SelectItem>
														))}
												</SelectContent>
											</Select>
										</FormControl>
									</FormItem>
									)}
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<FormField
									control={form.control}
									name="startDate"
									render={({ field }) => (
										<FormItem>
											<FormLabel>开始日期</FormLabel>
											<FormControl>
												<DatePicker value={field.value ?? ''} onChange={field.onChange} clearable={false} />
											</FormControl>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="expectedEndDate"
									render={({ field }) => (
										<FormItem>
											<FormLabel>预期结束日期</FormLabel>
											<FormControl>
												<DatePicker value={field.value ?? ''} onChange={field.onChange} />
											</FormControl>
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name="contractNumber"
								render={({ field }) => (
									<FormItem>
										<FormLabel>合同编号</FormLabel>
										<FormControl>
											<Input placeholder="可选" {...field} />
										</FormControl>
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>项目描述</FormLabel>
										<FormControl>
											<Textarea rows={4} placeholder="简要介绍项目背景、范围等" {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							</div>
							)}
						</ModalShell>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
