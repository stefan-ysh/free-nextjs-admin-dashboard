import { UserRole } from '@/types/user';

import type { WorkflowNodeSchema } from './types';

export const APPROVAL_NODE_SCHEMA: WorkflowNodeSchema = {
  type: 'approval',
  title: '审批节点属性',
  fields: [
    {
      path: 'name',
      label: '节点名称',
      type: 'text',
      placeholder: '请输入节点名称',
      required: true,
    },
    {
      path: 'approverType',
      label: '审批人类型',
      type: 'select',
      options: [
        { value: 'role', label: '按角色' },
        { value: 'user', label: '指定人员' },
      ],
      required: true,
    },
    {
      path: 'approverRole',
      label: '审批角色',
      type: 'select',
      options: [
        { value: UserRole.DEPARTMENT_MANAGER, label: '部门负责人' },
        { value: UserRole.FINANCE, label: '财务' },
        { value: UserRole.ADMIN, label: '管理员' },
        { value: UserRole.SUPER_ADMIN, label: '超级管理员' },
        { value: UserRole.HR, label: '人事' },
      ],
      visibleWhen: { path: 'approverType', equals: 'role' },
      required: true,
    },
    {
      path: 'approverUserId',
      label: '审批人员',
      type: 'select',
      visibleWhen: { path: 'approverType', equals: 'user' },
      required: true,
    },
    {
      path: 'condition.organizationType',
      label: '所属分支',
      type: 'select',
      options: [
        { value: 'all', label: '通用（全部组织）' },
        { value: 'school', label: '学校分支' },
        { value: 'company', label: '单位分支' },
      ],
    },
    {
      path: 'approvalMode',
      label: '审批模式',
      type: 'select',
      options: [
        { value: 'serial', label: '串签（逐级）' },
        { value: 'any', label: '或签（任一）' },
      ],
      required: true,
    },
    {
      path: 'condition.minAmount',
      label: '最小金额',
      type: 'number',
      min: 0,
      placeholder: '留空表示不限制',
    },
    {
      path: 'condition.maxAmount',
      label: '最大金额',
      type: 'number',
      min: 0,
      placeholder: '留空表示不限制',
    },
    {
      path: 'timeoutHours',
      label: '超时阈值（小时）',
      type: 'number',
      min: 1,
      required: true,
    },
    {
      path: 'requiredComment',
      label: '意见必填',
      type: 'switch',
      help: '审批必须填写意见',
    },
  ],
};
