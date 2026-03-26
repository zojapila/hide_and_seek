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
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";
import type { Player, PlayerRole } from "@hideseek/shared";

export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string; isCreator?: string }>();
  const [code, setCode] = useState(params.code ?? "");
  const [name, setName] = useState("");
  const [role, setRole] = useState<PlayerRole>("seeker");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Błąd", "Wpisz swoje imię");
      return;
    }
    if (!code.trim()) {
      Alert.alert("Błąd", "Wpisz kod gry");
      return;
    }

    setLoading(true);
    try {
      const player = await api<Player>(`/games/${code.toUpperCase()}/join`, {
        method: "POST",
        body: JSON.stringify({ name: trimmedName, role }),
      });
      router.replace({
        pathname: "/(auth)/lobby",
        params: {
          code: code.toUpperCase(),
          playerId: player.id,
          playerName: player.name,
          isCreator: params.isCreator ?? "0",
        },
      });
    } catch (err) {
      Alert.alert("Błąd", err instanceof Error ? err.message : "Nie udało się dołączyć");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Dołącz do gry</Text>

      <Text style={styles.label}>Kod gry</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="np. ABC123"
        autoCapitalize="characters"
        maxLength={6}
      />

      <Text style={styles.label}>Twoje imię</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Jak masz na imię?"
        maxLength={50}
      />

      <Text style={styles.label}>Rola</Text>
      <View style={styles.roleRow}>
        <Pressable
          style={[styles.roleButton, role === "seeker" && styles.roleActive]}
          onPress={() => setRole("seeker")}
        >
          <Text style={[styles.roleText, role === "seeker" && styles.roleTextActive]}>
            🔍 Szukający
          </Text>
        </Pressable>
        <Pressable
          style={[styles.roleButton, role === "hider" && styles.roleActive]}
          onPress={() => setRole("hider")}
        >
          <Text style={[styles.roleText, role === "hider" && styles.roleTextActive]}>
            🙈 Chowający
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.button} onPress={handleJoin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Dołącz</Text>
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
  roleRow: {
    flexDirection: "row",
    gap: 12,
  },
  roleButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  roleActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  roleText: {
    fontSize: 16,
    color: "#6b7280",
  },
  roleTextActive: {
    color: "#2563eb",
    fontWeight: "600",
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
