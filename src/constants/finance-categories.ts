import { TransactionType } from '@/types/finance';

export type FinanceCategoryOption = {
  value: string;
  label: string;
  type: TransactionType;
  group: string;
  /** Legacy or alternate names that should map to this label */
  aliases?: string[];
};

export type FinanceCategoryGroup = {
  label: string;
  options: FinanceCategoryOption[];
};

const INCOME_GROUP_ORDER = ['主营业务', '投资及财务', '其他收入'] as const;
const EXPENSE_GROUP_ORDER = [
  '办公与行政',
  '员工与福利',
  '市场销售',
  '采购运营',
  'IT与技术',
  '专业服务',
  '财务税务',
] as const;

const GROUP_ORDER: Record<TransactionType, readonly string[]> = {
  [TransactionType.INCOME]: INCOME_GROUP_ORDER,
  [TransactionType.EXPENSE]: EXPENSE_GROUP_ORDER,
};

const FALLBACK_GROUP_LABEL: Record<TransactionType, string> = {
  [TransactionType.INCOME]: '其他收入',
  [TransactionType.EXPENSE]: '其他',
};

export const FINANCE_CATEGORY_OPTIONS: FinanceCategoryOption[] = [
  // ==================== 收入类别 ====================
  {
    value: 'core-business-income',
    label: '主营业务收入',
    type: TransactionType.INCOME,
    group: '主营业务',
    aliases: ['收入', '销售收入', '项目收入', '服务收入', '销售额'],
  },
  {
    value: 'investment-income',
    label: '投资收益',
    type: TransactionType.INCOME,
    group: '投资及财务',
    aliases: ['投资及财务收益', '资金注入'],
  },
  {
    value: 'other-income',
    label: '其他收入',
    type: TransactionType.INCOME,
    group: '其他收入',
    aliases: ['银行公户办理相关'],
  },

  // ==================== 支出类别 - 办公与行政 ====================
  {
    value: 'office-expense',
    label: '办公费用',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
    aliases: [
      '办公费',
      '办公用品',
      '办公费（含文具/耗材/印刷/小额场地维修）',
      '办公设备维修费（电脑/打印机/家电维修）',
      '装修费用(零星)',
      '日常用品',
    ],
  },
  {
    value: 'renovation-expense',
    label: '装修及建设',
    type: TransactionType.EXPENSE,
    group: '采购运营',
    aliases: ['装修费用'],
  },
  {
    value: 'rental-expense',
    label: '租金及物业',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
    aliases: [
      '租赁费',
      '租赁费（办公场地/设备/无形资产租赁）',
      '水电费',
      '水电费及物业能源费（办公场地水电气/公共设施费）',
    ],
  },
  {
    value: 'communication-expense',
    label: '通讯费',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
    aliases: ['通讯费（手机话费/宽带/即时通讯增值服务）'],
  },
  {
    value: 'post-expense',
    label: '快递及邮寄',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
    aliases: ['快递费', '快递费（文件/物品/退换货/国际快递）'],
  },
  {
    value: 'admin-misc-expense',
    label: '行政杂费',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
  },

  // ==================== 支出类别 - 员工与福利 ====================
  {
    value: 'salary-expense',
    label: '工资薪酬',
    type: TransactionType.EXPENSE,
    group: '员工与福利',
    aliases: [
      '薪酬外补贴（通讯/交通/餐补/住房补贴）',
      '发放工资',
      '工资',
    ],
  },
  {
    value: 'travel-expense',
    label: '差旅及交通',
    type: TransactionType.EXPENSE,
    group: '员工与福利',
    aliases: [
      '报销',
      '差旅费',
      '差旅费（跨区域交通/住宿/餐饮/签证）',
      '交通费',
      '交通费（本地公务出行/通勤补贴/共享出行）',
      '误餐费',
      '误餐费（加班错过饭点餐费补贴）',
      '住宿费',
    ],
  },
  {
    value: 'employee-meal-expense',
    label: '加班餐费',
    type: TransactionType.EXPENSE,
    group: '员工与福利',
    aliases: ['餐费', '加班餐费', '夜宵费', '夜宵', '餐补', '工作餐', '员工餐费'],
  },
  {
    value: 'welfare-expense',
    label: '福利及团建',
    type: TransactionType.EXPENSE,
    group: '员工与福利',
    aliases: [
      '福利费',
      '福利费（节日福利/体检/团建/特殊补贴）',
      '团建',
    ],
  },
  {
    value: 'training-expense',
    label: '培训学习',
    type: TransactionType.EXPENSE,
    group: '员工与福利',
    aliases: ['培训费/学习费（课程/考试/教材/师资费）'],
  },

  // ==================== 支出类别 - 市场销售 ====================
  {
    value: 'marketing-expense',
    label: '营销推广',
    type: TransactionType.EXPENSE,
    group: '市场销售',
    aliases: [
      '广告费',
      '宣传费',
      '广告费/宣传费（线上/线下广告/内容营销/品牌活动）',
    ],
  },
  {
    value: 'channel-expense',
    label: '销售渠道',
    type: TransactionType.EXPENSE,
    group: '市场销售',
    aliases: ['销售渠道费（代理商佣金/平台入驻/推广服务）'],
  },

  // ==================== 支出类别 - 采购运营 ====================
  {
    value: 'procurement-expense',
    label: '采购成本',
    type: TransactionType.EXPENSE,
    group: '采购运营',
    aliases: [
      '材料费',
      '采购支出',
      '原材料检验费',
      '原材料检验费（制造业原材料质检）',
    ],
  },
  {
    value: 'equipment-procurement',
    label: '设备采购',
    type: TransactionType.EXPENSE,
    group: '采购运营',
    aliases: ['设备购买'],
  },
  {
    value: 'engineering-payment',
    label: '工程款',
    type: TransactionType.EXPENSE,
    group: '采购运营',
    aliases: ['工程款'],
  },
  {
    value: 'logistics-expense',
    label: '物流配送',
    type: TransactionType.EXPENSE,
    group: '采购运营',
    aliases: [
      '物流费',
      '物流费（制造业原材料/成品运输）',
      '包装费',
      '包装费（零售电商快递包装耗材）',
    ],
  },
  {
    value: 'inventory-loss-expense',
    label: '库存损耗',
    type: TransactionType.EXPENSE,
    group: '采购运营',
    aliases: ['库存损耗费（零售商品过期/破损报废）'],
  },

  // ==================== 支出类别 - IT与技术 ====================
  {
    value: 'software-expense',
    label: '软件及系统',
    type: TransactionType.EXPENSE,
    group: 'IT与技术',
    aliases: ['软件与系统维护费（办公软件/业务系统/数据安全）'],
  },
  {
    value: 'server-expense',
    label: '服务器及云服务',
    type: TransactionType.EXPENSE,
    group: 'IT与技术',
    aliases: ['服务器托管费（互联网云服务器/带宽费）'],
  },

  // ==================== 支出类别 - 专业服务 ====================
  {
    value: 'consulting-expense',
    label: '法律及咨询',
    type: TransactionType.EXPENSE,
    group: '专业服务',
    aliases: [
      '咨询费',
      '服务费',
      '咨询费（服务业律师/会计/顾问咨询）',
      '法律与风险费',
      '法律与风险费（诉讼费/律师费/保险费）',
    ],
  },
  {
    value: 'entertainment-expense',
    label: '业务招待',
    type: TransactionType.EXPENSE,
    group: '专业服务',
    aliases: [
      '业务招待费',
      '业务招待费（餐饮宴请/礼品馈赠/商务娱乐）',
      '客户餐饮',
    ],
  },

  // ==================== 支出类别 - 财务税务 ====================
  {
    value: 'finance-expense',
    label: '财务费用',
    type: TransactionType.EXPENSE,
    group: '财务税务',
    aliases: [
      '银行公户办理相关',
      '财务费用（银行手续费/贷款利息/汇兑损益）',
    ],
  },
  {
    value: 'tax-expense',
    label: '税费及规费',
    type: TransactionType.EXPENSE,
    group: '财务税务',
    aliases: [
      '其他支出',
      '税费与规费（印花税/行政规费/公益捐赠）',
    ],
  },
];

