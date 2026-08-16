import { GameOverMessage, KillEventMessage, LeaderboardEntry, TankSnapshot } from '@bubble-wars/shared';
import { hsla } from '../graphics/render.js';

export class HudManager {
  private hpFill = document.getElementById('hud-health-fill');
  private hpText = document.getElementById('hud-health-text');
  private scoreText = document.getElementById('hud-score');
  private killsText = document.getElementById('hud-kills');
  private fragLimitEl = document.getElementById('hud-frag-limit');
  private pingEl = document.getElementById('hud-ping');
  private leaderboardContainer = document.getElementById('leaderboard-container');
  private killFeed = document.getElementById('kill-feed');
  private deathModal = document.getElementById('death-modal');
  private deathFinalScore = document.getElementById('death-final-score');
  private gameoverModal = document.getElementById('gameover-modal');
  private gameoverTitle = document.getElementById('gameover-title');
  private gameoverSubtitle = document.getElementById('gameover-subtitle');
  private gameoverCrown = document.getElementById('gameover-crown');
  private gameoverLeaderboard = document.getElementById('gameover-leaderboard');

  public updatePlayerHUD(snap: TankSnapshot): void {
    const pct = Math.max(0, Math.round((snap.hp / snap.maxHp) * 100));

    if (this.hpFill) {
      this.hpFill.style.width = `${pct}%`;
      if (pct <= 30) {
        this.hpFill.classList.add('low');
      } else {
        this.hpFill.classList.remove('low');
      }
    }

    if (this.hpText) {
      this.hpText.innerHTML = `${Math.round(snap.hp)}<span style="color: rgba(154, 220, 240, 0.5);">/${snap.maxHp}</span>`;
    }
    if (this.scoreText) this.scoreText.textContent = `${snap.score}`;
    if (this.killsText) this.killsText.textContent = `${snap.kills}`;
  }

  public updateFragLimit(fragLimit: number): void {
    if (this.fragLimitEl && fragLimit) {
      this.fragLimitEl.textContent = `${fragLimit}`;
    }
  }

  public updatePing(latency: number): void {
    if (this.pingEl) {
      this.pingEl.textContent = `${latency} ms`;
    }
  }

  public updateLeaderboard(leaderboard: LeaderboardEntry[], myId: string | null): void {
    const container = this.leaderboardContainer;
    if (!container) return;

    container.innerHTML = '';

    leaderboard.forEach((entry) => {
      const isPlayer = entry.id === myId;
      const card = document.createElement('div');
      card.className = isPlayer ? 'panel' : 'panel-soft';
      card.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 4px 12px;
        ${isPlayer ? 'border: 1px solid rgba(53, 224, 255, 0.6);' : ''}
      `;

      card.innerHTML = `
        <span style="
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 30%, rgba(255,255,255,0.9), ${hsla(entry.hue, 90, 62, 1)} 60%);
          box-shadow: 0 0 8px ${hsla(entry.hue, 95, 65, 0.8)};
        "></span>
        <span style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 800; color: ${isPlayer ? '#fff' : 'var(--color-foam)'};">
          ${entry.name}
        </span>
        <span style="font-family: var(--font-disp); font-size: 14px; font-weight: 700; color: #fff;">${entry.kills}</span>
        <span style="font-size: 10px; font-weight: 700; color: rgba(154, 220, 240, 0.5);">/${entry.deaths}</span>
      `;
      container.appendChild(card);
    });
  }

  public addKillFeedItem(data: KillEventMessage): void {
    if (!this.killFeed) return;

    const item = document.createElement('div');
    item.className = 'feed-item panel-soft';
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 700;
    `;
    item.innerHTML = `<span style="color: ${hsla(data.killerHue, 90, 72, 1)}">${data.killerName}</span> <span style="color: rgba(154, 220, 240, 0.6); font-weight: 600;">${data.verb || 'лопает'}</span> <span style="color: ${hsla(data.victimHue, 90, 72, 1)}">${data.victimName}</span> 💥`;

    this.killFeed.appendChild(item);
    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 4000);
  }

  public showDeathModal(score: number): void {
    if (this.deathFinalScore) this.deathFinalScore.textContent = `${score}`;
    if (this.deathModal) this.deathModal.classList.remove('hidden');
  }

  public hideDeathModal(): void {
    if (this.deathModal) this.deathModal.classList.add('hidden');
  }

  public showGameOverModal(data: GameOverMessage, myId: string | null): void {
    const isWinner = data.winnerId === myId;

    if (this.gameoverTitle) {
      this.gameoverTitle.textContent = isWinner ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
      this.gameoverTitle.style.color = isWinner ? '#fff' : 'var(--color-danger)';
      this.gameoverTitle.style.textShadow = isWinner
        ? '0 0 24px rgba(53, 224, 255, 0.8)'
        : '0 0 24px rgba(255, 84, 112, 0.8)';
    }

    if (this.gameoverSubtitle) {
      this.gameoverSubtitle.textContent = isWinner
        ? `Вся арена в мыльной пене — вы чемпион с ${data.winnerKills} фрагами!`
        : `Победил ${data.winnerName} (${data.winnerKills} фрагов). Реванш?`;
    }

    if (this.gameoverCrown) {
      this.gameoverCrown.style.filter = `drop-shadow(0 0 14px ${hsla(data.winnerHue || 48, 90, 65, 0.9)})`;
      this.gameoverCrown.setAttribute('stroke', hsla(data.winnerHue || 48, 95, 65, 1));
    }

    if (this.gameoverLeaderboard && data.leaderboard) {
      this.gameoverLeaderboard.innerHTML = data.leaderboard
        .map(
          (pl: any, i: number) => `
          <div style="display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 10px; ${
            pl.id === myId
              ? 'background: rgba(53, 224, 255, 0.15); border: 1px solid rgba(53, 224, 255, 0.4);'
              : 'background: rgba(0, 0, 0, 0.3);'
          }">
            <span style="font-family: var(--font-disp); font-size: 13px; font-weight: 700; width: 18px; color: rgba(154, 220, 240, 0.6);">${i + 1}</span>
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${hsla(pl.hue, 90, 65, 1)}; box-shadow: 0 0 8px ${hsla(pl.hue, 90, 65, 0.8)};"></span>
            <span style="flex: 1; text-align: left; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pl.name}</span>
            <span style="font-family: var(--font-disp); font-size: 15px; font-weight: 700; color: var(--color-soap-gold);">${pl.kills} фр.</span>
            <span style="font-size: 11px; font-weight: 700; opacity: 0.5;">${pl.deaths} см.</span>
          </div>
        `
        )
        .join('');
    }

    this.hideDeathModal();
    if (this.gameoverModal) this.gameoverModal.classList.remove('hidden');
  }

  public hideGameOverModal(): void {
    if (this.gameoverModal) this.gameoverModal.classList.add('hidden');
  }

  public reset(): void {
    this.hideDeathModal();
    this.hideGameOverModal();
    if (this.leaderboardContainer) this.leaderboardContainer.innerHTML = '';
  }
}
