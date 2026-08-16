import { useEffect, useRef, useState } from 'react';
import { BubbleWarsEngine } from '../game/engine';
import type { HudSnapshot, KillMsg, MatchResult } from '../game/types';
import { HUD } from './HUD';
import { PauseOverlay, GameOverOverlay } from './Overlays';

export function GameScreen({ name, onExit }: { name: string; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BubbleWarsEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [feed, setFeed] = useState<KillMsg[]>([]);
  const [overlay, setOverlay] = useState<'none' | 'paused' | 'over'>('none');
  const [result, setResult] = useState<MatchResult | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new BubbleWarsEngine(canvas, {
      onHud: setHud,
      onKill: (k) => {
        setFeed((f) => [...f.slice(-4), k]);
        const id = window.setTimeout(
          () => setFeed((f) => f.filter((x) => x.id !== k.id)),
          4200,
        );
        timers.current.push(id);
      },
      onOver: (r) => {
        setResult(r);
        setOverlay('over');
      },
      onPauseRequest: () => {
        setOverlay((o) => (o === 'paused' ? 'none' : o === 'none' ? 'paused' : o));
      },
    });
    engineRef.current = eng;
    eng.startMatch(name);
    return () => {
      eng.destroy();
      engineRef.current = null;
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(overlay === 'paused');
  }, [overlay]);

  const restart = () => {
    setFeed([]);
    setResult(null);
    setOverlay('none');
    const eng = engineRef.current;
    if (eng) {
      eng.setPaused(false);
      eng.startMatch(name);
    }
  };

  return (
    <div className="relative h-full w-full bg-abyss">
      <canvas ref={canvasRef} className="fixed inset-0 cursor-crosshair" />
      {hud && (
        <HUD
          hud={hud}
          feed={feed}
          onPause={() => setOverlay((o) => (o === 'over' ? o : o === 'paused' ? 'none' : 'paused'))}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}
      {overlay === 'paused' && (
        <PauseOverlay onResume={() => setOverlay('none')} onRestart={restart} onMenu={onExit} />
      )}
      {overlay === 'over' && result && (
        <GameOverOverlay result={result} onRematch={restart} onMenu={onExit} />
      )}
    </div>
  );
}
