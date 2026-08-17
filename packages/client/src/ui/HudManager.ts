import { GameOverMessage, KillEventMessage, LeaderboardEntry, TankSnapshot } from '@bubble-wars/shared';
import { hsla } from '../graphics/render.js';
import { CLIENT_CONFIG } from '../config.js';

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
  private deathKillerName = document.getElementById('death-killer-name');
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
      card.className = `leaderboard-badge ${isPlayer ? 'active' : ''}`;

      card.innerHTML = `
        <span class="leaderboard-dot" style="--dot-color: ${hsla(entry.hue, 90, 62, 1)};"></span>
        <span class="leaderboard-name ${isPlayer ? 'player' : 'bot'}">
          ${entry.name}
        </span>
        <span class="leaderboard-kills">${entry.kills}</span>
        <span class="leaderboard-deaths">/${entry.deaths}</span>
      `;
      container.appendChild(card);
    });
  }

  public addKillFeedItem(data: KillEventMessage): void {
    if (!this.killFeed) return;

    const item = document.createElement('div');
    item.className = 'feed-item panel-soft kill-feed-item';
    item.innerHTML = `<span style="color: ${hsla(data.killerHue, 90, 72, 1)}">${data.killerName}</span> <span style="color: rgba(154, 220, 240, 0.6); font-weight: 600;">${data.verb || 'лопает'}</span> <span style="color: ${hsla(data.victimHue, 90, 72, 1)}">${data.victimName}</span> 💥`;

    this.killFeed.appendChild(item);
    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, CLIENT_CONFIG.HUD.KILL_FEED_TIMEOUT_MS);
  }

  public showDeathModal(
    score: number,
    killerInfo?: { name: string; hue: number; verb?: string } | null
  ): void {
    // Never show death modal if gameover modal is already open
    if (this.gameoverModal && !this.gameoverModal.classList.contains('hidden')) {
      return;
    }
    if (this.deathFinalScore) this.deathFinalScore.textContent = `${score}`;

    if (this.deathKillerName) {
      if (killerInfo) {
        this.deathKillerName.textContent = killerInfo.name;
        this.deathKillerName.style.color = hsla(killerInfo.hue, 90, 72, 1);
        this.deathKillerName.style.textShadow = `0 0 20px ${hsla(killerInfo.hue, 90, 70, 0.8)}`;
      } else {
        this.deathKillerName.textContent = 'Арена';
        this.deathKillerName.style.color = 'var(--color-danger)';
        this.deathKillerName.style.textShadow = '0 0 16px rgba(255, 84, 112, 0.7)';
      }
    }

    if (this.deathModal) this.deathModal.classList.remove('hidden');
  }

  public hideDeathModal(): void {
    if (this.deathModal) this.deathModal.classList.add('hidden');
  }

  public hideGameOverModal(): void {
    if (this.gameoverModal) this.gameoverModal.classList.add('hidden');
  }

  public showGameOverModal(data: GameOverMessage, myId: string | null): void {
    this.hideDeathModal();
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
          <div class="gameover-row ${pl.id === myId ? 'active' : ''}">
            <span class="gameover-row-rank">${i + 1}</span>
            <span class="gameover-row-dot" style="--dot-color: ${hsla(pl.hue, 90, 65, 1)};"></span>
            <span class="gameover-row-name">${pl.name}</span>
            <span class="gameover-row-kills">${pl.kills} фр.</span>
            <span class="gameover-row-deaths">${pl.deaths} см.</span>
          </div>
        `
        )
        .join('');
    }

    if (this.gameoverModal) this.gameoverModal.classList.remove('hidden');
  }

  public reset(): void {
    this.hideDeathModal();
    this.hideGameOverModal();
    if (this.leaderboardContainer) this.leaderboardContainer.innerHTML = '';
  }
}
