# Документация и план проекта: Bubble Wars (MVP)

## 1. Концепция игры

**Bubble Wars** — это браузерная мультиплеерная 2D Top-Down экшен-игра, в которой игроки управляют танками из мыльных пузырей и сражаются на арене в реальном времени.

Все объекты в мире игры (танки, снаряды, препятствия) являются мыльными пузырями и подчиняются законам упругой физики (Soft-Body / Spring Physics).

---

## 2. Структура танка в MVP

В MVP танк имеет фиксированную базовую конструкцию из мыльных пузырей (без отдельного редактора):

1. 🟡 **Тело танка (Body)**: Большой мыльный пузырь-корпус. Принимает урон, перемещается по арене с инерцией и покачиваниями (`WASD`). Содержит запас HP танка.
2. 🔵 **Башня (Turret)**: Средний пузырь, закрепленный на теле танка, плавно поворачивающийся в сторону курсора мыши.
3. 🔴 **Ствол (Barrel)**: Цепочка из 1–2 маленьких пузырьков, выходящих из башни в направлении прицеливания. При выстреле анимирует отдачу (пружинит назад).

---

## 3. Архитектура проекта (Monorepo)

Проект разрабатывается в архитектуре монорепозитория с разделением на три пакета:

```text
BubbleWars/
├── docs/
│   └── plan.md                    # Архитектурный план и документация (этот файл)
├── package.json                   # Корневой package.json (npm workspaces)
├── packages/
│   ├── shared/                    # 📦 Общие контракты, типы и константы
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts           # TankState, ProjectileState, PlayerInput
│   │       ├── protocol.ts        # Сетевые сообщения (Join, Input, WorldState, Pop)
│   │       └── constants.ts       # Радиусы пузырей, скорость, урон, HP
│   │
│   ├── server/                    # 🖥️ Авторитетный сервер физики
│   │   ├── package.json           # Node.js, ws, matter-js, typescript
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts           # Запуск HTTP и WebSocket сервера
│   │       ├── game/
│   │       │   ├── GameRoom.ts    # Игровая комната, тикрейт (30-45 FPS), рассылка снапшотов
│   │       │   ├── PhysicsWorld.ts# Headless Matter.js симуляция мира
│   │       │   ├── ServerTank.ts  # Физический танк игрока/бота (движение, прицел, стрельба)
│   │       │   ├── Projectile.ts  # Мыльные снаряды
│   │       │   └── BotPlayer.ts   # Серверный AI-бот
│   │
│   └── client/                    # 🎮 Клиент игры (Phaser 3)
│       ├── package.json           # phaser, vite, typescript
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html             # Главная страница
│       └── src/
│           ├── main.ts            # Инициализация Phaser
│           ├── net/
│           │   └── NetworkManager.ts # WebSocket клиент (отправка инпутов, прием снапшотов)
│           ├── audio/
│           │   └── SoundFx.ts     # Процедурные звуки лопания и выстрелов (Web Audio API)
│           ├── graphics/
│           │   └── BubbleRenderer.ts # Процедурные текстуры мыльных пузырей и частиц
│           └── scenes/
│               ├── BootScene.ts   # Генерация текстур и инициализация
│               └── ArenaScene.ts  # Боевая арена (рендер танков, управление WASD+Mouse, HUD)
```

---

## 4. Сетевой протокол (WebSocket API)

Обмен сообщениями происходит в формате JSON:

### От Клиента к Серверу (Client -> Server)

1. **`JOIN_GAME`**:

   ```typescript
   {
     type: 'JOIN_GAME',
     name: string
   }
   ```

2. **`PLAYER_INPUT`**:

   ```typescript
   {
     type: 'PLAYER_INPUT',
     up: boolean,
     down: boolean,
     left: boolean,
     right: boolean,
     aimAngle: number,
     shooting: boolean,
     seq: number
   }
   ```

### От Сервера к Клиенту (Server -> Client)

1. **`INIT_PLAYER`**: Подтверждение входа, назначение playerId и параметров арены.

2. **`WORLD_STATE`** (каждый тик, 30–45 раз в сек):

   ```typescript
   {
     type: 'WORLD_STATE',
     tick: number,
     tanks: Array<{
       id: string,
       name: string,
       x: number,
       y: number,
       vx: number,
       vy: number,
       aimAngle: number,
       hp: number,
       maxHp: number,
       isBot: boolean
     }>,
     projectiles: Array<{
       id: number,
       x: number,
       y: number,
       radius: number
     }>
   }
   ```

3. **`BUBBLE_POP_EVENT`**:

   ```typescript
   {
     type: 'BUBBLE_POP_EVENT',
     x: number,
     y: number,
     radius: number,
     isKill: boolean
   }
   ```

---

## 5. Поэтапный план реализации MVP

### Фаза 1: Инициализация Monorepo и пакета shared

- [x] Настройка корневого `package.json` (npm workspaces).
- [x] Создание пакета `packages/shared` с типами (`TankState`, `PlayerInput`, `protocol.ts`) и константами баланса.

### Фаза 2: Авторитетный сервер (packages/server)

- [x] WebSocket сервер на `ws` + TypeScript.
- [x] Headless `matter-js` физика (движение танка с инерцией, упругость, коллизии со стенами и снарядами).
- [x] Логика стрельбы мыльными снарядами, обработка урона и лопания танков.
- [x] Встроенный спарринг-бот (AI Bot), преследующий игрока и стреляющий.

### Фаза 3: Клиент на Phaser 3 (packages/client)

- [x] Настройка Vite + Phaser 3 + TypeScript.
- [x] Процедурная генерация мыльных текстур (тело, башня, ствол, снаряды) с яркими бликами и переливами.
- [x] Процедурный синтез звуков (чпоки, выстрелы, лопание) через Web Audio API.
- [x] Боевая арена: управление `WASD + Mouse`, интерполяция движения танков со снапшотов сервера, анимация отдачи ствола, мыльные частицы при попаданиях.
- [x] HUD здоровья и экран респавна.

### Фаза 4: Верификация и тестирование

- [x] Запуск клиента и сервера, проверка сетевого взаимодействия, проверка боя с ботом и между несколькими вкладками браузера.
