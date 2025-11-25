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
  '员工与差旅',
  '市场与销售',
  '采购与供应链',
  'IT与运营',
  '专业服务',
  '财务与合规',
  '其他分类',
] as const;

const GROUP_ORDER: Record<TransactionType, readonly string[]> = {
  [TransactionType.INCOME]: INCOME_GROUP_ORDER,
  [TransactionType.EXPENSE]: EXPENSE_GROUP_ORDER,
};

const FALLBACK_GROUP_LABEL: Record<TransactionType, string> = {
  [TransactionType.INCOME]: '其他收入',
  [TransactionType.EXPENSE]: '其他分类',
};

export const FINANCE_CATEGORY_OPTIONS: FinanceCategoryOption[] = [
  {
    value: 'core-business-income',
    label: '主营业务收入',
    type: TransactionType.INCOME,
    group: '主营业务',
    aliases: ['收入', '销售收入'],
  },
  {
    value: 'project-income',
    label: '项目收入',
    type: TransactionType.INCOME,
    group: '主营业务',
    aliases: ['项目收入'],
  },
  {
    value: 'service-income',
    label: '服务收入',
    type: TransactionType.INCOME,
    group: '主营业务',
  },
  {
    value: 'investment-income',
    label: '投资及财务收益',
    type: TransactionType.INCOME,
    group: '投资及财务',
    aliases: ['资金注入'],
  },
  {
    value: 'other-income',
    label: '其他收入',
    type: TransactionType.INCOME,
    group: '其他收入',
    aliases: ['银行公户办理相关', '其他收入'],
  },
  {
    value: 'office-expense',
    label: '办公费（含文具/耗材/印刷/小额场地维修）',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
    aliases: ['装修费用', '办公用品', '办公费'],
  },
  {
    value: 'post-expense',
    label: '快递费（文件/物品/退换货/国际快递）',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
  },
  {
    value: 'communication-expense',
    label: '通讯费（手机话费/宽带/即时通讯增值服务）',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
  },
  {
    value: 'utility-expense',
    label: '水电费及物业能源费（办公场地水电气/公共设施费）',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
  },
  {
    value: 'travel-expense',
    label: '差旅费（跨区域交通/住宿/餐饮/签证）',
    type: TransactionType.EXPENSE,
    group: '员工与差旅',
    aliases: ['报销'],
  },
  {
    value: 'transportation-expense',
    label: '交通费（本地公务出行/通勤补贴/共享出行）',
    type: TransactionType.EXPENSE,
    group: '员工与差旅',
    aliases: ['交通费'],
  },
  {
    value: 'entertainment-expense',
    label: '业务招待费（餐饮宴请/礼品馈赠/商务娱乐）',
    type: TransactionType.EXPENSE,
    group: '员工与差旅',
    aliases: ['餐费'],
  },
  {
    value: 'welfare-expense',
    label: '福利费（节日福利/体检/团建/特殊补贴）',
    type: TransactionType.EXPENSE,
    group: '员工与差旅',
    aliases: ['团建'],
  },
  {
    value: 'training-expense',
    label: '培训费/学习费（课程/考试/教材/师资费）',
    type: TransactionType.EXPENSE,
    group: '员工与差旅',
  },
  {
    value: 'allowance-expense',
    label: '薪酬外补贴（通讯/交通/餐补/住房补贴）',
    type: TransactionType.EXPENSE,
    group: '员工与差旅',
    aliases: ['发放工资', '工资'],
  },
  {
    value: 'advertising-expense',
    label: '广告费/宣传费（线上/线下广告/内容营销/品牌活动）',
    type: TransactionType.EXPENSE,
    group: '市场与销售',
  },
  {
    value: 'channel-expense',
    label: '销售渠道费（代理商佣金/平台入驻/推广服务）',
    type: TransactionType.EXPENSE,
    group: '市场与销售',
  },
  {
    value: 'device-maintenance-expense',
    label: '办公设备维修费（电脑/打印机/家电维修）',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
    aliases: ['设备购买'],
  },
  {
    value: 'software-expense',
    label: '软件与系统维护费（办公软件/业务系统/数据安全）',
    type: TransactionType.EXPENSE,
    group: 'IT与运营',
  },
  {
    value: 'rental-expense',
    label: '租赁费（办公场地/设备/无形资产租赁）',
    type: TransactionType.EXPENSE,
    group: '办公与行政',
  },
  {
    value: 'meal-allowance-expense',
    label: '误餐费（加班错过饭点餐费补贴）',
    type: TransactionType.EXPENSE,
    group: '员工与差旅',
  },
  {
    value: 'material-qc-expense',
    label: '原材料检验费（制造业原材料质检）',
    type: TransactionType.EXPENSE,
    group: '采购与供应链',
    aliases: ['材料费', '采购支出'],
  },
  {
    value: 'logistics-expense',
    label: '物流费（制造业原材料/成品运输）',
    type: TransactionType.EXPENSE,
    group: '采购与供应链',
  },
  {
    value: 'server-expense',
    label: '服务器托管费（互联网云服务器/带宽费）',
    type: TransactionType.EXPENSE,
    group: 'IT与运营',
  },
  {
    value: 'inventory-loss-expense',
    label: '库存损耗费（零售商品过期/破损报废）',
    type: TransactionType.EXPENSE,
    group: '采购与供应链',
  },
  {
    value: 'packaging-expense',
    label: '包装费（零售电商快递包装耗材）',
    type: TransactionType.EXPENSE,
    group: '采购与供应链',
  },
  {
    value: 'consulting-expense',
    label: '咨询费（服务业律师/会计/顾问咨询）',
    type: TransactionType.EXPENSE,
    group: '专业服务',
    aliases: ['服务费'],
  },
  {
    value: 'finance-expense',
    label: '财务费用（银行手续费/贷款利息/汇兑损益）',
    type: TransactionType.EXPENSE,
    group: '财务与合规',
    aliases: ['银行公户办理相关'],
  },
  {
    value: 'tax-expense',
    label: '税费与规费（印花税/行政规费/公益捐赠）',
    type: TransactionType.EXPENSE,
    group: '财务与合规',
    aliases: ['其他支出'],
  },
  {
    value: 'legal-expense',
    label: '法律与风险费（诉讼费/律师费/保险费）',
    type: TransactionType.EXPENSE,
    group: '财务与合规',
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
