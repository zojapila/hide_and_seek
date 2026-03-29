import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { loadSession, clearSession } from '../../lib/session';
import { api } from '../../lib/api';
import { useGameStore } from '../../stores/gameStore';
import { getSocket } from '../../lib/socket';
import type { Game, Player } from '@hideseek/shared';

export default function HomeScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const session = await loadSession();
        if (!session) { setChecking(false); return; }

        const data = await api<{ game: Game; player: Player }>(
          `/games/${session.gameCode}/rejoin`,
          { method: 'POST', body: JSON.stringify({ playerName: session.playerName }) },
        );

        const { game, player } = data;

        if (game.status === 'waiting') {
          // Go back to lobby
          router.replace({
            pathname: '/(auth)/lobby',
            params: {
              code: session.gameCode,
              playerId: player.id,
              playerName: player.name,
              playerRole: player.role,
              isCreator: '0',
            },
          });
          return;
        }

        // Game in progress — restore store and go to map
        const store = useGameStore.getState();
        store.setGameInfo({
          gameId: game.id,
          gameCode: session.gameCode,
          playerId: player.id,
          playerName: player.name,
          playerRole: player.role,
        });
        store.setPhase(game.status);

        const socket = getSocket();
        socket.connect();
        socket.emit('game:join', {
          gameCode: session.gameCode,
          playerName: session.playerName,
        });

        router.replace('/(game)/map');
      } catch {
        await clearSession();
        setChecking(false);
      }
    })();
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.subtitle}>Sprawdzanie sesji…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏙️ Hide & Seek</Text>
      <Text style={styles.subtitle}>Miejska zabawa w chowanego</Text>

      <View style={styles.buttons}>
        <Link href="/(auth)/create" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Stwórz grę</Text>
          </Pressable>
        </Link>

        <Link href="/(auth)/join" asChild>
          <Pressable style={[styles.button, styles.buttonSecondary]}>
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Dołącz do gry</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
  },
  buttons: {
    width: '100%',
    gap: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#2563eb',
  },
});
