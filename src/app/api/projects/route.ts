import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { createProject, getUserProjects, listProjects } from '@/lib/db/projects';
import { checkPermission, Permissions } from '@/lib/permissions';
import type { ListProjectsParams, ProjectPriority, ProjectRecord, ProjectStatus } from '@/types/project';
import { parseCreateProjectPayload, ProjectValidationError } from './validators';

function unauthorizedResponse() {
	return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function serverErrorResponse() {
	return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
}

function forbiddenResponse(reason = '无权访问') {
	return NextResponse.json({ success: false, error: reason }, { status: 403 });
}

function badRequestResponse(message: string) {
	return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function conflictResponse(message: string) {
	return NextResponse.json({ success: false, error: message }, { status: 409 });
}

const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled'];
const PROJECT_PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high', 'urgent'];
const SORT_FIELDS = ['createdAt', 'updatedAt', 'startDate', 'projectName', 'status'] as const;
type SortField = (typeof SORT_FIELDS)[number];
const SORT_ORDERS = ['asc', 'desc'] as const;
type SortOrder = (typeof SORT_ORDERS)[number];

const MAX_PAGE_SIZE = 50;

function isProjectStatus(value: string | null): value is ProjectStatus {
	return value != null && PROJECT_STATUSES.includes(value as ProjectStatus);
}

function isProjectPriority(value: string | null): value is ProjectPriority {
	return value != null && PROJECT_PRIORITIES.includes(value as ProjectPriority);
}

function isSortField(value: string | null): value is SortField {
	return value != null && SORT_FIELDS.includes(value as SortField);
}

function isSortOrder(value: string | null): value is SortOrder {
	return value != null && SORT_ORDERS.includes(value as SortOrder);
}

function filterProjects(projects: ProjectRecord[], params: ListProjectsParams): ProjectRecord[] {
	let result = [...projects];
	if (params.status && params.status !== 'all') {
		result = result.filter((project) => project.status === params.status);
	}
	if (params.priority) {
		result = result.filter((project) => project.priority === params.priority);
	}
	if (params.projectManagerId) {
		result = result.filter((project) => project.projectManagerId === params.projectManagerId);
	}
	if (params.search) {
		const keyword = params.search.trim().toLowerCase();
		if (keyword) {
			result = result.filter((project) => {
				const haystacks = [
					project.projectName,
					project.projectCode,
					project.clientName,
					project.description ?? undefined,
				];
				return haystacks.some((value) => value && value.toLowerCase().includes(keyword));
			});
		}
	}
	return result;
}

function sortProjects(projects: ProjectRecord[], sortBy: SortField, sortOrder: SortOrder): ProjectRecord[] {
	const multiplier = sortOrder === 'asc' ? 1 : -1;
	const getSortableValue = (project: ProjectRecord): string => {
		switch (sortBy) {
			case 'createdAt':
				return project.createdAt;
			case 'updatedAt':
				return project.updatedAt;
			case 'startDate':
				return project.startDate ?? '';
			case 'projectName':
				return project.projectName;
			case 'status':
				return project.status;
			default:
				return project.updatedAt;
		}
	};

	return [...projects].sort((a, b) => {
		const aValue = getSortableValue(a);
		const bValue = getSortableValue(b);
		if (aValue === bValue) {
			return a.id.localeCompare(b.id) * multiplier;
		}
		return aValue.localeCompare(bValue) * multiplier;
	});
}

export async function GET(request: Request) {
	try {
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const viewAll = await checkPermission(permissionUser, Permissions.PROJECT_VIEW_ALL);

		const { searchParams } = new URL(request.url);
		const params: ListProjectsParams = {
			includeDeleted: false,
		};

		params.search = searchParams.get('search') ?? undefined;
		const statusParam = searchParams.get('status');
		if (statusParam === 'all') {
			params.status = 'all';
		} else if (isProjectStatus(statusParam)) {
			params.status = statusParam;
		}
		const priorityParam = searchParams.get('priority');
		if (isProjectPriority(priorityParam)) {
			params.priority = priorityParam;
		}
		const projectManagerParam = searchParams.get('projectManagerId');
		if (projectManagerParam) {
			params.projectManagerId = projectManagerParam;
		}

		const sortByParam = searchParams.get('sortBy');
		params.sortBy = isSortField(sortByParam) ? sortByParam : 'updatedAt';
		const sortOrderParam = searchParams.get('sortOrder');
		params.sortOrder = isSortOrder(sortOrderParam) ? sortOrderParam : 'desc';

		const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
		params.page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
		const pageSizeParam = Number.parseInt(searchParams.get('pageSize') ?? '20', 10);
		const pageSize = Number.isNaN(pageSizeParam) ? 20 : Math.max(1, Math.min(pageSizeParam, MAX_PAGE_SIZE));
		params.pageSize = pageSize;

		if (viewAll.allowed) {
			const result = await listProjects(params);
			return NextResponse.json({ success: true, data: result });
		}

		const userProjects = await getUserProjects(context.user.id);
		const filtered = filterProjects(userProjects, params);
		const sorted = sortProjects(filtered, params.sortBy ?? 'updatedAt', params.sortOrder ?? 'desc');
		const startIndex = ((params.page ?? 1) - 1) * (params.pageSize ?? 20);
		const endIndex = startIndex + (params.pageSize ?? 20);
		const items = sorted.slice(startIndex, endIndex);

		return NextResponse.json({
			success: true,
			data: {
				items,
				total: filtered.length,
				page: params.page ?? 1,
				pageSize: params.pageSize ?? 20,
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
			return unauthorizedResponse();
		}
		console.error('获取项目列表失败', error);
		return serverErrorResponse();
	}
}

export async function POST(request: Request) {
	try {
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const canCreate = await checkPermission(permissionUser, Permissions.PROJECT_CREATE);
		if (!canCreate.allowed) {
			return forbiddenResponse(canCreate.reason ?? '无权创建项目');
		}

		const body = await request.json();
		const payload = parseCreateProjectPayload(body);
		const project = await createProject(payload, context.user.id);
		return NextResponse.json({ success: true, data: project }, { status: 201 });
	} catch (error) {
		if (error instanceof ProjectValidationError) {
			return badRequestResponse(error.message);
		}
		if (error instanceof Error) {
			if (error.message === 'PROJECT_MANAGER_NOT_FOUND') {
				return badRequestResponse('负责人不存在或已被禁用，请选择系统内的有效用户');
			}
			if (error.message === 'PROJECT_CODE_EXISTS') {
				return conflictResponse('项目编号已存在');
			}
			if (error.message === 'CONTRACT_NUMBER_EXISTS') {
				return conflictResponse('合同编号已存在');
			}
			if (error.message === 'UNAUTHENTICATED') {
				return unauthorizedResponse();
			}
		}
		console.error('创建项目失败', error);
		return serverErrorResponse();
	}
}
