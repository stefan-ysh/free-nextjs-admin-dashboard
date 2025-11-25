'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Inbox, Loader2, Mail, MoreHorizontal, Phone, User2, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { USER_ROLE_LABELS } from '@/constants/user-roles';

type EmployeeTableProps = {
	employees: Employee[];
	loading?: boolean;
	onEdit: (employee: Employee) => void;
	onDelete: (employee: Employee) => void;
	canEdit?: boolean;
	canDelete?: boolean;
	onAssignRoles?: (employee: Employee) => void;
	canAssignRoles?: boolean;
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

export default function EmployeeTable({
	employees,
	loading,
	onEdit,
	onDelete,
	onAssignRoles,
	canEdit = false,
	canDelete = false,
	canAssignRoles = false,
}: EmployeeTableProps) {
	if (loading) {
		return (
			<div className="flex min-h-[480px] flex-col items-center justify-center text-sm text-muted-foreground">
				<Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
				正在加载员工数据...
			</div>
		);
	}

	if (employees.length === 0) {
		return (
			<div className="flex min-h-[480px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
				<Inbox className="mb-4 h-12 w-12 text-muted-foreground/60" />
				<div className="font-medium text-foreground">暂无员工记录</div>
				<p className="mt-1 max-w-sm text-xs text-muted-foreground">
					请调整筛选条件或使用「新增员工」按钮录入第一条数据。
				</p>
			</div>
		);
	}

	return (
		<Table className="min-w-[1000px] text-muted-foreground">
			<TableHeader>
				<TableRow className="bg-muted/60">
					<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">员工编号</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">姓名</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">联系方式</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">部门</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">职位</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">状态</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide text-muted-foreground">入职日期</TableHead>
					{(canEdit || canDelete || canAssignRoles) && (
						<TableHead className="px-4 py-3 text-right uppercase tracking-wide text-muted-foreground">操作</TableHead>
					)}
				</TableRow>
			</TableHeader>
			<TableBody>
				{employees.map((employee) => (
					<TableRow key={employee.id} className="text-sm text-foreground">
						<TableCell className="px-4 py-4 font-mono text-xs text-muted-foreground">
							{employee.employeeCode ?? '—'}
						</TableCell>
						<TableCell className="px-4 py-4">
							<div className="flex items-center gap-3">
								<Avatar className="border border-border bg-background">
									{employee.avatarUrl ? (
										<AvatarImage src={employee.avatarUrl} alt={`${resolveDisplayName(employee)} avatar`} />
									) : (
										<AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
											{getAvatarInitials(employee)}
										</AvatarFallback>
									)}
								</Avatar>
								<div className="flex flex-col">
									<span className="font-medium text-foreground">{resolveDisplayName(employee)}</span>
									{employee.displayName && (
										<span className="text-xs text-muted-foreground">
											{employee.firstName} {employee.lastName}
										</span>
									)}
									{employee.userRoles && employee.userRoles.length > 0 && (
										<div className="mt-1 flex flex-wrap gap-1">
											{employee.userRoles.map((role) => (
												<Badge
													key={role}
													variant={role === employee.userPrimaryRole ? 'default' : 'outline'}
													className={role === employee.userPrimaryRole ? 'border-primary/40 bg-primary/10 text-primary' : 'border-dashed text-muted-foreground'}
												>
													{USER_ROLE_LABELS[role] ?? role}
													{role === employee.userPrimaryRole && <span className="ml-1 text-[10px]">主</span>}
												</Badge>
											))}
										</div>
									)}
								</div>
							</div>
						</TableCell>
						<TableCell className="px-4 py-4">
							<div className="flex flex-col gap-1 text-xs">
								{employee.email && (
									<a
										href={`mailto:${employee.email}`}
										className="inline-flex items-center gap-1 text-primary hover:underline"
									>
										<Mail className="h-3.5 w-3.5" />
										{employee.email}
									</a>
								)}
								{employee.phone && (
									<a
										href={`tel:${employee.phone}`}
										className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
									>
										<Phone className="h-3.5 w-3.5" />
										{employee.phone}
									</a>
								)}
								{!employee.email && !employee.phone && (
									<span className="inline-flex items-center gap-1 text-muted-foreground/70">
										<User2 className="h-3.5 w-3.5" />
										暂无
									</span>
								)}
							</div>
						</TableCell>
						<TableCell className="px-4 py-4">
							{employee.department || employee.departmentCode ? (
								<div className="flex flex-col gap-1">
									{employee.department && (
										<Badge variant="secondary" className="w-fit border-transparent bg-primary/10 text-primary">
											{employee.department}
										</Badge>
									)}
									{employee.departmentCode && (
										<span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">代码 {employee.departmentCode}</span>
									)}
								</div>
							) : (
								<span className="text-xs text-muted-foreground">—</span>
							)}
						</TableCell>
						<TableCell className="px-4 py-4 text-muted-foreground">
							<div className="flex flex-col gap-1">
								<span>{employee.jobTitle ?? '—'}</span>
								{employee.jobGrade && (
									<Badge variant="outline" className="w-fit border-dashed text-xs font-normal text-muted-foreground">
										{employee.jobGrade}
										{employee.jobGradeLevel != null ? ` · L${employee.jobGradeLevel}` : ''}
									</Badge>
								)}
							</div>
						</TableCell>
						<TableCell className="px-4 py-4">
							<EmployeeStatusBadge status={employee.employmentStatus} />
						</TableCell>
						<TableCell className="px-4 py-4 text-muted-foreground">
							{formatDate(employee.hireDate)}
						</TableCell>
						{(canEdit || canDelete || canAssignRoles) && (
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
	);
}
