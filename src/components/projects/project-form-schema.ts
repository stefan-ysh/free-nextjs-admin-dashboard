import { z } from 'zod';
import type { CurrencyCode, ProjectPriority, ProjectRecord, ProjectStatus } from '@/types/project';

export const currencyOptions = ['CNY', 'USD', 'HKD', 'EUR', 'JPY', 'GBP', 'OTHER'] as const satisfies readonly [CurrencyCode, ...CurrencyCode[]];

export const formSchema = z.object({
    projectName: z.string().min(1, '请输入项目名称'),
    projectCode: z.string().min(1, '请输入项目编号'),
    clientName: z.string().optional(),
    projectManagerId: z.string().min(1, '请输入负责人用户 ID'),
    status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled'] as [ProjectStatus, ...ProjectStatus[]]),
    priority: z.enum(['low', 'medium', 'high', 'urgent'] as [ProjectPriority, ...ProjectPriority[]]),
    budget: z.string().optional(),
    contractAmount: z.string().optional(),
    currency: z.enum(currencyOptions),
    startDate: z.string().optional(),
    expectedEndDate: z.string().optional(),
    description: z.string().optional(),
    contractNumber: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

export const buildDefaultValues = (project?: ProjectRecord | null): FormValues => ({
    projectName: project?.projectName ?? '',
    projectCode: project?.projectCode ?? '',
    clientName: project?.clientName ?? '',
    projectManagerId: project?.projectManagerId ?? '',
    status: project?.status ?? 'planning',
    priority: project?.priority ?? 'medium',
    budget: project?.budget != null ? String(project.budget) : '',
    contractAmount: project?.contractAmount != null ? String(project.contractAmount) : '',
    currency: project?.currency ?? 'CNY',
    startDate: project?.startDate?.slice(0, 10) ?? '',
    expectedEndDate: project?.expectedEndDate?.slice(0, 10) ?? '',
    description: project?.description ?? '',
    contractNumber: project?.contractNumber ?? '',
});

export function getFriendlyErrorMessage(message?: string | null, status?: number): string {
    if (status === 401) return '登录状态已过期，请重新登录后再试';
    if (status === 403) return '您没有权限执行该操作';
    if (status === 404) return '相关项目不存在或已被删除';
    if (status === 409 && message) return message;
    if (status && status >= 500) return '服务器暂时开小差，请稍后再试';

    if (!message) {
        return '保存失败，请稍后再试';
    }

    const normalized = message.toLowerCase();
    if (normalized.includes('fk_projects_manager') || normalized.includes('project_manager_id')) {
        return '负责人信息无效，请选择已有的系统用户作为负责人';
    }
    if (normalized.includes('foreign key')) {
        return '填写的信息存在无效关联，请检查表单内容后重试';
    }
    if (normalized.includes('project_code_exists')) {
        return '项目编号已存在，请更换一个新的编号';
    }
    if (normalized.includes('contract_number_exists')) {
        return '合同编号已存在，请检查后重试';
    }
    if (normalized.includes('failed to fetch') || normalized.includes('networkerror')) {
        return '网络连接异常，请检查网络后重新提交';
    }
    if (normalized.includes('server error') || normalized.includes('服务器错误')) {
        return '服务器暂时不可用，请稍后再试';
    }

    return message;
}
