import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { api } from "../../lib/api";
import type { Game } from "@hideseek/shared";

export default function CreateScreen() {
  const [hideTime, setHideTime] = useState("30");
  const [geofenceRadius, setGeofenceRadius] = useState("200");
  const [gameRadius, setGameRadius] = useState("3000");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const game = await api<Game>("/games", {
        method: "POST",
        body: JSON.stringify({
          hideTimeMinutes: parseInt(hideTime, 10),
          geofenceRadiusM: parseInt(geofenceRadius, 10),
          gameRadiusM: parseInt(gameRadius, 10),
        }),
      });
      router.replace({
        pathname: "/(auth)/join",
        params: { code: game.code, isCreator: "1" },
      });
    } catch (err) {
      Alert.alert("Błąd", err instanceof Error ? err.message : "Nie udało się stworzyć gry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Nowa gra</Text>

      <Text style={styles.label}>Czas na chowanie (minuty)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={hideTime}
        onChangeText={setHideTime}
        placeholder="5–120"
      />

      <Text style={styles.label}>Promień geofence (m)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={geofenceRadius}
        onChangeText={setGeofenceRadius}
        placeholder="50–1000"
      />

      <Text style={styles.label}>Promień gry (m)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={gameRadius}
        onChangeText={setGameRadius}
        placeholder="500–10000"
      />

      <Pressable style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Stwórz grę</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#fff",
  },
  heading: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
