export type WorkflowApprovalMode = 'serial' | 'any';
export type WorkflowNodeType =
  | 'user_activity'
  | 'system_activity'
  | 'sub_process'
  | 'connection'
  | 'circulate';

export type WorkflowCondition = {
  minAmount?: number | null;
  maxAmount?: number | null;
  organizationType?: 'school' | 'company' | 'all';
};

export type WorkflowApproverType = 'role' | 'user';
export type WorkflowNodePosition = { x: number; y: number };
export type WorkflowPortDirection = 'top' | 'right' | 'bottom' | 'left';

export interface PurchaseWorkflowEdge {
  id: string;
  sourceId: string;
  sourcePort: WorkflowPortDirection;
  targetId: string;
  targetPort: WorkflowPortDirection;
}

export interface PurchaseWorkflowNode {
  id: string;
  nodeType?: WorkflowNodeType;
  name: string;
  approverType: WorkflowApproverType;
  approverRole: string | null;
  approverUserId: string | null;
  approvalMode: WorkflowApprovalMode;
  timeoutHours: number;
  requiredComment: boolean;
  condition: WorkflowCondition;
  position?: WorkflowNodePosition | null;
  extras?: Record<string, unknown> | null;
}

export interface PurchaseWorkflowConfig {
  workflowKey: string;
  name: string;
  enabled: boolean;
  nodes: PurchaseWorkflowNode[];
  edges: PurchaseWorkflowEdge[];
  updatedAt: string;
  updatedBy: string | null;
}

export interface PurchaseWorkflowConfigInput {
  name: string;
  enabled: boolean;
  nodes: PurchaseWorkflowNode[];
  edges?: PurchaseWorkflowEdge[];
}
