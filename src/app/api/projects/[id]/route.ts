import { NextRequest, NextResponse } from 'next/server';
import {
  findProjectById,
  updateProject,
  deleteProject,
} from '@/lib/db/projects';
import { checkPermission, Permissions, canEditProject } from '@/lib/permissions';
import { getCurrentUser } from '@/lib/auth/current-user';
import type { UpdateProjectInput } from '@/types/project';

/**
 * GET /api/projects/[id]
 * 获取单个项目详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check permission
    const canViewAll = await checkPermission(context.user as any, Permissions.PROJECT_VIEW_ALL);
    
    const project = await findProjectById(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // If user can't view all, check if they're the project manager
    if (!canViewAll && project.projectManagerId !== context.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to view this project' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[id]
 * 更新项目
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const project = await findProjectById(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canEdit = await canEditProject(context.user as any, project.projectManagerId);
    if (!canEdit) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to edit this project' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const input: UpdateProjectInput = {
      projectName: body.projectName,
      description: body.description,
      clientName: body.clientName,
      contractAmount: body.contractAmount,
      budget: body.budget,
      startDate: body.startDate,
      endDate: body.endDate,
      expectedEndDate: body.expectedEndDate,
      projectManagerId: body.projectManagerId,
      teamMemberIds: body.teamMemberIds,
      status: body.status,
      priority: body.priority,
    };

    // Update project
    const updatedProject = await updateProject(id, input);

    return NextResponse.json({
      success: true,
      data: updatedProject,
    });
  } catch (error: any) {
    console.error('PATCH /api/projects/[id] error:', error);
    
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]
 * 删除项目（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const project = await findProjectById(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canDelete = await checkPermission(context.user as any, Permissions.PROJECT_DELETE);
    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to delete projects' },
        { status: 403 }
      );
    }

    // Delete project (soft delete)
    await deleteProject(id);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error: any) {
    console.error('DELETE /api/projects/[id] error:', error);
    
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
