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
	Employee,
	EmployeeFormSubmitPayload,
	EmployeeGender,
	EMPLOYEE_GENDER_LABELS,
	EMPLOYMENT_STATUS_LABELS,
} from './types';
import { UserRole } from '@/types/user';
import { USER_ROLE_OPTIONS } from '@/constants/user-roles';
import { Checkbox } from '@/components/ui/checkbox';

type EmployeeFormProps = {
	initialData?: Employee | null;
	onSubmit: (payload: EmployeeFormSubmitPayload) => Promise<void>;
	onCancel?: () => void;
	formId?: string;
	hideActions?: boolean;
	canAssignRoles?: boolean;
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
	gender: (data?.gender && GENDER_OPTIONS.includes(data.gender as typeof GENDER_OPTIONS[number])) ? data.gender as typeof GENDER_OPTIONS[number] : '',
	employmentStatus: data?.employmentStatus ?? 'active',
	hireDate: extractDateInput(data?.hireDate ?? ''),
	terminationDate: extractDateInput(data?.terminationDate ?? ''),
	location: data?.location ?? '',
	address: data?.address ?? '',
	statusChangeNote: '',
	roles: data?.userRoles ?? [],
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
	gender: z.enum(GENDER_OPTIONS).or(z.literal('')).optional(),
	employmentStatus: z.enum(STATUS_OPTIONS),
	hireDate: z.string().optional(),
	terminationDate: z.string().optional(),
	location: z.string().optional(),
	address: z.string().optional(),
	statusChangeNote: z.string().optional(),
	roles: z.array(z.nativeEnum(UserRole)).optional(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

export default function EmployeeForm({
	initialData,
	onSubmit,
	onCancel,
	formId,
	hideActions = false,
	canAssignRoles = false,
}: EmployeeFormProps) {
	const isCreating = !initialData;

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
			gender: values.gender ? (values.gender as EmployeeGender) : null,
			employmentStatus: values.employmentStatus,
			hireDate: sanitizeText(values.hireDate),
			terminationDate: sanitizeText(values.terminationDate),
			location: sanitizeText(values.location),
			address: sanitizeText(values.address),
			statusChangeNote: statusChanged ? sanitizeText(values.statusChangeNote) : null,
			roles: values.roles?.length ? values.roles : undefined,
			primaryRole: values.roles?.[0], // Simple logic: first selected role is primary
		};
		await onSubmit(payload);
	});

	return (
		<Form {...form}>
			<form id={formId} onSubmit={handleFormSubmit} className="space-y-8">
				{/* 1. 基本信息 */}
				<div className="space-y-4">
					<h3 className="text-lg font-medium">基本信息</h3>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<FormField
							control={control}
							name="employeeCode"
							render={({ field }) => (
								<FormItem>
									<FormLabel>工号</FormLabel>
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
						{isCreating && (
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
										<FormDescription>员工可用邮箱/手机号/工号登录。</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}
					</div>
				</div>

				{canAssignRoles && (
					<>
						<div className="border-t" />
						<div className="space-y-4">
							<h3 className="text-lg font-medium">系统权限</h3>
							<FormField
								control={control}
								name="roles"
								render={() => (
									<FormItem>
										<div className="mb-4">
											<FormLabel>分配角色</FormLabel>
											<FormDescription>
												选择该员工在系统中的操作权限。若不选择，默认即为普通员工。
											</FormDescription>
										</div>
										<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
											{USER_ROLE_OPTIONS.map((option) => (
												<FormField
													key={option.value}
													control={control}
													name="roles"
													render={({ field }) => {
														return (
															<FormItem
																key={option.value}
																className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
															>
																<FormControl>
																	<Checkbox
																		checked={field.value?.includes(option.value)}
																		onCheckedChange={(checked) => {
																			return checked
																				? field.onChange([...(field.value || []), option.value])
																				: field.onChange(
																						field.value?.filter(
																							(value) => value !== option.value
																						)
																				  );
																		}}
																	/>
																</FormControl>
																<div className="space-y-1 leading-none">
																	<FormLabel className="font-normal">
																		{option.label}
																	</FormLabel>
																	<p className="text-xs text-muted-foreground">
																		{option.description}
																	</p>
																</div>
															</FormItem>
														);
													}}
												/>
											))}
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</>
				)}

				<div className="border-t" />

				{/* 4. 在职状态 */}
				<div className="space-y-4">
					<h3 className="text-lg font-medium">在职状态</h3>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
				</div>

				<div className="border-t" />

				{/* 5. 其他信息 */}
				<div className="space-y-4">
					<h3 className="text-lg font-medium">其他信息</h3>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
				</div>

				{!hideActions && (
					<div className="flex justify-end gap-4 pt-4 border-t">
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
