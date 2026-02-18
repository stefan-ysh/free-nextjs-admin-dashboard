import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { UserProfile } from '@/types/user';
import { USER_ROLE_LABELS } from '@/constants/user-roles';

type ApproverOption = UserProfile & {
    pendingApprovalCount?: number;
};

interface ApproverSelectProps {
    value?: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

/**
 * A user selector that only lists users with purchase approval permissions
 * (super_admin, admin, finance, department_manager).
 */
export default function ApproverSelect({
    value,
    onChange,
    disabled = false,
    placeholder = '选择审批人...',
    className,
}: ApproverSelectProps) {
    const [users, setUsers] = useState<ApproverOption[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchApprovers() {
            setLoading(true);
            try {
                const response = await fetch('/api/users/approvers');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && Array.isArray(data.data)) {
                        setUsers(data.data);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch approvers', error);
            } finally {
                setLoading(false);
            }
        }

        fetchApprovers();
    }, []);

    useEffect(() => {
        if (!value && users.length > 0 && !disabled) {
            onChange(users[0].id);
        }
    }, [disabled, onChange, users, value]);

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
                {users.map((user) => {
                    const displayName = user.displayName?.trim() || user.email || user.employeeCode || '未命名';

                    return (
                        <SelectItem key={user.id} value={user.id}>
                            <span>{displayName}</span>
                            <span className="ml-1 text-xs text-muted-foreground">
                                ({USER_ROLE_LABELS[user.primaryRole] || user.primaryRole})
                                {' · '}
                                待审 {Number(user.pendingApprovalCount ?? 0)}
                                {users[0]?.id === user.id ? ' · 推荐' : ''}
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
}
