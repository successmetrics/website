import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { markTourDone } from '../lib/welcome';

// ---- Step definitions ---------------------------------------------------- //

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

type TourStep = {
  id: string;
  title: string;
  body: string;
  route?: string;
  selector?: string;
  placement?: Placement;
};

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Safe-Seed',
    body: 'This tour walks you through generating privacy-safe synthetic data — from a preset source to a fidelity / privacy report. In the demo, downloads are CSV-only with a row cap, and without an API key only presets (no ML training) are available. Use Next / Back to navigate, or press Exit any time.',
    placement: 'center',
  },
  {
    id: 'sidebar',
    title: 'Navigation',
    body: 'The sidebar is your main navigation. Move between Sources, Policies, Jobs, Targets, Settings, and Help from here.',
    route: '/',
    selector: '.sidebar',
    placement: 'right',
  },
  {
    id: 'home-stats',
    title: 'Dashboard',
    body: 'Your home dashboard shows recent jobs and a resource count at a glance. A Getting Started guide appears here when you are new to the workspace.',
    route: '/',
    selector: '[data-tour="home-stats"]',
    placement: 'bottom',
  },
  {
    id: 'sources',
    title: '1 · Sources',
    body: 'A source is the raw dataset Safe-Seed learns from. You can upload CSV files, connect a Postgres database, link Salesforce objects, or load a built-in test dataset.',
    route: '/sources',
    selector: '[data-tour="sources-list"]',
    placement: 'bottom',
  },
  {
    id: 'add-source',
    title: 'Adding a source',
    body: 'Click "Add source" to open the upload wizard. You can drop one or more CSV files; Safe-Seed auto-detects the schema and lets you confirm column types before saving.',
    route: '/sources',
    selector: '[data-tour="add-source-btn"]',
    placement: 'bottom',
  },
  {
    id: 'policies',
    title: '2 · Field policies',
    body: 'A policy governs how each column is handled — synthesized statistically, masked with realistic fake values, or preserved verbatim. It also sets the compliance tier (Safe Harbor, Expert Determination, etc.).',
    route: '/policies',
    selector: '[data-tour="policies-list"]',
    placement: 'bottom',
  },
  {
    id: 'new-policy',
    title: 'Creating a policy',
    body: 'Policies can be built manually or auto-suggested from a source. The suggestion engine detects likely PII columns (email, phone, SSN…) and proposes masking strategies — you review and adjust before saving.',
    route: '/policies',
    selector: '[data-tour="new-policy-btn"]',
    placement: 'bottom',
  },
  {
    id: 'jobs',
    title: '3 · Seed jobs',
    body: 'A seed job runs the ML synthesis engine on your source and produces a privacy-safe dataset that preserves statistical properties and referential integrity across tables.',
    route: '/jobs',
    selector: '[data-tour="jobs-list"]',
    placement: 'bottom',
  },
  {
    id: 'new-job',
    title: 'Running a job',
    body: 'The job wizard guides you through picking a source, attaching a policy, configuring inter-table relations, and tuning privacy noise. Synthesis runs in the background — you get a live progress bar.',
    route: '/jobs',
    selector: '[data-tour="new-job-btn"]',
    placement: 'bottom',
  },
  {
    id: 'api-key-gate',
    title: 'API key requirement',
    body: 'ML synthesis requires an approved API key tied to your workspace. Fast Search — AI-free record exploration and filtering across your sources — is always available without a key. Request yours under Settings.',
    placement: 'center',
  },
  {
    id: 'targets',
    title: '4 · Targets',
    body: 'A target is a Salesforce sandbox where Safe-Seed can push synthetic records via Bulk API 2.0. Connect your org here and map Safe-Seed tables to Salesforce object types.',
    route: '/targets',
    selector: '[data-tour="targets-page"]',
    placement: 'bottom',
  },
  {
    id: 'settings-api-key',
    title: 'Request an API key',
    body: 'Fill in this form to request your API key. An email goes to both you and our team; we will send the approved key within 1-2 business days. Once active, it unlocks full ML synthesis for everyone in your workspace.',
    route: '/settings',
    selector: '[data-tour="settings-api-key"]',
    placement: 'top',
  },
  {
    id: 'help',
    title: 'Help & checklist',
    body: 'The Help page tracks your first-run progress — source added, policy created, job completed, evidence downloaded. Return any time to see what is left.',
    route: '/help',
    selector: '[data-tour="help-checklist"]',
    placement: 'bottom',
  },
  {
    id: 'done',
    title: "You're all set",
    body: 'Follow the four steps: add a source → create a policy → request your API key → run a seed job and download the evidence pack. Press the ? button in the sidebar any time to replay this tour.',
    placement: 'center',
  },
];

