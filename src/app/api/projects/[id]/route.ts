import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { deleteProject, findProjectById, updateProject } from '@/lib/db/projects';
import { checkPermission, Permissions } from '@/lib/permissions';
import { parseUpdateProjectPayload, ProjectValidationError } from '../validators';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: projectId } = await params;
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const project = await findProjectById(projectId);
		if (!project || project.isDeleted) {
			return errorResponse('未找到项目', 404, 'PROJECT_NOT_FOUND');
		}

		const viewAll = await checkPermission(permissionUser, Permissions.PROJECT_VIEW_ALL);
		const isTeamMember =
			project.projectManagerId === context.user.id || project.teamMemberIds.includes(context.user.id);

		if (!viewAll.allowed && !isTeamMember) {
			return errorResponse('无权访问', 403, 'FORBIDDEN');
		}

		return successResponse(project);
	} catch (error) {
		return handleApiError(error, '获取项目详情失败');
	}
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: projectId } = await params;
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const existing = await findProjectById(projectId);
		if (!existing || existing.isDeleted) {
			return errorResponse('未找到项目', 404, 'PROJECT_NOT_FOUND');
		}

		const canUpdate = await checkPermission(permissionUser, Permissions.PROJECT_UPDATE);
		const isTeamMember =
			existing.projectManagerId === context.user.id || existing.teamMemberIds.includes(context.user.id);
		if (!canUpdate.allowed && !isTeamMember) {
			return errorResponse('无权访问', 403, 'FORBIDDEN');
		}

		const body = await request.json();
		const payload = parseUpdateProjectPayload(body);
		if (!Object.keys(payload).length) {
			return errorResponse('没有可更新的字段', 400, 'NO_CHANGES');
		}

		const updated = await updateProject(projectId, payload);
		return successResponse(updated);
	} catch (error) {
		if (error instanceof ProjectValidationError) {
			return errorResponse(error.message, 400, 'VALIDATION_ERROR');
		}
		if (error instanceof Error) {
			if (error.message === 'PROJECT_MANAGER_NOT_FOUND') {
				return errorResponse('负责人不存在或已被禁用，请选择系统内的有效用户', 400, 'INVALID_MANAGER');
			}
			if (error.message === 'PROJECT_NOT_FOUND') {
				return errorResponse('未找到项目', 404, 'PROJECT_NOT_FOUND');
			}
			if (error.message === 'CONTRACT_NUMBER_EXISTS') {
				return errorResponse('合同编号已存在', 409, 'CONFLICT');
			}
		}
		return handleApiError(error, '更新项目失败');
	}
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: projectId } = await params;
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const existing = await findProjectById(projectId);
		if (!existing || existing.isDeleted) {
			return errorResponse('未找到项目', 404, 'PROJECT_NOT_FOUND');
		}

		const canDelete = await checkPermission(permissionUser, Permissions.PROJECT_DELETE);
		if (!canDelete.allowed) {
			return errorResponse('无权访问', 403, 'FORBIDDEN');
		}

		await deleteProject(projectId);
		return successResponse(null);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'PROJECT_NOT_FOUND') {
				return errorResponse('未找到项目', 404, 'PROJECT_NOT_FOUND');
			}
		}
		return handleApiError(error, '删除项目失败');
	}
}
