import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getRecord, updateRecord, deleteRecord } from '@/lib/db/finance';
import { checkPermission, Permissions } from '@/lib/permissions';
import { FinanceApiResponse, FinanceRecord } from '@/types/finance';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

/**
 * GET - 获取单条记录
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const record = await getRecord(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    const response: FinanceApiResponse<FinanceRecord> = {
      success: true,
      data: record,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Error fetching record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch record' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - 更新记录
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_MANAGE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const body = await request.json();

    // Handle handlerId update by merging into metadata
    if (body.handlerId) {
      const existing = await getRecord(id);
      if (existing) {
        body.metadata = {
          ...existing.metadata,
          handlerId: body.handlerId,
        };
        delete body.handlerId;
      }
    }

    const record = await updateRecord(id, body);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    const response: FinanceApiResponse<FinanceRecord> = {
      success: true,
      data: record,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Error updating record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - 删除记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_MANAGE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const success = await deleteRecord(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Error deleting record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete record' },
      { status: 500 }
    );
  }
}
