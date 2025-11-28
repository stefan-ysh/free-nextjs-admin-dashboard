import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import type { ProjectRecord } from '@/types/project';
import ModalShell from '@/components/common/ModalShell';
import { ProjectFormFields } from './ProjectFormFields';
import {
	buildDefaultValues,
	currencyOptions,
	formSchema,
	type FormValues,
	getFriendlyErrorMessage,
} from './project-form-schema';

const RequiredMark = () => <span className="ml-1 text-destructive">*</span>;

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
				if (err instanceof DOMException && err.name === 'AbortError') return;
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
								<ProjectFormFields disableSubmit={disableSubmit} />
							)}
						</ModalShell>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
