import { useEffect, useRef } from 'react';
import { drawBubble, drawBackdrop, createAmbient, type AmbientBubble } from '../game/render';

const DECOR = [
  { fx: 0.1, fy: 0.24, fr: 0.11, hue: 320 },
  { fx: 0.9, fy: 0.18, fr: 0.08, hue: 190 },
  { fx: 0.07, fy: 0.8, fr: 0.07, hue: 50 },
  { fx: 0.93, fy: 0.78, fr: 0.1, hue: 140 },
  { fx: 0.5, fy: 0.08, fr: 0.055, hue: 265 },
  { fx: 0.22, fy: 0.55, fr: 0.045, hue: 200 },
  { fx: 0.8, fy: 0.5, fr: 0.05, hue: 300 },
];

function MenuBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let w = window.innerWidth;
    let h = window.innerHeight;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let ambient: AmbientBubble[] = createAmbient(w, h);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ambient = createAmbient(w, h);
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      t += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdrop(ctx, w, h, t, ambient, dt);
      const m = Math.min(w, h);
      DECOR.forEach((d, i) => {
        const x = d.fx * w + Math.sin(t * 0.5 + i * 2) * 14;
        const y = d.fy * h + Math.cos(t * 0.42 + i * 1.7) * 16;
        drawBubble(ctx, x, y, d.fr * m, d.hue + Math.sin(t * 0.8 + i) * 18, {
          squash: Math.sin(t * 1.9 + i * 1.3) * 0.04,
          sqAngle: t * 0.2 + i,
          alpha: 0.9,
          glow: 0.6,
        });
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0" />;
}

function TankPreview() {
  return (
    <svg width="120" height="76" viewBox="0 0 120 76" className="floaty">
      <defs>
        <radialGradient id="bt" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="45%" stopColor="rgba(53,224,255,0.25)" />
          <stop offset="100%" stopColor="rgba(53,224,255,0.55)" />
        </radialGradient>
      </defs>
      <circle cx="44" cy="42" r="27" fill="url(#bt)" stroke="#7ceaff" strokeWidth="2.5" />
      <circle cx="35" cy="32" r="6" fill="rgba(255,255,255,0.9)" />
      <circle cx="66" cy="36" r="10" fill="url(#bt)" stroke="#ff6ec7" strokeWidth="2" />
      <circle cx="80" cy="32" r="6" fill="none" stroke="#ffe36e" strokeWidth="2" />
      <circle cx="93" cy="28" r="4.5" fill="none" stroke="#ffe36e" strokeWidth="1.8" />
      <circle cx="104" cy="24" r="3" fill="none" stroke="#ffe36e" strokeWidth="1.5" />
    </svg>
  );
}

export function MenuScreen({
  name,
  onName,
  onPlay,
}: {
  name: string;
  onName: (n: string) => void;
  onPlay: () => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <MenuBackdrop />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-4 py-6">
        <div className="panel-soft px-4 py-1 text-[11px] font-extrabold tracking-[0.22em] text-foam/80 uppercase">
          арена реального времени · 3 бота-соперника · фраг-лимит{' '}
          <span className="text-soap-gold">7</span>
        </div>

        <div className="text-center">
          <div className="mb-2 flex justify-center">
            <TankPreview />
          </div>
          <h1 className="title-bubble floaty text-6xl leading-none font-bold md:text-7xl">
            BUBBLE WARS
          </h1>
          <p className="mt-3 max-w-md text-[15px] font-bold text-foam/85">
            Танки из мыльных пузырей. Упругая физика, радужные снаряды
            и громкие «чпок» — лопни соперников раньше, чем лопнут тебя.
          </p>
        </div>

        <div className="flex w-full max-w-3xl flex-col items-stretch justify-center gap-4 md:flex-row">
          <div className="panel rise-in flex-1 p-6" style={{ animationDelay: '0.05s' }}>
            <div className="font-disp text-xs font-bold tracking-[0.2em] text-foam/70">
              ПИЛОТ ПУЗЫРЯ
            </div>
            <input
              className="name-input mt-3 w-full px-4 py-3 text-base"
              value={name}
              maxLength={14}
              placeholder="Ваш позывной"
              onChange={(e) => onName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onPlay();
              }}
            />
            <button
              className="btn-bubble mt-4 w-full px-6 py-3.5 text-xl tracking-wider"
              onClick={onPlay}
            >
              В БОЙ
            </button>
            <div className="mt-2 text-center text-[11px] font-bold text-foam/50">
              Enter — быстрый старт
            </div>
          </div>

          <div className="panel rise-in flex-1 p-6" style={{ animationDelay: '0.14s' }}>
            <div className="font-disp text-xs font-bold tracking-[0.2em] text-foam/70">
              УПРАВЛЕНИЕ
            </div>
            <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-[13px] font-bold text-foam/85">
              <span className="flex gap-1">
                <span className="keycap">W</span>
                <span className="keycap">A</span>
                <span className="keycap">S</span>
                <span className="keycap">D</span>
              </span>
              <span>движение корпуса (с инерцией)</span>
              <span className="keycap">Мышь</span>
              <span>поворот башни</span>
              <span className="flex gap-1">
                <span className="keycap">ЛКМ</span>
                <span className="keycap">Space</span>
              </span>
              <span>огонь мыльными снарядами</span>
              <span className="flex gap-1">
                <span className="keycap">Esc</span>
                <span className="keycap">M</span>
              </span>
              <span>пауза · звук</span>
            </div>
          </div>
        </div>

        <div className="rise-in flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] font-extrabold text-foam/65" style={{ animationDelay: '0.22s' }}>
          <span>
            <span className="text-soap-gold">7 фрагов</span> — победа
          </span>
          <span className="text-foam/30">•</span>
          <span>
            <span className="text-aqua">3 минуты</span> на матч
          </span>
          <span className="text-foam/30">•</span>
          <span>
            упругие столкновения и <span className="text-soap-pink">отдача ствола</span>
          </span>
          <span className="text-foam/30">•</span>
          <span>
            пузыри-препятствия <span className="text-soap-lime">пружинят</span>
          </span>
        </div>

        <div className="text-[11px] font-bold text-foam/40">
          Сетевой сервер недоступен в браузерной сборке — бой эмулируется локально:
          боты играют по тем же правилам и протоколу, что и люди.
        </div>
      </div>
    </div>
  );
}
