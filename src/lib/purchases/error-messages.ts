const PURCHASE_VALIDATION_MESSAGES: Record<string, string> = {
  PURCHASE_DATE_REQUIRED: '请选择采购日期',
  INVALID_PURCHASE_DATE: '采购日期格式不正确，请重新选择',
  PURCHASE_LINK_REQUIRED: '线上采购请填写购买链接',
  PURCHASE_LOCATION_REQUIRED: '线下采购请填写采购地点',
  INVALID_QUANTITY: '数量需要大于 0',
  INVALID_UNIT_PRICE: '单价不能为负数',
  INVALID_FEE_AMOUNT: '手续费金额不正确，请填写大于等于 0 的数字',
  INVALID_PAYMENT_TYPE: '请选择正确的付款方式',
  PROJECT_REQUIRED: '请选择需要关联的项目',
  PROJECT_NOT_ALLOWED: '当前采购不需要关联项目，请取消选择',
  PROJECT_NOT_FOUND: '选择的项目不存在或已被删除',
  PURCHASER_REQUIRED: '请选择采购人',
  CREATED_BY_REQUIRED: '当前登录信息异常，请重新登录后再试',
  CREATED_BY_NOT_FOUND: '创建人不存在或已被禁用，请重新登录后再试',
  PURCHASER_NOT_FOUND: '采购人不存在或已被禁用，请重新选择',
  INVALID_INVOICE_STATUS: '发票状态填写有误，请重新选择',
  NOT_EDITABLE: '当前状态下不能修改采购信息',
  NOT_SUBMITTABLE: '当前状态无法提交报销，请先确认记录为草稿或已驳回',
  NOT_APPROVABLE: '只有待审批的采购记录才能进行审批',
  NOT_REJECTABLE: '只有待审批的采购记录才能驳回',
  NOT_PAYABLE: '请先完成审批，只有已审批的采购才能打款',
  NOT_WITHDRAWABLE: '该采购当前无法撤回',
  NOT_DELETABLE: '当前状态禁止删除采购记录',
  INVOICE_FILES_REQUIRED: '请先上传发票凭证后再提交报销',
  PURCHASE_NOT_FOUND: '采购记录不存在或已被删除',
};

const GENERIC_MESSAGE = '采购信息填写有误，请检查后再试';

export function mapPurchaseValidationError(error: unknown): string | null {
  if (!error) return null;
  const code = error instanceof Error ? error.message : String(error);
  if (!code) return null;
  const friendly = PURCHASE_VALIDATION_MESSAGES[code];
  if (friendly) return friendly;
  if (
    code.startsWith('PURCHASE_') ||
    code.startsWith('INVALID_') ||
    code.startsWith('PROJECT_') ||
    code.startsWith('MISSING_') ||
    code.startsWith('NOT_')
  ) {
    return GENERIC_MESSAGE;
  }
  return null;
}
