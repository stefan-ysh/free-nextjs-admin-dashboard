'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EmployeeStatusBadge from './EmployeeStatusBadge';
import type { Employee } from './types';
import { formatDateTimeLocal } from '@/lib/dates';
import { Inbox, KeyRound, MoreHorizontal, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { USER_ROLE_LABELS } from '@/constants/user-roles';
import DataState from '@/components/common/DataState';

type EmployeeTableProps = {
	employees: Employee[];
	loading?: boolean;
	onEdit: (employee: Employee) => void;
	onDelete: (employee: Employee) => void;
	onResetPassword?: (employee: Employee) => void;
	canEdit?: boolean;
	canDelete?: boolean;
	onAssignRoles?: (employee: Employee) => void;
	canAssignRoles?: boolean;
	canResetPassword?: boolean;
};

function formatDate(value: string | null) {
	if (!value) return '—';
	const formatted = formatDateTimeLocal(value);
	if (formatted) {
		return formatted;
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return `${value} 00:00:00`;
	}
	return value;
}

function resolveDisplayName(employee: Employee) {
	if (employee.displayName) return employee.displayName;
	return employee.email || employee.phone || '未知员工';
}

function getAvatarInitials(employee: Employee) {
	const source =
		employee.displayName ||
		employee.email ||
		employee.phone ||
		'员工';
	const condensed = source.replace(/\s+/g, '');
	const characters = condensed.slice(0, 2);
	if (!characters) return '员工';
	return /^[A-Za-z]+$/.test(characters) ? characters.toUpperCase() : characters;
}

export default function EmployeeTable({
	employees,
	loading,
	onEdit,
	onDelete,
	onAssignRoles,
	onResetPassword,
	canEdit = false,
	canDelete = false,
	canAssignRoles = false,
	canResetPassword = false,
}: EmployeeTableProps) {
	if (loading) {
		return (
			<div className="surface-table p-6">
				<DataState
					variant="loading"
					title="正在加载员工数据"
					description="请稍候片刻，系统正在同步员工信息"
				/>
			</div>
		);
	}

	if (employees.length === 0) {
		return (
			<div className="surface-table p-6">
				<DataState
					variant="empty"
					title="暂无员工记录"
					description="请调整筛选条件或使用「新增员工」按钮录入第一条数据。"
					icon={<Inbox className="h-5 w-5" />}
				/>
			</div>
		);
	}

	return (
		<div className="surface-table flex-1 min-h-0 flex flex-col">
			<div className="md:hidden">
				<div className="space-y-3 p-4">
					{employees.map((employee) => {
						const displayName = resolveDisplayName(employee);
						return (
							<div key={employee.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-center gap-3">
										<Avatar className="border border-border bg-background">
											<AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
												{getAvatarInitials(employee)}
											</AvatarFallback>
										</Avatar>
										<div className="space-y-1">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-sm font-semibold text-foreground">{displayName}</span>
												{employee.userPrimaryRole ? (
													<Badge variant="secondary" className="text-xs">
														{USER_ROLE_LABELS[employee.userPrimaryRole] ?? employee.userPrimaryRole}
													</Badge>
												) : null}
											</div>
											<div className="text-xs text-muted-foreground">
												编号：{employee.employeeCode ?? '—'}
											</div>
										</div>
									</div>
									<EmployeeStatusBadge status={employee.employmentStatus} />
								</div>
								<div className="mt-3 grid gap-2 text-xs text-muted-foreground">
									<div className="flex items-center justify-between gap-3">
										<span>邮箱</span>
										<span className="text-foreground">{employee.email ?? '—'}</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span>入职日期</span>
										<span className="text-foreground">{formatDate(employee.hireDate)}</span>
									</div>
								</div>
								{(canEdit || canDelete || canAssignRoles || canResetPassword) && (
									<div className="mt-4 flex justify-end">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="outline" size="sm" className="h-8 px-3">
													<MoreHorizontal className="mr-2 h-4 w-4" /> 操作
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-44">
												{canAssignRoles && onAssignRoles && (
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															onAssignRoles(employee);
														}}
														className="cursor-pointer"
													>
														<ShieldCheck className="mr-2 h-4 w-4" /> 设置角色
													</DropdownMenuItem>
												)}
												{canEdit && (
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															onEdit(employee);
														}}
														className="cursor-pointer"
													>
														<Pencil className="mr-2 h-4 w-4" /> 编辑
													</DropdownMenuItem>
												)}
												{canResetPassword && onResetPassword && (
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															onResetPassword(employee);
														}}
														className="cursor-pointer"
													>
														<KeyRound className="mr-2 h-4 w-4" /> 重置密码
													</DropdownMenuItem>
												)}
												{canDelete && (
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															onDelete(employee);
														}}
														className="cursor-pointer text-destructive focus:text-destructive"
													>
														<Trash2 className="mr-2 h-4 w-4" /> 删除
													</DropdownMenuItem>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
			<div className="hidden md:flex md:flex-col flex-1 min-h-0">
				<Table
					stickyHeader
					scrollAreaClassName="max-h-[calc(100vh-280px)] custom-scrollbar"
					className="w-full text-muted-foreground"
				>
						<TableHeader>
							<TableRow className="bg-muted/60">
								<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground hidden md:table-cell">工号</TableHead>
								<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">姓名</TableHead>
								<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground hidden md:table-cell">邮箱</TableHead>
								<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">状态</TableHead>
								<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground hidden md:table-cell">入职日期</TableHead>
							{(canEdit || canDelete || canAssignRoles || canResetPassword) && (
								<TableHead className="px-4 py-3 text-right uppercase tracking-wide text-muted-foreground">操作</TableHead>
							)}
						</TableRow>
					</TableHeader>
					<TableBody>
						{employees.map((employee) => (
							<TableRow key={employee.id} className="text-sm text-foreground hover:bg-muted/40">
								<TableCell className="px-4 py-4 font-mono text-xs text-muted-foreground hidden md:table-cell">
									{employee.employeeCode ?? '—'}
								</TableCell>
								<TableCell className="px-4 py-4">
									<div className="flex items-center gap-3">
										<Avatar className="border border-border bg-background">
											<AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
												{getAvatarInitials(employee)}
											</AvatarFallback>
										</Avatar>
										<div className="flex items-center gap-2 truncate">
											{employee.userPrimaryRole ? (
												<Badge variant="secondary" className="whitespace-nowrap text-xs">
													{USER_ROLE_LABELS[employee.userPrimaryRole] ?? employee.userPrimaryRole}
												</Badge>
											) : null}
										</div>
									</div>
								</TableCell>
								<TableCell className="px-4 py-4 text-sm text-muted-foreground hidden md:table-cell">{employee.email ?? '—'}</TableCell>
								<TableCell className="px-4 py-4">
									<EmployeeStatusBadge status={employee.employmentStatus} />
								</TableCell>
								<TableCell className="px-4 py-4 text-muted-foreground hidden md:table-cell">
									{formatDate(employee.hireDate)}
								</TableCell>
								{(canEdit || canDelete || canAssignRoles || canResetPassword) && (
									<TableCell className="px-4 py-4 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon" className="h-8 w-8">
													<MoreHorizontal className="h-4 w-4" />
													<span className="sr-only">打开操作菜单</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-44">
												{canAssignRoles && onAssignRoles && (
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															onAssignRoles(employee);
														}}
														className="cursor-pointer"
													>
														<ShieldCheck className="mr-2 h-4 w-4" /> 设置角色
													</DropdownMenuItem>
												)}
												{canEdit && (
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															onEdit(employee);
														}}
														className="cursor-pointer"
													>
														<Pencil className="mr-2 h-4 w-4" /> 编辑
													</DropdownMenuItem>
												)}
												{canResetPassword && onResetPassword && (
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															onResetPassword(employee);
														}}
														className="cursor-pointer"
													>
														<KeyRound className="mr-2 h-4 w-4" /> 重置密码
													</DropdownMenuItem>
												)}
												{canDelete && (
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															onDelete(employee);
														}}
														className="cursor-pointer text-destructive focus:text-destructive"
													>
														<Trash2 className="mr-2 h-4 w-4" /> 删除
													</DropdownMenuItem>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								)}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
