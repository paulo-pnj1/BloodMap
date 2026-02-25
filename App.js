import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NotificationService } from './src/services/notifications';
import NotificationHandler from './src/services/NotificationHandler';

export default function App() {
  useEffect(() => {
    // Configurar categorias de notificação ao iniciar o app
    const setupNotifications = async () => {
      try {
        await NotificationService.setupNotificationCategories();
        console.log('✅ Configuração de notificações concluída');
      } catch (error) {
        console.error('❌ Erro na configuração de notificações:', error);
      }
    };

    setupNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {/* Handler para processar notificações e ações */}
      <NotificationHandler />
    </SafeAreaProvider>
  );
}