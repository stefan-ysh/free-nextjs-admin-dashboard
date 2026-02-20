'use client';

import { Control, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';

// We need to know the shape of the form values to type `control` correctly,
// but for a reusable component, we can use `any` or a generic if we want to be strict.
// For simplicity in this refactor, we'll assume the parent passes the correct control.
type CustomFieldsProps = {
    control: Control<any>;
    name: string;
    disabled?: boolean;
};

export default function CustomFields({ control, name, disabled = false }: CustomFieldsProps) {
    const { fields, append, remove } = useFieldArray({
        control,
        name,
    });

    return (
        <div className="rounded-2xl border border-dashed border-border p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">自定义字段</h3>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => append({ key: '', value: '' })}
                    disabled={disabled}
                >
                    + 添加字段
                </Button>
            </div>
            <div className="space-y-3">
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <FormField
                            control={control}
                            name={`${name}.${index}.key`}
                            render={({ field: fieldProps }) => (
                                <FormItem>
                                    <FormLabel>字段名</FormLabel>
                                    <FormControl>
                                        <Input placeholder="例如 工号" {...fieldProps} disabled={disabled} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex gap-2">
                            <FormField
                                control={control}
                                name={`${name}.${index}.value`}
                                render={({ field: fieldProps }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>字段值</FormLabel>
                                        <FormControl>
                                            <Input placeholder="字段值" {...fieldProps} disabled={disabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {fields.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="shrink-0"
                                    onClick={() => remove(index)}
                                    disabled={disabled}
                                >
                                    删除
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
