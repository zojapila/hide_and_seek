// ── Game ──

export type GameStatus = "waiting" | "hiding" | "seeking" | "finished";

export interface Game {
  id: string;
  code: string;
  status: GameStatus;
  hideTimeMinutes: number;
  geofenceRadiusM: number;
  gameRadiusM: number;
  startedAt: string | null;
  seekingStartedAt: string | null;
  finishedAt: string | null;
  centerPoint: { lat: number; lng: number } | null;
  createdAt: string;
}

// ── Player ──

export type PlayerRole = "hider" | "seeker";

export interface Player {
  id: string;
  gameId: string;
  name: string;
  role: PlayerRole;
  currentLocation: { lat: number; lng: number } | null;
  chosenStopId: string | null;
}

// ── Stop ──

export interface Stop {
  id: string;
  gameId: string;
  osmId: number;
  name: string;
  location: { lat: number; lng: number };
}

// ── Messages ──

export type MessageType = "text" | "image" | "question" | "curse" | "system";

export interface Message {
  id: string;
  gameId: string;
  senderId: string;
  type: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ── Questions ──

export type QuestionCategory =
  | "matching"
  | "measuring"
  | "thermometer"
  | "radar"
  | "nearest_place"
  | "photo";

export interface Question {
  id: string;
  category: QuestionCategory;
  template: string;
  params: Record<string, unknown>;
}

// ── Curses ──

export type CurseType = "timed" | "task";
export type CurseStatus = "active" | "completed" | "expired";

export interface Curse {
  id: string;
  name: string;
  description: string;
  type: CurseType;
  durationSeconds: number | null;
}

export interface ActiveCurse {
  id: string;
  gameId: string;
  curseId: string;
  curse: Curse;
  targetPlayerId: string;
  castByPlayerId: string;
  status: CurseStatus;
  expiresAt: string | null;
  createdAt: string;
}

// ── Cards ──

export type CardType = "curse" | "time_bonus";
export type CardStatus = "in_deck" | "in_hand" | "played" | "discarded";

export interface Card {
  id: string;
  gameId: string;
  playerId: string;
  cardType: CardType;
  cardRefId: string | null;
  status: CardStatus;
}

// ── Socket Events ──

export interface ServerToClientEvents {
  "game:player_joined": (data: { player: Player }) => void;
  "game:player_left": (data: { playerId: string }) => void;
  "game:phase_change": (data: { status: GameStatus }) => void;
  "location:seekers": (data: { players: Pick<Player, "id" | "name" | "currentLocation">[] }) => void;
  "location:geofence_warning": (data: { distanceToEdge: number }) => void;
  "chat:message": (data: Message) => void;
  "question:answer": (data: { questionId: string; answer: string }) => void;
  "curse:cast": (data: ActiveCurse) => void;
  "curse:expired": (data: { curseId: string }) => void;
  "curse:completed": (data: { curseId: string }) => void;
  "cards:drawn": (data: { cards: Card[] }) => void;
  "timer:sync": (data: { phase: GameStatus; remainingMs: number }) => void;
}

export interface ClientToServerEvents {
  "game:join": (data: { gameCode: string; playerName: string; role: PlayerRole }) => void;
  "game:start": () => void;
  "location:update": (data: { lat: number; lng: number }) => void;
  "chat:message": (data: { type: MessageType; content: string; metadata?: Record<string, unknown> }) => void;
  "question:ask": (data: { questionId: string; params: Record<string, unknown> }) => void;
  "curse:cast": (data: { curseId: string; targetPlayerId: string }) => void;
  "curse:complete": (data: { activeCurseId: string }) => void;
  "cards:draw": (data: { count: number }) => void;
  "cards:discard": (data: { cardId: string }) => void;
}
