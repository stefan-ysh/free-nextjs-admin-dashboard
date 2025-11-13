'use client';

import Image from 'next/image';
import EmployeeStatusBadge from './EmployeeStatusBadge';
import type { Employee } from './types';

type EmployeeTableProps = {
	employees: Employee[];
	loading?: boolean;
	onEdit: (employee: Employee) => void;
	onDelete: (employee: Employee) => void;
};

function formatDate(value: string | null) {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function resolveDisplayName(employee: Employee) {
	if (employee.displayName) return employee.displayName;
	return `${employee.lastName}${employee.firstName}`.trim() || employee.email || employee.phone || '未知员工';
}

function getAvatarInitials(employee: Employee) {
	const source =
		employee.displayName ||
		`${employee.lastName}${employee.firstName}`.trim() ||
		employee.email ||
		employee.phone ||
		'员工';
	const condensed = source.replace(/\s+/g, '');
	const characters = condensed.slice(0, 2);
	if (!characters) return '员工';
	return /^[A-Za-z]+$/.test(characters) ? characters.toUpperCase() : characters;
}

export default function EmployeeTable({ employees, loading, onEdit, onDelete }: EmployeeTableProps) {
	if (loading) {
		return (
			<div className="flex min-h-[500px] items-center justify-center">
				<div className="flex flex-col items-center gap-3">
					<div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
					<div className="text-sm text-gray-500 dark:text-gray-400">加载中...</div>
				</div>
			</div>
		);
	}

	if (employees.length === 0) {
		return (
			<div className="flex min-h-[500px] flex-col items-center justify-center gap-3">
				<svg
					className="h-16 w-16 text-gray-300 dark:text-gray-600"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
						d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
					/>
				</svg>
				<div className="text-sm font-medium text-gray-600 dark:text-gray-300">暂无员工数据</div>
				<div className="text-xs text-gray-400 dark:text-gray-500">
					使用上方筛选条件检索或点击新增按钮创建员工记录
				</div>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[1000px] border-collapse">
				<thead>
					<tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
							员工编号
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
							姓名
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
							联系方式
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
							部门
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
							职位
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
							状态
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
							入职日期
						</th>
						<th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
							操作
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
					{employees.map((employee) => (
						<tr
							key={employee.id}
							className="text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
						>
							<td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
								{employee.employeeCode ?? '—'}
							</td>
							<td className="whitespace-nowrap px-4 py-4">
								<div className="flex items-center gap-3">
									<div className="relative h-10 w-10 overflow-hidden rounded-full border border-gray-200 dark:border-gray-700">
										{employee.avatarUrl ? (
											<Image
												src={employee.avatarUrl}
												alt={`${resolveDisplayName(employee)} 头像`}
												width={40}
												height={40}
												className="h-full w-full object-cover"
												unoptimized
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center bg-blue-50 text-sm font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-200">
												{getAvatarInitials(employee)}
											</div>
										)}
									</div>
									<div className="flex flex-col">
										<span className="font-medium text-gray-900 dark:text-gray-100">
											{resolveDisplayName(employee)}
										</span>
										{employee.displayName && (
											<span className="text-xs text-gray-500 dark:text-gray-400">
												{employee.firstName} {employee.lastName}
											</span>
										)}
									</div>
								</div>
							</td>
							<td className="px-4 py-4">
								<div className="flex flex-col gap-1">
									{employee.email && (
										<a
											href={`mailto:${employee.email}`}
											className="text-xs text-blue-600 hover:underline dark:text-blue-400"
										>
											{employee.email}
										</a>
									)}
									{employee.phone && (
										<a
											href={`tel:${employee.phone}`}
											className="text-xs text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
										>
											{employee.phone}
										</a>
									)}
									{!employee.email && !employee.phone && <span className="text-xs text-gray-400">—</span>}
								</div>
							</td>
							<td className="whitespace-nowrap px-4 py-4">
								{employee.department ? (
									<span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-400/30">
										{employee.department}
									</span>
								) : (
									<span className="text-gray-400">—</span>
								)}
							</td>
							<td className="whitespace-nowrap px-4 py-4 text-gray-600 dark:text-gray-400">
								{employee.jobTitle ?? '—'}
							</td>
							<td className="whitespace-nowrap px-4 py-4">
								<EmployeeStatusBadge status={employee.employmentStatus} />
							</td>
							<td className="whitespace-nowrap px-4 py-4 text-gray-600 dark:text-gray-400">
								{formatDate(employee.hireDate)}
							</td>
							<td className="whitespace-nowrap px-4 py-4 text-right">
								<div className="flex items-center justify-end gap-2">
									<button
										onClick={() => onEdit(employee)}
										className="inline-flex items-center gap-1 rounded-lg border border-blue-500 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-blue-400 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
										title="编辑员工"
									>
										<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
											/>
										</svg>
										编辑
									</button>
									<button
										onClick={() => onDelete(employee)}
										className="inline-flex items-center gap-1 rounded-lg border border-rose-500 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 dark:border-rose-400 dark:bg-gray-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
										title="删除员工"
									>
										<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
										删除
									</button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
