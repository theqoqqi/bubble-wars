import {
    GameOverMessage,
    KillEventMessage,
    LeaderboardEntry,
    PlayerInfo,
    tankBlueprintRegistry,
} from '@bubble-wars/shared';
import { hsla } from '../graphics/render.js';
import { CLIENT_CONFIG } from '../config.js';

type NumericKeys<T> = {
    [K in keyof T]: NonNullable<T[K]> extends number ? K : never;
}[keyof T];

export class HudManager {
    private hpFill = document.getElementById('hud-health-fill');
    private hpText = document.getElementById('hud-health-text');
    private scoreText = document.getElementById('hud-score');
    private killsText = document.getElementById('hud-kills');
    private fragLimitEl = document.getElementById('hud-frag-limit');
    private pingEl = document.getElementById('hud-ping');
    private netInEl = document.getElementById('hud-net-in');
    private netPacketEl = document.getElementById('hud-net-packet');
    private hudHostBadge = document.getElementById('hud-host-badge');
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
    private btnGameOverHostConfig = document.getElementById('btn-gameover-host-config');

    // In-game Tab Overlay Elements & State
    private tabStatsOverlay = document.getElementById('tab-stats-overlay');
    private tabStatsLeaderboard = document.getElementById('tab-stats-leaderboard');
    private tabFragLimit = document.getElementById('tab-frag-limit');
    private isTabVisible: boolean = false;
    private lastLeaderboard: LeaderboardEntry[] = [];
    private lastPlayersInfo: Map<string, PlayerInfo> = new Map();
    private lastMyId: string | null = null;
    private lastHostId: string | null = null;
    private fragLimit: number = 10;

    public setHostId(hostId: string | null): void {
        this.lastHostId = hostId;
        const isMyHost = !!(hostId && this.lastMyId && hostId === this.lastMyId);
        if (this.hudHostBadge) {
            if (isMyHost) {
                this.hudHostBadge.classList.remove('hidden');
            } else {
                this.hudHostBadge.classList.add('hidden');
            }
        }
        if (this.btnGameOverHostConfig) {
            if (isMyHost && this.gameoverModal && !this.gameoverModal.classList.contains('hidden')) {
                this.btnGameOverHostConfig.classList.remove('hidden');
            } else {
                this.btnGameOverHostConfig.classList.add('hidden');
            }
        }
        if (this.isTabVisible) {
            this.renderTabStats();
        }
    }

    public updatePlayerHUD(hp: number, maxHp: number): void {
        const pct = maxHp > 0 ? Math.max(0, Math.round((hp / maxHp) * 100)) : 0;

        if (this.hpFill) {
            this.hpFill.style.width = `${pct}%`;
            if (pct <= 30) {
                this.hpFill.classList.add('low');
            } else {
                this.hpFill.classList.remove('low');
            }
        }

        if (this.hpText) {
            this.hpText.innerHTML = `${Math.round(hp)}<span style="color: rgba(154, 220, 240, 0.5);">/${maxHp}</span>`;
        }
    }

    public updateFragLimit(fragLimit: number): void {
        if (!fragLimit) return;
        this.fragLimit = fragLimit;
        if (this.fragLimitEl) {
            this.fragLimitEl.textContent = `${fragLimit}`;
        }
        if (this.tabFragLimit) {
            this.tabFragLimit.textContent = `${fragLimit}`;
        }
    }

    public updateNetworkStats(
        latency: number,
        inboundKbps: number = 0,
        avgPacketBytes: number = 0
    ): void {
        if (this.pingEl) {
            this.pingEl.textContent = `${latency} ms`;
        }
        if (this.netInEl) {
            this.netInEl.textContent = `${inboundKbps.toFixed(1)} KB/s`;
        }
        if (this.netPacketEl) {
            if (avgPacketBytes >= 1024) {
                this.netPacketEl.textContent = `(${(avgPacketBytes / 1024).toFixed(1)} KB/пкт)`;
            } else {
                this.netPacketEl.textContent = `(${avgPacketBytes} B/пкт)`;
            }
        }
    }

    public updatePing(latency: number): void {
        if (this.pingEl) {
            this.pingEl.textContent = `${latency} ms`;
        }
    }

