const REIMBURSEMENT_ERROR_MESSAGES: Record<string, string> = {
  REIMBURSEMENT_NOT_FOUND: '报销单不存在或已删除',
  REIMBURSEMENT_NOT_EDITABLE: '当前状态不允许修改报销单',
  REIMBURSEMENT_LINKED_PURCHASE_LOCKED: '关联采购单的报销在提交后不可修改',
  REIMBURSEMENT_NOT_SUBMITTABLE: '当前状态不允许提交报销',
  REIMBURSEMENT_NOT_APPROVABLE: '仅待审批报销单可执行审批',
  REIMBURSEMENT_NOT_REJECTABLE: '仅待审批或待打款报销单可执行驳回',
  REIMBURSEMENT_NOT_WITHDRAWABLE: '当前状态不允许撤回报销',
  REIMBURSEMENT_NOT_PAYABLE: '仅待审批或已审批报销单可执行打款',
  REIMBURSEMENT_TITLE_REQUIRED: '请填写报销标题',
  REIMBURSEMENT_CATEGORY_REQUIRED: '请选择报销分类',
  REIMBURSEMENT_AMOUNT_INVALID: '报销金额必须大于 0',
  INVALID_OCCURRED_DATE: '报销发生日期格式不正确',
  REIMBURSEMENT_SOURCE_INVALID: '报销来源类型不正确',
  REIMBURSEMENT_ORG_INVALID: '报销组织类型不正确',
  REIMBURSEMENT_REJECT_REASON_REQUIRED: '请填写驳回原因',
  SOURCE_PURCHASE_REQUIRED: '请选择关联采购单',
  SOURCE_PURCHASE_NOT_FOUND: '关联采购单不存在或已删除',
  SOURCE_PURCHASE_ALREADY_LINKED: '该采购单已关联报销单，不能重复关联',
  SOURCE_PURCHASE_NOT_APPROVED: '关联采购单尚未审批通过',
  SOURCE_PURCHASE_NOT_REIMBURSABLE: '对公转账采购单不属于员工垫付，不能关联报销',
  SOURCE_PURCHASE_INBOUND_REQUIRED: '关联采购单尚未入库，暂不可报销',
  REIMBURSEMENT_PURCHASE_INVOICE_REQUIRED: '该采购单标记为“有发票”，提交报销时必须上传发票附件',
  INVOICE_FILES_REQUIRED: '请先上传发票或收款凭证后再提交报销',
  CREATED_BY_NOT_FOUND: '当前登录信息异常，请重新登录后再试',
  APPLICANT_NOT_FOUND: '报销申请人不存在或已被禁用',
  APPROVER_NOT_FOUND: '当前没有可用审批管理员，请联系管理员配置',
};

export function mapReimbursementError(error: unknown): string | null {
  if (!error) return null;
  const code = error instanceof Error ? error.message : String(error);
  if (code.startsWith('REIMBURSEMENT_DETAIL_REQUIRED:')) {
    return '请补充完整当前报销分类的必填信息后再保存或提交';
  }
  return REIMBURSEMENT_ERROR_MESSAGES[code] ?? null;
}
