import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { deleteProject, findProjectById, updateProject } from '@/lib/db/projects';
import { checkPermission, Permissions } from '@/lib/permissions';
import { parseUpdateProjectPayload, ProjectValidationError } from '../validators';

function unauthorizedResponse() {
	return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
	return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function notFoundResponse() {
	return NextResponse.json({ success: false, error: '未找到项目' }, { status: 404 });
}

function badRequestResponse(message: string) {
	return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function conflictResponse(message: string) {
	return NextResponse.json({ success: false, error: message }, { status: 409 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: projectId } = await params;
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const project = await findProjectById(projectId);
		if (!project || project.isDeleted) {
			return notFoundResponse();
		}

		const viewAll = await checkPermission(permissionUser, Permissions.PROJECT_VIEW_ALL);
		const isTeamMember =
			project.projectManagerId === context.user.id || project.teamMemberIds.includes(context.user.id);

		if (!viewAll.allowed && !isTeamMember) {
			return forbiddenResponse();
		}

		return NextResponse.json({ success: true, data: project });
	} catch (error) {
		if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
			return unauthorizedResponse();
		}
		console.error('获取项目详情失败', error);
		return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
	}
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: projectId } = await params;
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const existing = await findProjectById(projectId);
		if (!existing || existing.isDeleted) {
			return notFoundResponse();
		}

		const canUpdate = await checkPermission(permissionUser, Permissions.PROJECT_UPDATE);
		const isTeamMember =
			existing.projectManagerId === context.user.id || existing.teamMemberIds.includes(context.user.id);
		if (!canUpdate.allowed && !isTeamMember) {
			return forbiddenResponse();
		}

		const body = await request.json();
		const payload = parseUpdateProjectPayload(body);
		if (!Object.keys(payload).length) {
			return badRequestResponse('没有可更新的字段');
		}

		const updated = await updateProject(projectId, payload);
		return NextResponse.json({ success: true, data: updated });
	} catch (error) {
		if (error instanceof ProjectValidationError) {
			return badRequestResponse(error.message);
		}
		if (error instanceof Error) {
			if (error.message === 'PROJECT_MANAGER_NOT_FOUND') {
				return badRequestResponse('负责人不存在或已被禁用，请选择系统内的有效用户');
			}
			if (error.message === 'PROJECT_NOT_FOUND') {
				return notFoundResponse();
			}
			if (error.message === 'CONTRACT_NUMBER_EXISTS') {
				return conflictResponse('合同编号已存在');
			}
			if (error.message === 'UNAUTHENTICATED') {
				return unauthorizedResponse();
			}
		}
		console.error('更新项目失败', error);
		return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
	}
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: projectId } = await params;
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const existing = await findProjectById(projectId);
		if (!existing || existing.isDeleted) {
			return notFoundResponse();
		}

		const canDelete = await checkPermission(permissionUser, Permissions.PROJECT_DELETE);
		if (!canDelete.allowed) {
			return forbiddenResponse();
		}

		await deleteProject(projectId);
		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'UNAUTHENTICATED') {
				return unauthorizedResponse();
			}
			if (error.message === 'PROJECT_NOT_FOUND') {
				return notFoundResponse();
			}
		}
		console.error('删除项目失败', error);
		return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
	}
}
