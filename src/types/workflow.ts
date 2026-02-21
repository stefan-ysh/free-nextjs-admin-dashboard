// ──────────────────────────────────────────────────
// 工作流节点类型
// ──────────────────────────────────────────────────
export type WorkflowNodeType = 'START' | 'APPROVAL' | 'CC' | 'NOTIFY' | 'CONDITION' | 'END';

export interface WorkflowNodeBase {
  id: string;
  type: WorkflowNodeType;
  name: string;
}

export interface WorkflowStartNode extends WorkflowNodeBase {
  type: 'START';
}

export interface WorkflowEndNode extends WorkflowNodeBase {
  type: 'END';
}

export interface WorkflowApprovalNode extends WorkflowNodeBase {
  type: 'APPROVAL';
  approverType: 'USER' | 'ROLE';
  users?: string[];
  roles?: string[];
}

/** 抄送节点：让相关人知晓消息，不阻塞流程 */
export interface WorkflowCcNode extends WorkflowNodeBase {
  type: 'CC';
  users?: string[];
  roles?: string[];   // 如 ['applicant']
}

/** 通知节点：发送邮件通知指定人员 */
export interface WorkflowNotifyNode extends WorkflowNodeBase {
  type: 'NOTIFY';
  users?: string[];
  roles?: string[];
  emailTemplate?: string;
}

// ──────────────────────────────────────────────────
// 条件分支
// ──────────────────────────────────────────────────

/** 条件字段的数据类型 */
export type ConditionFieldType = 'number' | 'date' | 'text' | 'enum';

/** 条件运算符 - 按字段类型分组 */
export type ConditionNumberOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between';
export type ConditionDateOp = 'before' | 'after' | 'on' | 'between';
export type ConditionTextOp = 'eq' | 'neq' | 'contains' | 'not_contains' | 'starts_with';
export type ConditionEnumOp = 'eq' | 'neq' | 'in';
export type ConditionOp = ConditionNumberOp | ConditionDateOp | ConditionTextOp | ConditionEnumOp;

/** 条件字段定义 */
export interface ConditionFieldDef {
  key: string;
  label: string;
  fieldType: ConditionFieldType;
  /** 仅 enum 类型使用 */
  options?: { value: string; label: string }[];
}

export interface WorkflowConditionNode extends WorkflowNodeBase {
  type: 'CONDITION';
  conditionField: string;
  conditionFieldType: ConditionFieldType;
  conditionOp: ConditionOp;
  conditionValue: string;
  /** 仅 between 操作使用 */
  conditionValue2?: string;
}

export type WorkflowNode =
  | WorkflowStartNode
  | WorkflowEndNode
  | WorkflowApprovalNode
  | WorkflowCcNode
  | WorkflowNotifyNode
  | WorkflowConditionNode;

// ──────────────────────────────────────────────────
// 连线条件
// ──────────────────────────────────────────────────
export type WorkflowEdgeCondition = 'APPROVED' | 'REJECTED' | 'CONDITION_TRUE' | 'CONDITION_FALSE' | 'ALWAYS';

export interface WorkflowEdge {
  source: string;
  target: string;
  condition?: WorkflowEdgeCondition;
}

