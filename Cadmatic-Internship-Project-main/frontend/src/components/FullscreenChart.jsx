import React, { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';

export default function FullscreenChart({ title, children, fullscreenChildren }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.classList.add('fullscreen-chart-open');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('fullscreen-chart-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div className="chart-card-header">
        <span className="card-title">{title}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm icon-btn"
          onClick={() => setOpen(true)}
          title={`Open ${title} fullscreen`}
          aria-label={`Open ${title} fullscreen`}
        >
          <Maximize2 size={13} />
        </button>
      </div>
      {children}
      {open && (
        <div className="fullscreen-chart-backdrop" role="dialog" aria-modal="true" aria-label={title}>
          <div className="fullscreen-chart-panel">
            <div className="fullscreen-chart-header">
              <span>{title}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm icon-btn"
                onClick={() => setOpen(false)}
                title="Close fullscreen chart"
                aria-label="Close fullscreen chart"
              >
                <X size={15} />
              </button>
            </div>
            <div className="fullscreen-chart-body">
              {fullscreenChildren || children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
