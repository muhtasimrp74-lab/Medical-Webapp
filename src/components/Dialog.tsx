import { useEffect, useRef, type ReactNode } from 'react';

/** Native <dialog>: focus trap, Esc to close and inert background come for free. */
export function Dialog({ open, onClose, label, className = '', children }: { open: boolean; onClose: () => void; label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`dlg ${className}`} aria-label={label} onClose={onClose} onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && <div className="dlg-body">{children}</div>}
    </dialog>
  );
}
