import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface EmployeeOption {
    id: string;
    displayName: string;
    email?: string;
}

interface EmployeeSelectProps {
    value?: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export default function EmployeeSelect({
    value,
    onChange,
    disabled = false,
    placeholder = '选择员工...',
    className,
}: EmployeeSelectProps) {
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchEmployees() {
            setLoading(true);
            try {
                const response = await fetch('/api/employees');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && Array.isArray(data.data)) {
                        setEmployees(data.data);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch employees', error);
            } finally {
                setLoading(false);
            }
        }

        fetchEmployees();
    }, []);

    return (
        <Select
            value={value || undefined}
            onValueChange={onChange}
            disabled={disabled || loading}
        >
            <SelectTrigger className={cn('w-full', className)}>
                <SelectValue placeholder={loading ? '加载中...' : placeholder} />
            </SelectTrigger>
            <SelectContent>
                {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                        <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[10px]">
                                    {employee.displayName.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <span>{employee.displayName}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