    public updateLeaderboard(
        leaderboard: LeaderboardEntry[],
        myId: string | null,
        playersInfo: Map<string, PlayerInfo>
    ): void {
        this.lastLeaderboard = leaderboard;
        this.lastMyId = myId;
        this.lastPlayersInfo = playersInfo;

        // 0. Update local player score and kills from leaderboard
        if (myId) {
            const myEntry = leaderboard.find((e) => e.id === myId);
            if (myEntry) {
                if (this.scoreText) this.scoreText.textContent = `${myEntry.score}`;
                if (this.killsText) this.killsText.textContent = `${myEntry.kills}`;
            }
        }

        // 1. Update top bar compact badges (Frag limit + Top-3 + local player if outside top-3)
        const container = this.leaderboardContainer;
        if (container) {
            container.innerHTML = '';

            // Frag limit target badge before top-3 players
            if (this.fragLimit > 0) {
                const limitCard = document.createElement('div');
                limitCard.className = 'leaderboard-badge leaderboard-frag-limit-badge';
                limitCard.title = `Лимит фрагов для победы: ${this.fragLimit}`;
                limitCard.innerHTML = `
                    <span class="leaderboard-frag-limit-num">${this.fragLimit}</span>
                    <span class="leaderboard-frag-limit-label">ЦЕЛЬ</span>
                `;
                container.appendChild(limitCard);
            }

            const topCount = 3;
            const topEntries = leaderboard.slice(0, topCount).map((entry, index) => ({
                entry,
                rank: index + 1,
            }));

            const myIndex = myId ? leaderboard.findIndex((e) => e.id === myId) : -1;
            const myEntryOutsideTop =
                myIndex >= topCount && leaderboard[myIndex]
                    ? { entry: leaderboard[myIndex], rank: myIndex + 1 }
                    : null;

            const displayList = myEntryOutsideTop ? [...topEntries, myEntryOutsideTop] : topEntries;

            displayList.forEach(({ entry, rank }) => {
                const isPlayer = entry.id === myId;
                const card = document.createElement('div');
                card.className = `leaderboard-badge ${isPlayer ? 'active' : ''}`;

                const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';

                card.innerHTML = `
            <span class="leaderboard-rank ${rankClass}">#${rank}</span>
            <span class="leaderboard-name" style="color: ${hsla(entry.hue, 90, 72, 1)}; text-shadow: 0 0 10px ${hsla(entry.hue, 90, 60, 0.45)};">
              ${entry.name}
            </span>
            <span class="leaderboard-kills">${entry.kills}</span>
          `;
                container.appendChild(card);
            });

            const hiddenCount = leaderboard.length - displayList.length;
            if (hiddenCount > 0) {
                const moreCard = document.createElement('div');
                moreCard.className = 'leaderboard-badge leaderboard-more-badge';
                moreCard.innerHTML = `<span class="leaderboard-more-text">+${this.formatPlayersCount(hiddenCount)}</span>`;
                container.appendChild(moreCard);
            }
        }

        // 2. If Tab overlay is active, re-render live stats table
        if (this.isTabVisible) {
            this.renderTabStats();
        }
    }

    public showTabStats(): void {
        if (!this.tabStatsOverlay) return;
        // Don't show if game over modal is active
        if (this.gameoverModal && !this.gameoverModal.classList.contains('hidden')) return;

        this.isTabVisible = true;
        this.renderTabStats();
        this.tabStatsOverlay.classList.remove('hidden');
    }

    public hideTabStats(): void {
        if (!this.tabStatsOverlay) return;
        this.isTabVisible = false;
        this.tabStatsOverlay.classList.add('hidden');
    }

    private isBestStat(
        list: LeaderboardEntry[],
        player: LeaderboardEntry,
        key: NumericKeys<LeaderboardEntry>,
        direction: 'max' | 'min' = 'max'
    ): boolean {
        if (!list || list.length === 0) return false;
        const myValue = Number(player[key] ?? 0);
        const bestValue = Math[direction](0, ...list.map((p) => Number(p[key] ?? 0)));

        return myValue === bestValue;
    }

