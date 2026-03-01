import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, Dimensions, Animated, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Card, ActivityIndicator } from 'react-native-paper';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { haversineDistance } from '../src/utils/distance';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { auth, db, cacheDoadores, getCachedDoadores } from '../src/services/firebase';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NotificationService } from '../src/services/notifications';

const { width } = Dimensions.get('window');
const DEFAULT_LOCATION = { coords: { latitude: -7.612, longitude: 15.056 } };

// Esquema de cores harmonizado
const colors = {
  primary: '#D32F2F',
  primaryLight: '#EF5350',
  primaryDark: '#B71C1C',
  secondary: '#1976D2',
  secondaryLight: '#42A5F5',
  accent: '#4CAF50',
  accentLight: '#81C784',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  textLight: '#FFFFFF',
  border: '#E0E0E0',
  shadow: '#00000020',
  error: '#F44336',
  warning: '#FF9800',
};

// Sistema de Erros Personalizado
const ErrorTypes = {
  LOCATION: 'location',
  NETWORK: 'network',
  AUTH: 'auth',
  PERMISSION: 'permission',
  CHAT: 'chat',
  GENERAL: 'general'
};

class AppError extends Error {
  constructor(message, type = ErrorTypes.GENERAL, code = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.timestamp = new Date();
  }
}

// Serviço de Tratamento de Erros
const ErrorService = {
  handleError: (error, context = '') => {
    console.error(`[${context}] Erro:`, error);
    
    let userMessage = 'Ocorreu um erro inesperado. Tente novamente.';
    let type = ErrorTypes.GENERAL;
    
    if (error instanceof AppError) {
      userMessage = error.message;
      type = error.type;
    } else if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          userMessage = 'Permissão negada para acessar este recurso.';
          type = ErrorTypes.PERMISSION;
          break;
        case 'unavailable':
          userMessage = 'Serviço indisponível. Verifique sua conexão.';
          type = ErrorTypes.NETWORK;
          break;
        case 'auth/network-request-failed':
          userMessage = 'Erro de conexão. Verifique sua internet.';
          type = ErrorTypes.NETWORK;
          break;
        case 'auth/too-many-requests':
          userMessage = 'Muitas tentativas. Tente novamente mais tarde.';
          type = ErrorTypes.AUTH;
          break;
        default:
          userMessage = error.message || userMessage;
      }
    } else if (error.message) {
      userMessage = error.message;
    }
    
    return { userMessage, type, originalError: error };
  },
  
  showError: (errorResult, onRetry = null) => {
    const { userMessage, type } = errorResult;
    
    const buttons = [
      { text: 'OK', style: 'default' }
    ];
    
    if (onRetry) {
      buttons.unshift({
        text: 'Tentar Novamente',
        onPress: onRetry,
        style: 'cancel'
      });
    }
    
    Alert.alert(
      '❌ Ops, algo deu errado',
      userMessage,
      buttons,
      { cancelable: true }
    );
  },
  
  logError: (error, context) => {
    const errorLog = {
      context,
      error: error instanceof AppError ? {
        message: error.message,
        type: error.type,
        code: error.code,
        timestamp: error.timestamp
      } : {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      timestamp: new Date().toISOString(),
      user: auth.currentUser?.uid || 'anonymous'
    };
    
    console.log('📋 Log de Erro:', errorLog);
  }
};

// Função para obter cor baseada no tipo sanguíneo
const getBloodTypeColor = (tipoSanguineo) => {
  const bloodColors = {
    'O+': '#EF5350',
    'O-': '#D32F2F',
    'A+': '#42A5F5',
    'A-': '#1976D2',
    'B+': '#81C784',
    'B-': '#4CAF50',
    'AB+': '#AB47BC',
    'AB-': '#7B1FA2',
  };
  return bloodColors[tipoSanguineo] || colors.secondary;
};

