import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme, View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import NotificationHandler from '../src/components/NotificationHandler';
import { AuthProvider } from '../src/contexts/AuthContext';
import { NotificationService } from '../src/services/notifications';

// Configurar o handler de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Função utilitária para usar em outros componentes
export const showLocalNotification = async (title, body, data = {}) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      sound: 'default',
      priority: 'high',
      vibrate: [0, 250, 250, 250],
    },
    trigger: null,
  });
};

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  
  const notificationListener = useRef();
  const responseListener = useRef();

  const theme = {
    colorScheme,
    colors: {
      primary: '#FF4444',
      accent: '#4CAF50',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      text: '#333333',
      error: '#B00020',
    },
  };

  useEffect(() => {
    // Configurar canal de notificação para Android
    const setupNotifications = async () => {
      // Configurar categorias de notificação com ações
      await NotificationService.setupNotificationCategories();

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('urgent-blood-requests', {
          name: 'Pedidos Urgentes de Sangue',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
        });

        await Notifications.setNotificationChannelAsync('blood-donation', {
          name: 'Doação de Sangue',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF4444',
          sound: 'default',
        });
      }

      // Solicitar permissões de notificação
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('Permissão para notificações não concedida');
          return;
        }
        
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log('🔔 Push Token:', token);
      } else {
        console.log('Notificações push só funcionam em dispositivos físicos');
      }
    };

    setupNotifications();

    // Cleanup function corrigida
    return () => {
      // Remover listeners de forma segura
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <View style={styles.container}>
          {/* Componente para lidar com notificações */}
          <NotificationHandler />
          
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: {
                backgroundColor: '#FFFFFF',
              },
            }}
          >
            <Stack.Screen 
              name="index" 
              options={{
                title: 'Mapa de Doadores',
                animation: 'fade',
              }}
            />
            <Stack.Screen 
              name="login" 
              options={{
                title: 'Login',
                presentation: 'modal',
              }}
            />
            <Stack.Screen 
              name="cadastro-doador" 
              options={{
                title: 'Cadastro de Doador',
                presentation: 'modal',
              }}
            />
            <Stack.Screen 
              name="pedidos-urgentes" 
              options={{
                title: 'Pedidos Urgentes',
                presentation: 'modal',
              }}
            />
            <Stack.Screen 
              name="perfil" 
              options={{
                title: 'Meu Perfil',
                presentation: 'card',
              }}
            />
            <Stack.Screen 
              name="consulta-pedido" 
              options={{
                title: 'Consultar Pedido',
                presentation: 'card',
              }}
            />
            <Stack.Screen 
              name="mapa-doadores" 
              options={{
                title: 'Mapa de Doadores',
                presentation: 'card',
              }}
            />
            <Stack.Screen 
              name="blood-request/[id]" 
              options={{
                title: 'Detalhes do Pedido',
                presentation: 'card',
              }}
            />
          </Stack>
        </View>
      </SafeAreaProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});