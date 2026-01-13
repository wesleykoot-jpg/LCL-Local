import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDisabled,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const dialog = dialogRef.current;
    const focusableElements = dialog?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements?.[0];
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }

      if (event.key === 'Enter') {
        if (document.activeElement === cancelButtonRef.current) {
          event.preventDefault();
          onCancel();
          return;
        }

        if (!confirmDisabled) {
          event.preventDefault();
          onConfirm();
        }
      }

      if (event.key === 'Tab' && focusableElements && focusableElements.length > 0) {
        const focusable = Array.from(focusableElements);
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
        let nextIndex = currentIndex + (event.shiftKey ? -1 : 1);

        if (nextIndex >= focusable.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = focusable.length - 1;

        event.preventDefault();
        focusable[nextIndex]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElement.current?.focus();
    };
  }, [open, onCancel, onConfirm, confirmDisabled]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className={cn(
          'w-full max-w-sm rounded-2xl bg-card border border-border shadow-lg p-5 focus:outline-none',
          'animate-in fade-in zoom-in duration-150'
        )}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 id="confirm-modal-title" className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            aria-label="Close dialog"
            className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground"
            onClick={onCancel}
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            aria-label={cancelText}
            onClick={onCancel}
            ref={cancelButtonRef}
            className="w-full min-h-[44px] rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {cancelText}
          </button>
          <button
            aria-label={confirmText}
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              'w-full min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-colors',
              'hover:opacity-90 disabled:opacity-60'
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
