import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, Animated, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Card, Button, TextInput } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { haversineDistance } from '../src/utils/distance';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { db, auth } from '../src/services/firebase';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PedidoErrorService, executeWithErrorHandling } from '../src/services/pedidoErrorService';

const { width, height } = Dimensions.get('window');

export default function TelaPedidosUrgentes() {
  const [tipoSanguineo, setTipoSanguineo] = useState('O+');
  const [mensagem, setMensagem] = useState('');
  const [solicitanteName, setSolicitanteName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [codigoPedido, setCodigoPedido] = useState('');
  const [locationLoading, setLocationLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [tipoErro, setTipoErro] = useState('');
  
  const fadeAnim = useState(new Animated.Value(0))[0];

  const [errors, setErrors] = useState({
    mensagem: '',
    solicitanteName: '',
    hospitalName: '',
    phoneNumber: '',
    location: ''
  });

  useEffect(() => {
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 500, 
      useNativeDriver: true 
    }).start();

    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Obter localização
      await getCurrentLocation();
    } catch (error) {
      const errorResult = PedidoErrorService.handleError(error, 'Inicializar App');
      setErro(errorResult.userMessage);
      setTipoErro(errorResult.type);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErro('Permissão de localização é necessária para encontrar doadores próximos.');
        setTipoErro('location');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000
      });
      setLocation(loc);
      clearError('location');
    } catch (error) {
      setErro('Erro ao obter localização. Verifique se o GPS está ativado.');
      setTipoErro('location');
    } finally {
      setLocationLoading(false);
    }
  };

  const clearError = (field = null) => {
    if (field) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    } else {
      setErrors({
        mensagem: '',
        solicitanteName: '',
        hospitalName: '',
        phoneNumber: '',
        location: ''
      });
      setErro('');
      setTipoErro('');
    }
  };

  const validateFields = () => {
    const newErrors = {
      mensagem: '',
      solicitanteName: '',
      hospitalName: '',
      phoneNumber: '',
      location: ''
    };

    let isValid = true;

    if (!mensagem.trim()) {
      newErrors.mensagem = 'Por favor, escreva uma mensagem explicando a urgência.';
      isValid = false;
    } else if (mensagem.trim().length < 10) {
      newErrors.mensagem = 'A mensagem deve ter pelo menos 10 caracteres.';
      isValid = false;
    }

    if (!solicitanteName.trim()) {
      newErrors.solicitanteName = 'Por favor, preencha o nome do solicitante.';
      isValid = false;
    }

    if (!hospitalName.trim()) {
      newErrors.hospitalName = 'Por favor, preencha o nome do hospital.';
      isValid = false;
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Por favor, preencha o número de telefone.';
      isValid = false;
    } else {
      const phoneClean = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
      if (!/^[\d\+]{8,15}$/.test(phoneClean)) {
        newErrors.phoneNumber = 'Por favor, insira um número de telefone válido.';
        isValid = false;
      }
    }

    if (!location) {
      newErrors.location = 'Aguardando localização...';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const buscarDoadoresCompatíveis = async () => {
    try {
      const doadoresQuery = query(
        collection(db, 'usuarios'),
        where('disponivel', '==', true),
        where('tipoSanguineo', '==', tipoSanguineo)
      );
      
      const snapshot = await getDocs(doadoresQuery);

      const doadoresProximos = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(doador => {
          if (!doador.localizacao || !doador.localizacao.lat || !doador.localizacao.lng) return false;

          const dist = haversineDistance(
            location.coords.latitude,
            location.coords.longitude,
            doador.localizacao.lat,
            doador.localizacao.lng
          );
          return dist < 50; // 50km
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

      console.log(`📍 Encontrados ${doadoresProximos.length} doadores compatíveis próximos`);
      return doadoresProximos;
    } catch (error) {
      console.error('Erro ao buscar doadores:', error);
      return [];
    }
  };

  const criarPedidoNoFirestore = async (pedidoData) => {
    try {
      const docRef = await addDoc(collection(db, 'pedidos'), pedidoData);
      console.log(`📝 Pedido criado com ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      throw error;
    }
  };

  const handleEnviarPedido = async () => {
    clearError();

    if (!validateFields()) {
      return;
    }

    setLoading(true);

    try {
      const codigo = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
      setCodigoPedido(codigo);

      const doadoresProximos = await buscarDoadoresCompatíveis();

      const pedidoData = {
        codigo,
        tipoSanguineo,
        mensagem: mensagem.trim(),
        solicitante: solicitanteName.trim(),
        hospital: hospitalName.trim(),
        telefone: phoneNumber.trim(),
        localizacao: {
          lat: location.coords.latitude,
          lng: location.coords.longitude
        },
        status: 'pending',
        aceites: 0,
        doadoresNotificados: doadoresProximos.length,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdBy: auth.currentUser?.uid || 'anonymous',
        updatedAt: new Date().toISOString()
      };

      await criarPedidoNoFirestore(pedidoData);

      showSuccessAlert(codigo, doadoresProximos.length);
      resetForm();

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessAlert = (codigo, totalDoadores) => {
    const mensagem = `Seu pedido urgente foi criado com sucesso!

📋 Código de consulta: ${codigo}
📍 Doadores próximos: ${totalDoadores}

Use seu número de telefone para consultar o pedido.`;

    Alert.alert('✅ Pedido Criado com Sucesso!', mensagem, [
      { 
        text: 'Consultar Pedido', 
        onPress: () => {
          router.push({
            pathname: '/consulta-pedido',
            params: { codigoConsulta: codigo }
          });
        }
      },
      { 
        text: 'OK', 
        style: 'default' 
      }
    ]);
  };

  const resetForm = () => {
    setMensagem('');
    setSolicitanteName('');
    setHospitalName('');
    setPhoneNumber('');
    clearError();
  };

  const getEstilosErro = () => {
    switch (tipoErro) {
      case 'validation':
        return {
          container: styles.erroWarningContainer,
          text: styles.erroWarningText,
          icon: '⚠️'
        };
      case 'location':
        return {
          container: styles.erroInfoContainer,
          text: styles.erroInfoText,
          icon: '📍'
        };
      default:
        return {
          container: styles.erroContainer,
          text: styles.erroText,
          icon: '❌'
        };
    }
  };

  const estilosErro = getEstilosErro();

  return (
    <LinearGradient colors={['#FF3B30', '#FF6B6B']} style={styles.container}>
      {/* Menu Fixo no Topo */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerContent}>
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </Pressable>
          
          <View style={styles.headerTitleContainer}>
            <MaterialIcons name="emergency" size={28} color="#FFF" />
            <Text style={styles.headerTitle}>Pedido Urgente</Text>
          </View>

          <Pressable 
            style={styles.menuButton}
            onPress={() => router.push('/consulta-pedido')}
          >
            <MaterialIcons name="search" size={24} color="#FFF" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            
            {/* Banner Informativo */}
            <View style={styles.banner}>
              <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']} style={styles.bannerGradient}>
                <View style={styles.bannerContent}>
                  <MaterialIcons name="warning" size={32} color="#FFF" />
                  <View style={styles.bannerTexts}>
                    <Text style={styles.bannerTitle}>Alerta de Emergência</Text>
                    <Text style={styles.bannerSubtitle}>
                      Envie um alerta urgente para doadores compatíveis próximos à sua localização
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Mensagem de erro geral */}
            {erro ? (
              <View style={[styles.alertContainer, estilosErro.container]}>
                <Text style={styles.alertIcon}>{estilosErro.icon}</Text>
                <Text style={[styles.alertText, estilosErro.text]}>{erro}</Text>
              </View>
            ) : null}

            {/* Card Principal do Formulário */}
            <Card style={styles.mainCard}>
              <LinearGradient colors={['#FFFFFF', '#F8F9FF']} style={styles.cardGradient}>
                
                {/* Seção de Tipo Sanguíneo */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="bloodtype" size={20} color="#FF3B30" />
                    <Text style={styles.sectionTitle}>Tipo Sanguíneo Necessário</Text>
                  </View>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={tipoSanguineo}
                      onValueChange={setTipoSanguineo}
                      style={styles.picker}
                      dropdownIconColor="#FF3B30"
                    >
                      <Picker.Item label="O+ (Doador Universal)" value="O+" />
                      <Picker.Item label="O- (Doador Universal)" value="O-" />
                      <Picker.Item label="A+" value="A+" />
                      <Picker.Item label="A-" value="A-" />
                      <Picker.Item label="B+" value="B+" />
                      <Picker.Item label="B-" value="B-" />
                      <Picker.Item label="AB+" value="AB+" />
                      <Picker.Item label="AB- (Receptor Universal)" value="AB-" />
                    </Picker>
                  </View>
                </View>

                {/* Seção de Mensagem de Urgência */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="message" size={20} color="#FF3B30" />
                    <Text style={styles.sectionTitle}>Mensagem de Urgência</Text>
                  </View>
                  <TextInput
                    label="Descreva a situação de emergência *"
                    value={mensagem}
                    onChangeText={(text) => {
                      setMensagem(text);
                      clearError('mensagem');
                    }}
                    multiline
                    numberOfLines={4}
                    mode="outlined"
                    style={[styles.textArea, errors.mensagem && styles.inputError]}
                    outlineColor={errors.mensagem ? '#FF6B6B' : '#E8E8E8'}
                    activeOutlineColor="#FF3B30"
                    placeholder="Ex: Paciente em estado crítico, necessita transfusão urgente para cirurgia..."
                    error={!!errors.mensagem}
                  />
                  {errors.mensagem ? (
                    <View style={styles.errorContainer}>
                      <MaterialIcons name="error-outline" size={16} color="#FF3B30" />
                      <Text style={styles.errorText}>{errors.mensagem}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.charCount}>
                    {mensagem.length}/200 caracteres
                  </Text>
                </View>

                {/* Seção de Informações de Contato */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="contact-page" size={20} color="#FF3B30" />
                    <Text style={styles.sectionTitle}>Informações de Contato</Text>
                  </View>
                  
                  <TextInput
                    label="Nome do Solicitante *"
                    value={solicitanteName}
                    onChangeText={(text) => {
                      setSolicitanteName(text);
                      clearError('solicitanteName');
                    }}
                    mode="outlined"
                    style={[styles.input, errors.solicitanteName && styles.inputError]}
                    outlineColor={errors.solicitanteName ? '#FF6B6B' : '#E8E8E8'}
                    activeOutlineColor="#FF3B30"
                    placeholder="Seu nome completo"
                  />

                  <TextInput
                    label="Telefone *"
                    value={phoneNumber}
                    onChangeText={(text) => {
                      setPhoneNumber(text);
                      clearError('phoneNumber');
                    }}
                    keyboardType="phone-pad"
                    mode="outlined"
                    style={[styles.input, errors.phoneNumber && styles.inputError]}
                    outlineColor={errors.phoneNumber ? '#FF6B6B' : '#E8E8E8'}
                    activeOutlineColor="#FF3B30"
                    placeholder="+244 900 000 000"
                  />

                  <TextInput
                    label="Nome do Hospital *"
                    value={hospitalName}
                    onChangeText={(text) => {
                      setHospitalName(text);
                      clearError('hospitalName');
                    }}
                    mode="outlined"
                    style={[styles.input, errors.hospitalName && styles.inputError]}
                    outlineColor={errors.hospitalName ? '#FF6B6B' : '#E8E8E8'}
                    activeOutlineColor="#FF3B30"
                    placeholder="Ex: Hospital Central, Clínica São Lucas..."
                  />
                </View>

                {/* Status da Localização */}
                <View style={[
                  styles.locationCard,
                  location ? styles.locationSuccess : styles.locationLoading
                ]}>
                  <View style={styles.locationHeader}>
                    <MaterialIcons 
                      name={location ? "location-on" : "location-searching"} 
                      size={24} 
                      color={location ? "#4CAF50" : "#FF9800"} 
                    />
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationTitle}>
                        {location ? 'Localização Confirmada' : 'Buscando Localização'}
                      </Text>
                      <Text style={styles.locationSubtitle}>
                        {location 
                          ? 'Pronto para encontrar doadores próximos' 
                          : 'Ativando GPS para maior precisão'
                        }
                      </Text>
                    </View>
                    {!location && (
                      <Pressable onPress={getCurrentLocation} style={styles.locationRetry}>
                        <MaterialIcons name="gps-fixed" size={20} color="#FF3B30" />
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Botão Principal de Ação */}
                <View style={styles.actionSection}>
                  <Button
                    icon={loading ? "loading" : "send"}
                    mode="contained"
                    onPress={handleEnviarPedido}
                    loading={loading}
                    disabled={loading || locationLoading}
                    style={[
                      styles.primaryButton,
                      (loading || locationLoading) && styles.buttonDisabled
                    ]}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}
                  >
                    {loading ? 'Enviando Alerta...' : 
                     locationLoading ? 'Obtendo Localização...' : 
                     ' Enviar Alerta Urgente'}
                  </Button>
                </View>

                {/* Card de Sucesso */}
                {codigoPedido && (
                  <Card style={styles.successCard}>
                    <LinearGradient colors={['#4CAF50', '#45a049']} style={styles.successGradient}>
                      <View style={styles.successContent}>
                        <View style={styles.successIcon}>
                          <MaterialIcons name="check-circle" size={40} color="#FFF" />
                        </View>
                        <Text style={styles.successTitle}>Alerta Enviado!</Text>
                        <Text style={styles.successMessage}>
                          Seu pedido urgente foi distribuído para doadores compatíveis próximos
                        </Text>
                        
                        <View style={styles.codeContainer}>
                          <Text style={styles.codeLabel}>Código de Acompanhamento</Text>
                          <Text style={styles.codeValue}>{codigoPedido}</Text>
                        </View>

                        <View style={styles.successActions}>
                          <Button
                            mode="contained"
                            onPress={() => {
                              router.push({
                                pathname: '/consulta-pedido',
                                params: { codigoConsulta: codigoPedido }
                              });
                            }}
                            style={styles.successButton}
                            contentStyle={styles.successButtonContent}
                            icon="chart-line"
                            textColor="#4CAF50"
                          >
                            Acompanhar Pedido
                          </Button>
                        </View>
                      </View>
                    </LinearGradient>
                  </Card>
                )}

                {/* Menu Fixo Inferior */}
                <View style={styles.bottomMenu}>
                  <Pressable 
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => router.push('/consulta-pedido')}
                  >
                    <MaterialIcons name="search" size={22} color="#FF3B30" />
                    <Text style={styles.menuText}>Consultar</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => router.push('/')}
                  >
                    <MaterialIcons name="map" size={22} color="#FF3B30" />
                    <Text style={styles.menuText}>Mapa</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => router.push('/perfil')}
                  >
                    <MaterialIcons name="person" size={22} color="#FF3B30" />
                    <Text style={styles.menuText}>Perfil</Text>
                  </Pressable>
                </View>

              </LinearGradient>
            </Card>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// Mantenha os estilos existentes (não mudei os estilos)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
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
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoid: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 110 : 90,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  content: {
    flex: 1,
    paddingTop: 10,
  },
  banner: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bannerGradient: {
    padding: 20,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTexts: {
    flex: 1,
    marginLeft: 15,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  mainCard: {
    marginHorizontal: 20,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 15,
  },
  cardGradient: {
    padding: 25,
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 15,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  picker: {
    height: 60,
  },
  textArea: {
    backgroundColor: '#FFF',
    minHeight: 120,
    borderRadius: 15,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    marginBottom: 15,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 5,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  locationCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
  },
  locationSuccess: {
    backgroundColor: '#F1F8E9',
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  locationLoading: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 5,
    borderLeftColor: '#FF9800',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 15,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  locationRetry: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  actionSection: {
    marginTop: 10,
    marginBottom: 20,
    
  },
  primaryButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    borderRadius: 15,
   

  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonContent: {
    paddingVertical: 12,
    height: 64,
    
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    
  },
  successCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
  },
  successGradient: {
    padding: 25,
  },
  successContent: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 15,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
  },
  successMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 20,
    lineHeight: 22,
  },
  codeContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 3,
  },
  successActions: {
    width: '100%',
  },
  successButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  successButtonContent: {
    paddingVertical: 8,
  },
  bottomMenu: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginTop: 20,
  },
  menuItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    minWidth: 80,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  menuText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 5,
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 15,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  alertIcon: {
    marginRight: 12,
    fontSize: 20,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  erroContainer: {
    backgroundColor: '#FFEAA7',
    borderLeftWidth: 6,
    borderLeftColor: '#FF4444',
  },
  erroWarningContainer: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 6,
    borderLeftColor: '#FFA000',
  },
  erroInfoContainer: {
    backgroundColor: '#D1ECF1',
    borderLeftWidth: 6,
    borderLeftColor: '#0DCAF0',
  },
  erroText: {
    color: '#D63031',
  },
  erroWarningText: {
    color: '#856404',
  },
  erroInfoText: {
    color: '#055160',
  },
});