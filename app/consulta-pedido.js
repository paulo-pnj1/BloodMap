import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Alert, 
  Animated, 
  ScrollView,
  Text,
  Pressable
} from 'react-native';
import { Card, Button, TextInput, Title, Paragraph } from 'react-native-paper';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import { db } from '../src/services/firebase';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const colors = {
  primary: '#2196F3',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  background: '#E3F2FD',
  surface: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
};

// Altura segura para evitar interferência com a barra de navegação
const SAFE_BOTTOM_SPACE = 80; // Espaço extra para a barra de navegação

export default function TelaConsultaPedido() {
  const { telefoneConsulta } = useLocalSearchParams();
  const [telefone, setTelefone] = useState(telefoneConsulta || '');
  const [pedidos, setPedidos] = useState([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 500, 
      useNativeDriver: true 
    }).start();

    if (telefoneConsulta) {
      consultarPedidos();
    }
  }, []);

  // DEBUG: Função para ver todos os pedidos no banco
  const debugVerTodosPedidos = async () => {
    try {
      console.log('🔍 DEBUG: Buscando TODOS os pedidos...');
      const querySnapshot = await getDocs(collection(db, 'pedidos'));
      const todosPedidos = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        todosPedidos.push({
          id: doc.id,
          telefone: data.telefone,
          codigo: data.codigo,
          tipoSanguineo: data.tipoSanguineo,
          hospital: data.hospital
        });
      });

      console.log('📋 TODOS os pedidos no banco:', todosPedidos);
      Alert.alert(
        'DEBUG - Todos os Pedidos', 
        `Encontrados ${todosPedidos.length} pedidos:\n\n${todosPedidos.slice(0, 10).map(p => 
          `Tel: ${p.telefone} - Cód: ${p.codigo} - ${p.tipoSanguineo} - ${p.hospital}`
        ).join('\n')}${todosPedidos.length > 10 ? '\n\n... e mais ' + (todosPedidos.length - 10) + ' pedidos' : ''}`
      );
    } catch (error) {
      console.error('Erro no debug:', error);
    }
  };

  const formatarTelefoneParaConsulta = (telefone) => {
    if (!telefone) return '';
    
    // Remove tudo que não é número
    const apenasNumeros = telefone.replace(/\D/g, '');
    
    console.log('📞 Telefone original:', telefone);
    console.log('🔢 Apenas números:', apenasNumeros);
    
    // Verifica diferentes formatos que podem estar no banco
    const formatos = [];
    
    // Formato 1: +244XXXXXXXXX (com código internacional)
    if (apenasNumeros.startsWith('244')) {
      formatos.push(`+${apenasNumeros}`);
      // Também tenta sem o +
      formatos.push(apenasNumeros);
    }
    
    // Formato 2: 244XXXXXXXXX (sem +)
    if (apenasNumeros.startsWith('244') && apenasNumeros.length === 12) {
      formatos.push(apenasNumeros);
    }
    
    // Formato 3: 9XXXXXXXX (apenas número angolano)
    if (apenasNumeros.length === 9 && apenasNumeros.startsWith('9')) {
      formatos.push(`+244${apenasNumeros}`);
      formatos.push(`244${apenasNumeros}`);
      formatos.push(apenasNumeros);
    }
    
    // Formato 4: Qualquer número como está
    formatos.push(apenasNumeros);
    formatos.push(`+${apenasNumeros}`);
    
    // Remove duplicatas
    const formatosUnicos = [...new Set(formatos)];
    
    console.log('🎯 Formatos a serem testados:', formatosUnicos);
    return formatosUnicos;
  };

  const consultarPedidos = async () => {
    if (!telefone.trim()) {
      Alert.alert('Atenção', 'Digite o número de telefone usado no pedido.');
      return;
    }

    setConsultando(true);
    setPedidos([]);
    setPedidoSelecionado(null);

    try {
      const formatosTelefone = formatarTelefoneParaConsulta(telefone.trim());
      console.log('🔍 Iniciando consulta com formatos:', formatosTelefone);

      let todosPedidosEncontrados = [];

      // Tenta cada formato de telefone
      for (const formato of formatosTelefone) {
        try {
          console.log(`🔎 Tentando formato: ${formato}`);
          const q = query(
            collection(db, 'pedidos'), 
            where('telefone', '==', formato)
          );
          
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            console.log(`✅ Encontrados ${snapshot.size} pedidos com formato: ${formato}`);
            snapshot.forEach(doc => {
              const data = doc.data();
              todosPedidosEncontrados.push({
                ...data,
                id: doc.id,
                telefoneEncontrado: formato // Para debug
              });
            });
          } else {
            console.log(`❌ Nenhum pedido com formato: ${formato}`);
          }
        } catch (error) {
          console.error(`Erro ao consultar formato ${formato}:`, error);
        }
      }

      setConsultando(false);

      if (todosPedidosEncontrados.length === 0) {
        console.log('❌ Nenhum pedido encontrado com nenhum dos formatos');
        
        // Mostra opção de debug
        Alert.alert(
          'Nenhum Pedido Encontrado', 
          `Não encontramos pedidos com o telefone: ${telefone}\n\nVerifique:\n• Formato do número\n• Número usado no cadastro\n• Ou visualize todos os pedidos para debug`,
          [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'Ver Todos os Pedidos (Debug)', 
              onPress: debugVerTodosPedidos 
            }
          ]
        );
        return;
      }

      console.log(`🎉 Total de pedidos encontrados: ${todosPedidosEncontrados.length}`);
      
      // Remove duplicatas por ID
      const pedidosUnicos = todosPedidosEncontrados.filter((pedido, index, self) =>
        index === self.findIndex(p => p.id === pedido.id)
      );

      // Ordena por data (mais recente primeiro)
      const pedidosOrdenados = pedidosUnicos.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      setPedidos(pedidosOrdenados);
      setPedidoSelecionado(pedidosOrdenados[0]);

      console.log('📊 Pedidos ordenados:', pedidosOrdenados.map(p => ({
        id: p.id,
        telefone: p.telefone,
        codigo: p.codigo,
        formatoEncontrado: p.telefoneEncontrado
      })));

    } catch (error) {
      setConsultando(false);
      console.error('Erro geral na consulta:', error);
      Alert.alert('Erro', 'Não foi possível consultar os pedidos. Tente novamente.');
    }
  };

  // Consulta alternativa mais agressiva - busca TODOS e filtra localmente
  const consultarTodosEFiltrar = async () => {
    setConsultando(true);
    setPedidos([]);
    setPedidoSelecionado(null);

    try {
      console.log('🔍 Buscando TODOS os pedidos para filtragem local...');
      const snapshot = await getDocs(collection(db, 'pedidos'));
      const todosPedidos = [];
      
      snapshot.forEach((doc) => {
        todosPedidos.push({
          ...doc.data(),
          id: doc.id
        });
      });

      console.log(`📋 Total de pedidos no banco: ${todosPedidos.length}`);
      
      // Formata o telefone de busca
      const telefoneBusca = telefone.replace(/\D/g, '');
      console.log('🔢 Telefone para busca (apenas números):', telefoneBusca);

      // Filtra localmente - várias estratégias
      const pedidosFiltrados = todosPedidos.filter(pedido => {
        if (!pedido.telefone) return false;
        
        const telPedido = pedido.telefone.replace(/\D/g, '');
        console.log(`📞 Comparando: ${telPedido} com ${telefoneBusca}`);
        
        // Estratégias de matching
        return (
          // Match exato
          telPedido === telefoneBusca ||
          // Match sem código do país
          (telefoneBusca.length === 9 && telPedido.endsWith(telefoneBusca)) ||
          // Match parcial
          telPedido.includes(telefoneBusca) ||
          telefoneBusca.includes(telPedido)
        );
      });

      setConsultando(false);

      if (pedidosFiltrados.length === 0) {
        Alert.alert(
          'Nenhum Pedido Encontrado', 
          `Busca local não encontrou pedidos.\n\nTelefone buscado: ${telefoneBusca}\nTotal no banco: ${todosPedidos.length}`,
          [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'Ver Dados do Banco', 
              onPress: () => {
                console.log('📊 Dados completos do banco:', todosPedidos.map(p => ({
                  telefone: p.telefone,
                  codigo: p.codigo,
                  tipoSanguineo: p.tipoSanguineo
                })));
                Alert.alert(
                  'Dados do Banco', 
                  `Total: ${todosPedidos.length}\nExemplos:\n${todosPedidos.slice(0, 5).map(p => 
                    `Tel: ${p.telefone} - Cód: ${p.codigo}`
                  ).join('\n')}`
                );
              }
            }
          ]
        );
        return;
      }

      console.log(`✅ Encontrados ${pedidosFiltrados.length} pedidos na busca local`);
      setPedidos(pedidosFiltrados);
      setPedidoSelecionado(pedidosFiltrados[0]);

    } catch (error) {
      setConsultando(false);
      console.error('Erro na busca local:', error);
      Alert.alert('Erro', 'Falha na busca local.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'accepted': return colors.success;
      case 'completed': return colors.primary;
      case 'expired': return colors.textSecondary;
      case 'cancelled': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '🟡 Pendente';
      case 'accepted': return '🟢 Aceito';
      case 'completed': return '🔵 Concluído';
      case 'expired': return '⚫ Expirado';
      case 'cancelled': return '🔴 Cancelado';
      default: return '⚪ Desconhecido';
    }
  };

  const formatarData = (dataString) => {
    try {
      const data = new Date(dataString);
      return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Data inválida';
    }
  };

  const limparConsulta = () => {
    setTelefone('');
    setPedidos([]);
    setPedidoSelecionado(null);
  };

  return (
    <LinearGradient colors={[colors.background, colors.surface]} style={styles.container}>
      
      {/* Header Fixo com Seta de Voltar */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerContent}>
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </Pressable>
          
          <View style={styles.headerTitleContainer}>
            <FontAwesome name="search" size={24} color="#FFF" />
            <Text style={styles.headerTitle}>Consultar Pedido</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          
          {/* Header Principal (conteúdo) */}
          <View style={styles.mainHeader}>
            <View style={styles.iconContainer}>
              <FontAwesome name="search" size={32} color={colors.primary} />
            </View>
            <Title style={styles.title}>Consultar Pedido</Title>
            <Paragraph style={styles.subtitle}>
              Digite o número de telefone usado no pedido
            </Paragraph>
          </View>

          <Card style={styles.formCard}>
            <LinearGradient colors={[colors.surface, '#F8F9FA']} style={styles.formGradient}>
              <TextInput
                label="Número de Telefone *"
                value={telefone}
                onChangeText={setTelefone}
                mode="outlined"
                style={styles.input}
                outlineColor={colors.primary}
                activeOutlineColor={colors.primary}
                placeholder="Ex: 923456789 ou +244923456789"
                keyboardType="phone-pad"
                left={<TextInput.Icon icon="phone" />}
              />
              
              <View style={styles.buttonContainer}>
                <Button
                  icon="magnify"
                  mode="contained"
                  onPress={consultarPedidos}
                  loading={consultando}
                  disabled={consultando}
                  style={styles.consultButton}
                  contentStyle={styles.buttonContent}
                >
                  {consultando ? 'Consultando...' : 'Consultar Normal'}
                </Button>

                {telefone && (
                  <Button
                    icon="close"
                    mode="outlined"
                    onPress={limparConsulta}
                    style={styles.clearButton}
                    contentStyle={styles.buttonContent}
                  >
                    Limpar
                  </Button>
                )}
              </View>

              <Button
                mode="outlined"
                onPress={consultarTodosEFiltrar}
                style={styles.alternativeButton}
                contentStyle={styles.buttonContent}
                icon="database-search"
              >
                Busca Avançada
              </Button>

              <Button
                mode="text"
                onPress={debugVerTodosPedidos}
                style={styles.debugButton}
                textColor={colors.textSecondary}
                icon="bug"
              >
                Debug: Ver Todos Pedidos
              </Button>
            </LinearGradient>
          </Card>

          {pedidos.length > 0 && (
            <Card style={styles.pedidosListCard}>
              <LinearGradient colors={[colors.primary, '#1976D2']} style={styles.pedidosListHeader}>
                <Title style={styles.pedidosListTitle}>
                  ✅ Encontrados: {pedidos.length} pedido(s)
                </Title>
              </LinearGradient>
              
              <View style={styles.pedidosList}>
                {pedidos.map((pedido) => (
                  <Pressable
                    key={pedido.id}
                    style={[
                      styles.pedidoItem,
                      pedidoSelecionado?.id === pedido.id && styles.pedidoItemSelecionado
                    ]}
                    onPress={() => setPedidoSelecionado(pedido)}
                  >
                    <View style={styles.pedidoItemHeader}>
                      <Text style={styles.pedidoCodigo}>
                        #{pedido.codigo || pedido.id.substring(0, 8)}
                      </Text>
                      <View style={[
                        styles.statusBadgeSmall,
                        { backgroundColor: getStatusColor(pedido.status) }
                      ]}>
                        <Text style={styles.statusTextSmall}>
                          {pedido.status || 'pending'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.pedidoInfo}>
                      {pedido.tipoSanguineo} • {pedido.hospital}
                    </Text>
                    <Text style={styles.pedidoData}>
                      {formatarData(pedido.createdAt)}
                    </Text>
                    <Text style={styles.pedidoTelefone}>
                      📞 {pedido.telefone}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          )}

          {pedidoSelecionado && (
            <Card style={styles.resultCard}>
              <LinearGradient colors={[colors.primary, '#1976D2']} style={styles.resultHeader}>
                <View style={styles.resultTitleContainer}>
                  <FontAwesome name="file-text" size={20} color="#FFF" />
                  <Title style={styles.resultTitle}>
                    Pedido #{pedidoSelecionado.codigo}
                  </Title>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(pedidoSelecionado.status) }
                ]}>
                  <Text style={styles.statusText}>
                    {getStatusText(pedidoSelecionado.status)}
                  </Text>
                </View>
              </LinearGradient>

              <View style={styles.resultBody}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📞 Telefone do Pedido</Text>
                  <Text style={styles.telefoneDestaque}>{pedidoSelecionado.telefone}</Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>💉 Informações</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tipo Sanguíneo:</Text>
                    <Text style={styles.infoValue}>{pedidoSelecionado.tipoSanguineo}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Hospital:</Text>
                    <Text style={styles.infoValue}>{pedidoSelecionado.hospital}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Solicitante:</Text>
                    <Text style={styles.infoValue}>{pedidoSelecionado.solicitante}</Text>
                  </View>
                </View>

                {pedidoSelecionado.mensagem && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📝 Mensagem</Text>
                    <Text style={styles.mensagemText}>{pedidoSelecionado.mensagem}</Text>
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📅 Datas</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Criado em:</Text>
                    <Text style={styles.infoValue}>{formatarData(pedidoSelecionado.createdAt)}</Text>
                  </View>
                </View>
              </View>
            </Card>
          )}

          {/* Container de Navegação com Espaço Seguro */}
          <View style={styles.navigationContainer}>
            <Button
              icon="plus"
              mode="contained"
              onPress={() => router.push('/pedidos-urgentes')}
              style={styles.navButton}
              contentStyle={styles.navButtonContent}
            >
              Novo Pedido
            </Button>

            <Button
              icon="home"
              mode="outlined"
              onPress={() => router.push('/')}
              style={styles.navButton}
              contentStyle={styles.navButtonContent}
            >
              Voltar ao Mapa
            </Button>
          </View>

          {/* Espaço extra para evitar interferência com a barra de navegação */}
          <View style={styles.safeBottomSpace} />

        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  // Header Fixo
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#2196F3',
    paddingTop: 50, // Para iOS
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 10,
  },
  headerSpacer: {
    width: 40, // Para manter o balance com o botão voltar
  },
  scrollContent: { 
    flexGrow: 1, 
    paddingTop: 120, // Espaço para o header fixo
    paddingBottom: SAFE_BOTTOM_SPACE, // Espaço seguro para a barra de navegação
    minHeight: height - 120, // Garante que o conteúdo ocupe a tela toda
  },
  content: { 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  mainHeader: { 
    alignItems: 'center', 
    marginBottom: 24 
  },
  iconContainer: {
    width: 80, 
    height: 80, 
    borderRadius: 40,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#212121', 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#757575', 
    textAlign: 'center', 
    lineHeight: 22 
  },
  formCard: { 
    width: '100%', 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginBottom: 20 
  },
  formGradient: { 
    padding: 20 
  },
  input: { 
    backgroundColor: '#FFFFFF', 
    marginBottom: 16 
  },
  buttonContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12 
  },
  consultButton: { 
    flex: 2, 
    backgroundColor: '#2196F3', 
    borderRadius: 8, 
    marginRight: 8 
  },
  clearButton: { 
    flex: 1, 
    borderColor: '#757575', 
    borderRadius: 8 
  },
  alternativeButton: { 
    borderColor: '#2196F3', 
    borderRadius: 8, 
    marginBottom: 8 
  },
  debugButton: { 
    marginTop: 8 
  },
  buttonContent: { 
    paddingVertical: 6 
  },
  pedidosListCard: { 
    width: '100%', 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginBottom: 16 
  },
  pedidosListHeader: { 
    padding: 16 
  },
  pedidosListTitle: { 
    color: '#FFF', 
    fontSize: 16 
  },
  pedidosList: { 
    backgroundColor: '#FFFFFF' 
  },
  pedidoItem: { 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  pedidoItemSelecionado: { 
    backgroundColor: '#E3F2FD' 
  },
  pedidoItemHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  pedidoCodigo: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#212121' 
  },
  statusBadgeSmall: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  statusTextSmall: { 
    color: '#FFF', 
    fontSize: 10, 
    fontWeight: 'bold' 
  },
  pedidoInfo: { 
    fontSize: 14, 
    color: '#757575', 
    marginBottom: 4 
  },
  pedidoData: { 
    fontSize: 12, 
    color: '#757575', 
    marginBottom: 2 
  },
  pedidoTelefone: { 
    fontSize: 12, 
    color: '#2196F3', 
    fontWeight: 'bold' 
  },
  resultCard: { 
    width: '100%', 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginBottom: 20 
  },
  resultHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16 
  },
  resultTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  resultTitle: { 
    color: '#FFF', 
    marginLeft: 8, 
    fontSize: 18 
  },
  statusBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  statusText: { 
    color: '#FFF', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  resultBody: { 
    padding: 16, 
    backgroundColor: '#FFFFFF' 
  },
  section: { 
    marginBottom: 20, 
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#212121', 
    marginBottom: 12 
  },
  telefoneDestaque: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#2196F3', 
    textAlign: 'center' 
  },
  infoRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  infoLabel: { 
    fontSize: 14, 
    color: '#757575', 
    flex: 1 
  },
  infoValue: { 
    fontSize: 14, 
    color: '#212121', 
    fontWeight: '500', 
    flex: 1, 
    textAlign: 'right' 
  },
  mensagemText: { 
    fontSize: 14, 
    color: '#212121', 
    lineHeight: 20, 
    backgroundColor: '#F8F9FA', 
    padding: 12, 
    borderRadius: 8 
  },
  navigationContainer: { 
    width: '100%', 
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  navButton: { 
    borderRadius: 8,
  },
  navButtonContent: {
    paddingVertical: 8,
  },
  safeBottomSpace: {
    height: SAFE_BOTTOM_SPACE,
  },
});