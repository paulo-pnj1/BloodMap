import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getAuth } from 'firebase/auth';

// Configurar o handler de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  static async registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log('Notificações push devem ser testadas em dispositivo físico');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permissão para notificações não concedida');
      return null;
    }

    try {
      // projectId necessário para builds standalone (APK) - Expo usa para gerar token válido
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      const pushToken = tokenData.data;
      
      console.log('🔔 Push Token Gerado:', pushToken);
      return pushToken;
    } catch (error) {
      console.error('Erro ao obter token de notificação:', error);
      return null;
    }
  }

  static async savePushToken(userId, pushToken) {
    if (!userId || !pushToken) return false;

    try {
      await setDoc(doc(db, 'usuarios', userId), {
        pushToken,
        pushTokenUpdatedAt: new Date().toISOString()
      }, { merge: true });
      
      console.log('✅ Token salvo para usuário:', userId);
      return true;
    } catch (error) {
      console.error('Erro ao salvar token:', error);
      return false;
    }
  }

  static async sendPushNotification(to, title, body, data = {}) {
    if (!to) {
      console.log('Token de destino não fornecido');
      return false;
    }

    try {
      const message = {
        to,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        // Configurações para Android
        ...(Platform.OS === 'android' && {
          android: {
            channelId: 'urgent-blood-requests',
            priority: 'high',
          }
        }),
        // Configurações para iOS
        ...(Platform.OS === 'ios' && {
          ios: {
            sound: true,
            _category: 'BLOOD_REQUEST',
          }
        })
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      // API Expo retorna { data: [{ status: 'ok', id: '...' }] } para mensagem única
      const ok = Array.isArray(result.data) ? result.data[0]?.status === 'ok' : result.data?.status === 'ok';
      if (ok) {
        console.log('✅ Notificação enviada com sucesso');
        return true;
      } else {
        console.log('❌ Erro ao enviar notificação:', result);
        return false;
      }
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      return false;
    }
  }

  static async sendBulkNotifications(tokens, title, body, data = {}, categoryIdentifier = 'BLOOD_REQUEST') {
    if (!tokens || tokens.length === 0) {
      console.log('Nenhum token fornecido para notificação em massa');
      return { success: 0, failed: 0 };
    }

    const validTokens = tokens.filter(token => token && token.startsWith('ExponentPushToken'));
    
    if (validTokens.length === 0) {
      console.log('Nenhum token válido encontrado');
      return { success: 0, failed: 0 };
    }

    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: {
        ...data,
        // Garantir que as ações estejam disponíveis
        hasCallAction: true,
        hasSMSAction: true,
        hasWhatsAppAction: true
      },
      priority: 'high',
      // Configurações para Android
      android: {
        channelId: 'urgent-blood-requests',
        priority: 'high',
      },
      // Configurações para iOS
      ios: {
        sound: true,
        _category: categoryIdentifier,
      },
      // Category para ações (funciona em ambas as plataformas)
      categoryId: categoryIdentifier
    }));

    // Dividir em lotes de 100 (limitação do Expo)
    const batches = [];
    for (let i = 0; i < messages.length; i += 100) {
      batches.push(messages.slice(i, i + 100));
    }

    let successCount = 0;
    let failedCount = 0;

    for (const batch of batches) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });

        const results = await response.json();
        
        if (results.data && Array.isArray(results.data)) {
          results.data.forEach(result => {
            if (result.status === 'ok') {
              successCount++;
            } else {
              failedCount++;
              console.log('Falha no envio:', result);
            }
          });
        } else {
          console.log('Resposta inesperada:', results);
          failedCount += batch.length;
        }

      } catch (error) {
        console.error('Erro ao enviar lote de notificações:', error);
        failedCount += batch.length;
      }
    }

    console.log(`📊 Resultado: ${successCount} enviadas, ${failedCount} falhas`);
    return { success: successCount, failed: failedCount };
  }

  // Configurar categorias para ações (iOS)
  static async setupNotificationCategories() {
    try {
      await Notifications.setNotificationCategoryAsync('BLOOD_REQUEST', [
        {
          identifier: 'call',
          buttonTitle: '📞 Ligar',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'sms',
          buttonTitle: '💬 SMS',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'whatsapp',
          buttonTitle: 'WhatsApp',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'view',
          buttonTitle: 'Ver Detalhes',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
      console.log('✅ Categorias de notificação configuradas');
    } catch (error) {
      console.error('❌ Erro ao configurar categorias:', error);
    }
  }
}