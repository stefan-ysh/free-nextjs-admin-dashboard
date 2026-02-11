import { useFormContext } from 'react-hook-form';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import DatePicker from '@/components/ui/DatePicker';
import ClientSelector from '@/components/common/ClientSelector';
import EmployeeSelector from '@/components/common/EmployeeSelector';
import { projectPriorityOptions, projectStatusOptions } from './constants';
import { currencyOptions, type FormValues } from './project-form-schema';

const RequiredMark = () => <span className="ml-1 text-destructive">*</span>;

export function ProjectFormFields({ disableSubmit }: { disableSubmit: boolean }) {
    const form = useFormContext<FormValues>();

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                    control={form.control}
                    name="projectName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                项目名称
                                <RequiredMark />
                            </FormLabel>
                            <FormControl>
                                <Input placeholder="例如：华东数据中心升级" required {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="projectCode"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                项目编号
                                <RequiredMark />
                            </FormLabel>
                            <FormControl>
                                <Input placeholder="例如：PRJ-2025-001" required {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>客户名称</FormLabel>
                            <FormControl>
                                <ClientSelector
                                    value={field.value ?? ''}
                                    onChange={(client) => {
                                        field.onChange(client);
                                        field.onBlur();
                                    }}
                                    disabled={disableSubmit}
                                    helperText="可搜索历史客户，或直接输入新的客户名称"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="projectManagerId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                项目负责人
                                <RequiredMark />
                            </FormLabel>
                            <FormControl>
                                <EmployeeSelector
                                    value={field.value}
                                    onChange={(userId) => {
                                        field.onChange(userId);
                                        field.onBlur();
                                    }}
                                    disabled={disableSubmit}
                                />
                            </FormControl>
                            <FormDescription>请选择一位在职员工作为负责人，系统会自动关联其账号。</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                状态
                                <RequiredMark />
                            </FormLabel>
                            <FormControl>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="请选择状态" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projectStatusOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                优先级
                                <RequiredMark />
                            </FormLabel>
                            <FormControl>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="请选择优先级" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projectPriorityOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>预算 (¥)</FormLabel>
                            <FormControl>
                                <Input type="number" min="0" step="1000" placeholder="可选" {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="contractAmount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>合同金额 (¥)</FormLabel>
                            <FormControl>
                                <Input type="number" min="0" step="1000" placeholder="可选" {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                货币
                                <RequiredMark />
                            </FormLabel>
                            <FormControl>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {currencyOptions.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>开始日期</FormLabel>
                            <FormControl>
                                <DatePicker value={field.value ?? ''} onChange={field.onChange} clearable={false} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="expectedEndDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>预期结束日期</FormLabel>
                            <FormControl>
                                <DatePicker value={field.value ?? ''} onChange={field.onChange} />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name="contractNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>合同编号</FormLabel>
                        <FormControl>
                            <Input placeholder="可选" {...field} />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>项目描述</FormLabel>
                        <FormControl>
                            <Textarea rows={4} placeholder="简要介绍项目背景、范围等" {...field} />
                        </FormControl>
                    </FormItem>
                )}
            />
        </div>
    );
}
