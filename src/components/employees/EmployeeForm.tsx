'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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

type EmployeeFormProps = {
	initialData?: Employee | null;
	onSubmit: (payload: EmployeeFormSubmitPayload) => Promise<void>;
	onCancel?: () => void;
	departmentOptions?: DepartmentOption[];
	jobGradeOptions?: JobGradeOption[];
};

type CustomFieldRow = {
	key: string;
	value: string;
};

const STATUS_OPTIONS = ['active', 'on_leave', 'terminated'] as const;
const GENDER_OPTIONS = ['male', 'female', 'other'] as const;
const MAX_AVATAR_SIZE = 1_572_864; // 1.5MB

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

const initializeCustomFields = (data?: Employee | null): CustomFieldRow[] => {
	if (!data?.customFields) return [{ key: '', value: '' }];
	const entries = Object.entries(data.customFields)
		.filter(([key]) => typeof key === 'string')
		.map(([key, rawValue]) => ({ key, value: rawValue == null ? '' : String(rawValue) }));
	return entries.length ? entries : [{ key: '', value: '' }];
};

const buildDefaultValues = (data?: Employee | null): EmployeeFormValues => ({
	employeeCode: data?.employeeCode ?? '',
	firstName: data?.firstName ?? '',
	lastName: data?.lastName ?? '',
	displayName: data?.displayName ?? '',
	email: data?.email ?? '',
	phone: data?.phone ?? '',
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
	customFields: initializeCustomFields(data),
	statusChangeNote: '',
});

