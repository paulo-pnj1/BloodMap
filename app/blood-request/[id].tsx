import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, Dimensions } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface PedidoData {
  codigo: string;
  tipoSanguineo: string;
  mensagem: string;
  solicitante: string;
  hospital: string;
  telefone: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

const { width } = Dimensions.get('window');

export default function BloodRequestDetails() {
  const { id, action, phoneNumber } = useLocalSearchParams();
  const [pedido, setPedido] = useState<PedidoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acaoExecutada, setAcaoExecutada] = useState(false);

  useEffect(() => {
    carregarPedido();
  }, [id]);

  useEffect(() => {
    if (action && phoneNumber && pedido && !acaoExecutada) {
      console.log(`🚀 Executando ação automática: ${action} para ${phoneNumber}`);
      executarAcaoAutomatica(action as string, phoneNumber as string);
      setAcaoExecutada(true);
    }
  }, [action, phoneNumber, pedido, acaoExecutada]);

  const executarAcaoAutomatica = (acao: string, numero: string) => {
    setTimeout(() => {
      switch (acao) {
        case 'call':
          console.log('📞 Executando ligação automática');
          fazerLigacao(numero);
          break;
        case 'sms':
          console.log('💬 Executando SMS automático');
          enviarSMS(numero);
          break;
        case 'whatsapp':
          console.log('📱 Executando WhatsApp automático');
          enviarWhatsApp(numero);
          break;
        default:
          console.log('⚡ Ação automática não reconhecida:', acao);
      }
    }, 800);
  };

  const carregarPedido = async () => {
    try {
      if (!id) {
        Alert.alert('Erro', 'ID do pedido não fornecido');
        router.back();
        return;
      }

      console.log('🔍 Buscando pedido com código:', id);

      const pedidosQuery = query(
        collection(db, 'pedidos'),
        where('codigo', '==', id)
      );
      const snapshot = await getDocs(pedidosQuery);
      
      if (!snapshot.empty) {
        const pedidoDoc = snapshot.docs[0];
        const pedidoData = pedidoDoc.data() as PedidoData;
        console.log('✅ Pedido encontrado:', pedidoData.codigo);
        setPedido(pedidoData);
      } else {
        console.log('❌ Pedido não encontrado no Firestore');
        Alert.alert('Erro', 'Pedido não encontrado');
        router.back();
      }
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do pedido');
    } finally {
      setLoading(false);
    }
  };

  const formatarTelefoneParaLink = (telefone: string) => {
    if (!telefone) return null;
    return telefone.replace(/[^\d+]/g, '');
  };

  const fazerLigacao = (telefone: string) => {
    const numeroFormatado = formatarTelefoneParaLink(telefone);
    if (numeroFormatado) {
      console.log('📞 Abrindo discador para:', numeroFormatado);
      Linking.openURL(`tel:${numeroFormatado}`).catch(err => {
        console.error('❌ Erro ao abrir discador:', err);
        Alert.alert('Erro', 'Não foi possível fazer a ligação. Verifique se o seu dispositivo suporta esta funcionalidade.');
      });
    } else {
      Alert.alert('Erro', 'Número de telefone inválido');
    }
  };

  const enviarSMS = (telefone: string) => {
    const numeroFormatado = formatarTelefoneParaLink(telefone);
    if (numeroFormatado) {
      const message = `Olá, vi seu pedido urgente de sangue no app e gostaria de ajudar!`;
      console.log('💬 Abrindo SMS para:', numeroFormatado);
      Linking.openURL(`sms:${numeroFormatado}?body=${encodeURIComponent(message)}`).catch(err => {
        console.error('❌ Erro ao abrir SMS:', err);
        Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mensagens.');
      });
    } else {
      Alert.alert('Erro', 'Número de telefone inválido');
    }
  };

  const enviarWhatsApp = (telefone: string) => {
    const numeroFormatado = formatarTelefoneParaLink(telefone);
    if (numeroFormatado) {
      const whatsappNumber = numeroFormatado.replace(/^\+/, '');
      const message = `Olá, vi seu pedido urgente de sangue no app e gostaria de ajudar!`;
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      
      console.log('📱 Abrindo WhatsApp para:', whatsappNumber);
      Linking.openURL(whatsappUrl).catch(err => {
        console.error('❌ Erro ao abrir WhatsApp:', err);
        Alert.alert('Erro', 'Não foi possível abrir o WhatsApp. Verifique se o aplicativo está instalado.');
      });
    } else {
      Alert.alert('Erro', 'Número de telefone inválido');
    }
  };

  const handleAcaoContato = (tipo: string) => {
    if (!pedido?.telefone) {
      Alert.alert('Erro', 'Número de telefone não disponível');
      return;
    }

    switch (tipo) {
      case 'call':
        fazerLigacao(pedido.telefone);
        break;
      case 'sms':
        enviarSMS(pedido.telefone);
        break;
      case 'whatsapp':
        enviarWhatsApp(pedido.telefone);
        break;
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#FF6B35', text: 'Pendente', icon: 'clock-o' as const };
      case 'accepted':
        return { color: '#4CAF50', text: 'Aceito', icon: 'check-circle' as const };
      case 'completed':
        return { color: '#2196F3', text: 'Concluído', icon: 'flag-checkered' as const };
      default:
        return { color: '#666', text: 'Desconhecido', icon: 'question-circle' as const };
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={['#FF4444', '#CC0000']} style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <View style={styles.spinnerContainer}>
            <FontAwesome name="tint" size={48} color="#FFF" />
            <View style={styles.spinnerOverlay}>
              <FontAwesome name="spinner" size={24} color="#FFF" />
            </View>
          </View>
          <Text style={styles.loadingText}>Carregando detalhes do pedido...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!pedido) {
    return (
      <LinearGradient colors={['#FF4444', '#CC0000']} style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <FontAwesome name="exclamation-triangle" size={64} color="#FFF" />
          <Text style={styles.errorTitle}>Pedido não encontrado</Text>
          <Text style={styles.errorSubtitle}>O pedido solicitado não foi encontrado em nosso sistema.</Text>
          <Button 
            mode="contained" 
            onPress={() => router.back()} 
            style={styles.backButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Voltar para o Mapa
          </Button>
        </View>
      </LinearGradient>
    );
  }

  const statusInfo = getStatusInfo(pedido.status);

  return (
    <LinearGradient colors={['#FF4444', '#CC0000']} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient 
            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']} 
            style={styles.iconContainer}
          >
            <FontAwesome name="tint" size={42} color="#FFF" />
          </LinearGradient>
          <Text style={styles.title}>Detalhes do Pedido</Text>
          <Text style={styles.subtitle}>Código: {pedido.codigo}</Text>
          
          {action && (
            <View style={styles.actionBadge}>
              <FontAwesome 
                name={
                  action === 'call' ? 'phone' as const : 
                  action === 'sms' ? 'comment' as const : 
                  'whatsapp' as const
                } 
                size={14} 
                color="#FFF" 
              />
              <Text style={styles.actionBadgeText}>
                {action === 'call' ? 'Ligação' : action === 'sms' ? 'SMS' : 'WhatsApp'}
              </Text>
            </View>
          )}
        </View>

        {/* Main Card */}
        <Card style={styles.detailsCard}>
          <Card.Content style={styles.cardContent}>
            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
              <FontAwesome name={statusInfo.icon} size={16} color="#FFF" />
              <Text style={styles.statusBadgeText}>{statusInfo.text}</Text>
            </View>

            {/* Blood Type Highlight */}
            <View style={styles.bloodTypeContainer}>
              <Text style={styles.bloodTypeLabel}>Tipo Sanguíneo Necessário</Text>
              <Text style={styles.bloodTypeValue}>{pedido.tipoSanguineo}</Text>
            </View>

            {/* Details Grid */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <FontAwesome name="user" size={18} color="#FF4444" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Solicitante</Text>
                  <Text style={styles.detailValue}>{pedido.solicitante}</Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <FontAwesome name="medkit" size={18} color="#FF4444" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Hospital</Text>
                  <Text style={styles.detailValue}>{pedido.hospital}</Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <FontAwesome name="phone" size={18} color="#FF4444" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Telefone</Text>
                  <Text style={styles.detailValue}>{pedido.telefone}</Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <FontAwesome name="calendar" size={18} color="#FF4444" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Data do Pedido</Text>
                  <Text style={styles.detailValue}>
                    {new Date(pedido.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>
            </View>

            {/* Urgent Message */}
            <View style={styles.messageSection}>
              <View style={styles.messageHeader}>
                <FontAwesome name="exclamation-circle" size={20} color="#FF4444" />
                <Text style={styles.messageLabel}>Mensagem de Urgência</Text>
              </View>
              <Text style={styles.messageText}>"{pedido.mensagem}"</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Entre em contato agora</Text>
          <View style={styles.actionsGrid}>
            <Button
              mode="contained"
              icon={({ size, color }) => <FontAwesome name="phone" size={size} color={color} />}
              onPress={() => handleAcaoContato('call')}
              style={[styles.actionButton, styles.callButton]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Ligar
            </Button>
            
            <Button
              mode="contained"
              icon={({ size, color }) => <FontAwesome name="comment" size={size} color={color} />}
              onPress={() => handleAcaoContato('sms')}
              style={[styles.actionButton, styles.smsButton]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              SMS
            </Button>
            
            <Button
              mode="contained"
              icon={({ size, color }) => <FontAwesome name="whatsapp" size={size} color={color} />}
              onPress={() => handleAcaoContato('whatsapp')}
              style={[styles.actionButton, styles.whatsappButton]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              WhatsApp
            </Button>
          </View>
        </View>

        {/* Back Button */}
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.backButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.backButtonLabel}
          icon={({ size, color }) => <FontAwesome name="arrow-left" size={size} color={color} />}
        >
          Voltar para o Mapa
        </Button>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  spinnerContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  spinnerOverlay: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    padding: 4,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    alignItems: 'center',
    padding: 30,
  },
  errorTitle: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 12,
  },
  actionBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsCard: {
    borderRadius: 20,
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  cardContent: {
    padding: 0,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bloodTypeContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bloodTypeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  bloodTypeValue: {
    fontSize: 42,
    color: '#FF4444',
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 68, 68, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  detailsGrid: {
    padding: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    lineHeight: 20,
  },
  messageSection: {
    padding: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.05)',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  messageLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  messageText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    fontStyle: 'italic',
    textAlign: 'left',
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  smsButton: {
    backgroundColor: '#2196F3',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  backButton: {
    borderColor: 'rgba(255,255,255,0.5)',
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backButtonLabel: {
    color: '#FFF',
    fontWeight: '600',
  },
});