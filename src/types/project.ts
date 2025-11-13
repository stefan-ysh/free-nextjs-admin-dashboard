/**
 * 项目状态
 */
export type ProjectStatus = 
  | 'planning'      // 计划中
  | 'active'        // 进行中
  | 'on_hold'       // 暂停
  | 'completed'     // 已完成
  | 'archived'      // 已归档
  | 'cancelled';    // 已取消

/**
 * 项目优先级
 */
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * 项目记录
 */
export interface ProjectRecord {
  id: string;
  projectCode: string;
  projectName: string;
  description: string | null;
  
  // 客户和财务
  clientName: string | null;
  contractAmount: number | null;
  budget: number | null;
  actualCost: number;
  
  // 时间
  startDate: string | null;
  endDate: string | null;
  expectedEndDate: string | null;
  
  // 团队
  projectManagerId: string;
  teamMemberIds: string[];
  
  // 状态
  status: ProjectStatus;
  priority: ProjectPriority;
  
  // 审计
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isDeleted: boolean;
  deletedAt: string | null;
}

/**
 * 创建项目输入
 */
export interface CreateProjectInput {
  projectCode: string;
  projectName: string;
  description?: string;
  clientName?: string;
  contractAmount?: number;
  budget?: number;
  startDate?: string;
  endDate?: string;
  expectedEndDate?: string;
  projectManagerId: string;
  teamMemberIds?: string[];
  status?: ProjectStatus;
  priority?: ProjectPriority;
}

/**
 * 更新项目输入
 */
export interface UpdateProjectInput {
  projectName?: string;
  description?: string | null;
  clientName?: string | null;
  contractAmount?: number | null;
  budget?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  expectedEndDate?: string | null;
  projectManagerId?: string;
  teamMemberIds?: string[];
  status?: ProjectStatus;
  priority?: ProjectPriority;
}

/**
 * 项目列表查询参数
 */
export interface ListProjectsParams {
  search?: string;
  status?: ProjectStatus | 'all';
  priority?: ProjectPriority;
  projectManagerId?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'startDate' | 'projectName' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 项目列表结果
 */
export interface ListProjectsResult {
  items: ProjectRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 项目统计信息
 */
export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
  totalActualCost: number;
  costUtilization: number; // 成本使用率 %
}

/**
 * 项目详情（含关联信息）
 */
export interface ProjectDetail extends ProjectRecord {
  projectManager: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  teamMembers: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
  }>;
  purchaseCount: number;
  purchaseTotal: number;
}
