import { Tabs } from 'expo-router';

export default function GameLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="map" options={{ title: 'Mapa', tabBarIcon: () => null }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: () => null }} />
    </Tabs>
  );
}
