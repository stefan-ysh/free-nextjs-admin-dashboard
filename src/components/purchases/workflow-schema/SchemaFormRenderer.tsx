'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { PurchaseWorkflowNode } from '@/types/purchase-workflow';

import type { WorkflowFieldSchema, WorkflowSchemaOption } from './types';

type DynamicOptions = {
  approverUsers: WorkflowSchemaOption[];
};

function getByPath(target: unknown, path: string): unknown {
  if (!target || typeof target !== 'object') return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, target);
}

function isVisible(field: WorkflowFieldSchema, node: PurchaseWorkflowNode): boolean {
  if (!field.visibleWhen) return true;
  const value = getByPath(node, field.visibleWhen.path);
  return value === field.visibleWhen.equals;
}

function buildOptions(field: WorkflowFieldSchema, dynamicOptions: DynamicOptions): WorkflowSchemaOption[] {
  if (field.path === 'approverUserId') return dynamicOptions.approverUsers;
  return field.options ?? [];
}

export default function SchemaFormRenderer({
  node,
  fields,
  dynamicOptions,
  onFieldChange,
}: {
  node: PurchaseWorkflowNode;
  fields: WorkflowFieldSchema[];
  dynamicOptions: DynamicOptions;
  onFieldChange: (path: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-3">
      {fields.filter((field) => isVisible(field, node)).map((field) => {
        const value = getByPath(node, field.path);
        const key = `${node.id}:${field.path}`;

        if (field.type === 'switch') {
          return (
            <div key={key} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{field.label}</p>
                {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
              </div>
              <Switch checked={Boolean(value)} onCheckedChange={(checked) => onFieldChange(field.path, checked)} />
            </div>
          );
        }

        if (field.type === 'select') {
          const options = buildOptions(field, dynamicOptions);
          return (
            <div key={key}>
              <p className="mb-1 text-xs text-muted-foreground">
                {field.label}
                {field.required ? ' *' : ''}
              </p>
              <Select
                value={typeof value === 'string' ? value : undefined}
                onValueChange={(next) => onFieldChange(field.path, next)}
              >
                <SelectTrigger><SelectValue placeholder={field.placeholder ?? '请选择'} /></SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={`${key}:${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (field.type === 'number') {
          const display = typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
          return (
            <div key={key}>
              <p className="mb-1 text-xs text-muted-foreground">
                {field.label}
                {field.required ? ' *' : ''}
              </p>
              <Input
                type="number"
                min={field.min}
                max={field.max}
                placeholder={field.placeholder}
                value={display}
                onChange={(event) => {
                  const raw = event.target.value;
                  onFieldChange(field.path, raw === '' ? null : Number(raw));
                }}
              />
            </div>
          );
        }

        return (
          <div key={key}>
            <p className="mb-1 text-xs text-muted-foreground">
              {field.label}
              {field.required ? ' *' : ''}
            </p>
            <Input
              placeholder={field.placeholder}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => onFieldChange(field.path, event.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
