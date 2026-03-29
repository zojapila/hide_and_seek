import { View, Text, StyleSheet } from "react-native";
import { useGameStore } from "../stores/gameStore";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function GameTimer() {
  const secondsLeft = useGameStore((s) => s.secondsLeft);
  const phase = useGameStore((s) => s.phase);
  const playerRole = useGameStore((s) => s.playerRole);
  const chosenStopId = useGameStore((s) => s.chosenStopId);

  if (secondsLeft === null || (phase !== "hiding" && phase !== "seeking")) return null;

  // Hider who already chose a stop doesn't need the timer
  if (playerRole === "hider" && chosenStopId && phase === "hiding") return null;

  const isUrgent = secondsLeft <= 60;
  const isCritical = secondsLeft <= 10;

  return (
    <View style={[styles.container, isUrgent && styles.urgent, isCritical && styles.critical]}>
      <Text style={styles.label}>
        {phase === "hiding" ? "🙈 Czas na chowanie" : "🔍 Czas szukania"}
      </Text>
      <Text style={[styles.time, isCritical && styles.criticalText]}>
        {formatTime(secondsLeft)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: "center",
    zIndex: 10,
  },
  urgent: {
    backgroundColor: "rgba(202, 138, 4, 0.9)",
  },
  critical: {
    backgroundColor: "rgba(185, 28, 28, 0.95)",
  },
  label: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  time: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  criticalText: {
    color: "#fca5a5",
  },
});
