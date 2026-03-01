import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  Animated, 
  ScrollView, 
  Pressable, 
  KeyboardAvoidingView, 
  Platform,
  TextInput 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { haversineDistance } from '../src/utils/distance';
import { isCompativel } from '../src/utils/bloodCompatibility';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { db, auth } from '../src/services/firebase';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NotificationService } from '../src/services/notifications';

const tiposSanguineos = [
  { label: 'O+ (Doador Universal)', value: 'O+' },
  { label: 'O- (Doador Universal)', value: 'O-' },
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB- (Receptor Universal)', value: 'AB-' },
];

const urgencias = [
  { label: 'Alta', value: 'alta' },
  { label: 'Média', value: 'media' },
  { label: 'Baixa', value: 'baixa' },
];

const raios = [5, 10, 20, 50];

export default function TelaPedidosUrgentes() {
  const [tipoSanguineo, setTipoSanguineo] = useState('O+');
  const [urgencia, setUrgencia] = useState('alta');
  const [raioKm, setRaioKm] = useState(10);
  const [mensagem, setMensagem] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [hospital, setHospital] = useState('');
  const [telefone, setTelefone] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [showUrgenciaPicker, setShowUrgenciaPicker] = useState(false);
  const [showTipoPicker, setShowTipoPicker] = useState(false);
  const [showRaioPicker, setShowRaioPicker] = useState(false);
  const [pushToken, setPushToken] = useState(null);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    getLocation();
    registerForPushNotifications();
  }, []);

  const registerForPushNotifications = async () => {
    try {
      const token = await NotificationService.registerForPushNotifications();
      setPushToken(token);
    } catch (error) {
      console.log('Erro ao registrar notificações:', error);
    }
  };

  const getLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'A localização é necessária para encontrar doadores próximos.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000
      });
      setLocation(loc);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível obter sua localização.');
    } finally {
      setLocationLoading(false);
    }
  };

  const validar = () => {
    if (!mensagem.trim()) {
      Alert.alert('Atenção', 'Escreva uma mensagem explicando a urgência.');
      return false;
    }
    if (mensagem.trim().length < 10) {
      Alert.alert('Atenção', 'A mensagem deve ter pelo menos 10 caracteres.');
      return false;
    }
    if (!solicitante.trim()) {
      Alert.alert('Atenção', 'Informe o nome do solicitante.');
      return false;
    }
    if (!hospital.trim()) {
      Alert.alert('Atenção', 'Informe o nome do hospital.');
      return false;
    }
    if (!telefone.trim()) {
      Alert.alert('Atenção', 'Informe o telefone para contato.');
      return false;
    }
    if (!location) {
      Alert.alert('Atenção', 'Aguardando localização...');
      return false;
    }
    return true;
  };

  const buscarDoadores = async () => {
    try {
      const q = query(collection(db, 'usuarios'), where('disponivel', '==', true));
      const snapshot = await getDocs(q);

      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => {
          if (!d.localizacao?.lat || !d.localizacao?.lng) return false;
          if (!isCompativel(d.tipoSanguineo, tipoSanguineo)) return false;
          if (d.compartilharLocalizacao === false) return false;

          const dist = haversineDistance(
            location.coords.latitude,
            location.coords.longitude,
            d.localizacao.lat,
            d.localizacao.lng
          );
          return dist <= raioKm;
        })
        .sort((a, b) => {
          const distA = haversineDistance(
            location.coords.latitude,
            location.coords.longitude,
            a.localizacao.lat,
            a.localizacao.lng
          );
          const distB = haversineDistance(
            location.coords.latitude,
            location.coords.longitude,
            b.localizacao.lat,
            b.localizacao.lng
          );
          return distA - distB;
        });
    } catch (error) {
      console.error('Erro ao buscar doadores:', error);
      return [];
    }
  };

  const enviarNotificacoes = async (doadores, pedidoId, codigo) => {
    try {
      const tokens = doadores
        .map(d => d.pushToken)
        .filter(Boolean);

      if (tokens.length === 0) {
        console.log('Nenhum token de notificação encontrado');
        return;
      }

      const titulo = `🚨 Pedido Urgente - ${tipoSanguineo}`;
      const corpo = `${hospital} necessita de doador ${tipoSanguineo}. ${mensagem.substring(0, 80)}...`;

      const resultado = await NotificationService.sendBulkNotifications(
        tokens,
        titulo,
        corpo,
        {
          pedidoId,
          tipoSanguineo,
          hospital,
          telefone,
          codigo,
          type: 'URGENT_PEDIDO'
        },
        'URGENT'
      );

      console.log(`Notificações enviadas: ${resultado?.successCount || 0} de ${tokens.length}`);
    } catch (error) {
      console.error('Erro ao enviar notificações:', error);
    }
  };

  const handleEnviar = async () => {
    if (!validar()) return;

    setLoading(true);

    try {
      const doadores = await buscarDoadores();

      if (doadores.length === 0) {
        Alert.alert(
          'Nenhum doador encontrado',
          `Não há doadores compatíveis num raio de ${raioKm} km. Tente aumentar o raio.`
        );
        setLoading(false);
        return;
      }

      const codigo = telefone.replace(/\D/g, '').slice(-8);

      const pedido = {
        codigo,
        tipoSanguineo,
        urgencia,
        raioKm,
        mensagem: mensagem.trim(),
        solicitante: solicitante.trim(),
        hospital: hospital.trim(),
        telefone: telefone.trim(),
        localizacao: {
          lat: location.coords.latitude,
          lng: location.coords.longitude
        },
        status: 'pending',
        doadoresNotificados: doadores.length,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || 'anonymous',
      };

      const docRef = await addDoc(collection(db, 'pedidos'), pedido);
      
      // Enviar notificações push
      await enviarNotificacoes(doadores, docRef.id, codigo);

      Alert.alert(
        '✅ Pedido Enviado!',
        `Seu pedido foi enviado para ${doadores.length} doador${doadores.length > 1 ? 'es' : ''} próximo${doadores.length > 1 ? 's' : ''}.\n\nCódigo: ${codigo}`,
        [
          { 
            text: 'Ver Pedido', 
            onPress: () => router.push({
              pathname: '/consulta-pedido',
              params: { codigo }
            })
          },
          { text: 'OK' }
        ]
      );

      // Limpar formulário
      setMensagem('');
      setSolicitante('');
      setHospital('');
      setTelefone('');

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar o pedido.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const PickerModal = ({ visible, onClose, options, selected, onSelect, title }) => {
    if (!visible) return null;

    return (
      <View style={styles.pickerModal}>
        <View style={styles.pickerContent}>
          <Text style={styles.pickerTitle}>{title}</Text>
          {options.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.pickerOption,
                selected === option.value && styles.pickerOptionSelected
              ]}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
            >
              <Text style={[
                styles.pickerOptionText,
                selected === option.value && styles.pickerOptionTextSelected
              ]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.pickerClose} onPress={onClose}>
            <Text style={styles.pickerCloseText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-left" size={22} color="white" />
        </Pressable>
        <Text style={styles.title}>Pedido Urgente</Text>
        <Pressable onPress={() => router.push('/consulta-pedido')} style={styles.searchBtn}>
          <MaterialIcons name="search" size={22} color="white" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(24, insets.bottom) }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

            {/* Info Banner */}
            <View style={styles.banner}>
              <MaterialIcons name="warning" size={24} color="#E53935" />
              <Text style={styles.bannerText}>
                Envie um alerta urgente para doadores compatíveis próximos
              </Text>
            </View>

            {/* Tipo Sanguíneo */}
            <View style={styles.card}>
              <Text style={styles.label}>Tipo Sanguíneo Necessário</Text>
              <Pressable
                style={styles.picker}
                onPress={() => setShowTipoPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {tiposSanguineos.find(t => t.value === tipoSanguineo)?.label}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
              </Pressable>
            </View>

            {/* Urgência */}
            <View style={styles.card}>
              <Text style={styles.label}>Nível de Urgência</Text>
              <Pressable
                style={styles.picker}
                onPress={() => setShowUrgenciaPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {urgencias.find(u => u.value === urgencia)?.label}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
              </Pressable>
            </View>

            {/* Raio */}
            <View style={styles.card}>
              <Text style={styles.label}>Raio de Busca</Text>
              <Pressable
                style={styles.picker}
                onPress={() => setShowRaioPicker(true)}
              >
                <Text style={styles.pickerText}>{raioKm} km</Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
              </Pressable>
            </View>

            {/* Mensagem */}
            <View style={styles.card}>
              <Text style={styles.label}>Mensagem de Urgência</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={mensagem}
                onChangeText={setMensagem}
                placeholder="Descreva a situação de emergência..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                maxLength={200}
              />
              <Text style={styles.counter}>{mensagem.length}/200</Text>
            </View>

            {/* Contato */}
            <View style={styles.card}>
              <Text style={styles.label}>Nome do Solicitante</Text>
              <TextInput
                style={styles.input}
                value={solicitante}
                onChangeText={setSolicitante}
                placeholder="Seu nome completo"
                placeholderTextColor="#999"
              />

              <Text style={[styles.label, { marginTop: 15 }]}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={setTelefone}
                placeholder="+244 900 000 000"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />

              <Text style={[styles.label, { marginTop: 15 }]}>Hospital</Text>
              <TextInput
                style={styles.input}
                value={hospital}
                onChangeText={setHospital}
                placeholder="Nome do hospital"
                placeholderTextColor="#999"
              />
            </View>

            {/* Localização */}
            <View style={[styles.locationCard, location ? styles.locationOk : styles.locationWaiting]}>
              <MaterialIcons
                name={location ? "location-on" : "location-searching"}
                size={20}
                color={location ? "#4CAF50" : "#FF9800"}
              />
              <Text style={styles.locationText}>
                {location ? 'Localização confirmada' : 'Obtendo localização...'}
              </Text>
              {!location && (
                <Pressable onPress={getLocation} style={styles.retryBtn}>
                  <MaterialIcons name="gps-fixed" size={18} color="#E53935" />
                </Pressable>
              )}
            </View>

            {/* Token de Notificação (opcional - feedback) */}
            {pushToken && (
              <View style={styles.tokenInfo}>
                <MaterialIcons name="notifications-active" size={16} color="#4CAF50" />
                <Text style={styles.tokenText}>Notificações ativas</Text>
              </View>
            )}

            {/* Botão Enviar */}
            <Pressable
              style={[
                styles.sendButton,
                (loading || locationLoading) && styles.sendButtonDisabled
              ]}
              onPress={handleEnviar}
              disabled={loading || locationLoading}
            >
              <Text style={styles.sendButtonText}>
                {loading ? 'Enviando...' : 'Enviar Alerta Urgente'}
              </Text>
            </Pressable>

            {/* Menu Inferior */}
            <View style={styles.bottomMenu}>
              <Pressable style={styles.menuItem} onPress={() => router.push('/consulta-pedido')}>
                <MaterialIcons name="search" size={20} color="#E53935" />
                <Text style={styles.menuText}>Consultar</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={() => router.push('/')}>
                <MaterialIcons name="map" size={20} color="#E53935" />
                <Text style={styles.menuText}>Mapa</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={() => router.push('/perfil')}>
                <MaterialIcons name="person" size={20} color="#E53935" />
                <Text style={styles.menuText}>Perfil</Text>
              </Pressable>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modais dos Pickers */}
      <PickerModal
        visible={showTipoPicker}
        onClose={() => setShowTipoPicker(false)}
        options={tiposSanguineos}
        selected={tipoSanguineo}
        onSelect={setTipoSanguineo}
        title="Selecione o tipo sanguíneo"
      />

      <PickerModal
        visible={showUrgenciaPicker}
        onClose={() => setShowUrgenciaPicker(false)}
        options={urgencias}
        selected={urgencia}
        onSelect={setUrgencia}
        title="Nível de urgência"
      />

      <PickerModal
        visible={showRaioPicker}
        onClose={() => setShowRaioPicker(false)}
        options={raios.map(r => ({ label: `${r} km`, value: r }))}
        selected={raioKm}
        onSelect={(v) => setRaioKm(Number(v))}
        title="Raio de busca"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E53935',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: 16,
  },
  content: {
    gap: 12,
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#E53935',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  pickerText: {
    fontSize: 14,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: 'white',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  locationOk: {
    backgroundColor: '#E8F5E9',
  },
  locationWaiting: {
    backgroundColor: '#FFF3E0',
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  retryBtn: {
    padding: 6,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tokenText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  sendButton: {
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#FFCDD2',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomMenu: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 10,
  },
  menuItem: {
    alignItems: 'center',
    gap: 4,
  },
  menuText: {
    fontSize: 11,
    color: '#E53935',
    fontWeight: '500',
  },
  pickerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: '#FFEBEE',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#E53935',
    fontWeight: '600',
  },
  pickerClose: {
    marginTop: 15,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  pickerCloseText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
});