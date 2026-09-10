import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { AlertTriangle, Trash2, X, Info } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  requireMatchString?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'CONFIRM_ACTION',
  message,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  requireMatchString,
}) => {
  const [matchInput, setMatchInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMatchInput('');
      setIsProcessing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isConfirmDisabled = requireMatchString 
    ? matchInput.trim().toLowerCase() !== requireMatchString.trim().toLowerCase()
    : false;

  const handleConfirmClick = async () => {
    if (isConfirmDisabled || isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('[ConfirmModal] Error during confirm action:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-[2px] animate-fadeIn select-none">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md z-10">
        <Card variant="blueprint" className="p-0 overflow-hidden shadow-hard-ink border-2 border-ink bg-paper-raised">
          {/* Header */}
          <div className={`px-4 py-3 border-b-2 border-ink flex items-center justify-between ${
            danger ? 'bg-signal text-paper' : 'bg-ink text-paper'
          }`}>
            <div className="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-wider">
              {danger ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4 text-blueprint" />}
              <span>// {title}</span>
            </div>
            <button
              onClick={onClose}
              className="text-paper/70 hover:text-paper p-0.5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full border-2 border-ink flex items-center justify-center shrink-0 ${
                danger ? 'bg-signal/15 text-signal' : 'bg-blueprint/15 text-blueprint'
              }`}>
                {danger ? <Trash2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className="text-[13.5px] font-bold text-ink leading-snug">
                  {message}
                </p>
                {description && (
                  <p className="text-[12px] text-ink-soft font-mono mt-1.5 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {/* Type-to-confirm requirement if specified */}
            {requireMatchString && (
              <div className="flex flex-col gap-1.5 bg-paper border border-line p-3 font-mono text-[11.5px]">
                <span className="text-ink-soft">
                  Type <strong className="text-ink font-bold">{requireMatchString}</strong> below to confirm:
                </span>
                <input
                  type="text"
                  value={matchInput}
                  onChange={(e) => setMatchInput(e.target.value)}
                  placeholder={requireMatchString}
                  autoFocus
                  className="w-full px-2.5 py-1.5 border border-ink bg-paper-raised text-ink text-[12px] font-mono focus:outline-none focus:border-signal"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-line font-mono text-[12px]">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 border border-ink bg-paper hover:bg-paper-raised text-ink font-bold transition-colors cursor-pointer"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={isConfirmDisabled || isProcessing}
                className={`px-4 py-2 border-2 border-ink font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
                  danger
                    ? 'bg-signal text-paper hover:bg-signal/90 border-signal'
                    : 'bg-ink text-paper hover:bg-blueprint border-ink'
                } ${isConfirmDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {danger && <Trash2 className="w-3.5 h-3.5" />}
                <span>{isProcessing ? 'processing...' : confirmText}</span>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
