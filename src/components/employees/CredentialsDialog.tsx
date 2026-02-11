'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type CredentialItem = {
  label: string;
  value: string;
};

type CredentialsDialogProps = {
  open: boolean;
  accounts: CredentialItem[];
  password: string;
  onOpenChange: (open: boolean) => void;
};

export default function CredentialsDialog({
  open,
  accounts,
  password,
  onOpenChange,
}: CredentialsDialogProps) {
  useEffect(() => {
    if (!open) return;
    if (!password) {
      onOpenChange(false);
    }
  }, [open, password, onOpenChange]);

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label}已复制`);
    } catch (error) {
      console.error('复制失败', error);
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>员工登录信息</DialogTitle>
          <DialogDescription>请妥善保存初始密码，员工首次登录后建议修改。</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {accounts.map((account) => (
            <div key={account.label} className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{account.label}</div>
              <div className="flex items-center gap-2">
                <Input value={account.value} readOnly />
                <Button type="button" variant="outline" onClick={() => handleCopy(account.value, account.label)}>
                  复制
                </Button>
              </div>
            </div>
          ))}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">初始密码</div>
            <div className="flex items-center gap-2">
              <Input value={password} readOnly />
              <Button type="button" variant="outline" onClick={() => handleCopy(password, '初始密码')}>
                复制
              </Button>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
