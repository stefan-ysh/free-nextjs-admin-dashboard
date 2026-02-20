import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  onEnter?: () => void;
  onEscape?: () => void;
  onCtrlS?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onEnter,
  onEscape,
  onCtrlS,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;

      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        if (isInput && target.tagName !== 'TEXTAREA') {
          return;
        }
        event.preventDefault();
        onEnter?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        onCtrlS?.();
        return;
      }
    },
    [enabled, onEnter, onEscape, onCtrlS]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
