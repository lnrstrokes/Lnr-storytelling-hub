import { useCallback, useEffect, useState } from 'react';
import {
  PRO_CHECKOUT_URL,
  PRO_LIMITS,
  activatePro,
  deactivatePro,
  getProState,
  refreshPro,
  type ProState
} from './license';
import {
  checkOwner,
  getDeviceId,
  getOwnerMode,
  isOwnerDevice,
  setOwnerMode,
  type OwnerMode
} from './owner';
import {
  X_HANDLE,
  X_URL,
  YOUTUBE_HANDLE,
  YOUTUBE_URL,
  dismissNotice,
  isNoticeDismissed
} from '../social';
import { LABEL_MAX_LENGTH, STAGE_LABEL_FIELDS, readLabelValues, writeLabelOverride } from '../stage-labels';
import './pro.css';

/** Shown once per NOTICE_VERSION, then remembered as dismissed. */
const PACKS_NOTICE_ID = 'pro-free-packs';

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
 * Pro: rename the category printed on the stage.
 *
 * One field per engine category — the two quiz packs, the player quiz, the
 * video engine and the storytelling archetypes — because the rotation can
 * hand the stage to any of them and the creator's niche does not change.
 *
 * Uncontrolled inputs on purpose — the value is written straight to storage on
 * each keystroke, so the stage updates live and this panel re-renders nothing.
 * Clearing a field restores the shipped category.
 */
function StageLabelFields() {
  const stored = readLabelValues();

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid rgba(217,171,99,0.2)'
      }}
    >
      <p className="lnr-pro-line" style={{ margin: '0 0 6px' }}>
        <span>Stage category</span>
        <b>Pro</b>
      </p>

      {STAGE_LABEL_FIELDS.map((field) => (
        <label
          key={field.id}
          className="lnr-pro-field"
          style={{ textTransform: 'none', letterSpacing: 0, marginBottom: 8 }}
        >
          <span>{field.label}</span>
          <input
            type="text"
            maxLength={LABEL_MAX_LENGTH}
            defaultValue={stored[field.id] || ''}
            placeholder="Your niche, e.g. Donghua / Renegade Immortal"
            onChange={(e) => writeLabelOverride(field.id, e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '7px 9px',
              borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.14)',
              background: '#070c12',
              color: '#e8e3d8',
              fontSize: 11,
              letterSpacing: 0,
              fontFamily: 'ui-sans-serif, system-ui, sans-serif'
            }}
          />
        </label>
      ))}

      <p className="lnr-pro-note" style={{ margin: '2px 0 0' }}>
        Replaces the category on the stage for every engine. Leave blank to restore the shipped name.
      </p>
    </div>
  );
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
  const [owner, setOwner] = useState(() => isOwnerDevice());
  const [mode, setMode] = useState<OwnerMode>(() => getOwnerMode());
  const [packsNote, setPacksNote] = useState(() => !isNoticeDismissed(PACKS_NOTICE_ID));

  useEffect(() => {
    const sync = () => setState(getProState());
    const show = () => setOpen(true);
    const syncOwner = () => {
      setOwner(isOwnerDevice());
      setMode(getOwnerMode());
      setState(getProState());
    };
    window.addEventListener('lnr:pro-changed', sync);
    window.addEventListener('lnr:pro-open', show);
    window.addEventListener('lnr:owner-changed', syncOwner);
    void refreshPro();
    return () => {
      window.removeEventListener('lnr:pro-changed', sync);
      window.removeEventListener('lnr:pro-open', show);
      window.removeEventListener('lnr:owner-changed', syncOwner);
    };
  }, []);

  /* Boot check: quietly confirm this is still the owner device. */
  useEffect(() => {
    void checkOwner().then(() => {
      setOwner(isOwnerDevice());
      setMode(getOwnerMode());
      setState(getProState());
    });
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
  const deviceTag = getDeviceId().slice(0, 8).toUpperCase();

  return (
    <div className="lnr-pro">
      <button
        type="button"
        className={'lnr-pro-pill' + (active ? ' is-pro' : '')}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={
          owner
            ? `Owner device ${deviceTag} — ${mode === 'pro' ? 'Pro' : 'Free'} mode`
            : active
              ? 'Pro licence active — open licence panel'
              : 'Free plan — open the Pro panel'
        }
      >
        <span className="lnr-pro-dot" aria-hidden="true" />
        {owner ? (mode === 'pro' ? 'Pro' : 'Free') : active ? 'Pro' : 'Free'}
      </button>

      {open && (
        <div className="lnr-pro-panel" role="dialog" aria-label="Pro licence">
          <div className="lnr-pro-head">
            <b>{owner ? 'Owner device' : active ? 'Pro licence active' : 'Free plan'}</b>
            <button type="button" className="lnr-pro-x" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>

          {owner ? (
            <>
              <p className="lnr-pro-line">
                <span>This device</span>
                <b>{deviceTag} · registered</b>
              </p>
              <p className="lnr-pro-line">
                <span>Current mode</span>
                <b>{mode === 'pro' ? 'Pro' : 'Free'}</b>
              </p>
              <p className="lnr-pro-note">
                The owner device switches tier freely and never locks its own branding. Customer
                keys still work normally on other devices.
              </p>
              <button
                type="button"
                className="lnr-pro-btn"
                onClick={() => {
                  const next: OwnerMode = mode === 'pro' ? 'free' : 'pro';
                  setMode(next);
                  setOwnerMode(next);
                  setMessage(next === 'pro' ? 'Owner device is now Pro.' : 'Owner device is now Free.');
                }}
              >
                Switch to {mode === 'pro' ? 'Free' : 'Pro'} mode
              </button>
            </>
          ) : active && unlock ? (
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

              {/* Read before the price, dismissed forever after: two things people
                  assume are paid for, and a way to ask instead of buying blind. */}
              {packsNote ? (
                <div
                  style={{
                    position: 'relative',
                    margin: '0 0 12px',
                    padding: '10px 30px 10px 11px',
                    borderRadius: 10,
                    border: '1px solid rgba(217,171,99,0.28)',
                    background: 'rgba(217,171,99,0.07)',
                    fontSize: 11,
                    lineHeight: 1.55,
                    color: '#cbd2d9'
                  }}
                >
                  <button
                    type="button"
                    aria-label="Dismiss this note"
                    onClick={() => {
                      dismissNotice(PACKS_NOTICE_ID);
                      setPacksNote(false);
                    }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      border: 0,
                      background: 'transparent',
                      color: '#9aa3ad',
                      fontSize: 13,
                      cursor: 'pointer',
                      padding: '4px 6px'
                    }}
                  >
                    ✕
                  </button>
                  <p style={{ margin: 0 }}>
                    Before you upgrade: your own question packs (JSON) and your own MP3 narration
                    already work on Free — no key needed.
                  </p>
                  <p style={{ margin: '5px 0 0' }}>
                    Questions first?{' '}
                    <a
                      href={X_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#d9ab63' }}
                    >
                      {X_HANDLE}
                    </a>{' '}
                    ·{' '}
                    <a
                      href={YOUTUBE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#d9ab63' }}
                    >
                      {YOUTUBE_HANDLE}
                    </a>
                  </p>
                </div>
              ) : null}

              <a
                className="lnr-pro-btn"
                href={PRO_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Subscribe — $19/month
              </a>
              <p className="lnr-pro-note">
                Pay securely, then paste the Pro key issued to you below.
              </p>
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

          {active ? <StageLabelFields /> : null}

          {message ? <p className="lnr-pro-message">{message}</p> : null}
        </div>
      )}
    </div>
  );
}
