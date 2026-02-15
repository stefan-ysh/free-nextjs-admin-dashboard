'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormDescription,
	FormMessage,
} from '@/components/ui/form';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import DatePicker from '@/components/ui/DatePicker';
import {
	DepartmentOption,
	Employee,
	EmployeeFormSubmitPayload,
	EmployeeGender,
	EMPLOYEE_GENDER_LABELS,
	EMPLOYMENT_STATUS_LABELS,
	JobGradeOption,
} from './types';
import { useEmployeeOptions } from './useEmployeeOptions';

type EmployeeFormProps = {
	initialData?: Employee | null;
	onSubmit: (payload: EmployeeFormSubmitPayload) => Promise<void>;
	onCancel?: () => void;
	departmentOptions?: DepartmentOption[];
	jobGradeOptions?: JobGradeOption[];
	formId?: string;
	hideActions?: boolean;
};

const STATUS_OPTIONS = ['active', 'on_leave', 'terminated'] as const;
const GENDER_OPTIONS = ['male', 'female', 'other'] as const;

const sanitizeText = (value?: string | null) => {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
};

const extractDateInput = (value?: string | null) => {
	if (!value) return '';
	const trimmed = value.trim();
	if (!trimmed) return '';
	const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
	if (match) {
		return match[1];
	}
	if (trimmed.includes('T')) {
		return trimmed.split('T')[0] || '';
	}
	return trimmed;
};

const buildDefaultValues = (data?: Employee | null): EmployeeFormValues => ({
	employeeCode: data?.employeeCode ?? '',
	displayName: data?.displayName ?? '',
	email: data?.email ?? '',
	phone: data?.phone ?? '',
	initialPassword: '',
	department: data?.department ?? '',
	departmentId: data?.departmentId ?? '',
	nationalId: data?.nationalId ?? '',
	gender: (data?.gender && GENDER_OPTIONS.includes(data.gender as typeof GENDER_OPTIONS[number])) ? data.gender as typeof GENDER_OPTIONS[number] : '',
	jobTitle: data?.jobTitle ?? '',
	jobGradeId: data?.jobGradeId ?? '',
	employmentStatus: data?.employmentStatus ?? 'active',
	hireDate: extractDateInput(data?.hireDate ?? ''),
	terminationDate: extractDateInput(data?.terminationDate ?? ''),
	managerId: data?.managerId ?? '',
	location: data?.location ?? '',
	address: data?.address ?? '',
	organization: data?.organization ?? '',
	educationBackground: data?.educationBackground ?? '',
	statusChangeNote: '',
});

