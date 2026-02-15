'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Employee } from './types';

type ResetPasswordDialogProps = {
  open: boolean;
  employee: Employee | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { newPassword: string; confirmPassword: string }) => void | Promise<void>;
};

export default function ResetPasswordDialog({
  open,
  employee,
  saving = false,
  onOpenChange,
  onSubmit,
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!open) {
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open]);

  const displayName = employee?.displayName || employee?.email || '该员工';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
          <DialogDescription>
            为 {displayName} 设置新的登录密码。员工可使用邮箱、手机号或员工编号登录。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password">新密码</Label>
            <Input
              id="reset-password"
              type="password"
              placeholder="至少 8 位字符"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm-password">确认新密码</Label>
            <Input
              id="reset-confirm-password"
              type="password"
              placeholder="再次输入新密码"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={saving}
            />
          </div>
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit({ newPassword, confirmPassword })}
            disabled={saving}
          >
            确认重置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
