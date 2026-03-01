import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  ScrollView, 
  Animated, 
  TouchableOpacity,
  Linking 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Button, TextInput, Switch, Badge } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import * as Location from 'expo-location';
import { router, usePathname } from 'expo-router';
import { auth, db } from '../src/services/firebase';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getContagemRegressiva, podeDoar, getDiasIntervalo } from '../src/utils/availability';

// Constantes e configurações
const BLOOD_TYPE_COLORS = {
  'O+': '#D32F2F',
  'O-': '#F44336',
  'A+': '#E53935',
  'A-': '#EF5350',
  'B+': '#C62828',
  'B-': '#E57373',
  'AB+': '#B71C1C',
  'AB-': '#EF9A9A'
};

const URGENCY_COLORS = {
  'alta': '#D32F2F',
  'media': '#FF9800',
  'baixa': '#4CAF50',
  'default': '#757575'
};

const ROUTES = {
  'mapa': '/',
  'perfil': '/perfil',
  'pedidos': '/pedidos',
  'historico': '/historico',
  'inicio': '/(tabs)',
  'doacoes': '/doacoes',
  'emergencia': '/emergencia',
  'configuracoes': '/configuracoes'
};

export default function TelaPerfil() {
  // Estados do usuário
  const [userData, setUserData] = useState({
    nome: '',
    tipoSanguineo: 'O+',
    telefone: '',
    sexo: 'M',
    disponivel: false,
    location: null,
    ultimaDoacao: null,
    historicoDoacoes: [],
    compartilharLocalizacao: true,
  });
  
  // Estados da UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [activeMenu, setActiveMenu] = useState('perfil');
  
  // Estados de dados
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [pedidosAceitos, setPedidosAceitos] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [pedidosAceitosMap, setPedidosAceitosMap] = useState({});

  // Animações
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  const notificationCount = pedidosPendentes.length;
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Efeitos
  useEffect(() => {
    carregarPerfil();
    iniciarAnimacoes();
  }, []);

  useEffect(() => {
    if (userData.disponivel && userData.tipoSanguineo) {
      carregarPedidosPendentes();
      carregarPedidosAceitos();
    } else {
      setPedidosPendentes([]);
      setPedidosAceitos([]);
    }
  }, [userData.disponivel, userData.tipoSanguineo]);

  // Sincroniza o menu ativo com a rota atual
  useEffect(() => {
    const routeName = Object.keys(ROUTES).find(key => ROUTES[key] === pathname);
    if (routeName && ['perfil', 'pedidos', 'mapa', 'aceitos'].includes(routeName)) {
      setActiveMenu(routeName);
    }
  }, [pathname]);

  // Funções de carregamento de dados
  const iniciarAnimacoes = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  };

  const carregarPerfil = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Login Necessário', 'Faça login para acessar seu perfil.');
      router.push('/login');
      return;
    }

    try {
      const docRef = doc(db, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData({
          nome: data.nome || '',
          tipoSanguineo: data.tipoSanguineo || 'O+',
          telefone: data.telefone || '',
          sexo: data.sexo || 'M',
          disponivel: data.disponivel || false,
          location: data.localizacao || null,
          ultimaDoacao: data.ultimaDoacao || null,
          historicoDoacoes: data.historicoDoacoes || [],
          compartilharLocalizacao: data.compartilharLocalizacao !== false,
        });
      } else {
        Alert.alert('Perfil Não Encontrado', 'Complete seu cadastro como doador.');
        router.push('/cadastro-doador');
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      Alert.alert('Erro', 'Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  };

  const carregarPedidosPendentes = async () => {
    if (!userData.disponivel) {
      setPedidosPendentes([]);
      return;
    }

    setLoadingPedidos(true);
    try {
      const pedidosQuery = query(
        collection(db, 'pedidos'), 
        where('status', '==', 'pending'), 
        where('tipoSanguineo', '==', userData.tipoSanguineo)
      );
      
      const snapshot = await getDocs(pedidosQuery);
      const pedidos = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      
      setPedidosPendentes(pedidos);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os pedidos pendentes.');
      setPedidosPendentes([]);
    } finally {
      setLoadingPedidos(false);
    }
  };

  const carregarPedidosAceitos = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Primeiro busca todos os pedidos aceitos pelo usuário
      const pedidosQuery = query(
        collection(db, 'pedidos'), 
        where('aceitoPor', '==', user.uid),
        where('status', '==', 'accepted')
      );
      
      const snapshot = await getDocs(pedidosQuery);
      let pedidos = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      
      // Ordena localmente por data (mais recente primeiro)
      pedidos = pedidos.sort((a, b) => {
        const dataA = new Date(a.aceitoEm || a.createdAt || 0);
        const dataB = new Date(b.aceitoEm || b.createdAt || 0);
        return dataB - dataA;
      });
      
      setPedidosAceitos(pedidos);
    } catch (error) {
      console.error('Erro ao carregar pedidos aceitos:', error);
      
      // Fallback: tenta carregar sem ordenação
      try {
        const pedidosQuery = query(
          collection(db, 'pedidos'), 
          where('aceitoPor', '==', user.uid)
        );
        
        const snapshot = await getDocs(pedidosQuery);
        let pedidos = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        
        // Filtra localmente por status
        pedidos = pedidos.filter(pedido => pedido.status === 'accepted');
        
        // Ordena localmente
        pedidos = pedidos.sort((a, b) => {
          const dataA = new Date(a.aceitoEm || a.createdAt || 0);
          const dataB = new Date(b.aceitoEm || b.createdAt || 0);
          return dataB - dataA;
        });
        
        setPedidosAceitos(pedidos);
      } catch (fallbackError) {
        console.error('Erro no fallback de pedidos aceitos:', fallbackError);
        Alert.alert('Aviso', 'Algumas funcionalidades podem estar limitadas temporariamente.');
      }
    }
  };

  // Funções de atualização e salvamento
  const atualizarLocalizacao = async () => {
    setUpdatingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Necessária', 'Precisamos da sua localização para conectar você com quem precisa.');
        return;
      }
      
      let loc = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.High 
      });
      
      const novaLocalizacao = { 
        lat: loc.coords.latitude, 
        lng: loc.coords.longitude 
      };
      
      setUserData(prev => ({ ...prev, location: novaLocalizacao }));
      
      // Atualiza também no Firestore
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'usuarios', user.uid), {
          localizacao: novaLocalizacao,
          updatedAt: new Date().toISOString()
        });
      }
      
      Alert.alert('📍 Localização Atualizada', 'Sua localização foi atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar localização:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a localização.');
    } finally {
      setUpdatingLocation(false);
    }
  };

  const salvarPerfil = async () => {
    if (!userData.nome.trim()) {
      Alert.alert('Atenção', 'Por favor, informe seu nome.');
      return;
    }

    if (!userData.telefone.trim()) {
      Alert.alert('Atenção', 'Por favor, informe seu telefone.');
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        return;
      }

      const updates = {
        nome: userData.nome.trim(),
        tipoSanguineo: userData.tipoSanguineo,
        telefone: userData.telefone.trim(),
        sexo: userData.sexo,
        disponivel: userData.disponivel,
        compartilharLocalizacao: userData.compartilharLocalizacao,
        updatedAt: new Date().toISOString(),
        ...(userData.location && { localizacao: userData.location })
      };
      
      await updateDoc(doc(db, 'usuarios', user.uid), updates);
      Alert.alert('✨ Perfil Atualizado', 'Suas informações foram salvas com sucesso!');
      
      if (userData.disponivel) {
        carregarPedidosPendentes();
        carregarPedidosAceitos();
      }
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  // Funções de gerenciamento de pedidos
  const aceitarPedido = async (pedidoId) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }
    if (!podeDoar(userData.ultimaDoacao, userData.sexo)) {
      const { dias } = getContagemRegressiva(userData.ultimaDoacao, userData.sexo);
      Alert.alert('Indisponível', `Você só pode doar novamente em ${dias} dia(s). Aguarde o intervalo entre doações.`);
      return;
    }
    try {
      // Marca o pedido como aceito localmente
      setPedidosAceitosMap(prev => ({
        ...prev,
        [pedidoId]: true
      }));

      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, { 
        status: 'accepted',
        aceitoPor: user.uid,
        aceitoEm: new Date().toISOString()
      });
      
      // Recarrega os pedidos aceitos
      await carregarPedidosAceitos();
      
      // Remove o pedido da lista após um delay para mostrar a confirmação
      setTimeout(() => {
        setPedidosPendentes(pedidos => pedidos.filter(p => p.id !== pedidoId));
      }, 1500);
      
      Alert.alert('🎉 Pedido Aceito!', 'Entre em contato com o solicitante para combinar a doação.');
    } catch (error) {
      console.error('Erro ao aceitar pedido:', error);
      Alert.alert('Erro', 'Não foi possível aceitar o pedido.');
      // Remove a marcação de aceito em caso de erro
      setPedidosAceitosMap(prev => ({
        ...prev,
        [pedidoId]: false
      }));
    }
  };

  const finalizarPedido = async (pedidoId) => {
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, { 
        status: 'completed',
        finalizadoEm: new Date().toISOString()
      });
      
      // Remove da lista de aceitos
      setPedidosAceitos(pedidos => pedidos.filter(p => p.id !== pedidoId));
      
      Alert.alert('✅ Doação Concluída', 'Obrigado por sua doação! Você ajudou a salvar vidas.');
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
      Alert.alert('Erro', 'Não foi possível marcar o pedido como concluído.');
    }
  };

  const cancelarAceitacao = async (pedidoId) => {
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, { 
        status: 'pending',
        aceitoPor: null,
        aceitoEm: null
      });
      
      // Remove da lista de aceitos e adiciona de volta aos pendentes
      const pedidoCancelado = pedidosAceitos.find(p => p.id === pedidoId);
      if (pedidoCancelado) {
        setPedidosAceitos(pedidos => pedidos.filter(p => p.id !== pedidoId));
        setPedidosPendentes(prev => [pedidoCancelado, ...prev]);
      }
      
      Alert.alert('🔄 Aceitação Cancelada', 'O pedido voltou para a lista de pendentes.');
    } catch (error) {
      console.error('Erro ao cancelar aceitação:', error);
      Alert.alert('Erro', 'Não foi possível cancelar a aceitação.');
    }
  };

  // Funções de contato
  const formatarTelefoneParaLink = (telefone) => {
    if (!telefone) return null;
    return telefone.replace(/[^\d+]/g, '');
  };

  const fazerLigacao = (telefone) => {
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

  const enviarSMS = (telefone) => {
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

  const enviarWhatsApp = (telefone) => {
    const numeroFormatado = formatarTelefoneParaLink(telefone);
    if (numeroFormatado) {
      // Remove o prefixo + se existir para o WhatsApp
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

  // Funções de navegação e auxiliares
  const navegarPara = (tela) => {
    const rota = ROUTES[tela];
    
    if (!rota) {
      // Se não houver rota definida, é um menu interno
      if (tela === 'aceitos') {
        setActiveMenu(tela);
        carregarPedidosAceitos();
        return;
      }
      
      console.error(`Rota não encontrada para: ${tela}`);
      Alert.alert('Erro', 'Rota não configurada.');
      return;
    }

    try {
      if (tela === 'perfil' || tela === 'pedidos' || tela === 'aceitos') {
        setActiveMenu(tela);
        if (tela === 'pedidos') {
          carregarPedidosPendentes();
        } else if (tela === 'aceitos') {
          carregarPedidosAceitos();
        }
        return;
      } else if (tela === 'mapa') {
        router.push(rota);
        return;
      }
      
      setActiveMenu(tela);
      router.push(rota);
    } catch (error) {
      console.error('Erro na navegação:', error);
      Alert.alert('Erro', `Não foi possível navegar para ${tela}`);
    }
  };

  // Funções auxiliares de formatação e handlers
  const getBloodTypeColor = (tipo) => BLOOD_TYPE_COLORS[tipo] || '#D32F2F';

  const formatarData = (dataString) => {
    try {
      if (!dataString) return 'Data não disponível';
      
      const data = new Date(dataString);
      if (isNaN(data.getTime())) return 'Data inválida';
      
      return data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'Data não disponível';
    }
  };

  const getUrgenciaColor = (urgencia) => URGENCY_COLORS[urgencia] || URGENCY_COLORS.default;

  const handleUserDataChange = (field, value) => {
    if (field === 'disponivel' && value === true) {
      const pode = podeDoar(userData.ultimaDoacao, userData.sexo);
      if (!pode && userData.ultimaDoacao) {
        const { dias, proximaData } = getContagemRegressiva(userData.ultimaDoacao, userData.sexo);
        Alert.alert(
          'Aguardar intervalo',
          `Você pode doar novamente em ${dias} dia(s).\nPróxima data permitida: ${proximaData?.toLocaleDateString('pt-BR') || '-'}\n\nHomens: 60 dias entre doações.\nMulheres: 90 dias.`
        );
        return;
      }
    }
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  const getMenuIcon = (menu) => {
    const icons = {
      mapa: 'map',
      perfil: 'user',
      pedidos: 'heart',
      aceitos: 'check-circle'
    };
    return icons[menu] || 'help';
  };

  // Componentes de renderização
  const renderLoading = () => (
    <LinearGradient colors={['#D32F2F', '#B71C1C']} style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FFF" />
      <Text style={styles.loadingText}>Carregando seu perfil...</Text>
    </LinearGradient>
  );

  const renderTopMenu = () => (
    <LinearGradient 
      colors={['#D32F2F', '#B71C1C']} 
      style={[
        styles.topMenu, 
        { paddingTop: (notificationCount > 0 || pedidosAceitos.length > 0) ? 70 : 40 }
      ]}
    >
      <View style={styles.menuItems}>
        {['mapa', 'perfil', 'pedidos', 'aceitos'].map((item) => {
          const isPedidos = item === 'pedidos';
          const isAceitos = item === 'aceitos';
          const label = item === 'aceitos' ? 'Aceitos' : item.charAt(0).toUpperCase() + item.slice(1);
          
          return (
            <View key={item} style={styles.menuButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.menuButton,
                  activeMenu === item && styles.menuButtonActive
                ]}
                onPress={() => navegarPara(item)}
              >
                <FontAwesome 
                  name={getMenuIcon(item)} 
                  size={20} 
                  color={activeMenu === item ? '#D32F2F' : '#FFFFFF'} 
                />
                <Text style={[
                  styles.menuButtonText,
                  activeMenu === item && styles.menuButtonTextActive
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
              {isPedidos && notificationCount > 0 && (
                <Badge style={styles.badge}>{notificationCount}</Badge>
              )}
              {isAceitos && pedidosAceitos.length > 0 && (
                <Badge style={[styles.badge, styles.aceitosBadge]}>{pedidosAceitos.length}</Badge>
              )}
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );

  const renderHeader = () => (
    <LinearGradient colors={['#D32F2F', '#B71C1C']} style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.avatarContainer}>
          <LinearGradient colors={['#FFFFFF', '#F5F5F5']} style={styles.avatarGradient}>
            <FontAwesome name="user" size={28} color="#D32F2F" />
          </LinearGradient>
          {userData.disponivel && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.title}>{userData.nome || 'Doador'}</Text>
          <View style={[styles.bloodTypeBadge, { backgroundColor: getBloodTypeColor(userData.tipoSanguineo) }]}>
            <Text style={styles.bloodTypeText}>{userData.tipoSanguineo}</Text>
          </View>
          <Text style={styles.subtitle}>Herói do Sangue</Text>
        </View>
      </View>
    </LinearGradient>
  );

  const renderPedidosHeader = () => (
    <LinearGradient colors={['#D32F2F', '#B71C1C']} style={styles.pedidosHeader}>
      <View style={styles.pedidosHeaderContent}>
        <Text style={styles.pedidosSubtitle}>
          {pedidosPendentes.length} pedido(s) compatível(is) com seu tipo sanguíneo
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => setActiveMenu('perfil')}
      >
        <FontAwesome name="arrow-left" size={24} color="#FFF" />
      </TouchableOpacity>
    </LinearGradient>
  );

  const renderPedidosAceitosHeader = () => (
    <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.pedidosHeader}>
      <View style={styles.pedidosHeaderContent}>
    
        <Text style={styles.pedidosSubtitle}>
          {pedidosAceitos.length} pedido(s) que você aceitou ajudar
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => setActiveMenu('perfil')}
      >
        <FontAwesome name="arrow-left" size={24} color="#FFF" />
      </TouchableOpacity>
    </LinearGradient>
  );

  const renderFormSection = () => (
    <Card style={styles.formCard}>
      <LinearGradient colors={['#FFFFFF', '#FAFAFA']} style={styles.formGradient}>
        {renderPersonalInfoSection()}
        {renderDonationStatusSection()}
        {renderLocationSection()}
        {renderHistoricoDoacoes()}
        {renderActionButtons()}
      </LinearGradient>
    </Card>
  );

  const renderPersonalInfoSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <FontAwesome name="user-circle" size={20} color="#D32F2F" />
        <Text style={styles.sectionTitle}>Informações Pessoais</Text>
      </View>
      
      <View style={styles.inputGroup}>
        <TextInput
          label="Nome Completo *"
          value={userData.nome}
          onChangeText={(value) => handleUserDataChange('nome', value)}
          mode="outlined"
          style={styles.input}
          outlineColor="#E0E0E0"
          activeOutlineColor="#D32F2F"
          left={<TextInput.Icon icon="account" color="#D32F2F" />}
        />
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          label="Telefone *"
          value={userData.telefone}
          onChangeText={(value) => handleUserDataChange('telefone', value)}
          keyboardType="phone-pad"
          mode="outlined"
          style={styles.input}
          outlineColor="#E0E0E0"
          activeOutlineColor="#D32F2F"
          left={<TextInput.Icon icon="phone" color="#D32F2F" />}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tipo Sanguíneo</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={userData.tipoSanguineo}
            onValueChange={(value) => handleUserDataChange('tipoSanguineo', value)}
            style={styles.picker}
          >
            {Object.keys(BLOOD_TYPE_COLORS).map((type) => (
              <Picker.Item key={type} label={type} value={type} />
            ))}
          </Picker>
        </View>
      </View>
    </View>
  );

  const renderDonationStatusSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <FontAwesome name="heartbeat" size={20} color="#D32F2F" />
        <Text style={styles.sectionTitle}>Status de Doação</Text>
      </View>
      <Card style={styles.availabilityCard}>
        <View style={styles.availabilityContent}>
          <View style={styles.availabilityInfo}>
            <FontAwesome 
              name={userData.disponivel ? 'check-circle' : 'times-circle'} 
              size={28} 
              color={userData.disponivel ? '#D32F2F' : '#757575'} 
            />
            <View style={styles.availabilityText}>
              <Text style={styles.availabilityTitle}>
                {userData.disponivel ? '🎯 Disponível para Doar' : '⏸️ Indisponível'}
              </Text>
              <Text style={styles.availabilitySubtitle}>
                {userData.disponivel 
                  ? 'Você está visível no mapa para pessoas que precisam de ajuda' 
                  : 'Você não aparecerá no mapa para solicitações'
                }
              </Text>
              {userData.ultimaDoacao && (() => {
                const { dias, disponivel } = getContagemRegressiva(userData.ultimaDoacao, userData.sexo);
                const intervalo = getDiasIntervalo(userData.sexo);
                if (!disponivel) {
                  return (
                    <Text style={styles.countdownText}>
                      ⏱ Próxima doação em {dias} dia(s) (intervalo: {intervalo} dias para {userData.sexo === 'F' ? 'mulheres' : 'homens'})
                    </Text>
                  );
                }
                return null;
              })()}
            </View>
          </View>
          <Switch
            value={userData.disponivel}
            onValueChange={(value) => handleUserDataChange('disponivel', value)}
            trackColor={{ false: '#767577', true: '#FFCDD2' }}
            thumbColor={userData.disponivel ? '#D32F2F' : '#f4f3f4'}
          />
        </View>
      </Card>
    </View>
  );

  const renderLocationSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <FontAwesome name="map-marker" size={20} color="#D32F2F" />
        <Text style={styles.sectionTitle}>Localização</Text>
      </View>
      <Card style={styles.locationCard}>
        <View style={styles.locationContent}>
          <FontAwesome name="map-pin" size={24} color="#D32F2F" />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationStatus}>
              {userData.location ? '📍 Localização configurada' : '🌍 Aguardando localização'}
            </Text>
            <Text style={styles.locationCoords}>
              {userData.location 
                ? `${userData.location.lat?.toFixed(4)}, ${userData.location.lng?.toFixed(4)}`
                : 'Atualize para aparecer no mapa de doadores'
              }
            </Text>
          </View>
        </View>
      </Card>
      
      <View style={styles.shareLocationRow}>
        <Text style={styles.shareLocationLabel}>Compartilhar localização com hospitais</Text>
        <Switch
          value={userData.compartilharLocalizacao}
          onValueChange={(value) => handleUserDataChange('compartilharLocalizacao', value)}
          trackColor={{ false: '#767577', true: '#FFCDD2' }}
          thumbColor={userData.compartilharLocalizacao ? '#D32F2F' : '#f4f3f4'}
        />
      </View>
      
      <Button
        icon="crosshairs-gps"
        mode="outlined"
        onPress={atualizarLocalizacao}
        loading={updatingLocation}
        disabled={updatingLocation}
        style={styles.locationButton}
        contentStyle={styles.locationButtonContent}
        labelStyle={styles.locationButtonText}
      >
        {updatingLocation ? 'Buscando...' : 'Atualizar Localização'}
      </Button>
    </View>
  );

  const renderHistoricoDoacoes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <FontAwesome name="history" size={20} color="#D32F2F" />
        <Text style={styles.sectionTitle}>Histórico de Doações</Text>
      </View>
      <Card style={styles.historicoCard}>
        {(!userData.historicoDoacoes || userData.historicoDoacoes.length === 0) ? (
          <Text style={styles.historicoEmpty}>Nenhuma doação registrada ainda.</Text>
        ) : (
          userData.historicoDoacoes.slice(0, 10).map((item, idx) => (
            <View key={idx} style={styles.historicoItem}>
              <FontAwesome name="tint" size={16} color="#D32F2F" />
              <Text style={styles.historicoText}>
                {item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '-'}
                {item.hospital ? ` • ${item.hospital}` : ''}
              </Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionsSection}>
      <Button
        icon="content-save"
        mode="contained"
        onPress={salvarPerfil}
        loading={saving}
        disabled={saving}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonText}
      >
        {saving ? 'Salvando...' : 'Salvar Alterações'}
      </Button>
    </View>
  );

  const renderPedidosContent = () => {
    if (loadingPedidos) {
      return (
        <View style={styles.loadingContainerModal}>
          <ActivityIndicator size="large" color="#D32F2F" />
          <Text style={styles.loadingTextModal}>Carregando pedidos...</Text>
        </View>
      );
    }

    if (pedidosPendentes.length === 0) {
      return (
        <View style={styles.emptyState}>
          <FontAwesome name="check-circle" size={64} color="#E0E0E0" />
          <Text style={styles.emptyStateTitle}>Nenhum pedido pendente</Text>
          <Text style={styles.emptyStateText}>
            {userData.disponivel 
              ? 'Não há pedidos compatíveis com seu tipo sanguíneo no momento.'
              : 'Ative sua disponibilidade para receber pedidos de doação.'
            }
          </Text>
        </View>
      );
    }

    return pedidosPendentes.map((pedido) => {
      const isAceito = pedidosAceitosMap[pedido.id];
      
      return (
        <Card key={pedido.id} style={styles.pedidoCard}>
          <Card.Content>
            <View style={styles.pedidoHeader}>
              <View style={styles.pedidoInfo}>
                <Text style={styles.pedidoSolicitante}>
                  {pedido.solicitante || 'Solicitante não informado'}
                </Text>
                <Text style={styles.pedidoHospital}>
                  🏥 {pedido.hospital || 'Hospital não especificado'}
                </Text>
              </View>
              <View style={[styles.urgenciaBadge, { backgroundColor: '#D32F2F' }]}>
                <Text style={styles.urgenciaText}>
                  🆘 Urgente
                </Text>
              </View>
            </View>
            
            <View style={styles.pedidoDetails}>
              <View style={styles.detailItem}>
                <FontAwesome name="tint" size={16} color="#D32F2F" />
                <Text style={styles.detailText}>Tipo Sanguíneo: {pedido.tipoSanguineo}</Text>
              </View>
              
              <View style={styles.detailItem}>
                <FontAwesome name="phone" size={16} color="#757575" />
                <Text style={styles.detailText}>Contato: {pedido.telefone}</Text>
              </View>
              
              <View style={styles.detailItem}>
                <FontAwesome name="clock-o" size={16} color="#757575" />
                <Text style={styles.detailText}>
                  Criado em: {formatarData(pedido.createdAt)}
                </Text>
              </View>
              
              {pedido.mensagem && (
                <View style={styles.detailItem}>
                  <FontAwesome name="sticky-note" size={16} color="#757575" />
                  <Text style={styles.detailText}>{pedido.mensagem}</Text>
                </View>
              )}
            </View>

            {/* Botões de ação */}
            <View style={styles.contactActionsContainer}>
              <Button
                mode="contained"
                icon="phone"
                onPress={() => fazerLigacao(pedido.telefone)}
                style={styles.contactActionButton}
                contentStyle={styles.contactButtonContent}
                labelStyle={styles.contactButtonText}
              >
                Ligar
              </Button>
              
              <Button
                mode="contained"
                icon="message"
                onPress={() => enviarSMS(pedido.telefone)}
                style={[styles.contactActionButton, styles.smsButton]}
                contentStyle={styles.contactButtonContent}
                labelStyle={styles.contactButtonText}
              >
                SMS
              </Button>
              
              <Button
                mode="contained"
                icon="whatsapp"
                onPress={() => enviarWhatsApp(pedido.telefone)}
                style={[styles.contactActionButton, styles.whatsappButton]}
                contentStyle={styles.contactButtonContent}
                labelStyle={styles.contactButtonText}
              >
                WhatsApp
              </Button>
            </View>

            <Button
              mode={isAceito ? "contained" : "outlined"}
              onPress={() => aceitarPedido(pedido.id)}
              style={[
                styles.aceitarButton,
                isAceito && styles.aceitarButtonAceito
              ]}
              contentStyle={styles.aceitarButtonContent}
              labelStyle={[
                styles.aceitarButtonText,
                isAceito && styles.aceitarButtonTextAceito
              ]}
              icon={isAceito ? "check-circle" : "check"}
              disabled={isAceito}
            >
              {isAceito ? '✅ Pedido Aceito' : 'Marcar como Aceito'}
            </Button>
          </Card.Content>
        </Card>
      );
    });
  };

  const renderPedidosAceitosContent = () => {
    if (loadingPedidos) {
      return (
        <View style={styles.loadingContainerModal}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingTextModal}>Carregando pedidos aceitos...</Text>
        </View>
      );
    }

    if (pedidosAceitos.length === 0) {
      return (
        <View style={styles.emptyState}>
          <FontAwesome name="inbox" size={64} color="#E0E0E0" />
          <Text style={styles.emptyStateTitle}>Nenhum pedido aceito</Text>
          <Text style={styles.emptyStateText}>
            Você ainda não aceitou nenhum pedido de doação.
          </Text>
          <Button 
            mode="contained" 
            onPress={() => navegarPara('pedidos')}
            style={styles.primaryButton}
          >
            Ver Pedidos Pendentes
          </Button>
        </View>
      );
    }

    return pedidosAceitos.map((pedido) => (
      <Card key={pedido.id} style={[styles.pedidoCard, styles.aceitoCard]}>
        <Card.Content>
          <View style={styles.pedidoHeader}>
            <View style={styles.pedidoInfo}>
              <Text style={styles.pedidoSolicitante}>
                {pedido.solicitante || 'Solicitante não informado'}
              </Text>
              <Text style={styles.pedidoHospital}>
                🏥 {pedido.hospital || 'Hospital não especificado'}
              </Text>
            </View>
            <View style={[styles.urgenciaBadge, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.urgenciaText}>
                ✅ Aceito
              </Text>
            </View>
          </View>
          
          <View style={styles.pedidoDetails}>
            <View style={styles.detailItem}>
              <FontAwesome name="tint" size={16} color="#4CAF50" />
              <Text style={styles.detailText}>Tipo Sanguíneo: {pedido.tipoSanguineo}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <FontAwesome name="phone" size={16} color="#757575" />
              <Text style={styles.detailText}>Contato: {pedido.telefone}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <FontAwesome name="calendar" size={16} color="#757575" />
              <Text style={styles.detailText}>
                Aceito em: {formatarData(pedido.aceitoEm)}
              </Text>
            </View>
            
            {pedido.mensagem && (
              <View style={styles.detailItem}>
                <FontAwesome name="sticky-note" size={16} color="#757575" />
                <Text style={styles.detailText}>{pedido.mensagem}</Text>
              </View>
            )}
          </View>

          {/* Botões de ação para pedidos aceitos */}
          <View style={styles.contactActionsContainer}>
            <Button
              mode="contained"
              icon="phone"
              onPress={() => fazerLigacao(pedido.telefone)}
              style={styles.contactActionButton}
              contentStyle={styles.contactButtonContent}
              labelStyle={styles.contactButtonText}
            >
              Ligar
            </Button>
            
            <Button
              mode="contained"
              icon="message"
              onPress={() => enviarSMS(pedido.telefone)}
              style={[styles.contactActionButton, styles.smsButton]}
              contentStyle={styles.contactButtonContent}
              labelStyle={styles.contactButtonText}
            >
              SMS
            </Button>
            
            <Button
              mode="contained"
              icon="whatsapp"
              onPress={() => enviarWhatsApp(pedido.telefone)}
              style={[styles.contactActionButton, styles.whatsappButton]}
              contentStyle={styles.contactButtonContent}
              labelStyle={styles.contactButtonText}
            >
              WhatsApp
            </Button>
          </View>

          <View style={styles.aceitoActionsContainer}>
            <Button
              mode="outlined"
              onPress={() => cancelarAceitacao(pedido.id)}
              style={styles.cancelarButton}
              contentStyle={styles.aceitarButtonContent}
              labelStyle={styles.cancelarButtonText}
              icon="close-circle"
            >
              Cancelar
            </Button>
            
            <Button
              mode="contained"
              onPress={() => finalizarPedido(pedido.id)}
              style={styles.finalizarButton}
              contentStyle={styles.aceitarButtonContent}
              labelStyle={styles.finalizarButtonText}
              icon="check-circle"
            >
              Concluir Doação
            </Button>
          </View>
        </Card.Content>
      </Card>
    ));
  };

  if (loading) return renderLoading();

  return (
    <View style={styles.container}>
      {renderTopMenu()}

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 4, paddingBottom: Math.max(24, insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.content, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {activeMenu === 'perfil' ? (
            <>
              {renderHeader()}
              {renderFormSection()}
            </>
          ) : activeMenu === 'pedidos' ? (
            <>
              {renderPedidosHeader()}
              <View style={styles.modalContent}>
                {renderPedidosContent()}
              </View>
            </>
          ) : activeMenu === 'aceitos' ? (
            <>
              {renderPedidosAceitosHeader()}
              <View style={styles.modalContent}>
                {renderPedidosAceitosContent()}
              </View>
            </>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topMenu: {
    paddingBottom: 10,
    paddingHorizontal: 5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1000,
  },
  menuItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  menuButtonContainer: {
    position: 'relative',
  },
  menuButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 70,
  },
  menuButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  menuButtonTextActive: {
    color: '#D32F2F',
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6F00',
  },
  aceitosBadge: {
    backgroundColor: '#4CAF50',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 20,
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: '#D32F2F',
  },
  onlineIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bloodTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bloodTypeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  formCard: {
    margin: 20,
    marginTop: -20,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  formGradient: {
    padding: 25,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginLeft: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFF',
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    elevation: 2,
  },
  picker: {
    height: 55,
  },
  availabilityCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  availabilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availabilityText: {
    marginLeft: 12,
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 4,
  },
  availabilitySubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  locationCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  locationStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 14,
    color: '#6B7280',
  },
  locationButton: {
    borderColor: '#D32F2F',
    borderWidth: 1,
    borderRadius: 12,
  },
  locationButtonContent: {
    height: 50,
  },
  locationButtonText: {
    color: '#D32F2F',
    fontWeight: '600',
    fontSize: 16,
  },
  countdownText: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
  },
  shareLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  shareLocationLabel: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  historicoCard: {
    padding: 16,
    borderRadius: 12,
  },
  historicoEmpty: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 12,
  },
  historicoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historicoText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
  },
  actionsSection: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonContent: {
    height: 55,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '500',
  },
  pedidosHeader: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pedidosHeaderContent: {
    alignItems: 'center',
  },
  pedidosTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  pedidosSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 8,
  },
  modalContent: {
    padding: 20,
    paddingTop: 10,
  },
  pedidoCard: {
    marginBottom: 20,
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
     borderLeftWidth: 4,
  },
  aceitoCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  pedidoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pedidoInfo: {
    flex: 1,
    marginRight: 12,
  },
  pedidoSolicitante: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
  },
  pedidoHospital: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  urgenciaBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  urgenciaText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  pedidoDetails: {
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailText: {
    fontSize: 15,
    color: '#4B5563',
    marginLeft: 10,
    flex: 1,
  },
  contactActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  contactActionButton: {
    flex: 1,
    backgroundColor: '#D32F2F',
    borderRadius: 10,
    elevation: 3,
  },
  smsButton: {
    backgroundColor: '#FF9800',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  contactButtonContent: {
    height: 45,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aceitarButton: {
    borderColor: '#D32F2F',
    borderWidth: 2,
    borderRadius: 12,
  },
  aceitarButtonAceito: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  aceitarButtonContent: {
    height: 50,
  },
  aceitarButtonText: {
    color: '#D32F2F',
    fontWeight: 'bold',
    fontSize: 16,
  },
  aceitarButtonTextAceito: {
    color: '#FFFFFF',
  },
  aceitoActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  cancelarButton: {
    flex: 1,
    borderColor: '#757575',
    borderWidth: 1,
    borderRadius: 12,
  },
  finalizarButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
  },
  cancelarButtonText: {
    color: '#757575',
    fontWeight: '600',
  },
  finalizarButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loadingContainerModal: {
    padding: 40,
    alignItems: 'center',
  },
  loadingTextModal: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
});