// ──────────────────────────────────────────────────
// 流程定义
// ──────────────────────────────────────────────────
export interface WorkflowDefinitionJson {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface SystemWorkflowDefinition {
  id: string;
  moduleName: string;
  organizationType: string;
  workflowNodes: WorkflowDefinitionJson;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

// ──────────────────────────────────────────────────
// 条件字段 Schema（采购单 + 报销单）
// ──────────────────────────────────────────────────

export const PURCHASE_CONDITION_FIELDS: ConditionFieldDef[] = [
  { key: 'totalAmount', label: '采购总额', fieldType: 'number' },
  { key: 'quantity', label: '数量', fieldType: 'number' },
  { key: 'unitPrice', label: '单价', fieldType: 'number' },
  { key: 'feeAmount', label: '费用金额', fieldType: 'number' },
  { key: 'purchaseDate', label: '采购日期', fieldType: 'date' },
  { key: 'itemName', label: '物品名称', fieldType: 'text' },
  { key: 'specification', label: '规格', fieldType: 'text' },
  { key: 'purpose', label: '用途', fieldType: 'text' },
  {
    key: 'organizationType', label: '组织类型', fieldType: 'enum',
    options: [{ value: 'company', label: '单位' }, { value: 'school', label: '学校' }],
  },
  {
    key: 'purchaseChannel', label: '采购渠道', fieldType: 'enum',
    options: [
      { value: 'taobao', label: '淘宝' },
      { value: 'jd', label: '京东' },
      { value: 'pdd', label: '拼多多' },
      { value: 'offline', label: '线下采购' },
      { value: 'other', label: '其他' },
    ],
  },
  {
    key: 'paymentType', label: '付款类型', fieldType: 'enum',
    options: [
      { value: 'deposit', label: '定金' },
      { value: 'full_payment', label: '全款' },
      { value: 'installment', label: '分期' },
      { value: 'balance', label: '尾款' },
      { value: 'other', label: '其他' },
    ],
  },
];

export const REIMBURSEMENT_CONDITION_FIELDS: ConditionFieldDef[] = [
  { key: 'amount', label: '报销金额', fieldType: 'number' },
  { key: 'occurredAt', label: '发生日期', fieldType: 'date' },
  { key: 'title', label: '报销标题', fieldType: 'text' },
  {
    key: 'category', label: '报销类别', fieldType: 'enum',
    options: [
      { value: '交通', label: '交通' },
      { value: '餐饮', label: '餐饮' },
      { value: '差旅', label: '差旅' },
      { value: '办公', label: '办公' },
      { value: '招待', label: '招待' },
      { value: '物流', label: '物流' },
      { value: '采购报销', label: '采购报销' },
      { value: '其他', label: '其他' },
    ],
  },
  {
    key: 'organizationType', label: '组织类型', fieldType: 'enum',
    options: [{ value: 'company', label: '单位' }, { value: 'school', label: '学校' }],
  },
  {
    key: 'sourceType', label: '来源类型', fieldType: 'enum',
    options: [{ value: 'purchase', label: '采购关联' }, { value: 'direct', label: '直接报销' }],
  },
];

/** 所有可用的条件字段 */
export const ALL_CONDITION_FIELDS: { group: string; fields: ConditionFieldDef[] }[] = [
  { group: '📦 采购单', fields: PURCHASE_CONDITION_FIELDS },
  { group: '💰 报销单', fields: REIMBURSEMENT_CONDITION_FIELDS },
];

/** 根据字段类型获取可用运算符 */
export function getOperatorsForFieldType(fieldType: ConditionFieldType): { value: string; label: string }[] {
  switch (fieldType) {
    case 'number':
      return [
        { value: 'gt', label: '大于 (>)' },
        { value: 'gte', label: '大于等于 (≥)' },
        { value: 'lt', label: '小于 (<)' },
        { value: 'lte', label: '小于等于 (≤)' },
        { value: 'eq', label: '等于 (=)' },
        { value: 'neq', label: '不等于 (≠)' },
        { value: 'between', label: '区间范围' },
      ];
    case 'date':
      return [
        { value: 'before', label: '早于' },
        { value: 'after', label: '晚于' },
        { value: 'on', label: '等于（当天）' },
        { value: 'between', label: '日期范围' },
      ];
    case 'text':
      return [
        { value: 'eq', label: '等于' },
        { value: 'neq', label: '不等于' },
        { value: 'contains', label: '包含' },
        { value: 'not_contains', label: '不包含' },
        { value: 'starts_with', label: '开头是' },
      ];
    case 'enum':
      return [
        { value: 'eq', label: '等于' },
        { value: 'neq', label: '不等于' },
        { value: 'in', label: '属于（多选）' },
      ];
    default:
      return [];
  }
}
