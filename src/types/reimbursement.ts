export type ReimbursementSourceType = 'purchase' | 'direct';

export type ReimbursementStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'paid';

export type ReimbursementOrganizationType = 'school' | 'company';

export const REIMBURSEMENT_SOURCE_TYPES: readonly ReimbursementSourceType[] = ['purchase', 'direct'] as const;
export const REIMBURSEMENT_STATUSES: readonly ReimbursementStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'paid',
] as const;
export const REIMBURSEMENT_ORGANIZATION_TYPES: readonly ReimbursementOrganizationType[] = [
  'school',
  'company',
] as const;

export const REIMBURSEMENT_CATEGORY_OPTIONS = [
  '交通',
  '餐饮',
  '差旅',
  '办公',
  '招待',
  '物流',
  '采购报销',
  '其他',
] as const;

export type ReimbursementCategory = (typeof REIMBURSEMENT_CATEGORY_OPTIONS)[number] | string;

export type ReimbursementDetails = Record<string, string>;

export type ReimbursementDetailFieldType = 'text' | 'textarea' | 'date' | 'select' | 'number';

export type ReimbursementDetailField = {
  key: string;
  label: string;
  type?: ReimbursementDetailFieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export const REIMBURSEMENT_CATEGORY_FIELDS: Record<string, ReimbursementDetailField[]> = {
  交通: [
    { key: 'transportMode', label: '交通工具', type: 'select', required: true, options: [
      { value: 'taxi', label: '出租车/网约车' },
      { value: 'subway', label: '地铁' },
      { value: 'bus', label: '公交' },
      { value: 'train', label: '高铁/火车' },
      { value: 'flight', label: '飞机' },
      { value: 'other', label: '其他' },
    ] },
    { key: 'origin', label: '出发地', required: true, placeholder: '例如：上海虹桥' },
    { key: 'destination', label: '目的地', required: true, placeholder: '例如：浦东国际机场' },
    { key: 'tripDocNo', label: '行程单号', placeholder: '可填写行程单编号' },
  ],
  餐饮: [
    { key: 'location', label: '消费地点', required: true, placeholder: '例如：XX餐厅' },
    { key: 'attendeeCount', label: '用餐人数', type: 'number', required: true, placeholder: '例如：3' },
    { key: 'businessPurpose', label: '事由说明', type: 'textarea', required: true, placeholder: '例如：客户接待/加班用餐' },
  ],
  差旅: [
    { key: 'startDate', label: '出发日期', type: 'date', required: true },
    { key: 'endDate', label: '返回日期', type: 'date', required: true },
    { key: 'destinationCity', label: '目的地城市', required: true, placeholder: '例如：北京' },
    { key: 'tripPurpose', label: '出差事由', type: 'textarea', required: true, placeholder: '例如：拜访客户/参会' },
  ],
  办公: [
    { key: 'officeItem', label: '物品名称', required: true, placeholder: '例如：打印纸、鼠标' },
    { key: 'officeQty', label: '数量', type: 'number', placeholder: '例如：10' },
    { key: 'officeUsage', label: '使用场景', type: 'textarea', required: true, placeholder: '例如：行政办公' },
  ],
  招待: [
    { key: 'guestOrg', label: '接待对象', required: true, placeholder: '例如：XX公司项目组' },
    { key: 'guestCount', label: '接待人数', type: 'number', placeholder: '例如：5' },
    { key: 'hospitalityPurpose', label: '接待事由', type: 'textarea', required: true, placeholder: '例如：项目洽谈' },
  ],
  物流: [
    { key: 'courierCompany', label: '快递公司', required: true, placeholder: '例如：顺丰' },
    { key: 'trackingNo', label: '快递单号', required: true, placeholder: '请输入快递单号' },
    { key: 'shipmentDesc', label: '物流说明', type: 'textarea', placeholder: '例如：寄送样品材料' },
  ],
  采购报销: [
    { key: 'purchaseUsage', label: '采购用途补充', type: 'textarea', placeholder: '可补充采购与报销关系说明' },
    { key: 'inboundNote', label: '入库备注', placeholder: '可填写入库批次或备注' },
  ],
  其他: [
    { key: 'customType', label: '报销细分类型', required: true, placeholder: '例如：停车费/材料复印' },
    { key: 'customDetail', label: '详细说明', type: 'textarea', required: true, placeholder: '请说明报销场景与必要性' },
  ],
};

export interface ReimbursementRecord {
  id: string;
  reimbursementNumber: string;
  sourceType: ReimbursementSourceType;
  sourcePurchaseId: string | null;
  sourcePurchaseNumber: string | null;
  organizationType: ReimbursementOrganizationType;
  category: ReimbursementCategory;
  title: string;
  amount: number;
  occurredAt: string;
  description: string | null;
  details: ReimbursementDetails;
  invoiceImages: string[];
  receiptImages: string[];
  attachments: string[];
  status: ReimbursementStatus;
  pendingApproverId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  paidBy: string | null;
  paidByName?: string | null;
  paymentNote: string | null;
  applicantId: string;
  applicantName?: string | null;
  pendingApproverName?: string | null;
  approvedByName?: string | null;
  rejectedByName?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReimbursementInput {
  sourceType: ReimbursementSourceType;
  sourcePurchaseId?: string | null;
  organizationType?: ReimbursementOrganizationType;
  category: ReimbursementCategory;
  title: string;
  amount: number;
  occurredAt: string;
  description?: string | null;
  details?: ReimbursementDetails;
  invoiceImages?: string[];
  receiptImages?: string[];
  attachments?: string[];
  applicantId?: string;
}

export interface UpdateReimbursementInput {
  sourceType?: ReimbursementSourceType;
  sourcePurchaseId?: string | null;
  organizationType?: ReimbursementOrganizationType;
  category?: ReimbursementCategory;
  title?: string;
  amount?: number;
  occurredAt?: string;
  description?: string | null;
  details?: ReimbursementDetails;
  invoiceImages?: string[];
  receiptImages?: string[];
  attachments?: string[];
}

export interface ListReimbursementsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ReimbursementStatus;
  sourceType?: ReimbursementSourceType;
  organizationType?: ReimbursementOrganizationType;
  category?: string;
  currentUserId: string;
  scope?: 'mine' | 'approval' | 'pay' | 'all';
  financeOrgType?: ReimbursementOrganizationType | null;
}

export interface ListReimbursementsResult {
  items: ReimbursementRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReimbursementAction = 'create' | 'submit' | 'approve' | 'reject' | 'withdraw' | 'pay';

export interface ReimbursementLog {
  id: string;
  reimbursementId: string;
  action: ReimbursementAction;
  fromStatus: ReimbursementStatus;
  toStatus: ReimbursementStatus;
  operatorId: string;
  comment: string | null;
  createdAt: string;
}

export function isReimbursementStatus(value: string | null | undefined): value is ReimbursementStatus {
  return value != null && REIMBURSEMENT_STATUSES.includes(value as ReimbursementStatus);
}

export function isReimbursementSourceType(value: string | null | undefined): value is ReimbursementSourceType {
  return value != null && REIMBURSEMENT_SOURCE_TYPES.includes(value as ReimbursementSourceType);
}

export function isReimbursementOrganizationType(
  value: string | null | undefined
): value is ReimbursementOrganizationType {
  return value != null && REIMBURSEMENT_ORGANIZATION_TYPES.includes(value as ReimbursementOrganizationType);
}
