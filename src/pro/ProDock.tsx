import { useCallback, useEffect, useState } from 'react';
import {
  PRO_LIMITS,
  activatePro,
  deactivatePro,
  getProState,
  refreshPro,
  type ProState
} from './license';
import './pro.css';

function expiryLabel(state: ProState): string {
  const exp = state.license?.exp;
  if (!exp) return '';
  try {
    return new Date(exp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

/**
 * The whole Pro surface.
 *
 * Kept deliberately small and outside the engine: activating a key must not
 * touch the streaming code path, so a licensing problem can never stop a
 * broadcast. The engine reads the resulting state through window.LNR_PRO.
 */
export default function ProDock() {
  const [state, setState] = useState<ProState>(() => getProState());
  const [open, setOpen] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sync = () => setState(getProState());
    const show = () => setOpen(true);
    window.addEventListener('lnr:pro-changed', sync);
    window.addEventListener('lnr:pro-open', show);
    void refreshPro();
    return () => {
      window.removeEventListener('lnr:pro-changed', sync);
      window.removeEventListener('lnr:pro-open', show);
    };
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await activatePro(keyInput);
      if (result.ok) {
        setKeyInput('');
        setMessage('Pro activated on this device.');
      } else {
        setMessage(result.error || 'That key was not accepted.');
      }
    } finally {
      setBusy(false);
    }
  }, [keyInput]);

  const remove = useCallback(() => {
    deactivatePro();
    setMessage('Pro key removed from this device.');
  }, []);

  const active = state.active;
  const unlock = state.license;

  return (
    <div className="lnr-pro">
      <button
        type="button"
        className={'lnr-pro-pill' + (active ? ' is-pro' : '')}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={active ? 'Pro licence active — open licence panel' : 'Free plan — open the Pro panel'}
      >
        <span className="lnr-pro-dot" aria-hidden="true" />
        {active ? 'Pro' : 'Free'}
      </button>

      {open && (
        <div className="lnr-pro-panel" role="dialog" aria-label="Pro licence">
          <div className="lnr-pro-head">
            <b>{active ? 'Pro licence active' : 'Free plan'}</b>
            <button type="button" className="lnr-pro-x" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>

          {active && unlock ? (
            <>
              <p className="lnr-pro-line">
                <span>Brand strap</span>
                <b>{unlock.brand}</b>
              </p>
              <p className="lnr-pro-line">
                <span>Watermark</span>
                <b>{unlock.watermark}</b>
              </p>
              {unlock.site ? (
                <p className="lnr-pro-line">
                  <span>Locked to</span>
                  <b>{unlock.site}</b>
                </p>
              ) : null}
              <p className="lnr-pro-line">
                <span>Renews / expires</span>
                <b>{expiryLabel(state)}</b>
              </p>
              <p className="lnr-pro-note">
                Brand text is issued with the key and cannot be edited here — that is what stops a
                shared key from being re-branded. To change it, request a new key.
              </p>
              <button type="button" className="lnr-pro-btn is-quiet" onClick={remove}>
                Remove key from this device
              </button>
            </>
          ) : (
            <>
              <ul className="lnr-pro-list">
                <li>Upload up to {PRO_LIMITS.promoClips} promo break clips</li>
                <li>Promo rotation sequence &amp; layout controls</li>
                <li>Brand strap locked to your licence</li>
              </ul>
              <label className="lnr-pro-field">
                <span>Pro key</span>
                <textarea
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="LNRPRO.…"
                  rows={3}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </label>
              <button
                type="button"
                className="lnr-pro-btn"
                onClick={submit}
                disabled={busy || !keyInput.trim()}
              >
                {busy ? 'Checking…' : 'Activate Pro'}
              </button>
              {state.error ? <p className="lnr-pro-error">{state.error}</p> : null}
            </>
          )}

          {message ? <p className="lnr-pro-message">{message}</p> : null}
        </div>
      )}
    </div>
  );
}
