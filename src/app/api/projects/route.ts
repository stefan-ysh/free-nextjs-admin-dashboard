import { NextRequest, NextResponse } from 'next/server';
import {
  listProjects,
  createProject,
  getProjectStats,
} from '@/lib/db/projects';
import { checkPermission, Permissions } from '@/lib/permissions';
import { getCurrentUser } from '@/lib/auth/current-user';
import type { CreateProjectInput, ListProjectsParams, ProjectPriority, ProjectStatus } from '@/types/project';
import type { UserProfile } from '@/types/user';

const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled'];
const PROJECT_PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high', 'urgent'];

function isProjectStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

function isProjectPriority(value: string): value is ProjectPriority {
  return PROJECT_PRIORITIES.includes(value as ProjectPriority);
}

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
    const userForPermission = context.user as unknown as UserProfile;
    const permissionResult = await checkPermission(userForPermission, Permissions.PROJECT_VIEW_ALL);
    const canViewAll = permissionResult.allowed;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') || '20', 10);
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
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
    const params: ListProjectsParams = {
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 20 : pageSize,
      search,
      includeDeleted,
      projectManagerId: managerId || (canViewAll ? undefined : context.user.id),
    };

    if (statusParam === 'all') {
      params.status = 'all';
    } else if (statusParam && isProjectStatus(statusParam)) {
      params.status = statusParam;
    }

    if (priorityParam && isProjectPriority(priorityParam)) {
      params.priority = priorityParam;
    }

    const result = await listProjects(params);

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
    const userForPermission = context.user as unknown as UserProfile;
    const canCreate = await checkPermission(userForPermission, Permissions.PROJECT_CREATE);
    if (!canCreate.allowed) {
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
  } catch (error: unknown) {
    console.error('POST /api/projects error:', error);

    if (error instanceof Error && error.message.includes('already exists')) {
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
