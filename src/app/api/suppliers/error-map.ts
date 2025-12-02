const SUPPLIER_ERROR_MESSAGES: Record<string, string> = {
  INVALID_SUPPLIER_PAYLOAD: '提交内容不完整或格式不正确，请刷新后重试。',
  SUPPLIER_NAME_REQUIRED: '请填写供应商名称后再提交。',
  SUPPLIER_NOT_FOUND: '供应商不存在或已被删除。',
  FAILED_TO_LOAD_SUPPLIER_AFTER_CREATE: '已保存，但返回数据失败，请刷新列表确认。',
  FAILED_TO_LOAD_SUPPLIER_AFTER_UPDATE: '已更新，但返回数据失败，请刷新列表确认。',
};

const PREFIX_HINTS: { prefix: string; message: string }[] = [
  { prefix: 'INVALID_', message: '表单填写有误，请检查后重试。' },
  { prefix: 'SUPPLIER_', message: '供应商信息校验未通过，请检查后重试。' },
];

function extractErrorCode(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return null;
}

export function formatSupplierError(error: unknown, fallback = '操作失败，请稍后再试。'): string {
  const code = extractErrorCode(error);
  if (!code) return fallback;

  if (SUPPLIER_ERROR_MESSAGES[code]) {
    return SUPPLIER_ERROR_MESSAGES[code];
  }

  for (const { prefix, message } of PREFIX_HINTS) {
    if (code.startsWith(prefix)) {
      return message;
    }
  }

  return fallback;
}
