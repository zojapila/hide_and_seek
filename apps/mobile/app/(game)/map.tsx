import { useEffect, useRef, useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, AppState, Alert } from "react-native";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import { useLocation } from "../../hooks/useLocation";
import { useGameStore } from "../../stores/gameStore";
import { getSocket } from "../../lib/socket";
import { api } from "../../lib/api";
import { GameTimer } from "../../components/GameTimer";
import type { Stop } from "@hideseek/shared";

const LOCATION_EMIT_INTERVAL_MS = 4000;

export default function MapScreen() {
  const { location, error, permissionDenied } = useLocation();
  const mapRef = useRef<MapView>(null);
  const lastEmitRef = useRef<number>(0);

  const setMyLocation = useGameStore((s) => s.setMyLocation);
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const seekerLocations = useGameStore((s) => s.seekerLocations);
  const playerRole = useGameStore((s) => s.playerRole);
  const gameCode = useGameStore((s) => s.gameCode);
  const stops = useGameStore((s) => s.stops);
  const showStops = useGameStore((s) => s.showStops);
  const setStops = useGameStore((s) => s.setStops);
  const toggleStops = useGameStore((s) => s.toggleStops);
  const setSecondsLeft = useGameStore((s) => s.setSecondsLeft);
  const chosenStopId = useGameStore((s) => s.chosenStopId);
  const setChosenStopId = useGameStore((s) => s.setChosenStopId);
  const playerId = useGameStore((s) => s.playerId);

  // Update store + emit location to server
  useEffect(() => {
    if (!location) return;

    setMyLocation(location);

    const now = Date.now();
    if (now - lastEmitRef.current >= LOCATION_EMIT_INTERVAL_MS) {
      lastEmitRef.current = now;
      const socket = getSocket();
      if (socket.connected) {
        socket.emit("location:update", {
          lat: location.latitude,
          lng: location.longitude,
        });
      }
    }
  }, [location, setMyLocation]);

  // Listen for seeker locations (hider view)
  useEffect(() => {
    const socket = getSocket();
    const setSeekerLocations = useGameStore.getState().setSeekerLocations;

    const handleSeekerLocations = (data: {
      players: { id: string; name: string; currentLocation: { lat: number; lng: number } | null }[];
    }) => {
      setSeekerLocations(data.players);
    };

    socket.on("location:seekers", handleSeekerLocations);
    return () => {
      socket.off("location:seekers", handleSeekerLocations);
    };
  }, []);

  // Listen for timer sync
  useEffect(() => {
    const socket = getSocket();

    const handleTimerSync = (data: { phase: string; remainingMs: number }) => {
      const seconds = Math.ceil(data.remainingMs / 1000);
      setSecondsLeft(seconds);
      // Sync phase if server says we've moved to seeking
      if (data.phase === "seeking") {
        setPhase("seeking");
      }
    };

    socket.on("timer:sync", handleTimerSync);
    return () => {
      socket.off("timer:sync", handleTimerSync);
    };
  }, [setSecondsLeft, setPhase]);

  // Re-sync timer when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const socket = getSocket();
        const { gameCode: code, playerName: name } = useGameStore.getState();
        if (socket.connected && code && name) {
          // Re-join room — server will emit timer:sync with current state
          socket.emit("game:join", { gameCode: code, playerName: name });
        }
      }
    });
    return () => subscription.remove();
  }, []);

  // Listen for stop chosen events
  useEffect(() => {
    const socket = getSocket();
    const handleStopChosen = (data: { playerId: string; stopId: string; stopName: string }) => {
      const myId = useGameStore.getState().playerId;
      if (data.playerId === myId) {
        setChosenStopId(data.stopId);
      }
    };
    socket.on("game:stop_chosen", handleStopChosen);
    return () => {
      socket.off("game:stop_chosen", handleStopChosen);
    };
  }, [setChosenStopId]);

  const handleChooseStop = useCallback((stop: Stop) => {
    Alert.alert(
      "Ukryj się tutaj?",
      `Czy chcesz schować się na przystanku "${stop.name}"?`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Tak, chowam się!",
          onPress: () => {
            const socket = getSocket();
            socket.emit("game:choose_stop", { stopId: stop.id });
          },
        },
      ],
    );
  }, []);

  // Fetch stops when game enters hiding/seeking phase
  useEffect(() => {
    if (!gameCode) return;
    if (phase !== "hiding" && phase !== "seeking") return;
    if (stops.length > 0) return; // already loaded

    api<Stop[]>(`/games/${gameCode}/stops`)
      .then((data) => setStops(data))
      .catch(() => {
        /* stops will just not appear — non-critical */
      });
  }, [gameCode, phase, stops.length, setStops]);

  const handleRecenter = useCallback(() => {
    if (!location || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      500,
    );
  }, [location]);

  // Permission denied state
  if (permissionDenied) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>📍</Text>
        <Text style={styles.errorTitle}>Brak dostępu do lokalizacji</Text>
        <Text style={styles.errorText}>
          Włącz uprawnienia lokalizacji w ustawieniach telefonu, żeby korzystać z mapy.
        </Text>
        <Pressable
          style={styles.settingsButton}
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Otwórz ustawienia"
        >
          <Text style={styles.settingsButtonText}>Otwórz ustawienia</Text>
        </Pressable>
      </View>
    );
  }

  // Waiting for first fix
  if (!location) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>📡 Ustalanie lokalizacji...</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Player's own marker */}
        <Marker
          coordinate={location}
          title="Ty"
          pinColor={playerRole === "hider" ? "#16a34a" : "#2563eb"}
        />

        {/* Seeker markers (visible to hiders in seeking phase) */}
        {playerRole === "hider" &&
          phase === "seeking" &&
          seekerLocations.map(
            (seeker) =>
              seeker.currentLocation && (
                <Marker
                  key={seeker.id}
                  coordinate={{
                    latitude: seeker.currentLocation.lat,
                    longitude: seeker.currentLocation.lng,
                  }}
                  title={seeker.name}
                  pinColor="#ef4444"
                />
              ),
          )}

        {/* Stop markers */}
        {showStops &&
          stops.map((stop) => (
            <Marker
              key={stop.id}
              coordinate={{
                latitude: stop.location.lat,
                longitude: stop.location.lng,
              }}
              pinColor={stop.id === chosenStopId ? "#16a34a" : "#f59e0b"}
              tracksViewChanges={false}
            >
              <Callout
                onPress={
                  playerRole === "hider" && phase === "hiding" && !chosenStopId
                    ? () => handleChooseStop(stop)
                    : undefined
                }
              >
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    🚏 {stop.name}
                    {stop.id === chosenStopId ? " ✅" : ""}
                  </Text>
                  {playerRole === "hider" && phase === "hiding" && !chosenStopId && (
                    <Text style={styles.calloutAction}>Kliknij, żeby się tu schować</Text>
                  )}
                </View>
              </Callout>
            </Marker>
          ))}
      </MapView>

      {/* Phase badge */}
      <View style={styles.phaseBadge}>
        <Text style={styles.phaseText}>
          {phase === "waiting" && "⏳ Oczekiwanie"}
          {phase === "hiding" && "🙈 Chowanie"}
          {phase === "seeking" && "🔍 Szukanie"}
          {phase === "finished" && "🏁 Koniec"}
        </Text>
      </View>

      {/* Recenter button */}
      <Pressable
        style={styles.recenterButton}
        onPress={handleRecenter}
        accessibilityRole="button"
        accessibilityLabel="Wyśrodkuj mapę na mojej lokalizacji"
      >
        <Text style={styles.recenterText}>📌</Text>
      </Pressable>

      {/* Toggle stops button */}
      {stops.length > 0 && (
        <Pressable
          style={styles.toggleStopsButton}
          onPress={toggleStops}
          accessibilityRole="button"
          accessibilityLabel={showStops ? "Ukryj przystanki" : "Pokaż przystanki"}
        >
          <Text style={styles.toggleStopsText}>{showStops ? "🚏 ✕" : "🚏"}</Text>
        </Pressable>
      )}

      {/* Timer — floating, centered at top */}
      <GameTimer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#fff",
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: "#4b5563",
  },
  phaseBadge: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  phaseText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
  },
  recenterButton: {
    position: "absolute",
    bottom: 24,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  recenterText: {
    fontSize: 22,
  },
  settingsButton: {
    marginTop: 20,
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  settingsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  callout: {
    padding: 4,
    minWidth: 120,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  calloutAction: {
    fontSize: 12,
    color: "#2563eb",
    marginTop: 4,
    fontWeight: "500",
  },
  toggleStopsButton: {
    position: "absolute",
    bottom: 24,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleStopsText: {
    fontSize: 20,
  },
});
