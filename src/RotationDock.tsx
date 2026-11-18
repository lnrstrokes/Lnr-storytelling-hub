/* ==========================================================================
   RotationDock.tsx — settings AND driver for automatic engine rotation
   --------------------------------------------------------------------------
   This component owns the whole rotation feature, which is why App.tsx needs
   no changes at all:

     - it renders the on/off switch, the dwell times and the order
     - it runs the scheduler
     - when the timer fires it calls switchEngine(), which freezes the current
       stage into a curtain, swaps engines underneath, then fades the curtain
       out — so a screencast never sees a blank frame

   Off by default. Nothing changes unless you turn it on.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Repeat, ChevronDown, ChevronUp } from 'lucide-react';
import {
  loadRotation,
  saveRotation,
  describeRotation,
  formatRemaining,
  RotationScheduler,
  type RotationConfig,
  type EngineId
} from './engineRotation';
import { switchEngine, isOnStage } from './rotationDriver';

export default function RotationDock() {
  const [cfg, setCfg] = useState<RotationConfig>(() => loadRotation());
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [lastSwitch, setLastSwitch] = useState<string>('');

  const schedulerRef = useRef<RotationScheduler | null>(null);
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  // Persist on every change.
  useEffect(() => {
    saveRotation(cfg);
  }, [cfg]);

  /* ------------------------------------------------------------- scheduler */
  useEffect(() => {
    schedulerRef.current?.stop();
    schedulerRef.current = null;

    if (!cfg.enabled) {
      setRemaining(null);
      return;
    }

    const scheduler = new RotationScheduler(cfg, 'quiz', {
      onSwitch: async (to: EngineId) => {
        // Only rotate while the stage is actually on screen. If the streamer
        // is in the gateway setting things up, we skip this turn rather than
        // yanking the UI around.
        if (!isOnStage()) {
          setLastSwitch('skipped (not on stage)');
          return;
        }
        const ok = await switchEngine(to, cfgRef.current.fadeMs);
        setLastSwitch(ok ? `switched to ${to}` : 'switch failed');
      },
      onTick: (remainingMs: number) => setRemaining(remainingMs)
    });

    schedulerRef.current = scheduler;
    scheduler.start();

    return () => scheduler.stop();
  }, [cfg]);

  const setDwell = (engine: EngineId, minutes: number) => {
    setCfg(c => ({
      ...c,
      dwellMinutes: { ...c.dwellMinutes, [engine]: Math.min(720, Math.max(1, minutes || 1)) }
    }));
  };

  return (
    <div className="rotation-dock">
      <button
        className={`rotation-toggle ${cfg.enabled ? 'is-on' : ''}`}
        onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))}
        title={cfg.enabled ? 'Turn automatic engine rotation off' : 'Rotate between quiz and video automatically'}
      >
        <Repeat size={14} />
        <span>{cfg.enabled ? 'Rotation On' : 'Rotation Off'}</span>
      </button>

      <button
        className="rotation-expand"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title="Rotation settings"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <span className="rotation-summary">
        {describeRotation(cfg)}
        {cfg.enabled && remaining !== null ? ` · next in ${formatRemaining(remaining)}` : ''}
        {lastSwitch ? ` · ${lastSwitch}` : ''}
      </span>

      {open && (
        <div className="rotation-panel">
          <p className="rotation-hint">
            When on, the stream switches engines automatically. The switch freezes the current
            frame, swaps underneath, then fades — so a viewer never sees a blank frame.
          </p>

          <label className="rotation-row">
            <span>Quiz runs for</span>
            <input
              type="number"
              min={1}
              max={720}
              value={cfg.dwellMinutes.quiz}
              onChange={e => setDwell('quiz', Number(e.target.value))}
            />
            <span className="rotation-unit">min</span>
          </label>

          <label className="rotation-row">
            <span>Video runs for</span>
            <input
              type="number"
              min={1}
              max={720}
              value={cfg.dwellMinutes.video}
              onChange={e => setDwell('video', Number(e.target.value))}
            />
            <span className="rotation-unit">min</span>
          </label>

          <label className="rotation-row">
            <span>Order</span>
            <select
              value={cfg.order.join(',')}
              onChange={e =>
                setCfg(c => ({ ...c, order: e.target.value.split(',') as EngineId[] }))
              }
            >
              <option value="quiz,video">Quiz → Video</option>
              <option value="video,quiz">Video → Quiz</option>
            </select>
          </label>

          <p className="rotation-note">
            Saved automatically and survives a refresh. Rotation only acts while the stage is on
            screen, so it never interrupts you in the studio.
          </p>
        </div>
      )}
    </div>
  );
}