// ---- Context --------------------------------------------------------------- //

type TourCtx = {
  active: boolean;
  step: number;
  total: number;
  startTour: () => void;
  exitTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
};

const TourContext = createContext<TourCtx>({
  active: false,
  step: 0,
  total: STEPS.length,
  startTour: () => {},
  exitTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
});

export function useTour() {
  return useContext(TourContext);
}

// ---- Spotlight rect -------------------------------------------------------- //

type SpotRect = { top: number; left: number; width: number; height: number };

function rectFromEl(el: Element): SpotRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function useSpotRect(active: boolean, selector: string | undefined, signal: number): SpotRect | null {
  const [rect, setRect] = useState<SpotRect | null>(null);

  useEffect(() => {
    if (!active || !selector) { setRect(null); return; }
    const findAndSet = () => {
      const el = document.querySelector(selector);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setRect(rectFromEl(el)), 280);
    };
    const t = setTimeout(findAndSet, 220);
    return () => clearTimeout(t);
  }, [active, selector, signal]);

  useEffect(() => {
    if (!active || !selector || !rect) return;
    const onResize = () => {
      const el = document.querySelector(selector);
      if (el) setRect(rectFromEl(el));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, selector, rect]);

  return rect;
}

function useNavRect(active: boolean, route: string | undefined, signal: number): SpotRect | null {
  const [rect, setRect] = useState<SpotRect | null>(null);

  useEffect(() => {
    if (!active || !route) { setRect(null); return; }
    const t = setTimeout(() => {
      const el = document.querySelector(`.sidebar a[href="${route}"]`);
      if (el) setRect(rectFromEl(el));
      else setRect(null);
    }, 260);
    return () => clearTimeout(t);
  }, [active, route, signal]);

  return rect;
}

// ---- Tooltip position ------------------------------------------------------ //

function tooltipPos(
  rect: SpotRect | null,
  placement: Placement,
): React.CSSProperties {
  const W = 400;
  const GAP = 14;

  if (!rect || placement === 'center') {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: W };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const clampL = (l: number) => Math.max(12, Math.min(l, vw - W - 12));
  const clampT = (t: number) => Math.max(12, Math.min(t, vh - 260));

  if (placement === 'bottom') {
    return { position: 'fixed', top: clampT(rect.top + rect.height + GAP), left: clampL(cx - W / 2), width: W };
  }
  if (placement === 'top') {
    return { position: 'fixed', bottom: Math.max(12, vh - rect.top + GAP), left: clampL(cx - W / 2), width: W };
  }
  if (placement === 'right') {
    return { position: 'fixed', top: clampT(cy - 110), left: clampL(rect.left + rect.width + GAP), width: W };
  }
  // left
  return { position: 'fixed', top: clampT(cy - 110), right: Math.max(12, vw - rect.left + GAP), width: W };
}

