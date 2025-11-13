import { NextRequest, NextResponse } from 'next/server';
import {
  listProjects,
  createProject,
  getProjectStats,
} from '@/lib/db/projects';
import { checkPermission, Permissions } from '@/lib/permissions';
import { getCurrentUser } from '@/lib/auth/current-user';
import type { CreateProjectInput } from '@/types/project';

/**
 * GET /api/projects
 * 获取项目列表
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission
    const canViewAll = await checkPermission(context.user as any, Permissions.PROJECT_VIEW_ALL);

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const search = searchParams.get('search') || undefined;
    const managerId = searchParams.get('managerId') || undefined;
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Get statistics if requested
    if (searchParams.get('stats') === 'true') {
      const stats = await getProjectStats();
      return NextResponse.json({
        success: true,
        data: stats,
      });
    }

    // List projects - if user can't view all, only show their managed projects
    const result = await listProjects({
      page,
      pageSize,
      status: status as any,
      priority: priority as any,
      search,
      projectManagerId: managerId || (canViewAll ? undefined : context.user.id),
      includeDeleted,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * 创建新项目
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission
    const canCreate = await checkPermission(context.user as any, Permissions.PROJECT_CREATE);
    if (!canCreate) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to create projects' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const input: CreateProjectInput = {
      projectCode: body.projectCode,
      projectName: body.projectName,
      description: body.description || null,
      clientName: body.clientName || null,
      contractAmount: body.contractAmount || null,
      budget: body.budget || null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      expectedEndDate: body.expectedEndDate || null,
      projectManagerId: body.projectManagerId,
      teamMemberIds: body.teamMemberIds || [],
      status: body.status || 'planning',
      priority: body.priority || 'medium',
    };

    // Validate required fields
    if (!input.projectName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    if (!input.projectManagerId) {
      return NextResponse.json(
        { success: false, error: 'Project manager is required' },
        { status: 400 }
      );
    }

    // Create project
    const project = await createProject(input, context.user.id);

    return NextResponse.json({
      success: true,
      data: project,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/projects error:', error);
    
    if (error.message?.includes('already exists')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
