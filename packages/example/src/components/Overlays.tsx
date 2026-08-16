import type { MatchResult } from '../game/types';
import { hsla } from '../game/render';

function CrownIcon({ hue }: { hue: number }) {
  return (
    <svg width="52" height="40" viewBox="0 0 52 40" className="floaty">
      <path
        d="M4 30 8 10l10 9 8-13 8 13 10-9 4 20z"
        fill={hsla(hue, 90, 62, 0.9)}
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="4" y="30" width="44" height="6" rx="3" fill={hsla(hue, 85, 52, 0.95)} />
      <circle cx="26" cy="20" r="3" fill="rgba(255,255,255,0.9)" />
    </svg>
  );
}

export function PauseOverlay({
  onResume,
  onRestart,
  onMenu,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-abyss/70 backdrop-blur-[3px]">
      <div className="rise-in panel w-[380px] p-8 text-center">
        <div className="font-disp glow-aqua text-4xl font-bold text-white">ПАУЗА</div>
        <div className="mt-1 text-sm font-bold text-foam/70">пузыри замерли в воздухе</div>
        <div className="mt-6 flex flex-col gap-3">
          <button className="btn-bubble px-6 py-3 text-lg" onClick={onResume}>
            ПРОДОЛЖИТЬ
          </button>
          <button className="btn-ghost px-6 py-2.5" onClick={onRestart}>
            Начать заново
          </button>
          <button className="btn-ghost px-6 py-2.5" onClick={onMenu}>
            Выйти в меню
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-[12px] font-bold text-foam/70">
          <span className="flex items-center gap-2">
            <span className="keycap">W</span>
            <span className="keycap">A</span>
            <span className="keycap">S</span>
            <span className="keycap">D</span>
          </span>
          <span className="self-center">движение</span>
          <span className="flex items-center gap-2">
            <span className="keycap">Мышь</span>
          </span>
          <span className="self-center">прицел башни</span>
          <span className="flex items-center gap-2">
            <span className="keycap">ЛКМ</span>
            <span className="keycap">Space</span>
          </span>
          <span className="self-center">огонь</span>
          <span className="flex items-center gap-2">
            <span className="keycap">M</span>
          </span>
          <span className="self-center">звук вкл/выкл</span>
        </div>
      </div>
    </div>
  );
}

export function GameOverOverlay({
  result,
  onRematch,
  onMenu,
}: {
  result: MatchResult;
  onRematch: () => void;
  onMenu: () => void;
}) {
  const win = result.winnerIsPlayer;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-abyss/70 backdrop-blur-[3px]">
      <div className="rise-in panel w-[470px] max-w-[94vw] p-8 text-center">
        <div className="flex justify-center">
          <CrownIcon hue={result.winnerHue} />
        </div>
        <div
          className={`font-disp mt-1 text-5xl font-bold ${win ? 'glow-aqua text-white' : 'text-danger'}`}
          style={win ? undefined : { textShadow: '0 0 22px rgba(255,84,112,0.55)' }}
        >
          {win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}
        </div>
        <div className="mt-1.5 text-sm font-bold text-foam/75">
          {win
            ? 'Вся арена в мыльной пене — вы чемпион!'
            : `Победил ${result.winnerName}. Реванш?`}
          {result.reason === 'time' && ' Время вышло — решили фраги.'}
        </div>

        <div className="mt-5 space-y-1.5">
          {result.players.map((pl, i) => (
            <div
              key={pl.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${
                pl.isPlayer ? 'border border-aqua/45 bg-aqua/10' : 'bg-black/25'
              }`}
            >
              <span className="font-disp w-5 text-sm font-bold text-foam/60">{i + 1}</span>
              <span
                className="inline-block h-3.5 w-3.5 rounded-full"
                style={{
                  background: `radial-gradient(circle at 32% 30%, rgba(255,255,255,0.9), ${hsla(pl.hue, 90, 62, 1)} 60%)`,
                  boxShadow: `0 0 8px ${hsla(pl.hue, 95, 65, 0.8)}`,
                }}
              />
              <span className="flex-1 truncate text-left text-sm font-extrabold text-white">
                {pl.name}
              </span>
              <span className="font-disp text-base font-bold tabular-nums text-soap-gold">
                {pl.kills}
              </span>
              <span className="w-10 text-right text-xs font-bold tabular-nums text-foam/50">
                {pl.deaths} см.
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            { v: result.stats.kills, l: 'фраги' },
            { v: result.stats.deaths, l: 'смерти' },
            { v: `${Math.round(result.stats.accuracy * 100)}%`, l: 'точность' },
            { v: result.stats.damage, l: 'урон' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-black/25 px-2 py-2">
              <div className="font-disp text-lg font-bold tabular-nums text-white">{s.v}</div>
              <div className="text-[10px] font-bold tracking-wider text-foam/60 uppercase">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button className="btn-bubble flex-1 px-6 py-3 text-lg" onClick={onRematch}>
            РЕВАНШ
          </button>
          <button className="btn-ghost px-6 py-3" onClick={onMenu}>
            В меню
          </button>
        </div>
      </div>
    </div>
  );
}
