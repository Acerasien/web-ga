'use client';

import { HelpCircle, Loader2 } from 'lucide-react';
import styles from './modal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isPending?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  isPending = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className={styles.backdrop} 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div 
        className={styles.modal} 
        style={{ maxWidth: '400px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 'var(--space-6) var(--space-6) var(--space-2) var(--space-6)' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: 'var(--radius-full)', 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            color: 'var(--color-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 'var(--space-4)'
          }}>
            <HelpCircle size={28} />
          </div>

          <h3 id="confirm-modal-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 var(--space-2) 0', color: 'var(--color-text)' }}>
            {title}
          </h3>
          
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            {message}
          </p>
        </div>

        <div className={styles.footer} style={{ borderTop: 'none', padding: 'var(--space-4) var(--space-6) var(--space-6) var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary"
            disabled={isPending}
            style={{ width: '100%', minHeight: '44px', margin: 0 }}
          >
            {cancelText}
          </button>
          
          <button 
            type="button" 
            onClick={onConfirm} 
            className="btn btn-primary"
            disabled={isPending}
            style={{ width: '100%', minHeight: '44px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isPending && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
