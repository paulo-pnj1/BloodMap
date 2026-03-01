import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#FFF',
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Admin - Login', headerBackVisible: false }} />
      <Stack.Screen name="index" options={{ title: 'Painel Hospital' }} />
      <Stack.Screen name="doadores" options={{ title: 'Doadores' }} />
      <Stack.Screen name="pedidos" options={{ title: 'Pedidos' }} />
      <Stack.Screen name="criar-pedido" options={{ title: 'Novo Pedido Urgente' }} />
      <Stack.Screen name="campanhas" options={{ title: 'Campanhas' }} />
    </Stack>
  );
}