export default function TelaMapaPublico() {
  const [location, setLocation] = useState(null);
  const [doadores, setDoadores] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtroTipoSanguineo, setFiltroTipoSanguineo] = useState('Todos');
  const [doadorSelecionado, setDoadorSelecionado] = useState(null);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [modalChatVisivel, setModalChatVisivel] = useState(false);
  const [mapaVisivel, setMapaVisivel] = useState(true);
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const router = useRouter();
  const scrollViewRef = useRef(null);
  const unsubscribeMensagensRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Tipos sanguíneos disponíveis para filtro
  const tiposSanguineos = useMemo(() => ['Todos', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'], []);

  // Função auxiliar para inicialização com tratamento de erro
  const initializeWithErrorHandling = async (operation, context, fallback = null) => {
    try {
      return await operation();
    } catch (error) {
      const errorResult = ErrorService.handleError(error, context);
      ErrorService.logError(error, context);
      
      if (fallback) {
        return fallback;
      }
      
      throw new AppError(errorResult.userMessage, errorResult.type, error.code);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const currentUser = auth.currentUser;
        setIsLoggedIn(!!currentUser);
        setIsAdmin(false);

        // Verifica se o usuário atual é admin
        if (currentUser) {
          await initializeWithErrorHandling(
            async () => {
              const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
              setIsAdmin(adminSnap.exists());
            },
            'Verificar perfil admin'
          );
        }
        setLoading(true);

        // Carregar doadores do cache com tratamento de erro
        await initializeWithErrorHandling(
          async () => {
            const cached = await getCachedDoadores();
            if (cached) setDoadores(cached);
          },
          'Carregar cache doadores'
        );

        // Solicitar permissão de localização com tratamento de erro
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLocation(DEFAULT_LOCATION);
          } else {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            setLocation(loc);
          }
        } catch (_) {
          setLocation(DEFAULT_LOCATION);
        }

        setLoading(false);
        
        // Animação de entrada
        Animated.timing(fadeAnim, { 
          toValue: 1, 
          duration: 500, 
          useNativeDriver: true 
        }).start();

        // Registrar token de notificação para usuários logados
        if (auth.currentUser) {
          await initializeWithErrorHandling(
            async () => {
              const pushToken = await NotificationService.registerForPushNotifications();
              if (pushToken) {
                await NotificationService.savePushToken(auth.currentUser.uid, pushToken);
              }
            },
            'Registrar notificações'
          );
        }

      } catch (error) {
        const errorResult = ErrorService.handleError(error, 'Inicializar App');
        setErrorMsg(errorResult.userMessage);
        ErrorService.showError(errorResult, initializeApp);
        setLoading(false);
      }
    };

    initializeApp();

    // Listener para autenticação
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setIsLoggedIn(!!user);
      setIsAdmin(false);

      if (user) {
        await initializeWithErrorHandling(
          async () => {
            const adminSnap = await getDoc(doc(db, 'admins', user.uid));
            setIsAdmin(adminSnap.exists());
          },
          'Verificar perfil admin (auth listener)'
        );
      }
    });

    // Listener para doadores em tempo real com tratamento de erro
    const q = query(collection(db, 'usuarios'), where('disponivel', '==', true));
    const unsubscribeDoadores = onSnapshot(q,
      (snapshot) => {
        const doadoresList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        cacheDoadores(doadoresList).catch((err) => ErrorService.logError(err, 'Cache doadores'));
        setDoadores(doadoresList);
      },
      (error) => {
        const errorResult = ErrorService.handleError(error, 'Listener doadores');
        ErrorService.showError(errorResult);
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeDoadores();
      if (unsubscribeMensagensRef.current) {
        unsubscribeMensagensRef.current();
      }
    };
  }, []);

  // Cleanup quando o modal de chat fecha
  useEffect(() => {
    if (!modalChatVisivel) {
      if (unsubscribeMensagensRef.current) {
        unsubscribeMensagensRef.current();
        unsubscribeMensagensRef.current = null;
      }
      setMensagens([]);
      setDoadorSelecionado(null);
    }
  }, [modalChatVisivel]);

  // Scroll to bottom quando mensagens mudam
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [mensagens]);

  // Filtra doadores por tipo sanguíneo e proximidade (memoizado para performance)
  const doadoresProximos = useMemo(() => {
    if (!location) return [];
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    return doadores
      .filter((doador) => {
        const filtroTipo = filtroTipoSanguineo === 'Todos' || doador.tipoSanguineo === filtroTipoSanguineo;
        if (!doador.localizacao?.lat || !doador.localizacao?.lng) return false;
        const dist = haversineDistance(lat, lng, doador.localizacao.lat, doador.localizacao.lng);
        return filtroTipo && dist < 20;
      })
      .map((doador) => ({
        ...doador,
        distancia: haversineDistance(lat, lng, doador.localizacao.lat, doador.localizacao.lng),
      }))
      .sort((a, b) => a.distancia - b.distancia);
  }, [location, doadores, filtroTipoSanguineo]);

  const initialRegion = location ? {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  } : { latitude: -7.612, longitude: 15.056, latitudeDelta: 0.0922, longitudeDelta: 0.0421 };

  // Funções de contato com tratamento de erro
  const ligarDoador = async (telefone) => {
    try {
      if (!telefone) {
        throw new AppError('Número de telefone não disponível', ErrorTypes.GENERAL);
      }
      
      await initializeWithErrorHandling(
        () => Linking.openURL(`tel:${telefone}`),
        'Abrir ligação telefônica'
      );
    } catch (error) {
      const errorResult = ErrorService.handleError(error, 'Ligar doador');
      ErrorService.showError(errorResult);
    }
  };

  const whatsappDoador = async (telefone) => {
    try {
      if (!telefone) {
        throw new AppError('Número de telefone não disponível', ErrorTypes.GENERAL);
      }
      
      const num = telefone.replace(/\D/g, '');
      await initializeWithErrorHandling(
        () => Linking.openURL(`whatsapp://send?phone=${num}`),
        'Abrir WhatsApp'
      );
    } catch (error) {
      const errorResult = ErrorService.handleError(error, 'WhatsApp doador');
      ErrorService.showError(errorResult);
    }
  };

  // Função para quando clicar no marcador
  const handleMarkerPress = useCallback((doador) => {
    setDoadorSelecionado(doador);
    setModalVisivel(true);
  }, []);

  // Função para quando clicar em um doador na lista
  const handleDoadorListaPress = useCallback((doador) => {
    setDoadorSelecionado(doador);
    setModalVisivel(true);
  }, []);

  // Função para abrir chat com doador com tratamento de erro robusto
  const abrirChat = useCallback(async (doador) => {
    try {
      // Se não estiver logado, fazer login anônimo automaticamente
      if (!auth.currentUser) {
        await initializeWithErrorHandling(
          async () => {
            await signInAnonymously(auth);
          },
          'Login anônimo para chat'
        );
      }

      // Unsubscribe listener anterior se existir
      if (unsubscribeMensagensRef.current) {
        unsubscribeMensagensRef.current();
        unsubscribeMensagensRef.current = null;
      }

      setDoadorSelecionado(doador);
      setMensagens([]);
      setCarregandoMensagens(true);
      setModalChatVisivel(true);
      
      // Carregar mensagens existentes
      await initializeWithErrorHandling(
        async () => {
          const unsub = carregarMensagens(doador.id);
          unsubscribeMensagensRef.current = unsub;
        },
        'Carregar mensagens do chat'
      );

    } catch (error) {
      const errorResult = ErrorService.handleError(error, 'Abrir chat');
      ErrorService.showError(errorResult, () => abrirChat(doador));
    } finally {
      setCarregandoMensagens(false);
    }
  }, []);

  // Carregar mensagens do chat com tratamento de erro
  const carregarMensagens = useCallback((doadorId) => {
    if (!auth.currentUser) return () => {};

    try {
      const chatId = [auth.currentUser.uid, doadorId].sort().join('_');
      const q = query(
        collection(db, 'chats', chatId, 'mensagens'),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          try {
            const mensagensList = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setMensagens(mensagensList);
          } catch (error) {
            const errorResult = ErrorService.handleError(error, 'Processar mensagens');
            ErrorService.logError(error, 'Processar mensagens');
          }
        },
        (error) => {
          const errorResult = ErrorService.handleError(error, 'Listener mensagens');
          ErrorService.showError(errorResult);
        }
      );

      return unsubscribe;
    } catch (error) {
      const errorResult = ErrorService.handleError(error, 'Configurar listener mensagens');
      ErrorService.showError(errorResult);
      return () => {};
    }
  }, []);

  // Enviar mensagem com tratamento de erro
  const enviarMensagem = useCallback(async () => {
    if (!novaMensagem.trim() || !auth.currentUser || !doadorSelecionado) return;

    try {
      const chatId = [auth.currentUser.uid, doadorSelecionado.id].sort().join('_');
      
      await initializeWithErrorHandling(
        async () => {
          await addDoc(collection(db, 'chats', chatId, 'mensagens'), {
            texto: novaMensagem.trim(),
            remetenteId: auth.currentUser.uid,
            remetenteNome: auth.currentUser.displayName || 'Usuário Anônimo',
            destinatarioId: doadorSelecionado.id,
            destinatarioNome: doadorSelecionado.nome,
            timestamp: serverTimestamp(),
            lida: false
          });
          setNovaMensagem('');
        },
        'Enviar mensagem'
      );

    } catch (error) {
      const errorResult = ErrorService.handleError(error, 'Enviar mensagem');
      ErrorService.showError(errorResult);
    }
  }, [novaMensagem, doadorSelecionado]);

  const handleLogout = useCallback(async () => {
    try {
      await initializeWithErrorHandling(
        () => auth.signOut(),
        'Logout'
      );
      setIsLoggedIn(false);
    } catch (error) {
      const errorResult = ErrorService.handleError(error, 'Logout');
      ErrorService.showError(errorResult);
    }
  }, []);

  // Alternar entre mapa e lista
  const toggleVisualizacao = useCallback(() => {
    setMapaVisivel(!mapaVisivel);
  }, [mapaVisivel]);

  if (loading) {
    return (
      <LinearGradient colors={[colors.primaryLight, colors.primary]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.textLight} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </LinearGradient>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header Principal */}
      <View style={styles.mainHeader}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={[styles.mainHeaderGradient, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <FontAwesome name="tint" size={24} color={colors.textLight} />
              <Text style={styles.mainTitle}>BloodMap</Text>
            </View>
            <View style={styles.headerControls}>
              <Pressable 
                style={({pressed}) => [styles.viewToggleBtn, !mapaVisivel && styles.viewToggleBtnActive, pressed && {opacity: 0.7}]}
                onPress={toggleVisualizacao}
              >
                <FontAwesome 
                  name={mapaVisivel ? "list" : "map"} 
                  size={16} 
                  color={colors.textLight} 
                />
                <Text style={[styles.viewToggleText, !mapaVisivel && styles.viewToggleTextActive]}>
                  {mapaVisivel ? "Lista" : "Mapa"}
                </Text>
              </Pressable>
            </View>
          </View>
          
          <View style={styles.headerStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{doadoresProximos.length}</Text>
              <Text style={styles.statLabel}>Doadores Próximos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{doadores.length}</Text>
              <Text style={styles.statLabel}>Total Disponível</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Conteúdo Principal - Mapa ou Lista */}
      <View style={styles.contentContainer}>
        {mapaVisivel ? (
          /* Mapa */
          <View style={styles.mapContainer}>
            <MapView 
              style={styles.map} 
              initialRegion={initialRegion} 
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              {location && (
                <Marker 
                  coordinate={{ 
                    latitude: location.coords.latitude, 
                    longitude: location.coords.longitude 
                  }} 
                  title="Sua localização" 
                  pinColor={colors.secondary}
                />
              )}
              {doadoresProximos.map((doador) => (
                <Marker
                  key={doador.id}
                  coordinate={{ 
                    latitude: doador.localizacao.lat, 
                    longitude: doador.localizacao.lng 
                  }}
                  title={`${doador.tipoSanguineo} - ${doador.nome}`}
                  pinColor={getBloodTypeColor(doador.tipoSanguineo)}
                  tracksViewChanges={false}
                  onPress={() => handleMarkerPress(doador)}
                >
                  <Callout tooltip>
                    <Card style={styles.calloutCard}>
                      <LinearGradient colors={[colors.surface, colors.background]} style={styles.calloutGradient}>
                        <View style={styles.calloutHeader}>
                          <Text style={styles.calloutTitle}>{doador.nome}</Text>
                          <View style={[styles.bloodTypeBadge, 
                            { backgroundColor: getBloodTypeColor(doador.tipoSanguineo) }]} >
                            <Text style={styles.bloodTypeText}>{doador.tipoSanguineo}</Text>
                          </View>
                        </View>
                        <Text style={styles.calloutDistance}>{doador.distancia.toFixed(1)} km de distância</Text>
                        <View style={styles.calloutButtons}>
                          <Pressable 
                            onPress={() => ligarDoador(doador.telefone)} 
                            style={({pressed}) => [{...styles.calloutBtn, ...styles.phoneBtn}, pressed && {opacity: 0.7}]}
                          >
                            <FontAwesome name="phone" size={16} color={colors.textLight} />
                            <Text style={styles.calloutBtnText}>Ligar</Text>
                          </Pressable>
                          <Pressable 
                            onPress={() => whatsappDoador(doador.telefone)} 
                            style={({pressed}) => [{...styles.calloutBtn, ...styles.whatsappBtn}, pressed && {opacity: 0.7}]}
                          >
                            <FontAwesome name="whatsapp" size={16} color={colors.textLight} />
                            <Text style={styles.calloutBtnText}>WhatsApp</Text>
                          </Pressable>
                          <Pressable 
                            onPress={() => abrirChat(doador)} 
                            style={({pressed}) => [{...styles.calloutBtn, ...styles.chatBtn}, pressed && {opacity: 0.7}]}
                          >
                            <FontAwesome name="comment" size={16} color={colors.textLight} />
                            <Text style={styles.calloutBtnText}>Chat</Text>
                          </Pressable>
                        </View>
                      </LinearGradient>
                    </Card>
                  </Callout>
                </Marker>
              ))}
            </MapView>
          </View>
        ) : (
          /* Lista de Doadores */
          <View style={styles.listaContainer}>
            <ScrollView style={styles.listaScroll}>
              {doadoresProximos.length === 0 ? (
                <View style={styles.listaVazia}>
                  <FontAwesome name="users" size={48} color={colors.textSecondary} />
                  <Text style={styles.listaVaziaText}>Nenhum doador encontrado</Text>
                  <Text style={styles.listaVaziaSubtext}>
                    {filtroTipoSanguineo !== 'Todos' 
                      ? `Tente alterar o filtro de tipo sanguíneo`
                      : `Não há doadores próximos da sua localização`
                    }
                  </Text>
                </View>
              ) : (
                doadoresProximos.map((doador, index) => (
                  <Pressable 
                    key={doador.id}
                    style={({pressed}) => [styles.doadorCard, pressed && {opacity: 0.7}]}
                    onPress={() => handleDoadorListaPress(doador)}
                  >
                    <LinearGradient 
                      colors={[colors.surface, colors.background]} 
                      style={styles.doadorCardGradient}
                    >
                      <View style={styles.doadorCardHeader}>
                        <View style={styles.doadorInfo}>
                          <Text style={styles.doadorNome}>{doador.nome}</Text>
                          <View style={styles.doadorMeta}>
                            <View style={[styles.bloodTypeBadgeList, 
                              { backgroundColor: getBloodTypeColor(doador.tipoSanguineo) }]} >
                              <Text style={styles.bloodTypeText}>{doador.tipoSanguineo}</Text>
                            </View>
                            <Text style={styles.doadorDistancia}>
                              {doador.distancia.toFixed(1)} km
                            </Text>
                          </View>
                        </View>
                        <View style={styles.doadorAcoes}>
                          <Pressable 
                            style={({pressed}) => [{...styles.acaoBtn, ...styles.phoneBtnList}, pressed && {opacity: 0.7}]}
                            onPress={() => ligarDoador(doador.telefone)}
                          >
                            <FontAwesome name="phone" size={14} color={colors.textLight} />
                          </Pressable>
                          <Pressable 
                            style={({pressed}) => [{...styles.acaoBtn, ...styles.whatsappBtnList}, pressed && {opacity: 0.7}]}
                            onPress={() => whatsappDoador(doador.telefone)}
                          >
                            <FontAwesome name="whatsapp" size={14} color={colors.textLight} />
                          </Pressable>
                          <Pressable 
                            style={({pressed}) => [{...styles.acaoBtn, ...styles.chatBtnList}, pressed && {opacity: 0.7}]}
                            onPress={() => abrirChat(doador)}
                          >
                            <FontAwesome name="comment" size={14} color={colors.textLight} />
                          </Pressable>
                        </View>
                      </View>
                      <View style={styles.doadorContato}>
                        <FontAwesome name="phone" size={14} color={colors.textSecondary} />
                        <Text style={styles.doadorTelefone}>{doador.telefone}</Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Filtro de Tipo Sanguíneo */}
      <View style={styles.filtroContainer}>
        <LinearGradient colors={[colors.surface, colors.background]} style={styles.filtroGradient}>
          <Text style={styles.filtroTitulo}>Filtrar por Tipo Sanguíneo:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtroScroll}
          >
            <View style={styles.filtroOpcoes}>
              {tiposSanguineos.map((tipo) => (
                <Pressable
                  key={tipo}
                  style={({pressed}) => [{ 
                    ...styles.filtroOpcao,
                    ...(filtroTipoSanguineo === tipo && styles.filtroOpcaoSelecionada),
                    backgroundColor: tipo === 'Todos' ? colors.textSecondary : getBloodTypeColor(tipo),
                    ...(pressed && {opacity: 0.7})
                  }]}
                  onPress={() => setFiltroTipoSanguineo(tipo)}
                >
                  <Text style={[
                    styles.filtroOpcaoTexto,
                    filtroTipoSanguineo === tipo && styles.filtroOpcaoTextoSelecionado
                  ]}>
                    {tipo}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </LinearGradient>
      </View>

      {/* Modal de Informações do Doador */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisivel}
        onRequestClose={() => setModalVisivel(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {doadorSelecionado && (
              <>
                <LinearGradient 
                  colors={[colors.primaryLight, colors.primary]} 
                  style={styles.modalHeader}
                >
                  <Text style={styles.modalTitle}>Informações do Doador</Text>
                  <Pressable 
                    style={({pressed}) => [{...styles.modalFecharBtn}, pressed && {opacity: 0.7}]}
                    onPress={() => setModalVisivel(false)}
                  >
                    <FontAwesome name="times" size={20} color={colors.textLight} />
                  </Pressable>
                </LinearGradient>
                
                <View style={styles.modalBody}>
                  <View style={styles.doadorInfoModal}>
                    <View style={styles.infoRow}>
                      <FontAwesome name="user" size={16} color={colors.textSecondary} />
                      <Text style={styles.infoLabel}>Nome:</Text>
                      <Text style={styles.infoValue}>{doadorSelecionado.nome}</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <FontAwesome name="tint" size={16} color={colors.textSecondary} />
                      <Text style={styles.infoLabel}>Tipo Sanguíneo:</Text>
                      <View style={[
                        styles.bloodTypeBadgeModal,
                        { backgroundColor: getBloodTypeColor(doadorSelecionado.tipoSanguineo) }
                      ]}>
                        <Text style={styles.bloodTypeText}>{doadorSelecionado.tipoSanguineo}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <FontAwesome name="phone" size={16} color={colors.textSecondary} />
                      <Text style={styles.infoLabel}>Telefone:</Text>
                      <Text style={styles.infoValue}>{doadorSelecionado.telefone}</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <FontAwesome name="map-marker" size={16} color={colors.textSecondary} />
                      <Text style={styles.infoLabel}>Distância:</Text>
                      <Text style={styles.infoValue}>{doadorSelecionado.distancia?.toFixed(1)} km</Text>
                    </View>
                  </View>
                  
                  <View style={styles.modalButtons}>
                    <Pressable 
                      style={({pressed}) => [{...styles.modalBtn, ...styles.phoneBtn}, pressed && {opacity: 0.7}]}
                      onPress={() => {
                        ligarDoador(doadorSelecionado.telefone);
                        setModalVisivel(false);
                      }}
                    >
                      <FontAwesome name="phone" size={16} color={colors.textLight} />
                      <Text style={styles.modalBtnText}>Ligar</Text>
                    </Pressable>
                    
                    <Pressable 
                      style={({pressed}) => [{...styles.modalBtn, ...styles.whatsappBtn}, pressed && {opacity: 0.7}]}
                      onPress={() => {
                        whatsappDoador(doadorSelecionado.telefone);
                        setModalVisivel(false);
                      }}
                    >
                      <FontAwesome name="whatsapp" size={16} color={colors.textLight} />
                      <Text style={styles.modalBtnText}>WhatsApp</Text>
                    </Pressable>

                    <Pressable 
                      style={({pressed}) => [{...styles.modalBtn, ...styles.chatBtn}, pressed && {opacity: 0.7}]}
                      onPress={() => {
                        setModalVisivel(false);
                        abrirChat(doadorSelecionado);
                      }}
                    >
                      <FontAwesome name="comment" size={18} color={colors.textLight} />
                      <Text style={styles.modalBtnText}>Chat</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Chat */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalChatVisivel}
        onRequestClose={() => setModalChatVisivel(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.chatModalContainer}
        >
          <View style={styles.chatModalContent}>
            {doadorSelecionado && (
              <>
                {/* Header do Chat */}
                <LinearGradient 
                  colors={[colors.primary, colors.primaryLight]} 
                  style={styles.chatHeader}
                >
                  <View style={styles.chatHeaderInfo}>
                    <Pressable 
                      style={({pressed}) => [{...styles.chatVoltarBtn}, pressed && {opacity: 0.7}]}
                      onPress={() => setModalChatVisivel(false)}
                    >
                      <FontAwesome name="arrow-left" size={18} color={colors.textLight} />
                    </Pressable>
                    <View style={styles.chatUserInfo}>
                      <Text style={styles.chatUserName}>{doadorSelecionado.nome}</Text>
                      <Text style={styles.chatUserBloodType}>{doadorSelecionado.tipoSanguineo}</Text>
                    </View>
                  </View>
                  <View style={styles.chatHeaderAcoes}>
                    <Pressable 
                      style={({pressed}) => [{...styles.chatAcaoBtn}, pressed && {opacity: 0.7}]}
                      onPress={() => ligarDoador(doadorSelecionado.telefone)}
                    >
                      <FontAwesome name="phone" size={20} color={colors.textLight} />
                    </Pressable>
                    <Pressable 
                      style={({pressed}) => [{...styles.chatAcaoBtn}, pressed && {opacity: 0.7}]}
                      onPress={() => whatsappDoador(doadorSelecionado.telefone)}
                    >
                      <FontAwesome name="whatsapp" size={20} color={colors.textLight} />
                    </Pressable>
                  </View>
                </LinearGradient>

                {/* Área de Mensagens */}
                <View style={styles.chatArea}>
                  {carregandoMensagens ? (
                    <View style={styles.chatLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.chatLoadingText}>Carregando mensagens...</Text>
                    </View>
                  ) : mensagens.length === 0 ? (
                    <View style={styles.chatVazio}>
                      <FontAwesome name="comments" size={48} color={colors.textSecondary} />
                      <Text style={styles.chatVazioText}>Nenhuma mensagem ainda</Text>
                      <Text style={styles.chatVazioSubtext}>Inicie uma conversa com {doadorSelecionado.nome}</Text>
                    </View>
                  ) : (
                    <ScrollView 
                      style={styles.mensagensContainer}
                      ref={scrollViewRef}
                    >
                      {mensagens.map((mensagem) => {
                        const isUsuario = mensagem.remetenteId === auth.currentUser?.uid;
                        return (
                          <View
                            key={mensagem.id}
                            style={[
                              styles.mensagemItem,
                              isUsuario ? styles.mensagemUsuario : styles.mensagemDoador
                            ]}
                          >
                            <View style={[
                              styles.mensagemBubble,
                              isUsuario ? styles.mensagemBubbleUsuario : styles.mensagemBubbleDoador
                            ]}>
                              <Text style={[
                                styles.mensagemTexto,
                                isUsuario ? styles.mensagemTextoUsuario : styles.mensagemTextoDoador
                              ]}>
                                {mensagem.texto}
                              </Text>
                              <Text style={[
                                styles.mensagemHora,
                                isUsuario ? styles.mensagemHoraUsuario : styles.mensagemHoraDoador
                              ]}>
                                {mensagem.timestamp?.toDate()?.toLocaleTimeString([], { 
                                  hour: '2-digit', minute: '2-digit' 
                                })}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                {/* Input de Mensagem */}
                <View style={styles.chatInputContainer}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Digite sua mensagem..."
                    value={novaMensagem}
                    onChangeText={setNovaMensagem}
                    multiline
                    maxLength={500}
                  />
                  <Pressable 
                    style={({pressed}) => [{...styles.chatEnviarBtn, ...( !novaMensagem.trim() && styles.chatEnviarBtnDisabled )}, pressed && {opacity: 0.7}]}
                    onPress={enviarMensagem}
                    disabled={!novaMensagem.trim()}
                  >
                    <FontAwesome 
                      name="send" 
                      size={16} 
                      color={novaMensagem.trim() ? colors.textLight : colors.textSecondary} 
                    />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom Actions - com safe area para não sobrepor teclas de navegação */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {!isLoggedIn ? (
          <View style={styles.buttonContainer}>
            <Pressable 
              style={({pressed}) => [{...styles.actionButton, ...styles.urgentButton}, pressed && {opacity: 0.7}]}
              onPress={() => router.push('/pedidos-urgentes')}
            >
              <FontAwesome name="exclamation-triangle" size={18} color={colors.textLight} />
              <Text style={styles.buttonText}>Pedido</Text>
            </Pressable>
            <Pressable 
              style={({pressed}) => [{...styles.actionButton, ...styles.donorButton}, pressed && {opacity: 0.7}]}
              onPress={() => router.push('/login')}
            >
              <FontAwesome name="heart" size={18} color={colors.textLight} />
              <Text style={styles.buttonText}>Doador</Text>
            </Pressable>
            <Pressable 
              style={({pressed}) => [{...styles.actionButton, ...styles.adminButton}, pressed && {opacity: 0.7}]}
              onPress={() => router.push('/admin')}
            >
              <FontAwesome name="hospital-o" size={18} color={colors.textLight} />
              <Text style={styles.buttonText}>Hospital</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            {isAdmin ? (
              <Pressable 
                style={({pressed}) => [{...styles.actionButton, ...styles.profileButton}, pressed && {opacity: 0.7}]}
                onPress={() => router.push('/admin')}
              >
                <FontAwesome name="hospital-o" size={18} color={colors.textLight} />
                <Text style={styles.buttonText}>Perfil Admin</Text>
              </Pressable>
            ) : (
              <Pressable 
                style={({pressed}) => [{...styles.actionButton, ...styles.profileButton}, pressed && {opacity: 0.7}]}
                onPress={() => router.push('/perfil')}
              >
                <FontAwesome name="user" size={18} color={colors.textLight} />
                <Text style={styles.buttonText}>Meu Perfil</Text>
              </Pressable>
            )}
            <Pressable 
              style={({pressed}) => [{...styles.actionButton, ...styles.logoutButton}, pressed && {opacity: 0.7}]}
              onPress={handleLogout}
            >
              <FontAwesome name="sign-out" size={18} color={colors.textLight} />
              <Text style={styles.buttonText}>Sair</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textLight,
    marginTop: 16,
    fontSize: 16,
  },
  mainHeader: {
    height: 140,
  },
  mainHeaderGradient: {
    flex: 1,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 10,
    justifyContent: 'space-between',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
    marginLeft: 8,
    flexShrink: 1,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 80,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.surface,
  },
  viewToggleText: {
    color: colors.textLight,
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  viewToggleTextActive: {
    color: colors.primary,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 60,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  contentContainer: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    minHeight: 300,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  listaContainer: {
    flex: 1,
  },
  listaScroll: {
    flex: 1,
  },
  listaVazia: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  listaVaziaText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  listaVaziaSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  doadorCard: {
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    minHeight: 120,
  },
  doadorCardGradient: {
    padding: 16,
  },
  doadorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  doadorInfo: {
    flex: 1,
    minWidth: '60%',
  },
  doadorNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    flexShrink: 1,
  },
  doadorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  bloodTypeBadgeList: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  bloodTypeText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: 'bold',
  },
  doadorDistancia: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  doadorAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    minWidth: 80,
  },
  acaoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    marginBottom: 4,
  },
  phoneBtnList: {
    backgroundColor: colors.accent,
  },
  whatsappBtnList: {
    backgroundColor: '#25D366',
  },
  chatBtnList: {
    backgroundColor: colors.secondary,
  },
  doadorContato: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  doadorTelefone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  calloutCard: {
    width: Math.min(300, Dimensions.get('window').width * 0.8),
    borderRadius: 12,
    overflow: 'hidden',
  },
  calloutGradient: {
    padding: 12,
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
    flexShrink: 1,
  },
  bloodTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  calloutDistance: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  calloutButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  calloutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 2,
    marginBottom: 4,
    minWidth: 60,
  },
  phoneBtn: {
    backgroundColor: colors.accent,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  chatBtn: {
    backgroundColor: colors.secondary,
  },
  calloutBtnText: {
    color: colors.textLight,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  filtroContainer: {
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    
    
  },
  filtroGradient: {
    padding: 12,
  },
  filtroTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  filtroScroll: {
    flexGrow: 0,
  },
  filtroOpcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filtroOpcao: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  filtroOpcaoSelecionada: {
    borderWidth: 2,
    borderColor: colors.textLight,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  filtroOpcaoTexto: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  filtroOpcaoTextoSelecionado: {
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textLight,
    flex: 1,
    marginRight: 16,
  },
  modalFecharBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  doadorInfoModal: {
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 8,
    marginRight: 12,
    width: 100,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
    flexShrink: 1,
  },
  bloodTypeBadgeModal: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    marginBottom: 8,
    minWidth: 100,
  },
  modalBtnText: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    textAlign: 'center',
  },
  chatModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chatModalContent: {
    flex: 1,
    backgroundColor: colors.surface,
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    maxHeight: '95%',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    minHeight: 70,
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatVoltarBtn: {
    padding: 8,
    marginRight: 12,
  },
  chatUserInfo: {
    flex: 1,
  },
  chatUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textLight,
    flexShrink: 1,
  },
  chatUserBloodType: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  chatHeaderAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chatAcaoBtn: {
    padding: 8,
    marginLeft: 8,
    marginBottom: 4,
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    minHeight: 300,
  },
  chatLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  chatLoadingText: {
    marginTop: 8,
    color: colors.textSecondary,
  },
  chatVazio: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  chatVazioText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  chatVazioSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  mensagensContainer: {
    flex: 1,
    padding: 16,
  },
  mensagemItem: {
    marginBottom: 12,
  },
  mensagemUsuario: {
    alignItems: 'flex-end',
  },
  mensagemDoador: {
    alignItems: 'flex-start',
  },
  mensagemBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    minWidth: 50,
  },
  mensagemBubbleUsuario: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  mensagemBubbleDoador: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mensagemTexto: {
    fontSize: 14,
  },
  mensagemTextoUsuario: {
    color: colors.textLight,
  },
  mensagemTextoDoador: {
    color: colors.textPrimary,
  },
  mensagemHora: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
  },
  mensagemHoraUsuario: {
    color: 'rgba(255,255,255,0.7)',
  },
  mensagemHoraDoador: {
    color: colors.textSecondary,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 80,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    marginRight: 8,
    minHeight: 40,
  },
  chatEnviarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatEnviarBtnDisabled: {
    backgroundColor: colors.border,
  },
  bottomBar: {
    padding: 16,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 6,
    marginBottom: 8,
    minWidth: 90,
    minHeight: 48,
    gap: 8,
  },
  urgentButton: {
    backgroundColor: colors.primaryLight,
  },
  donorButton: {
    backgroundColor: colors.accent,
  },
  adminButton: {
    backgroundColor: colors.secondary,
  },
  profileButton: {
    backgroundColor: colors.secondary,
  },
  logoutButton: {
    backgroundColor: colors.textSecondary,
  },
  buttonText: {
    color: colors.textLight,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
  },
});