const CATEGORY_BY_LABEL = new Map<string, FinanceCategoryOption>();
const CATEGORY_BY_ALIAS = new Map<string, FinanceCategoryOption[]>();

FINANCE_CATEGORY_OPTIONS.forEach((option) => {
  CATEGORY_BY_LABEL.set(option.label, option);
  option.aliases?.forEach((alias) => {
    const bucket = CATEGORY_BY_ALIAS.get(alias) ?? [];
    bucket.push(option);
    CATEGORY_BY_ALIAS.set(alias, bucket);
  });
});

export function getDefaultCategoryLabels(type: TransactionType): string[] {
  return FINANCE_CATEGORY_OPTIONS.filter((option) => option.type === type).map((option) => option.label);
}

export function matchCategoryLabel(type: TransactionType, rawName?: string | null): string | undefined {
  if (!rawName) return undefined;
  const normalized = rawName.trim();
  if (!normalized) return undefined;
  const direct = CATEGORY_BY_LABEL.get(normalized);
  if (direct && direct.type === type) {
    return direct.label;
  }
  const aliasMatch = CATEGORY_BY_ALIAS.get(normalized)?.find((option) => option.type === type);
  return aliasMatch?.label;
}

export function getCategoryGroups(type: TransactionType, labels?: string[]): FinanceCategoryGroup[] {
  const orderedGroups = GROUP_ORDER[type];
  const fallbackGroup = FALLBACK_GROUP_LABEL[type];
  const availableLabels = labels ? new Set(labels) : undefined;
  const grouped = new Map<string, FinanceCategoryOption[]>();

  const registerOption = (option: FinanceCategoryOption) => {
    const groupLabel = option.group || fallbackGroup;
    if (!grouped.has(groupLabel)) {
      grouped.set(groupLabel, []);
    }
    grouped.get(groupLabel)!.push(option);
  };

  FINANCE_CATEGORY_OPTIONS.forEach((option) => {
    if (option.type !== type) return;
    if (availableLabels && !availableLabels.has(option.label)) return;
    registerOption(option);
  });

  if (availableLabels) {
    availableLabels.forEach((label) => {
      if (CATEGORY_BY_LABEL.has(label)) return;
      registerOption({
        value: label,
        label,
        type,
        group: fallbackGroup,
      });
    });
  }

  return orderedGroups
    .map((groupLabel) => ({
      label: groupLabel,
      options: grouped.get(groupLabel) ?? [],
    }))
    .filter((group) => group.options.length);
}
