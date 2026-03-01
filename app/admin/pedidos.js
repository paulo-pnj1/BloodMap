import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Alert, 
  Animated,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

export default function AdminPedidos() {
  const insets = useSafeAreaInsets();
  const [pedidos, setPedidos] = useState([]);
  const [filteredPedidos, setFilteredPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  
  // Animação
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    loadPedidos();
  }, []);

  useEffect(() => {
    filterPedidos();
  }, [searchQuery, filterStatus, pedidos]);

  const loadPedidos = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'pedidos'));
      const list = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        status: d.data().status || 'pending'
      }));
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setPedidos(list);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar pedidos.');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const filterPedidos = () => {
    let filtered = [...pedidos];
    if (filterStatus !== 'todos') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.hospital?.toLowerCase().includes(query) ||
        p.tipoSanguineo?.toLowerCase().includes(query)
      );
    }
    setFilteredPedidos(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPedidos();
  };

  const atualizarStatus = async (pedidoId, novoStatus) => {
    Alert.alert(
      'Confirmar',
      `Marcar como ${novoStatus === 'accepted' ? 'atendido' : 'cancelado'}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'pedidos', pedidoId), {
                status: novoStatus,
                updatedAt: new Date().toISOString(),
              });
              loadPedidos();
            } catch (e) {
              Alert.alert('Erro', 'Falha ao atualizar status.');
            }
          },
        },
      ]
    );
  };

  const excluirPedido = (pedidoId) => {
    Alert.alert(
      'Excluir',
      'Deseja excluir este pedido?',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'pedidos', pedidoId));
              loadPedidos();
            } catch (e) {
              Alert.alert('Erro', 'Falha ao excluir pedido.');
            }
          },
        },
      ]
    );
  };

  const LoadingIndicator = () => (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#E53935" />
    </View>
  );

  const StatusBadge = ({ status }) => {
    const colors = {
      pending: { bg: '#FFF3E0', text: '#F57C00', label: 'Pendente' },
      accepted: { bg: '#E8F5E9', text: '#2E7D32', label: 'Atendido' },
      cancelled: { bg: '#FFEBEE', text: '#C62828', label: 'Cancelado' }
    };
    const style = colors[status] || colors.pending;
    
    return (
      <View style={[styles.badge, { backgroundColor: style.bg }]}>
        <Text style={[styles.badgeText, { color: style.text }]}>{style.label}</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    return (
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.row}>
            <View style={styles.hospitalRow}>
              <MaterialCommunityIcons name="hospital" size={18} color="#E53935" />
              <Text style={styles.hospital} numberOfLines={1}>
                {item.hospital || 'Hospital'}
              </Text>
            </View>
            <StatusBadge status={item.status} />
          </View>

          {/* Info Row */}
          <View style={styles.row}>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="blood-bag" size={16} color="#E53935" />
              <Text style={styles.infoText}>{item.tipoSanguineo || 'N/I'}</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons 
                name={item.urgencia === 'alta' ? 'alert' : 'clock'} 
                size={16} 
                color={item.urgencia === 'alta' ? '#E53935' : '#F57C00'} 
              />
              <Text style={[styles.infoText, { color: item.urgencia === 'alta' ? '#E53935' : '#F57C00' }]}>
                {item.urgencia || 'Alta'}
              </Text>
            </View>
          </View>

          {/* Contact Row */}
          <View style={styles.row}>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="account" size={14} color="#666" />
              <Text style={styles.contactText}>{item.solicitante || 'N/I'}</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="phone" size={14} color="#666" />
              <Text style={styles.contactText}>{item.telefone || 'N/I'}</Text>
            </View>
          </View>

          {/* Date */}
          <Text style={styles.date}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : ''}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {item.status !== 'accepted' && (
              <TouchableOpacity 
                onPress={() => atualizarStatus(item.id, 'accepted')}
                style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]}
              >
                <MaterialCommunityIcons name="check" size={18} color="#2E7D32" />
              </TouchableOpacity>
            )}
            {item.status !== 'cancelled' && (
              <TouchableOpacity 
                onPress={() => atualizarStatus(item.id, 'cancelled')}
                style={[styles.actionBtn, { backgroundColor: '#FFF3E0' }]}
              >
                <MaterialCommunityIcons name="close" size={18} color="#F57C00" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => excluirPedido(item.id)}
              style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
            >
              <MaterialCommunityIcons name="delete" size={18} color="#C62828" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const FilterChip = ({ status, label, isSelected, onPress, count }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        isSelected && styles.chipSelected
      ]}
    >
      <Text style={[
        styles.chipText,
        isSelected && styles.chipTextSelected
      ]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  // ActivityIndicator nativo
  const ActivityIndicator = ({ size, color }) => (
    <View style={styles.activityIndicator}>
      <MaterialCommunityIcons name="loading" size={size === 'large' ? 40 : 20} color={color} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Pedidos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#999" />
          <TextInput
            placeholder="Buscar hospital ou tipo sanguíneo..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#999"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close" size={18} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip
            status="todos"
            label="Todos"
            isSelected={filterStatus === 'todos'}
            onPress={() => setFilterStatus('todos')}
            count={pedidos.length}
          />
          <FilterChip
            status="pending"
            label="Pendentes"
            isSelected={filterStatus === 'pending'}
            onPress={() => setFilterStatus('pending')}
            count={pedidos.filter(p => p.status === 'pending').length}
          />
          <FilterChip
            status="accepted"
            label="Atendidos"
            isSelected={filterStatus === 'accepted'}
            onPress={() => setFilterStatus('accepted')}
            count={pedidos.filter(p => p.status === 'accepted').length}
          />
          <FilterChip
            status="cancelled"
            label="Cancelados"
            isSelected={filterStatus === 'cancelled'}
            onPress={() => setFilterStatus('cancelled')}
            count={pedidos.filter(p => p.status === 'cancelled').length}
          />
        </ScrollView>
      </View>

      {/* Results count */}
      <View style={styles.resultCount}>
        <Text style={styles.resultText}>
          {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List */}
      {filteredPedidos.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="clipboard-text" size={60} color="#DDD" />
          <Text style={styles.emptyText}>Nenhum pedido encontrado</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPedidos}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(24, insets.bottom) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={['#E53935']}
              tintColor="#E53935"
            />
          }
        />
      )}
    </View>
  );
}

// Componente de loading customizado
const ActivityIndicator = ({ size, color }) => (
  <View style={styles.activityIndicator}>
    <MaterialCommunityIcons 
      name="loading" 
      size={size === 'large' ? 40 : 20} 
      color={color} 
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  activityIndicator: {
    transform: [{ rotate: '0deg' }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
     backgroundColor: '#e30505',
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'white',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    color: '#333',
    padding: 0,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#E53935',
  },
  chipText: {
    fontSize: 12,
    color: '#666',
  },
  chipTextSelected: {
    color: 'white',
  },
  resultCount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultText: {
    fontSize: 13,
    color: '#666',
  },
  list: {
    padding: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardContent: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  hospital: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#333',
  },
  contactText: {
    fontSize: 12,
    color: '#666',
  },
  date: {
    fontSize: 10,
    color: '#999',
    textAlign: 'right',
    marginVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});