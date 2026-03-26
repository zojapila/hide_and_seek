import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Hide & Seek' }} />
      <Stack.Screen name="join" options={{ title: 'Dołącz do gry' }} />
      <Stack.Screen name="create" options={{ title: 'Nowa gra' }} />
      <Stack.Screen name="lobby" options={{ title: 'Lobby' }} />
    </Stack>
  );
}
