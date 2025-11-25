/**
 * 项目状态
 */
export type ProjectStatus =
  | 'planning' // 计划中
  | 'active' // 进行中
  | 'on_hold' // 暂停
  | 'completed' // 已完成
  | 'archived' // 已归档
  | 'cancelled'; // 已取消

/**
 * 项目优先级
 */
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

import type { InvoiceType } from '@/types/finance';

export type ContractType = 'service' | 'purchase' | 'maintenance' | 'consulting' | 'other';
export type CurrencyCode = 'CNY' | 'USD' | 'HKD' | 'EUR' | 'JPY' | 'GBP' | 'OTHER';
export type ContractRiskLevel = 'low' | 'medium' | 'high';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';

export type ProjectPaymentStatus = 'scheduled' | 'invoiced' | 'received' | 'cancelled';

export interface ProjectPaymentInput {
  title: string;
  amount: number;
  expectedDate: string;
  receivedDate?: string | null;
  milestoneId?: string | null;
  description?: string | null;
  status?: ProjectPaymentStatus;
  invoiceType?: InvoiceType;
  invoiceNumber?: string | null;
  invoiceIssueDate?: string | null;
  invoiceAttachments?: string[];
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProjectPayment extends ProjectPaymentInput {
  id: string;
  projectId: string;
  invoiceType: InvoiceType;
  invoiceAttachments: string[];
  createdBy: string;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  status: ProjectPaymentStatus;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string | null;
  amount: number | null;
  status: MilestoneStatus;
}

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
  contractNumber: string | null;
  contractType: ContractType | null;
  signingDate: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  partyA: string | null;
  partyB: string | null;
  currency: CurrencyCode;
  taxRate: number;
  paymentTerms: string | null;
  riskLevel: ContractRiskLevel;
  attachments: string[];
  milestones: ProjectMilestone[];
  
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
  contractNumber?: string;
  contractType?: ContractType;
  signingDate?: string;
  effectiveDate?: string;
  expirationDate?: string;
  partyA?: string;
  partyB?: string;
  currency?: CurrencyCode;
  taxRate?: number;
  paymentTerms?: string;
  riskLevel?: ContractRiskLevel;
  attachments?: string[];
  milestones?: ProjectMilestone[];
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
  contractNumber?: string | null;
  contractType?: ContractType | null;
  signingDate?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  partyA?: string | null;
  partyB?: string | null;
  currency?: CurrencyCode;
  taxRate?: number;
  paymentTerms?: string | null;
  riskLevel?: ContractRiskLevel;
  attachments?: string[];
  milestones?: ProjectMilestone[];
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
