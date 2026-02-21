import React from 'react';
import { Button } from '@/components/ui/button';
import { SearchableEntitySelect } from '@/components/common/SearchableEntitySelect';
import { Input } from '@/components/ui/input';
import { WorkflowNodeJson, WorkflowEdgeJson } from './WorkflowDesignerClient';
import { X } from 'lucide-react';

interface Props {
  node: WorkflowNodeJson | null;
  edge: WorkflowEdgeJson | null;
  onClose: () => void;
  onUpdateNode: (id: string, partialData: Partial<WorkflowNodeJson>) => void;
  onUpdateEdge: (id: string, partialData: Partial<WorkflowEdgeJson>) => void;
}

export function WorkflowNodePanel({ node, edge, onClose, onUpdateNode, onUpdateEdge }: Props) {
  if (!node && !edge) return null;

  return (
    <div className="w-[320px] md:w-[400px] border-l bg-background flex flex-col h-full overflow-hidden shadow-sm z-20 shrink-0">
      <div className="p-4 border-b flex justify-between items-start bg-background shrink-0">
        <div>
          <h3 className="font-semibold text-base">{node ? '编辑节点属性' : '编辑连线属性'}</h3>
          <p className="text-xs text-muted-foreground mt-1 text-wrap">
            {node?.type === 'APPROVAL' && '配置该节点的审批人列表。'}
            {node?.type === 'CC' && '配置该节点的抄送通知人。'}
            {node?.type === 'CONDITION_WAIT' && '配置该节点的等待条件。'}
            {edge && '配置该连线的流转条件（例如同意或驳回时走此分支）。'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -mr-2 -mt-2">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-5 flex-1 overflow-y-auto space-y-6">
        {node && (
          <>
            {(node.type === 'START' || node.type === 'END') ? (
              <div className="text-sm text-muted-foreground p-3 bg-muted/30 border border-dashed rounded text-center">
                {node.type === 'START' ? '流程起始节点，不可配置。' : '流程终止节点，不可配置。'}
              </div>
            ) : (
            <>
            <div className="space-y-2">
              <label className="text-sm font-medium">节点名称</label>
              <Input 
                value={node.name || ''} 
                onChange={(e) => onUpdateNode(node.id, { name: e.target.value })}
                placeholder="例如：直属主管审批"
                className="bg-background"
              />
            </div>

            {node.type === 'APPROVAL' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">指定人员</label>
                {(node.users || []).length > 0 ? (
                  <ul className="space-y-2 mb-2">
                    {(node.users || []).map((userId: string) => (
                      <li key={userId} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded border">
                        <span className="truncate">{userId.substring(0, 8)}...</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:text-destructive"
                          onClick={() => {
                            onUpdateNode(node.id, { users: (node.users || []).filter((id: string) => id !== userId) });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 bg-muted/30 border border-dashed rounded text-center">
                    尚未指定人员，将使用系统兜底配置
                  </div>
                )}
                <SearchableEntitySelect<{id: string, displayName: string | null, email: string | null}>
                  value={''}
                  onChange={(val) => {
                    if (!val || (node.users || []).includes(val)) return;
                    onUpdateNode(node.id, { users: [...(node.users || []), val] });
                  }}
                  fetchEntities={async (search) => {
                    const params = new URLSearchParams({ pageSize: '10' });
                    if (search.trim()) params.set('search', search.trim());
                    const res = await fetch(`/api/employees?${params.toString()}`);
                    if (!res.ok) return [];
                    const json = await res.json();
                    return (json?.data?.items || []) as {id: string, displayName: string | null, email: string | null}[];
                  }}
                  mapOption={(user) => ({
                    id: user.id,
                    label: user.displayName || user.email || '未知用户',
                    description: user.email || undefined,
                    data: user
                  })}
                  placeholder="搜索添加新人员..."
                  searchPlaceholder="输入姓名或邮箱搜索"
                />
              </div>
            )}

            {node.type === 'CC' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">抄送至指定人员</label>
                  <SearchableEntitySelect<{id: string, displayName: string | null, email: string | null}>
                    value={''}
                    onChange={(val) => {
                      if (!val || (node.users || []).includes(val)) return;
                      onUpdateNode(node.id, { users: [...(node.users || []), val] });
                    }}
                    fetchEntities={async (search) => {
                      const params = new URLSearchParams({ pageSize: '10' });
                      if (search.trim()) params.set('search', search.trim());
                      const res = await fetch(`/api/employees?${params.toString()}`);
                      if (!res.ok) return [];
                      const json = await res.json();
                      return (json?.data?.items || []) as {id: string, displayName: string | null, email: string | null}[];
                    }}
                    mapOption={(user) => ({
                      id: user.id,
                      label: user.displayName || user.email || '未知用户',
                      description: user.email || undefined,
                      data: user
                    })}
                    placeholder="搜索添加抄送人..."
                    searchPlaceholder="输入姓名或邮箱"
                  />
                  {(node.users || []).length > 0 && (
                    <ul className="space-y-2 mt-2">
                      {(node.users || []).map((userId: string) => (
                        <li key={userId} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded border">
                          <span className="truncate">{userId.substring(0, 8)}...</span>
                          <Button
                            variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-destructive"
                            onClick={() => onUpdateNode(node.id, { users: (node.users || []).filter((id: string) => id !== userId) })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
                <div className="space-y-2 border-t pt-4">
                  <label className="text-sm font-medium">快捷抄送至角色</label>
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      type="checkbox" 
                      id="role-applicant"
                      className="accent-primary"
                      checked={(node.roles || []).includes('applicant')}
                      onChange={(e) => {
                        const roles = node.roles || [];
                        if (e.target.checked) {
                          onUpdateNode(node.id, { roles: [...roles, 'applicant'] });
                        } else {
                          onUpdateNode(node.id, { roles: roles.filter((r: string) => r !== 'applicant') });
                        }
                      }}
                    />
                    <label htmlFor="role-applicant" className="text-sm cursor-pointer select-none">发单申请人</label>
                  </div>
                </div>
              </div>
            )}
            {node.type === 'CONDITION' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">条件字段</label>
                  <select
                    title="条件字段"
                    className="w-full p-2 border rounded-md text-sm bg-background"
                    value={(node as Record<string, unknown>).conditionField as string || ''}
                    onChange={(e) => onUpdateNode(node.id, { conditionField: e.target.value })}
                  >
                    <option value="">-- 选择字段 --</option>
                    <optgroup label="📦 采购单字段">
                      <option value="totalAmount">采购总额 (totalAmount)</option>
                      <option value="quantity">数量 (quantity)</option>
                      <option value="unitPrice">单价 (unitPrice)</option>
                      <option value="feeAmount">费用金额 (feeAmount)</option>
                    </optgroup>
                    <optgroup label="💰 报销单字段">
                      <option value="amount">报销金额 (amount)</option>
                    </optgroup>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">比较运算</label>
                  <select
                    title="比较运算"
                    className="w-full p-2 border rounded-md text-sm bg-background"
                    value={(node as Record<string, unknown>).conditionOp as string || ''}
                    onChange={(e) => onUpdateNode(node.id, { conditionOp: e.target.value })}
                  >
                    <option value="">-- 选择 --</option>
                    <option value="gt">大于 (&gt;)</option>
                    <option value="gte">大于等于 (≥)</option>
                    <option value="lt">小于 (&lt;)</option>
                    <option value="lte">小于等于 (≤)</option>
                    <option value="eq">等于 (=)</option>
                    <option value="neq">不等于 (≠)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">比较值</label>
                  <Input
                    value={(node as Record<string, unknown>).conditionValue as string || ''}
                    onChange={(e) => onUpdateNode(node.id, { conditionValue: e.target.value })}
                    placeholder="例如: 10000"
                    className="bg-background"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  条件满足时走绿色出口 (true)，不满足时走红色出口 (false)。
                </p>
              </div>
            )}

            {node.type === 'CONDITION_WAIT' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">系统等待条件</label>
                <select 
                  title="Condition Options"
                  className="w-full p-2 border rounded-md text-sm bg-background"
                  value={node.waitCondition || ''}
                  onChange={(e) => onUpdateNode(node.id, { waitCondition: e.target.value })}
                >
                  <option value="">-- 请选择 --</option>
                  <option value="PURCHASE_ALL_INBOUND">待全部采购商品入库</option>
                  <option value="FINANCE_PAID">待财务完成全额打款</option>
                </select>
              </div>
            )}
          </>
            )}
          </>
        )}

        {edge && (
          <div className="space-y-2">
            <label className="text-sm font-medium">分支流转条件</label>
            <select 
              title="Edge Condition"
              className="w-full p-2 border rounded-md text-sm bg-background"
              value={edge.condition || 'ALWAYS'}
              onChange={(e) => onUpdateEdge(edge.id as string, { condition: e.target.value })}
            >
              <option value="ALWAYS">无条件 (始终流转)</option>
              <option value="APPROVED">仅当 [同意] 时流转</option>
              <option value="REJECTED">仅当 [驳回] 时流转</option>
              <option value="CONDITION_TRUE">仅当条件 [满足] 时</option>
              <option value="CONDITION_FALSE">仅当条件 [不满足] 时</option>
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              审批连线用同意/驳回；条件分支连线用满足/不满足。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

