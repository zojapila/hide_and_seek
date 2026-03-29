import { create } from "zustand";
import type { GameStatus, Player, Stop } from "@hideseek/shared";

interface GameState {
  // Game metadata (set once at lobby → game transition)
  gameId: string | null;
  gameCode: string | null;
  playerId: string | null;
  playerName: string | null;
  playerRole: "hider" | "seeker" | null;

  // Phase
  phase: GameStatus;

  // Player's own location
  myLocation: { latitude: number; longitude: number } | null;

  // Other seekers' locations (visible to hiders)
  seekerLocations: Pick<Player, "id" | "name" | "currentLocation">[];

  // Stops (bus/tram stops from Overpass)
  stops: Stop[];
  showStops: boolean;

  // Timer
  secondsLeft: number | null;

  // Actions
  setGameInfo: (info: {
    gameId: string;
    gameCode: string;
    playerId: string;
    playerName: string;
    playerRole: "hider" | "seeker";
  }) => void;
  setPhase: (phase: GameStatus) => void;
  setMyLocation: (loc: { latitude: number; longitude: number }) => void;
  setSeekerLocations: (players: Pick<Player, "id" | "name" | "currentLocation">[]) => void;
  setStops: (stops: Stop[]) => void;
  toggleStops: () => void;
  setSecondsLeft: (seconds: number | null) => void;
  reset: () => void;
}

const initialState = {
  gameId: null,
  gameCode: null,
  playerId: null,
  playerName: null,
  playerRole: null,
  phase: "waiting" as GameStatus,
  myLocation: null,
  seekerLocations: [],
  stops: [],
  showStops: true,
  secondsLeft: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setGameInfo: (info) => set(info),
  setPhase: (phase) => set({ phase }),
  setMyLocation: (loc) => set({ myLocation: loc }),
  setSeekerLocations: (players) =>
    set((state) => {
      const updated = [...state.seekerLocations];
      for (const p of players) {
        const idx = updated.findIndex((s) => s.id === p.id);
        if (idx >= 0) {
          updated[idx] = p;
        } else {
          updated.push(p);
        }
      }
      return { seekerLocations: updated };
    }),
  setStops: (stops) => set({ stops }),
  toggleStops: () => set((state) => ({ showStops: !state.showStops })),
  setSecondsLeft: (seconds) => set({ secondsLeft: seconds }),
  reset: () => set(initialState),
}));
