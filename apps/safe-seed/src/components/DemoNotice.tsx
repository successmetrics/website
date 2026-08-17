import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isTourDone, markDemoNoticeSeen } from '../lib/welcome';
import { useTour } from './Tour';

export { shouldShowDemoNotice, markDemoNoticeSeen } from '../lib/welcome';

type Props = {
  maxDownloadRows?: number;
  hasApiKey?: boolean;
  onDismiss: () => void;
};

export function DemoNotice({ maxDownloadRows = 150, hasApiKey = false, onDismiss }: Props) {
  const nav = useNavigate();
  const { startTour } = useTour();
  const { user } = useAuth();

  function finish(start: 'tour' | 'settings' | 'none') {
    markDemoNoticeSeen(user?.id);
    onDismiss();
    if (start === 'settings') {
      nav('/settings');
      return;
    }
    if (start === 'tour' && !isTourDone(user?.id)) {
      startTour();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-notice-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 8, 14, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: 480,
          maxWidth: '100%',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          border: '1px solid var(--line)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="muted" style={{ margin: '0 0 6px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Notification center
        </p>
        <h2 id="demo-notice-title" style={{ margin: '0 0 12px', fontSize: 20 }}>
          You&apos;re using the Safe-Seed demo
        </h2>
        <p style={{ margin: '0 0 14px', lineHeight: 1.55, color: 'var(--muted)', fontSize: 14 }}>
          This is the Safe-Seed demo build. These limits apply to all accounts:
        </p>
        <ul style={{ margin: '0 0 18px', paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
          <li>
            Downloads are capped at <strong>{maxDownloadRows}</strong> synthetic rows{' '}
            <strong>per table</strong>. Relational jobs download a ZIP with one CSV per table.
          </li>
          <li>
            {hasApiKey ? (
              <>Your workspace has an API key — custom sources and ML training are available.</>
            ) : (
              <>
                Without an API key, only <strong>built-in preset</strong> sources are available.
                ML / adapt training is locked.
              </>
            )}
          </li>
        </ul>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => finish('tour')}>
            Get started
          </button>
          {!hasApiKey && (
            <button type="button" className="btn sec" onClick={() => finish('settings')}>
              Request API Key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
