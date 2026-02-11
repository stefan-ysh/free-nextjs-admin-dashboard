export type WorkflowSchemaOption = {
  value: string;
  label: string;
};

export type WorkflowFieldType = 'text' | 'number' | 'select' | 'switch';

export type WorkflowFieldSchema = {
  path: string;
  label: string;
  type: WorkflowFieldType;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: WorkflowSchemaOption[];
  help?: string;
  required?: boolean;
  visibleWhen?: {
    path: string;
    equals: string | boolean | number | null;
  };
};

export type WorkflowNodeSchema = {
  type: 'approval';
  title: string;
  fields: WorkflowFieldSchema[];
};
