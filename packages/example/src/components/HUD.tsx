import type { HudSnapshot, KillMsg } from '../game/types';
import { hsla } from '../game/render';

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
};

export function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <line x1="16" y1="9" x2="22" y2="15" />
          <line x1="22" y1="9" x2="16" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4.5" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="4.5" height="16" rx="1.5" />
    </svg>
  );
}

interface Props {
  hud: HudSnapshot;
  feed: KillMsg[];
  onPause: () => void;
  onToggleMute: () => void;
}

export function HUD({ hud, feed, onPause, onToggleMute }: Props) {
  const p = hud.player;
  const leaderKills = hud.players[0]?.kills ?? 0;
  const toWin = Math.max(1, hud.fragLimit - leaderKills);
  const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / 100) * 100)));
  const respawnN = Math.max(1, Math.ceil(hud.respawnT));

  return (
    <>
      {/* верхняя панель */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between">
        <div className="panel-soft flex items-center gap-2.5 px-4 py-2">
          <svg width="26" height="26" viewBox="0 0 26 26">
            <circle cx="10" cy="14" r="8" fill="none" stroke="#35e0ff" strokeWidth="2" />
            <circle cx="7.4" cy="11.4" r="2" fill="rgba(255,255,255,0.85)" />
            <circle cx="19" cy="8" r="4.5" fill="none" stroke="#ff6ec7" strokeWidth="1.8" />
            <circle cx="17.6" cy="6.6" r="1.1" fill="rgba(255,255,255,0.85)" />
          </svg>
          <div className="font-disp text-sm font-bold tracking-widest text-foam">
            BUBBLE&nbsp;WARS
          </div>
        </div>

        <div className="panel px-7 py-1.5 text-center">
          <div className="font-disp glow-aqua text-[26px] font-bold leading-8 tabular-nums text-white">
            {hud.suddenDeath ? '0:00' : fmt(hud.timeLeft)}
          </div>
          <div className={`text-[11px] font-bold tracking-wide ${hud.suddenDeath ? 'blink-soft text-danger' : 'text-foam/70'}`}>
            {hud.suddenDeath ? 'ВНЕЗАПНАЯ СМЕРТЬ' : `до победы — ${toWin}`}
          </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button className="btn-icon" onClick={onToggleMute} title="Звук (M)">
            <SpeakerIcon muted={hud.muted} />
          </button>
          <button className="btn-icon" onClick={onPause} title="Пауза (Esc)">
            <PauseIcon />
          </button>
        </div>
      </div>

      {/* табло */}
      <div className="pointer-events-none absolute left-1/2 top-[76px] z-20 flex -translate-x-1/2 items-center gap-2">
        {hud.players.map((pl) => (
          <div
            key={pl.id}
            className={`flex items-center gap-2 rounded-full px-3 py-1 ${
              pl.isPlayer ? 'panel border border-aqua/50' : 'panel-soft'
            } ${pl.alive ? '' : 'opacity-45'}`}
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{
                background: `radial-gradient(circle at 32% 30%, rgba(255,255,255,0.9), ${hsla(pl.hue, 90, 62, 1)} 60%)`,
                boxShadow: `0 0 8px ${hsla(pl.hue, 95, 65, 0.8)}`,
              }}
            />
            <span className={`max-w-[110px] truncate text-xs font-extrabold ${pl.isPlayer ? 'text-white' : 'text-foam/85'}`}>
              {pl.name}
            </span>
            <span className="font-disp text-sm font-bold tabular-nums text-white">{pl.kills}</span>
            <span className="text-[10px] font-bold tabular-nums text-foam/50">/{pl.deaths}</span>
          </div>
        ))}
      </div>

      {/* киллфид */}
      <div className="pointer-events-none absolute right-3 top-[120px] z-20 flex flex-col items-end gap-1.5">
        {feed.map((k) => (
          <div
            key={k.id}
            className={`feed-item panel-soft flex items-center gap-1.5 px-3 py-1 text-xs font-bold ${
              k.you ? 'border border-soap-gold/40' : ''
            }`}
          >
            <span style={{ color: hsla(k.killerHue, 90, 72, 1) }}>{k.killer}</span>
            <span className="font-semibold text-foam/60">{k.verb}</span>
            <span style={{ color: hsla(k.victimHue, 90, 72, 1) }}>{k.victim}</span>
          </div>
        ))}
      </div>

      {/* HP */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 w-[280px]">
        <div className="panel px-4 pb-3 pt-2.5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="font-disp text-[11px] font-bold tracking-[0.18em] text-foam/80">
              КОРПУС-ПУЗЫРЬ
            </span>
            <span className="font-disp text-sm font-bold tabular-nums text-white">
              {Math.round(p.hp)}
              <span className="text-foam/50">/100</span>
            </span>
          </div>
          <div className="h-4 overflow-hidden rounded-full border border-white/10 bg-black/45">
            <div
              className={`hp-fill h-full rounded-full ${hpPct <= 30 ? 'low' : ''}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] font-bold text-foam/70">
            <span>
              Фраги <span className="text-white">{p.kills}</span>
            </span>
            <span>
              Смерти <span className="text-white">{p.deaths}</span>
            </span>
            <span>
              Цель <span className="text-soap-gold">{hud.fragLimit}</span>
            </span>
          </div>
        </div>
      </div>

      {/* подсказки */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden items-center gap-3 rounded-2xl border border-white/5 bg-black/25 px-4 py-2.5 text-[11px] font-bold text-foam/60 md:flex">
        <span className="flex items-center gap-1">
          <span className="keycap">W</span>
          <span className="keycap">A</span>
          <span className="keycap">S</span>
          <span className="keycap">D</span>
          движение
        </span>
        <span>ЛКМ — огонь</span>
        <span>
          <span className="keycap">Esc</span> пауза
        </span>
      </div>

      {/* возрождение */}
      {hud.running && !p.alive && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="text-center">
            <div className="font-disp text-3xl font-bold text-danger glow-aqua" style={{ textShadow: '0 0 22px rgba(255,84,112,0.6)' }}>
              Ваш пузырь лопнул!
            </div>
            <div key={respawnN} className="pop-num font-disp mt-2 text-8xl font-bold text-white glow-aqua">
              {respawnN}
            </div>
            <div className="mt-1 text-sm font-bold tracking-wide text-foam/70">
              возрождение…
            </div>
          </div>
        </div>
      )}
    </>
  );
}