const employeeSchema = z.object({
	employeeCode: z.string().optional(),
	firstName: z
		.string()
		.min(1, '请输入名')
		.refine((val) => val.trim().length > 0, { message: '请输入名' }),
	lastName: z
		.string()
		.min(1, '请输入姓氏')
		.refine((val) => val.trim().length > 0, { message: '请输入姓氏' }),
	displayName: z.string().optional(),
	email: z
		.string()
		.email('请输入有效邮箱')
		.or(z.literal(''))
		.optional(),
	phone: z.string().optional(),
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
	customFields: z
		.array(
			z.object({
				key: z.string().optional(),
				value: z.string().optional(),
			})
		)
		.optional(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

export default function EmployeeForm({ initialData, onSubmit, onCancel, departmentOptions, jobGradeOptions }: EmployeeFormProps) {
	const [avatarPreview, setAvatarPreview] = useState<string | null>(initialData?.avatarUrl ?? null);
	const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
	const [removeAvatar, setRemoveAvatar] = useState(false);
	const [avatarError, setAvatarError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [availableDepartments, setAvailableDepartments] = useState<DepartmentOption[]>(departmentOptions ?? []);
	const [availableJobGrades, setAvailableJobGrades] = useState<JobGradeOption[]>(jobGradeOptions ?? []);

	const form = useForm<EmployeeFormValues>({
		resolver: zodResolver(employeeSchema),
		defaultValues: buildDefaultValues(initialData),
	});

	const { control, reset, handleSubmit, formState } = form;
	const { fields, append, remove } = useFieldArray({ control, name: 'customFields' });
	const watchedStatus = form.watch('employmentStatus');
	const statusChanged = initialData ? watchedStatus !== initialData.employmentStatus : false;

	useEffect(() => {
		if (departmentOptions?.length) {
			setAvailableDepartments(departmentOptions);
		}
	}, [departmentOptions]);

	useEffect(() => {
		if (jobGradeOptions?.length) {
			setAvailableJobGrades(jobGradeOptions);
		}
	}, [jobGradeOptions]);

	useEffect(() => {
		if (departmentOptions?.length) {
			return;
		}
		let cancelled = false;
		async function fetchDepartments() {
			try {
				const response = await fetch('/api/employees/departments');
				if (!response.ok) return;
				const data = await response.json();
				if (!cancelled && data.success && Array.isArray(data.data)) {
					setAvailableDepartments(data.data);
				}
			} catch (error) {
				console.error('加载部门列表失败', error);
			}
		}
		fetchDepartments();
		return () => {
			cancelled = true;
		};
	}, [departmentOptions]);

	useEffect(() => {
		if (jobGradeOptions?.length) {
			return;
		}
		let cancelled = false;
		async function fetchJobGrades() {
			try {
				const response = await fetch('/api/employees/job-grades');
				if (!response.ok) return;
				const data = await response.json();
				if (!cancelled && data.success && Array.isArray(data.data)) {
					setAvailableJobGrades(data.data);
				}
			} catch (error) {
				console.error('加载职级列表失败', error);
			}
		}
		fetchJobGrades();
		return () => {
			cancelled = true;
		};
	}, [jobGradeOptions]);

	useEffect(() => {
		reset(buildDefaultValues(initialData));
		setAvatarPreview(initialData?.avatarUrl ?? null);
		setAvatarDataUrl(null);
		setRemoveAvatar(false);
		setAvatarError(null);
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
		const customFieldEntries = (values.customFields ?? [])
			.filter((row) => row?.key && row.key.trim())
			.reduce<Record<string, string>>((acc, row) => {
				if (!row?.key) return acc;
				acc[row.key.trim()] = row?.value?.trim() ?? '';
				return acc;
			}, {});

		const payload: EmployeeFormSubmitPayload = {
			employeeCode: sanitizeText(values.employeeCode),
			firstName: values.firstName.trim(),
			lastName: values.lastName.trim(),
			displayName: sanitizeText(values.displayName),
			email: sanitizeText(values.email),
			phone: sanitizeText(values.phone),
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
			customFields: Object.keys(customFieldEntries).length ? customFieldEntries : null,
			statusChangeNote: statusChanged ? sanitizeText(values.statusChangeNote) : null,
		};

		if (avatarDataUrl) {
			payload.avatarDataUrl = avatarDataUrl;
		} else if (removeAvatar && initialData?.avatarUrl) {
			payload.removeAvatar = true;
		}

		await onSubmit(payload);
	});

	const handlePickAvatar = () => {
		fileInputRef.current?.click();
	};

	const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;

		if (file.size > MAX_AVATAR_SIZE) {
			setAvatarError('请选择 1.5MB 以下的图片');
			return;
		}

		setAvatarError(null);
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				setAvatarPreview(reader.result);
				setAvatarDataUrl(reader.result);
				setRemoveAvatar(false);
			}
		};
		reader.onerror = () => {
			setAvatarError('读取图片失败，请重试');
		};
		reader.readAsDataURL(file);
	};

	const handleAvatarRemove = () => {
		setAvatarPreview(null);
		setAvatarDataUrl(null);
		setRemoveAvatar(true);
		setAvatarError(null);
	};

	const resolvedAvatar = removeAvatar ? null : avatarPreview ?? initialData?.avatarUrl ?? null;

	return (
		<Form {...form}>
			<form onSubmit={handleFormSubmit} className="space-y-6">
				<input
					type="file"
					accept="image/*"
					ref={fileInputRef}
					className="hidden"
					onChange={handleAvatarChange}
				/>

				<div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/20 p-4">
					<div className="relative h-20 w-20 overflow-hidden rounded-full border border-border">
						<Image
							src={resolvedAvatar ?? '/images/user/owner.jpg'}
							alt="员工头像预览"
							width={80}
							height={80}
							className="object-cover"
							unoptimized
						/>
					</div>
					<div className="flex flex-1 flex-col gap-2 text-sm">
						<div className="font-medium text-foreground">头像</div>
						<p className="text-xs text-muted-foreground">支持 PNG/JPG/GIF，建议 400×400 像素以内，最大 1.5MB。</p>
						<div className="flex flex-wrap gap-2">
							<Button type="button" size="sm" onClick={handlePickAvatar} disabled={formState.isSubmitting}>
								{resolvedAvatar ? '更换头像' : '上传头像'}
							</Button>
							{resolvedAvatar && (
								<Button type="button" variant="outline" size="sm" onClick={handleAvatarRemove} disabled={formState.isSubmitting}>
									移除
								</Button>
							)}
						</div>
						{avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
					</div>
				</div>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
								<FormLabel>常用名</FormLabel>
								<FormControl>
									<Input placeholder="昵称 / 名片展示名称" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="lastName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									姓 <span className="text-destructive">*</span>
								</FormLabel>
								<FormControl>
									<Input {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="firstName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									名 <span className="text-destructive">*</span>
								</FormLabel>
								<FormControl>
									<Input {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

				<div className="rounded-2xl border border-dashed border-border p-4">
					<div className="mb-3 flex items-center justify-between">
						<h3 className="text-sm font-medium text-foreground">自定义字段</h3>
						<Button type="button" variant="ghost" size="sm" onClick={() => append({ key: '', value: '' })}>
							+ 添加字段
						</Button>
					</div>
					<div className="space-y-3">
						{fields.map((field, index) => (
							<div key={field.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
								<FormField
									control={control}
									name={`customFields.${index}.key` as const}
									render={({ field: fieldProps }) => (
										<FormItem>
											<FormLabel>字段名</FormLabel>
											<FormControl>
												<Input placeholder="例如 员工编号2" {...fieldProps} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<div className="flex gap-2">
									<FormField
										control={control}
										name={`customFields.${index}.value` as const}
										render={({ field: fieldProps }) => (
											<FormItem className="flex-1">
												<FormLabel>字段值</FormLabel>
												<FormControl>
													<Input placeholder="字段值" {...fieldProps} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									{fields.length > 1 && (
										<Button
											type="button"
											variant="ghost"
											className="shrink-0"
											onClick={() => remove(index)}
										>
											删除
										</Button>
									)}
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="flex justify-end gap-3">
					{onCancel && (
						<Button type="button" variant="outline" onClick={onCancel} disabled={formState.isSubmitting}>
							取消
						</Button>
					)}
					<Button type="submit" disabled={formState.isSubmitting}>
						{formState.isSubmitting ? '保存中...' : initialData ? '更新' : '创建'}
					</Button>
				</div>
			</form>
		</Form>
	);
}
