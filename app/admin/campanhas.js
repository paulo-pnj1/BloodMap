import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Pressable
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { NotificationService } from '../../src/services/notifications';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AdminCampanhas() {
  const insets = useSafeAreaInsets();
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tokensCount, setTokensCount] = useState(0);
  const [buscandoTokens, setBuscandoTokens] = useState(false);

  // Form state (create/edit)
  const [modalVisivel, setModalVisivel] = useState(false);
  const [modalModo, setModalModo] = useState('create'); // 'create' | 'edit'
  const [campanhaEditando, setCampanhaEditando] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ativa, setAtiva] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    loadCampanhas();
  }, []);

  const loadCampanhas = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'campanhas'));
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setCampanhas(list);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar campanhas.');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const contarTokensNotificacao = async () => {
    setBuscandoTokens(true);
    try {
      const snap = await getDocs(collection(db, 'usuarios'));
      const tokens = snap.docs
        .map(d => d.data()?.pushToken)
        .filter(Boolean);
      setTokensCount(tokens.length);
    } catch (error) {
      console.error('Erro ao contar tokens:', error);
    } finally {
      setBuscandoTokens(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCampanhas();
  };

  const abrirModalCriar = () => {
    setModalModo('create');
    setCampanhaEditando(null);
    setTitulo('');
    setMensagem('');
    setAtiva(true);
    setModalVisivel(true);
    contarTokensNotificacao();
  };

  const abrirModalEditar = (campanha) => {
    setModalModo('edit');
    setCampanhaEditando(campanha);
    setTitulo(campanha.titulo || '');
    setMensagem(campanha.mensagem || '');
    setAtiva(campanha.ativa !== false);
    setModalVisivel(true);
  };

  const fecharModal = () => {
    setModalVisivel(false);
    setCampanhaEditando(null);
  };

  const validar = () => {
    if (!titulo.trim()) {
      Alert.alert('Atenção', 'Informe um título para a campanha.');
      return false;
    }
    if (titulo.trim().length < 3) {
      Alert.alert('Atenção', 'O título deve ter pelo menos 3 caracteres.');
      return false;
    }
    if (!mensagem.trim()) {
      Alert.alert('Atenção', 'Informe uma mensagem para a campanha.');
      return false;
    }
    if (mensagem.trim().length < 10) {
      Alert.alert('Atenção', 'A mensagem da campanha deve ter pelo menos 10 caracteres.');
      return false;
    }
    return true;
  };

  const handleCriarCampanha = async () => {
    if (!validar()) return;

    Alert.alert(
      'Confirmar envio',
      `Enviar campanha para ${tokensCount} doador${tokensCount !== 1 ? 'es' : ''}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          onPress: async () => {
            setSalvando(true);
            try {
              const now = new Date().toISOString();
              const tituloTrim = titulo.trim();
              const mensagemTrim = mensagem.trim();

              await addDoc(collection(db, 'campanhas'), {
                titulo: tituloTrim,
                mensagem: mensagemTrim,
                createdAt: now,
                updatedAt: now,
                ativa: true,
                enviadoPara: tokensCount,
              });

              const snap = await getDocs(collection(db, 'usuarios'));
              const tokens = snap.docs
                .map(d => d.data()?.pushToken)
                .filter(Boolean);

              if (tokens.length > 0) {
                await NotificationService.sendBulkNotifications(
                  tokens,
                  tituloTrim,
                  mensagemTrim,
                  { tipo: 'campanha' },
                  'CAMPAIGN'
                );
              }

              loadCampanhas();
              fecharModal();
              Alert.alert('Sucesso!', 'Campanha enviada com sucesso.');
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível criar a campanha.');
            } finally {
              setSalvando(false);
            }
          },
        },
      ]
    );
  };

  const handleAtualizarCampanha = async () => {
    if (!validar() || !campanhaEditando) return;

    setSalvando(true);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'campanhas', campanhaEditando.id), {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        ativa,
        updatedAt: now,
      });
      loadCampanhas();
      fecharModal();
      Alert.alert('Sucesso!', 'Campanha atualizada.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar a campanha.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirCampanha = (campanha) => {
    Alert.alert(
      'Excluir campanha',
      `Deseja excluir "${campanha.titulo}"?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'campanhas', campanha.id));
              loadCampanhas();
              Alert.alert('Sucesso', 'Campanha excluída.');
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível excluir a campanha.');
            }
          },
        },
      ]
    );
  };

  const renderCampanha = ({ item }) => (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <MaterialCommunityIcons name="bullhorn" size={20} color="#9C27B0" />
            <Text style={styles.cardTitulo} numberOfLines={1}>{item.titulo}</Text>
          </View>
          <View style={[styles.badgeAtiva, !item.ativa && styles.badgeInativa]}>
            <Text style={[styles.badgeText, !item.ativa && styles.badgeTextInativa]}>
              {item.ativa ? 'Ativa' : 'Inativa'}
            </Text>
          </View>
        </View>
        <Text style={styles.cardMensagem} numberOfLines={2}>{item.mensagem}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardData}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : ''}
          </Text>
          {item.enviadoPara != null && (
            <Text style={styles.cardEnviados}>{item.enviadoPara} doadores</Text>
          )}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => abrirModalEditar(item)}
            style={[styles.actionBtn, styles.editBtn]}
          >
            <MaterialCommunityIcons name="pencil" size={18} color="#1976D2" />
            <Text style={[styles.actionBtnText, { color: '#1976D2' }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleExcluirCampanha(item)}
            style={[styles.actionBtn, styles.deleteBtn]}
          >
            <MaterialCommunityIcons name="delete" size={18} color="#C62828" />
            <Text style={[styles.actionBtnText, { color: '#C62828' }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const renderFormModal = () => (
    <Modal
      visible={modalVisivel}
      animationType="slide"
      transparent={true}
      onRequestClose={fecharModal}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalContent}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalModo === 'create' ? 'Nova Campanha' : 'Editar Campanha'}
            </Text>
            <TouchableOpacity onPress={fecharModal} style={styles.modalFechar}>
              <MaterialCommunityIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {modalModo === 'create' && (
              <View style={[styles.card, styles.reachCard]}>
                <View style={styles.reachContent}>
                  {buscandoTokens ? (
                    <ActivityIndicator size="small" color="#9C27B0" />
                  ) : (
                    <>
                      <Text style={styles.reachNumber}>{tokensCount}</Text>
                      <Text style={styles.reachLabel}>
                        doador{tokensCount !== 1 ? 'es' : ''} com notificação
                      </Text>
                    </>
                  )}
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Título</Text>
              <View style={[styles.inputContainer, titulo.length > 0 && styles.inputFocused]}>
                <MaterialCommunityIcons name="format-title" size={18} color="#9C27B0" style={styles.icon} />
                <TextInput
                  value={titulo}
                  onChangeText={setTitulo}
                  placeholder="Ex: Campanha de Doação"
                  placeholderTextColor="#999"
                  style={styles.input}
                  maxLength={100}
                  editable={!salvando}
                />
              </View>
              <Text style={styles.helper}>{titulo.length}/100</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mensagem</Text>
              <View style={[styles.textAreaContainer, mensagem.length > 0 && styles.inputFocused]}>
                <MaterialCommunityIcons name="message-text" size={18} color="#9C27B0" style={styles.icon} />
                <TextInput
                  value={mensagem}
                  onChangeText={setMensagem}
                  placeholder="Digite a mensagem..."
                  placeholderTextColor="#999"
                  style={styles.textArea}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                  editable={!salvando}
                />
              </View>
              <View style={styles.helperRow}>
                <Text style={styles.helper}>{mensagem.length}/500</Text>
                {mensagem.length > 0 && mensagem.length < 10 && (
                  <Text style={styles.error}>Mínimo 10 caracteres</Text>
                )}
              </View>
            </View>

            {modalModo === 'edit' && (
              <Pressable
                onPress={() => setAtiva(!ativa)}
                style={styles.toggleAtiva}
              >
                <MaterialCommunityIcons
                  name={ativa ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color="#9C27B0"
                />
                <Text style={styles.toggleLabel}>Campanha ativa</Text>
              </Pressable>
            )}

            <View style={styles.modalActions}>
              {modalModo === 'create' ? (
                <TouchableOpacity
                  onPress={handleCriarCampanha}
                  disabled={salvando || !titulo.trim() || mensagem.trim().length < 10}
                  style={[
                    styles.sendButton,
                    (salvando || !titulo.trim() || mensagem.trim().length < 10) && styles.buttonDisabled
                  ]}
                >
                  {salvando ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send" size={18} color="white" />
                      <Text style={styles.sendText}>Enviar</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleAtualizarCampanha}
                  disabled={salvando || !titulo.trim() || mensagem.trim().length < 10}
                  style={[
                    styles.sendButton,
                    (salvando || !titulo.trim() || mensagem.trim().length < 10) && styles.buttonDisabled
                  ]}
                >
                  {salvando ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="content-save" size={18} color="white" />
                      <Text style={styles.sendText}>Salvar</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={fecharModal} disabled={salvando} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>Carregando campanhas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Campanhas</Text>
        <View style={{ width: 40 }} />
      </View>

      {campanhas.length === 0 && !refreshing ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bullhorn-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>Nenhuma campanha criada</Text>
          <Text style={styles.emptySubtext}>Toque em "Nova Campanha" para começar</Text>
        </View>
      ) : (
        <FlatList
          data={campanhas}
          keyExtractor={(item) => item.id}
          renderItem={renderCampanha}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(80, insets.bottom) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#9C27B0']}
              tintColor="#9C27B0"
            />
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(20, insets.bottom) }]}
        onPress={abrirModalCriar}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="white" />
        <Text style={styles.fabText}>Nova Campanha</Text>
      </TouchableOpacity>

      {renderFormModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: '#9C27B0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  list: {
    padding: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  cardTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  badgeAtiva: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  badgeInativa: {
    backgroundColor: '#F5F5F5',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },
  badgeTextInativa: {
    color: '#757575',
  },
  cardMensagem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardData: {
    fontSize: 11,
    color: '#999',
  },
  cardEnviados: {
    fontSize: 11,
    color: '#9C27B0',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  editBtn: {
    backgroundColor: '#E3F2FD',
  },
  deleteBtn: {
    backgroundColor: '#FFEBEE',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#9C27B0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalFechar: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalActions: {
    gap: 8,
    marginTop: 16,
    marginBottom: 24,
  },
  reachCard: {
    marginBottom: 16,
  },
  reachContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  reachNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#9C27B0',
  },
  reachLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: 'white',
    height: 44,
  },
  textAreaContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: 'white',
    minHeight: 90,
  },
  inputFocused: {
    borderColor: '#9C27B0',
    borderWidth: 2,
  },
  icon: {
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 8,
    paddingRight: 12,
  },
  textArea: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 10,
    paddingRight: 12,
    minHeight: 90,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  helper: {
    fontSize: 11,
    color: '#999',
  },
  error: {
    fontSize: 11,
    color: '#E53935',
  },
  toggleAtiva: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#9C27B0',
    borderRadius: 8,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonDisabled: {
    backgroundColor: '#B39DDB',
    opacity: 0.7,
  },
  sendText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#9C27B0',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#9C27B0',
    fontSize: 14,
    fontWeight: '500',
  },
});
