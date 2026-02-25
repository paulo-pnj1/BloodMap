import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';

export default function NotificationHandler() {
  const router = useRouter();
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Configurar canais de notificação para Android
    const setupAndroidChannels = async () => {
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
    };

    setupAndroidChannels();

    // Listener para notificações recebidas em foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notificação recebida em foreground:', notification);
    });

    // Listener para quando o usuário toca na notificação ou ações
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { actionIdentifier, notification } = response;
      const data = notification.request?.content?.data;
      
      console.log('👆 Ação selecionada:', actionIdentifier);
      console.log('📋 Dados da notificação:', data);

      // Lidar com ações de contato
      handleNotificationAction(actionIdentifier, data);
    });

    // Cleanup function corrigida
    return () => {
      try {
        // Usar remove() em vez de removeNotificationSubscription
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      } catch (error) {
        console.log('Erro ao remover listeners:', error);
      }
    };
  }, []);

  const handleNotificationAction = async (actionIdentifier, data) => {
    const phoneNumber = data.telefone;
    
    if (!phoneNumber) {
      console.error('❌ Número de telefone não encontrado na notificação');
      return;
    }

    const formattedNumber = formatarTelefoneParaLink(phoneNumber);

    switch (actionIdentifier) {
      case 'call':
        // Fazer ligação - navegar para tela de detalhes com ação de ligação
        console.log('📞 Iniciando ligação para:', formattedNumber);
        if (data.pedidoId) {
          router.push({
            pathname: '/blood-request/[id]',
            params: { 
              id: data.pedidoId,
              action: 'call',
              phoneNumber: formattedNumber
            }
          });
        }
        break;

      case 'sms':
        // Abrir SMS - navegar para tela de detalhes com ação de SMS
        console.log('💬 Abrindo SMS para:', formattedNumber);
        if (data.pedidoId) {
          router.push({
            pathname: '/blood-request/[id]',
            params: { 
              id: data.pedidoId,
              action: 'sms',
              phoneNumber: formattedNumber
            }
          });
        }
        break;

      case 'whatsapp':
        // Abrir WhatsApp - navegar para tela de detalhes com ação de WhatsApp
        console.log('WhatsApp para:', formattedNumber);
        if (data.pedidoId) {
          router.push({
            pathname: '/blood-request/[id]',
            params: { 
              id: data.pedidoId,
              action: 'whatsapp',
              phoneNumber: formattedNumber
            }
          });
        }
        break;

      case 'view':
      case 'expo.modules.notifications.actions.DEFAULT':
        // Ver detalhes - navegar para a tela de detalhes
        if (data.pedidoId) {
          console.log('📱 Navegando para detalhes do pedido:', data.pedidoId);
          router.push(`/blood-request/${data.pedidoId}`);
        }
        break;

      default:
        // Clicou na notificação em si (não em uma ação)
        console.log('📱 Notificação tocada, navegando...');
        if (data.pedidoId) {
          router.push(`/blood-request/${data.pedidoId}`);
        } else {
          // Navegação padrão
          handleNotificationTap(data);
        }
        break;
    }
  };

  const formatarTelefoneParaLink = (telefone) => {
    if (!telefone) return null;
    return telefone.replace(/[^\d+]/g, '');
  };

  const handleNotificationTap = (data) => {
    // Navegar para a tela apropriada baseada no tipo de notificação
    switch (data.type) {
      case 'blood_request':
        if (data.pedidoId) {
          router.push({
            pathname: '/blood-request/[id]',
            params: { 
              id: data.pedidoId,
              bloodType: data.bloodType 
            }
          });
        }
        break;
      
      case 'request_accepted':
        if (data.pedidoId) {
          router.push({
            pathname: '/blood-request/[id]',
            params: { id: data.pedidoId }
          });
        }
        break;
      
      case 'donation_reminder':
        router.push('/perfil');
        break;
      
      case 'new_donor_nearby':
        router.push('/mapa-doadores');
        break;
      
      default:
        if (data.screen === 'pedidos-urgentes') {
          router.push('/pedidos-urgentes');
        } else if (data.screen === 'perfil') {
          router.push('/perfil');
        } else {
          // Navegação padrão para pedidos urgentes
          router.push('/pedidos-urgentes');
        }
        break;
    }
  };

  return null;
}