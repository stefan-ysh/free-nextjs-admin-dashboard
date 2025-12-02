import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserProfile } from '@/types/user';
import { USER_ROLE_LABELS } from '@/constants/user-roles';

interface UserSelectProps {
    value?: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export default function UserSelect({
    value,
    onChange,
    disabled = false,
    placeholder = '选择人员...',
    className,
}: UserSelectProps) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchUsers() {
            setLoading(true);
            try {
                const response = await fetch('/api/users');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && Array.isArray(data.data)) {
                        setUsers(data.data);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch users', error);
            } finally {
                setLoading(false);
            }
        }

        fetchUsers();
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
                {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                                <AvatarImage src={user.avatarUrl || undefined} />
                                <AvatarFallback className="text-[10px]">
                                    {user.displayName.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <span>{user.displayName}</span>
                            {user.primaryRole && (
                                <span className="text-xs text-muted-foreground">
                                    ({USER_ROLE_LABELS[user.primaryRole] || user.primaryRole})
                                </span>
                            )}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