const employeeSchema = z.object({
	employeeCode: z.string().optional(),
	displayName: z
		.string()
		.min(1, '请输入姓名')
		.refine((val) => val.trim().length > 0, { message: '请输入姓名' }),
	email: z
		.string()
		.email('请输入有效邮箱')
		.or(z.literal(''))
		.optional(),
	phone: z.string().optional(),
	initialPassword: z.string().optional(),
	department: z.string().optional(),
	departmentId: z.string().optional(),
	nationalId: z.string().optional(),
	gender: z.enum(GENDER_OPTIONS).or(z.literal('')).optional(),
	jobTitle: z.string().optional(),
	jobGradeId: z.string().optional(),
	employmentStatus: z.enum(STATUS_OPTIONS),
	hireDate: z.string().optional(),
	terminationDate: z.string().optional(),
	managerId: z.string().optional(),
	location: z.string().optional(),
	address: z.string().optional(),
	organization: z.string().optional(),
	educationBackground: z.string().optional(),
	statusChangeNote: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

export default function EmployeeForm({ initialData, onSubmit, onCancel, departmentOptions, jobGradeOptions, formId, hideActions = false }: EmployeeFormProps) {
	const isCreating = !initialData;

	const { departments: availableDepartments, jobGrades: availableJobGrades } = useEmployeeOptions({
		initialDepartments: departmentOptions,
		initialJobGrades: jobGradeOptions,
	});

	const form = useForm<EmployeeFormValues>({
		resolver: zodResolver(employeeSchema),
		defaultValues: buildDefaultValues(initialData),
	});

	const { control, reset, handleSubmit, formState } = form;
	const watchedStatus = form.watch('employmentStatus');
	const statusChanged = initialData ? watchedStatus !== initialData.employmentStatus : false;

	useEffect(() => {
		reset(buildDefaultValues(initialData));
	}, [initialData, reset]);

	useEffect(() => {
		if (!statusChanged && form.getValues('statusChangeNote')) {
			form.setValue('statusChangeNote', '', { shouldDirty: false, shouldValidate: false });
		}
	}, [statusChanged, form]);

	useEffect(() => {
		const currentId = form.getValues('departmentId');
		if (!currentId) return;
		const currentName = form.getValues('department');
		if (currentName) return;
		const matched = availableDepartments.find((option) => option.id === currentId);
		if (matched) {
			form.setValue('department', matched.name ?? '', { shouldDirty: false, shouldValidate: false });
		}
	}, [availableDepartments, form]);

	const hasReadonlyStatus = useMemo(() => initialData?.employmentStatus === 'terminated', [initialData]);

	const handleFormSubmit = handleSubmit(async (values) => {
		if (isCreating && !values.initialPassword?.trim()) {
			form.setError('initialPassword', { message: '请输入初始密码' });
			return;
		}

		const payload: EmployeeFormSubmitPayload = {
			employeeCode: sanitizeText(values.employeeCode),
			displayName: values.displayName.trim(),
			email: sanitizeText(values.email),
			phone: sanitizeText(values.phone),
			initialPassword: isCreating ? sanitizeText(values.initialPassword) : null,
			department: sanitizeText(values.department),
			departmentId: sanitizeText(values.departmentId),
			nationalId: sanitizeText(values.nationalId),
			gender: values.gender ? (values.gender as EmployeeGender) : null,
			jobTitle: sanitizeText(values.jobTitle),
			jobGradeId: sanitizeText(values.jobGradeId),
			employmentStatus: values.employmentStatus,
			hireDate: sanitizeText(values.hireDate),
			terminationDate: sanitizeText(values.terminationDate),
			managerId: sanitizeText(values.managerId),
			location: sanitizeText(values.location),
			address: sanitizeText(values.address),
			organization: sanitizeText(values.organization),
			educationBackground: sanitizeText(values.educationBackground),
			statusChangeNote: statusChanged ? sanitizeText(values.statusChangeNote) : null,
		};


		await onSubmit(payload);
	});


	return (
		<Form {...form}>
			<form id={formId} onSubmit={handleFormSubmit} className="space-y-6">

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<FormField
						control={control}
						name="employeeCode"
						render={({ field }) => (
							<FormItem>
								<FormLabel>员工编号</FormLabel>
								<FormControl>
									<Input placeholder="可选, 例如 EMP-001" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="displayName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									姓名 <span className="text-destructive">*</span>
								</FormLabel>
								<FormControl>
									<Input placeholder="请输入员工姓名" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<FormField
						control={control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>邮箱</FormLabel>
								<FormControl>
									<Input type="email" placeholder="name@example.com" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="phone"
						render={({ field }) => (
							<FormItem>
								<FormLabel>电话</FormLabel>
								<FormControl>
									<Input placeholder="手机号或分机号" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				{isCreating && (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						<FormField
							control={control}
							name="initialPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										初始密码 <span className="text-destructive">*</span>
									</FormLabel>
									<FormControl>
										<Input type="password" placeholder="设置初始登录密码" {...field} />
									</FormControl>
									<FormDescription>员工可用邮箱/手机号/员工编号登录。</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				)}

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<FormField
						control={control}
						name="nationalId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>身份证号</FormLabel>
								<FormControl>
									<Input placeholder="填写居民身份证号码" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="gender"
						render={({ field }) => (
							<FormItem>
								<FormLabel>性别</FormLabel>
								<Select
									value={field.value || 'unspecified'}
									onValueChange={(value) => field.onChange(value === 'unspecified' ? '' : value)}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="未设置" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="unspecified">未设置</SelectItem>
										{GENDER_OPTIONS.map((option) => (
											<SelectItem key={option} value={option}>
												{EMPLOYEE_GENDER_LABELS[option]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<FormField
						control={control}
						name="organization"
						render={({ field }) => (
							<FormItem>
								<FormLabel>机关 / 单位</FormLabel>
								<FormControl>
									<Input placeholder="供职机构或行政机关" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="educationBackground"
						render={({ field }) => (
							<FormItem>
								<FormLabel>教育背景</FormLabel>
								<FormControl>
									<Input placeholder="最高学历或专业" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={control}
					name="address"
					render={({ field }) => (
						<FormItem>
							<FormLabel>住址</FormLabel>
							<FormControl>
								<Textarea rows={3} placeholder="省市区 + 详细地址" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<FormField
						control={control}
						name="departmentId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>部门 (结构化)</FormLabel>
								<Select
									value={field.value || 'none'}
									onValueChange={(value) => {
										const normalized = value === 'none' ? '' : value;
										field.onChange(normalized);
										if (normalized) {
											const matched = availableDepartments.find((option) => option.id === normalized);
											form.setValue('department', matched?.name ?? '', { shouldDirty: true });
										} else {
											form.setValue('department', '', { shouldDirty: true });
										}
									}}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder={availableDepartments.length ? '选择部门' : '正在加载部门…'} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="none">未设置</SelectItem>
										{!availableDepartments.length && (
											<SelectItem value="__no_departments" disabled>
												暂无可选部门
											</SelectItem>
										)}
										{availableDepartments.map((dept) => (
											<SelectItem key={dept.id} value={dept.id}>
												{dept.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormDescription>选择后会自动同步部门名称，可右侧手动微调。</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="department"
						render={({ field }) => (
							<FormItem>
								<FormLabel>部门名称</FormLabel>
								<FormControl>
									<Input placeholder="例如: 财务中心" {...field} />
								</FormControl>
								<FormDescription>无结构化数据时，可手动填写或覆盖自动名称。</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="jobGradeId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>职级</FormLabel>
								<Select
									value={field.value || 'none'}
									onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder={availableJobGrades.length ? '选择职级' : '正在加载职级…'} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="none">未设置</SelectItem>
										{!availableJobGrades.length && (
											<SelectItem value="__no_job_grade" disabled>
												暂无可选职级
											</SelectItem>
										)}
										{availableJobGrades.map((grade) => (
											<SelectItem key={grade.id} value={grade.id}>
												{grade.name}
												{grade.level != null ? ` (L${grade.level})` : ''}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="jobTitle"
						render={({ field }) => (
							<FormItem>
								<FormLabel>职位</FormLabel>
								<FormControl>
									<Input placeholder="职位名称" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<FormField
						control={control}
						name="employmentStatus"
						render={({ field }) => (
							<FormItem>
								<FormLabel>状态</FormLabel>
								<Select value={field.value} onValueChange={field.onChange} disabled={hasReadonlyStatus}>
									<FormControl>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{STATUS_OPTIONS.map((option) => (
											<SelectItem key={option} value={option}>
												{EMPLOYMENT_STATUS_LABELS[option]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="hireDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>入职日期</FormLabel>
								<FormControl>
									<DatePicker value={field.value ?? ''} onChange={field.onChange} clearable={false} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="terminationDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>离职日期</FormLabel>
								<FormControl>
									<DatePicker value={field.value ?? ''} onChange={field.onChange} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				{initialData && statusChanged && (
					<FormField
						control={control}
						name="statusChangeNote"
						render={({ field }) => (
							<FormItem>
								<FormLabel>状态变更备注</FormLabel>
								<FormDescription>可选，说明此次状态调整的背景或审批信息。</FormDescription>
								<FormControl>
									<Textarea rows={3} placeholder="例如：完成入职手续，状态改为在职" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<FormField
						control={control}
						name="managerId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>直属上级</FormLabel>
								<FormControl>
									<Input placeholder="可填写上级工号或姓名" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="location"
						render={({ field }) => (
							<FormItem>
								<FormLabel>办公地点</FormLabel>
								<FormControl>
									<Input placeholder="城市 / 园区 / 办公室" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				{!hideActions && (
					<div className="flex justify-end gap-4">
						{onCancel && (
							<Button type="button" variant="outline" onClick={onCancel} disabled={formState.isSubmitting}>
								取消
							</Button>
						)}
						<Button type="submit" disabled={formState.isSubmitting}>
							{formState.isSubmitting ? '保存中...' : '保存'}
						</Button>
					</div>
				)}
			</form>
		</Form>
	);
}
