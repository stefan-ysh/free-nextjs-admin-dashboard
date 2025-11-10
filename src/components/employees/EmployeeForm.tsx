'use client';

import { useMemo, useState } from 'react';
import {
	EmploymentStatus,
	Employee,
	EmployeeFormSubmitPayload,
	EMPLOYMENT_STATUS_LABELS,
} from './types';

type EmployeeFormProps = {
	initialData?: Employee | null;
	onSubmit: (payload: EmployeeFormSubmitPayload) => Promise<void>;
	onCancel?: () => void;
};

type CustomFieldRow = {
	key: string;
	value: string;
};

const STATUS_OPTIONS: EmploymentStatus[] = ['active', 'on_leave', 'terminated'];

const sanitizeText = (value: string) => {
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
};

const initializeCustomFields = (data?: Employee | null): CustomFieldRow[] => {
	if (!data?.customFields) return [{ key: '', value: '' }];
	const entries = Object.entries(data.customFields)
		.filter(([key]) => typeof key === 'string')
		.map(([key, rawValue]) => ({ key, value: rawValue == null ? '' : String(rawValue) }));
	return entries.length ? entries : [{ key: '', value: '' }];
};

export default function EmployeeForm({ initialData, onSubmit, onCancel }: EmployeeFormProps) {
	const [loading, setLoading] = useState(false);
	const [formState, setFormState] = useState({
		employeeCode: initialData?.employeeCode ?? '',
		firstName: initialData?.firstName ?? '',
		lastName: initialData?.lastName ?? '',
		displayName: initialData?.displayName ?? '',
		email: initialData?.email ?? '',
		phone: initialData?.phone ?? '',
		department: initialData?.department ?? '',
		jobTitle: initialData?.jobTitle ?? '',
		employmentStatus: initialData?.employmentStatus ?? 'active',
		hireDate: initialData?.hireDate?.split('T')[0] ?? initialData?.hireDate ?? '',
		terminationDate: initialData?.terminationDate?.split('T')[0] ?? initialData?.terminationDate ?? '',
		managerId: initialData?.managerId ?? '',
		location: initialData?.location ?? '',
	});
	const [customFields, setCustomFields] = useState<CustomFieldRow[]>(() => initializeCustomFields(initialData));

	const hasReadonlyStatus = useMemo(() => initialData?.employmentStatus === 'terminated', [initialData]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!formState.firstName.trim() || !formState.lastName.trim()) {
			alert('请填写员工姓名');
			return;
		}

		setLoading(true);
		try {
			const customFieldEntries = customFields
				.filter((row) => row.key.trim())
				.reduce<Record<string, string>>((acc, row) => {
					acc[row.key.trim()] = row.value.trim();
					return acc;
				}, {});

			const payload: EmployeeFormSubmitPayload = {
				employeeCode: sanitizeText(formState.employeeCode),
				firstName: formState.firstName.trim(),
				lastName: formState.lastName.trim(),
				displayName: sanitizeText(formState.displayName),
				email: sanitizeText(formState.email),
				phone: sanitizeText(formState.phone),
				department: sanitizeText(formState.department),
				jobTitle: sanitizeText(formState.jobTitle),
				employmentStatus: formState.employmentStatus,
				hireDate: sanitizeText(formState.hireDate),
				terminationDate: sanitizeText(formState.terminationDate),
				managerId: sanitizeText(formState.managerId),
				location: sanitizeText(formState.location),
				customFields: Object.keys(customFieldEntries).length ? customFieldEntries : null,
			};

			await onSubmit(payload);
		} catch (error) {
			console.error('提交员工信息失败', error);
			alert('保存失败, 请检查网络或稍后再试');
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
						员工编号
					</label>
					<input
						value={formState.employeeCode}
						onChange={(event) => setFormState((prev) => ({ ...prev, employeeCode: event.target.value }))}
						placeholder="可选, 例如 EMP-001"
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
						常用名
					</label>
					<input
						value={formState.displayName}
						onChange={(event) => setFormState((prev) => ({ ...prev, displayName: event.target.value }))}
						placeholder="昵称 / 名片展示名称"
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
						姓 <span className="text-rose-500">*</span>
					</label>
					<input
						required
						value={formState.lastName}
						onChange={(event) => setFormState((prev) => ({ ...prev, lastName: event.target.value }))}
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
						名 <span className="text-rose-500">*</span>
					</label>
					<input
						required
						value={formState.firstName}
						onChange={(event) => setFormState((prev) => ({ ...prev, firstName: event.target.value }))}
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
						邮箱
					</label>
					<input
						type="email"
						value={formState.email}
						onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
						placeholder="name@example.com"
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
						电话
					</label>
					<input
						value={formState.phone}
						onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
						placeholder="手机号或分机号"
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
						部门
					</label>
					<input
						value={formState.department}
						onChange={(event) => setFormState((prev) => ({ ...prev, department: event.target.value }))}
						placeholder="例如: 财务中心"
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
						职位
					</label>
					<input
						value={formState.jobTitle}
						onChange={(event) => setFormState((prev) => ({ ...prev, jobTitle: event.target.value }))}
						placeholder="职位名称"
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">状态</label>
					<select
						value={formState.employmentStatus}
						onChange={(event) =>
							setFormState((prev) => ({
								...prev,
								employmentStatus: event.target.value as EmploymentStatus,
							}))
						}
						disabled={hasReadonlyStatus}
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					>
						{STATUS_OPTIONS.map((option) => (
							<option key={option} value={option}>
								{EMPLOYMENT_STATUS_LABELS[option]}
							</option>
						))}
					</select>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">入职日期</label>
					<input
						type="date"
						value={formState.hireDate}
						onChange={(event) => setFormState((prev) => ({ ...prev, hireDate: event.target.value }))}
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">离职日期</label>
					<input
						type="date"
						value={formState.terminationDate}
						onChange={(event) =>
							setFormState((prev) => ({ ...prev, terminationDate: event.target.value }))
						}
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">直属上级</label>
					<input
						value={formState.managerId}
						onChange={(event) => setFormState((prev) => ({ ...prev, managerId: event.target.value }))}
						placeholder="可填写上级工号或姓名"
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">办公地点</label>
					<input
						value={formState.location}
						onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
						placeholder="城市 / 园区 / 办公室"
						className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
			</div>

			<div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-700">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">自定义字段</h3>
					<button
						type="button"
						onClick={() => setCustomFields((rows) => [...rows, { key: '', value: '' }])}
						className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
					>
						+ 添加字段
					</button>
				</div>
				<div className="space-y-3">
					{customFields.map((row, index) => (
						<div key={`custom-field-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<input
								value={row.key}
								onChange={(event) =>
									setCustomFields((prev) => {
										const next = [...prev];
										next[index] = { ...next[index], key: event.target.value };
										return next;
									})
								}
								placeholder="字段名 (例如 员工编号2)"
								className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
							/>
							<div className="flex gap-2">
								<input
									value={row.value}
									onChange={(event) =>
										setCustomFields((prev) => {
											const next = [...prev];
											next[index] = { ...next[index], value: event.target.value };
											return next;
										})
									}
									placeholder="字段值"
									className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								/>
								{customFields.length > 1 && (
									<button
										type="button"
										onClick={() => setCustomFields((prev) => prev.filter((_, idx) => idx !== index))}
										className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-rose-400 hover:text-rose-500 dark:border-gray-600 dark:text-gray-300"
									>
										删除
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="flex justify-end gap-3">
				{onCancel && (
					<button
						type="button"
						disabled={loading}
						onClick={onCancel}
						className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
					>
						取消
					</button>
				)}
				<button
					type="submit"
					disabled={loading}
					className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				>
					{loading ? '保存中...' : initialData ? '更新' : '创建'}
				</button>
			</div>
		</form>
	);
}