    private renderTabStats(): void {
        if (!this.tabStatsLeaderboard || !this.lastLeaderboard) return;

        const list = this.lastLeaderboard;

        this.tabStatsLeaderboard.innerHTML = list
            .map((pl: LeaderboardEntry, i: number) => {
                const isPlayer = pl.id === this.lastMyId;
                const isHost = pl.id === this.lastHostId;
                const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
                const badge = isPlayer
                    ? '<span class="gameover-badge-you">ВЫ</span>'
                    : pl.isBot
                    ? '<span class="gameover-badge-bot">BOT</span>'
                    : '';
                const hostBadge = isHost ? '<span class="gameover-badge-host" title="Хост арены">ХОСТ</span>' : '';
                const bpId = this.lastPlayersInfo.get(pl.id)?.blueprintId;
                const bp = bpId ? tankBlueprintRegistry.get(bpId) : null;
                const tankName = bp ? bp.name : 'Танк';

                return `
          <div class="tab-stats-row ${isPlayer ? 'active' : ''}">
            <span class="tab-col-rank ${rankClass}">${i + 1}</span>
            <div class="gameover-player-cell tab-col-name">
              <span class="gameover-row-dot" style="--dot-color: ${hsla(pl.hue, 90, 65, 1)};"></span>
              <div class="gameover-player-info">
                <div class="gameover-name-row">
                  <span class="gameover-row-name">${pl.name}</span>
                  ${badge}
                  ${hostBadge}
                </div>
                <span class="gameover-row-tank">${tankName}</span>
              </div>
            </div>
            <span class="tab-col-stat kills ${this.isBestStat(list, pl, 'kills') ? 'stat-best' : ''}">${pl.kills}</span>
            <span class="tab-col-stat deaths ${this.isBestStat(list, pl, 'deaths', 'min') ? 'stat-best' : ''}">${pl.deaths}</span>
            <span class="tab-col-stat assists ${this.isBestStat(list, pl, 'assists') ? 'stat-best' : ''}">${pl.assists ?? 0}</span>
            <span class="tab-col-score ${this.isBestStat(list, pl, 'score') ? 'stat-best' : ''}">${pl.score}</span>
          </div>
        `;
            })
            .join('');
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

    public updateDeathModalScore(score: number): void {
        if (this.deathFinalScore && this.deathFinalScore.textContent !== `${score}`) {
            this.deathFinalScore.textContent = `${score}`;
        }
    }

    public hideGameOverModal(): void {
        if (this.gameoverModal) this.gameoverModal.classList.add('hidden');
    }

    public showGameOverModal(
        data: GameOverMessage,
        myId: string | null,
        playersInfo: Map<string, PlayerInfo>
    ): void {
        this.hideDeathModal();
        this.lastPlayersInfo = playersInfo;
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
            const list = data.leaderboard;

            this.gameoverLeaderboard.innerHTML = list
                .map((pl: LeaderboardEntry, i: number) => {
                    const isPlayer = pl.id === myId;
                    const isHost = pl.id === this.lastHostId;
                    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
                    const badge = isPlayer
                        ? '<span class="gameover-badge-you">ВЫ</span>'
                        : pl.isBot
                        ? '<span class="gameover-badge-bot">BOT</span>'
                        : '';
                    const hostBadge = isHost ? '<span class="gameover-badge-host" title="Хост арены">ХОСТ</span>' : '';
                    const bpId = this.lastPlayersInfo.get(pl.id)?.blueprintId;
                    const bp = bpId ? tankBlueprintRegistry.get(bpId) : null;
                    const tankName = bp ? bp.name : 'Танк';

                    return `
          <div class="gameover-row ${isPlayer ? 'active' : ''}">
            <span class="gameover-col-rank ${rankClass}">${i + 1}</span>
            <div class="gameover-player-cell">
              <span class="gameover-row-dot" style="--dot-color: ${hsla(pl.hue, 90, 65, 1)};"></span>
              <div class="gameover-player-info">
                <div class="gameover-name-row">
                  <span class="gameover-row-name">${pl.name}</span>
                  ${badge}
                  ${hostBadge}
                </div>
                <span class="gameover-row-tank">${tankName}</span>
              </div>
            </div>
            <span class="gameover-col-stat kills ${this.isBestStat(list, pl, 'kills') ? 'stat-best' : ''}">${pl.kills}</span>
            <span class="gameover-col-stat deaths ${this.isBestStat(list, pl, 'deaths', 'min') ? 'stat-best' : ''}">${pl.deaths}</span>
            <span class="gameover-col-stat assists ${this.isBestStat(list, pl, 'assists') ? 'stat-best' : ''}">${pl.assists ?? 0}</span>
            <span class="gameover-col-stat damage-dealt ${this.isBestStat(list, pl, 'damageDealt') ? 'stat-best' : ''}">${pl.damageDealt ?? 0}</span>
            <span class="gameover-col-stat damage-taken ${this.isBestStat(list, pl, 'damageTaken') ? 'stat-best' : ''}">${pl.damageTaken ?? 0}</span>
            <span class="gameover-col-score ${this.isBestStat(list, pl, 'score') ? 'stat-best' : ''}">${pl.score}</span>
          </div>
        `;
                })
                .join('');
        }

        if (this.btnGameOverHostConfig) {
            const isHost = !!(this.lastHostId && myId && this.lastHostId === myId);
            if (isHost) {
                this.btnGameOverHostConfig.classList.remove('hidden');
            } else {
                this.btnGameOverHostConfig.classList.add('hidden');
            }
        }

        if (this.gameoverModal) this.gameoverModal.classList.remove('hidden');
    }

    public reset(): void {
        this.hideDeathModal();
        this.hideGameOverModal();
        this.hideTabStats();
        if (this.leaderboardContainer) this.leaderboardContainer.innerHTML = '';
    }

    private formatPlayersCount(count: number): string {
        const abs = Math.abs(count) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return `${count} игроков`;
        if (rem > 1 && rem < 5) return `${count} игрока`;
        if (rem === 1) return `${count} игрок`;
        return `${count} игроков`;
    }
}
