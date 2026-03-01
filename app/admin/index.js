import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  RefreshControl,
  Animated 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';
import { auth, db } from '../../src/services/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ 
    doadores: 0, 
    disponiveis: 0, 
    indisponiveis: 0, 
    pedidos: 0,
    pedidosAtivos: 0 
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminName, setAdminName] = useState('');
  
  // Animação
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (!auth.currentUser) {
      router.replace('/admin/login');
      return;
    }
    
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const adminSnap = await getDoc(doc(db, 'admins', auth.currentUser.uid));
      
      if (!adminSnap.exists()) {
        await signOut(auth);
        router.replace('/admin/login');
        return;
      }
      
      const adminData = adminSnap.data();
      setAdminName(adminData?.nome?.split(' ')[0] || 'Admin');
      loadStats();
    } catch (error) {
      router.replace('/admin/login');
    }
  };

  const loadStats = async () => {
    try {
      const [usersSnap, pedidosSnap] = await Promise.all([
        getDocs(collection(db, 'usuarios')),
        getDocs(collection(db, 'pedidos')),
      ]);
      
      const doadores = usersSnap.docs.map(d => ({ ...d.data() }));
      const disponiveis = doadores.filter(d => d.disponivel === true);
      const pedidosAtivos = pedidosSnap.docs.filter(p => p.data().status === 'ativo' || !p.data().status).length;
      
      setStats({
        doadores: doadores.length,
        disponiveis: disponiveis.length,
        indisponiveis: doadores.length - disponiveis.length,
        pedidos: pedidosSnap.size,
        pedidosAtivos
      });
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar estatísticas.');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Deseja sair do painel?',
      [
        { text: 'Não', style: 'cancel' },
        { 
          text: 'Sim', 
          onPress: async () => {
            await signOut(auth);
            router.replace('/admin/login');
          }
        }
      ]
    );
  };

  const StatCard = ({ icon, value, label, color }) => (
    <View style={styles.statCard}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const MenuButton = ({ icon, title, subtitle, colors, onPress }) => (
    <TouchableOpacity 
      style={styles.menuButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, { backgroundColor: colors[0] }]}>
        <MaterialCommunityIcons name={icon} size={28} color="white" />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header - safe area top */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {adminName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.welcome}>Olá,</Text>
              <Text style={styles.name}>{adminName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutIcon}>
            <MaterialCommunityIcons name="logout" size={22} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* Stats Preview */}
        <View style={styles.statsPreview}>
          <View style={styles.previewItem}>
            <Text style={styles.previewValue}>{stats.doadores}</Text>
            <Text style={styles.previewLabel}>Doadores</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewItem}>
            <Text style={styles.previewValue}>{stats.pedidosAtivos}</Text>
            <Text style={styles.previewLabel}>Ativos</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewItem}>
            <Text style={styles.previewValue}>{stats.disponiveis}</Text>
            <Text style={styles.previewLabel}>Disponíveis</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#E53935']} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Stats Grid */}
          <Text style={styles.sectionTitle}>Visão Geral</Text>
          <View style={styles.statsGrid}>
            <StatCard 
              icon="account-group" 
              value={stats.doadores} 
              label="Total" 
              color="#E53935"
            />
            <StatCard 
              icon="check-circle" 
              value={stats.disponiveis} 
              label="Disponíveis" 
              color="#4CAF50"
            />
            <StatCard 
              icon="cancel" 
              value={stats.indisponiveis} 
              label="Indisponíveis" 
              color="#9E9E9E"
            />
            <StatCard 
              icon="clipboard-text" 
              value={stats.pedidos} 
              label="Pedidos" 
              color="#FF9800"
            />
          </View>

          {/* Active Orders Alert */}
          {stats.pedidosAtivos > 0 && (
            <View style={styles.alertBox}>
              <MaterialCommunityIcons name="bell-ring" size={20} color="#E53935" />
              <Text style={styles.alertText}>
                {stats.pedidosAtivos} pedido{stats.pedidosAtivos > 1 ? 's' : ''} ativo{stats.pedidosAtivos > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Menu */}
          <Text style={styles.sectionTitle}>Menu</Text>
          
          <MenuButton
            icon="account-heart"
            title="Doadores"
            subtitle="Gerenciar lista de doadores"
            colors={['#4A90E2']}
            onPress={() => router.push('/admin/doadores')}
          />
          
          <MenuButton
            icon="clipboard-list"
            title="Pedidos"
            subtitle="Histórico de pedidos"
            colors={['#FF9800']}
            onPress={() => router.push('/admin/pedidos')}
          />
          
          <MenuButton
            icon="alert"
            title="Pedido Urgente"
            subtitle="Criar nova solicitação"
            colors={['#E53935']}
            onPress={() => router.push('/admin/criar-pedido')}
          />
          
          <MenuButton
            icon="bullhorn"
            title="Campanhas"
            subtitle="Enviar comunicação"
            colors={['#9C27B0']}
            onPress={() => router.push('/admin/campanhas')}
          />
        </Animated.View>
      </ScrollView>
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
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#E53935',
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  welcome: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    padding: 12,
  },
  previewItem: {
    alignItems: 'center',
  },
  previewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  previewLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  previewDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#E53935',
    fontWeight: '600',
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#999',
  },
});