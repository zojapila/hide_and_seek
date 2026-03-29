import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as Location from "expo-location";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { useGameStore } from "../../stores/gameStore";
import type { Game, GameStatus, Player } from "@hideseek/shared";

interface GameWithPlayers extends Game {
  players: Player[];
}

export default function LobbyScreen() {
  const params = useLocalSearchParams<{
    code: string;
    playerId: string;
    playerName: string;
    playerRole: string;
    isCreator: string;
  }>();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const isCreator = params.isCreator === "1";
  const gameRef = useRef<Game | null>(null);

  // Fetch initial game state
  useEffect(() => {
    api<GameWithPlayers>(`/games/${params.code}`)
      .then((data) => {
        setGame(data);
        setPlayers(data.players);
        gameRef.current = data;
      })
      .catch((err) => {
        Alert.alert("Błąd", err instanceof Error ? err.message : "Nie udało się pobrać gry");
      });
  }, [params.code]);

  // Connect Socket.IO and listen for player updates
  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    socket.emit("game:join", {
      gameCode: params.code,
      playerName: params.playerName,
    });

    socket.on("game:player_joined", ({ player }) => {
      setPlayers((prev) => {
        if (prev.some((p) => p.id === player.id)) return prev;
        return [...prev, player];
      });
    });

    socket.on("game:player_left", ({ playerId }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    });

    // Listen for game start → navigate to map
    socket.on("game:phase_change", ({ status }: { status: GameStatus }) => {
      if (status === "hiding") {
        const setGameInfo = useGameStore.getState().setGameInfo;
        const setPhase = useGameStore.getState().setPhase;
        const currentGame = gameRef.current;

        if (currentGame) {
          setGameInfo({
            gameId: currentGame.id,
            gameCode: params.code!,
            playerId: params.playerId!,
            playerName: params.playerName!,
            playerRole: (params.playerRole as "hider" | "seeker") ?? "seeker",
          });
        }
        setPhase("hiding");

        router.replace("/(game)/map");
      }
    });

    return () => {
      socket.off("game:player_joined");
      socket.off("game:player_left");
      socket.off("game:phase_change");
      // Don't disconnect — socket is needed for the game screen
    };
  }, [params.code, params.playerName, params.playerId, params.playerRole]);

  const handleStart = useCallback(async () => {
    const socket = getSocket();
    if (!socket.connected) {
      Alert.alert("Błąd", "Połączenie z serwerem utracone. Spróbuj ponownie.");
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      socket.emit("game:start", { lat: 50.0614, lng: 19.9383 });
    } catch {
      Alert.alert("Błąd", "Nie udało się pobrać lokalizacji. Włącz GPS i spróbuj ponownie.");
    }
  }, []);

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={styles.playerRow}>
      <Text style={styles.playerIcon}>{item.role === "hider" ? "🙈" : "🔍"}</Text>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {item.name}
          {item.id === params.playerId ? " (ty)" : ""}
        </Text>
        <Text style={styles.playerRole}>
          {item.role === "hider" ? "Chowający" : "Szukający"}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Lobby</Text>
        <View style={styles.codeBadge}>
          <Text style={styles.codeLabel}>KOD GRY</Text>
          <Text style={styles.codeValue}>{params.code}</Text>
        </View>
      </View>

      {game && (
        <View style={styles.settings}>
          <Text style={styles.settingText}>⏱ {game.hideTimeMinutes} min na chowanie</Text>
          <Text style={styles.settingText}>� {game.seekTimeMinutes} min na szukanie</Text>
          <Text style={styles.settingText}>�📍 Geofence: {game.geofenceRadiusM}m</Text>
          <Text style={styles.settingText}>🗺 Promień gry: {game.gameRadiusM}m</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>
        Gracze ({players.length})
      </Text>

      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        renderItem={renderPlayer}
        contentContainerStyle={styles.playerList}
      />

      {isCreator && (
        <Pressable style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>🚀 Rozpocznij grę</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: "bold",
  },
  codeBadge: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563eb",
    letterSpacing: 3,
  },
  settings: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    gap: 4,
    marginBottom: 20,
  },
  settingText: {
    fontSize: 14,
    color: "#4b5563",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  playerList: {
    gap: 8,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  playerIcon: {
    fontSize: 28,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  playerRole: {
    fontSize: 13,
    color: "#6b7280",
  },
  startButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
