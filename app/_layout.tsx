import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Removed pitch route - the app uses internal state navigation instead */}
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}