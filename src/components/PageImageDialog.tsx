import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { pageImageUrl } from '../lib/data';

/** Opens /pages/{pdf_page}.webp. The images are added later, so a missing file shows a placeholder. */
export function PageImageDialog({ page, onClose }: { page: { pdfPage: number; label: string } | null; onClose: () => void }) {
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  useEffect(() => setState('loading'), [page?.pdfPage]);
  return (
    <Dialog open={!!page} onClose={onClose} label="Original page" className="dlg-wide">
      {page && (
        <>
          <div className="dlg-head">
            <h2>Original page {page.label}</h2>
            <span className="muted">PDF page {page.pdfPage}</span>
            <button className="btn icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div className="page-img-wrap">
            {state !== 'missing' && (
              <img src={pageImageUrl(page.pdfPage)} alt={`Scanned book page ${page.label}`} onLoad={() => setState('ok')} onError={() => setState('missing')} hidden={state !== 'ok'} />
            )}
            {state === 'loading' && <p className="muted">Loading page image…</p>}
            {state === 'missing' && (
              <div className="img-missing">
                <Icon name="image" size={36} />
                <p><strong>Page image not available yet.</strong></p>
                <p className="muted">Add <code>public/pages/{page.pdfPage}.webp</code> and it will appear here (and be cached for offline use).</p>
              </div>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