// ---- Provider -------------------------------------------------------------- //

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [signal, setSignal] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const prevPath = useRef<string | null>(null);
  const { user } = useAuth();
  const userId = user?.id;

  const startTour = useCallback(() => {
    setStep(0);
    setActive(true);
    setSignal((s) => s + 1);
  }, []);

  const exitTour = useCallback(() => {
    markTourDone(userId);
    setActive(false);
  }, [userId]);

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= STEPS.length) {
        markTourDone(userId);
        setActive(false);
        return;
      }
      const s = STEPS[idx];
      setStep(idx);
      if (s.route && s.route !== location.pathname) {
        navigate(s.route);
      } else {
        setSignal((n) => n + 1);
      }
    },
    [location.pathname, navigate, userId],
  );

  useEffect(() => {
    if (active && prevPath.current !== null && prevPath.current !== location.pathname) {
      setSignal((s) => s + 1);
    }
    prevPath.current = location.pathname;
  }, [active, location.pathname]);

  const nextStep = useCallback(() => goTo(step + 1), [goTo, step]);
  const prevStep = useCallback(() => goTo(step - 1), [goTo, step]);

  const cur = STEPS[step];
  const rect = useSpotRect(active, cur?.selector, signal);
  // Show nav highlight for steps that land on a page (have a route + a real selector, not the sidebar itself)
  const showNav = active && !!cur?.route && cur?.selector !== '.sidebar';
  const navRect = useNavRect(showNav, cur?.route, signal);
  const pos = active ? tooltipPos(rect, cur?.placement ?? 'center') : {};

  return (
    <TourContext.Provider value={{ active, step, total: STEPS.length, startTour, exitTour, nextStep, prevStep }}>
      {children}
      {active && cur && (
        <>
          {/* SVG mask backdrop — cuts holes for both target and nav link */}
          <svg
            style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9000, pointerEvents: 'none' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                {rect && (
                  <rect
                    x={rect.left - 4} y={rect.top - 4}
                    width={rect.width + 8} height={rect.height + 8}
                    rx={7} fill="black"
                  />
                )}
                {navRect && (
                  <rect
                    x={navRect.left - 4} y={navRect.top - 4}
                    width={navRect.width + 8} height={navRect.height + 8}
                    rx={5} fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.58)" mask="url(#tour-mask)" />
          </svg>

          {/* Primary target highlight ring */}
          {rect && (
            <div style={{
              position: 'fixed',
              top: rect.top - 3, left: rect.left - 3,
              width: rect.width + 6, height: rect.height + 6,
              borderRadius: 8,
              outline: '2px solid #6366f1',
              boxShadow: '0 0 0 4px rgba(99,102,241,0.22)',
              zIndex: 9001, pointerEvents: 'none',
            }} />
          )}

          {/* Nav link highlight ring */}
          {navRect && (
            <div style={{
              position: 'fixed',
              top: navRect.top - 3, left: navRect.left - 3,
              width: navRect.width + 6, height: navRect.height + 6,
              borderRadius: 6,
              outline: '2px solid #818cf8',
              boxShadow: '0 0 0 3px rgba(129,140,248,0.18)',
              zIndex: 9001, pointerEvents: 'none',
            }} />
          )}

          <div style={{
            ...pos,
            zIndex: 9002,
            background: '#16181f',
            border: '1px solid #2a2d3f',
            borderRadius: 12,
            padding: '20px 22px 18px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            color: '#dde0f0',
            fontFamily: 'inherit',
            fontSize: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', lineHeight: 1.3 }}>{cur.title}</span>
              <button
                onClick={exitTour}
                title="Exit tour"
                style={{ background: 'none', border: 'none', color: '#6b7090', cursor: 'pointer', fontSize: 17, padding: 0, lineHeight: 1, flexShrink: 0 }}
              >✕</button>
            </div>
            <p style={{ margin: '0 0 18px', lineHeight: 1.65, color: '#b0b4cc' }}>{cur.body}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#555870' }}>{step + 1} / {STEPS.length}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {step > 0 && (
                  <button onClick={prevStep} style={{ background: '#222536', border: '1px solid #333650', color: '#b0b4cc', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13 }}>
                    Back
                  </button>
                )}
                <button
                  onClick={step === STEPS.length - 1 ? exitTour : nextStep}
                  style={{ background: '#4f46e5', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  {step === STEPS.length - 1 ? 'Done' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </TourContext.Provider>
  );
}
