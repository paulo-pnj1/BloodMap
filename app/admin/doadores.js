import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Alert, 
  TouchableOpacity,
  ScrollView 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

export default function AdminDoadores() {
  const insets = useSafeAreaInsets();
  const [doadores, setDoadores] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDoadores();
  }, []);

  const loadDoadores = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'usuarios'));
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setDoadores(list);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar doadores.');
    }
    setLoading(false);
  };

  const filtered = doadores.filter(d => {
    if (filtroTipo !== 'todos' && d.tipoSanguineo !== filtroTipo) return false;
    if (filtroStatus === 'disponivel' && !d.disponivel) return false;
    if (filtroStatus === 'indisponivel' && d.disponivel) return false;
    return true;
  });

  const registrarDoacao = async (doador) => {
    if (!doador.disponivel) {
      Alert.alert('Aviso', 'Doador já está indisponível.');
      return;
    }
    Alert.alert(
      'Registrar doação',
      `Confirmar doação de ${doador.nome}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          onPress: async () => {
            try {
              const now = new Date().toISOString();
              await updateDoc(doc(db, 'usuarios', doador.id), {
                ultimaDoacao: now,
                disponivel: false,
                historicoDoacoes: arrayUnion({ data: now, hospital: 'Hospital' }),
                updatedAt: now,
              });
              Alert.alert('Sucesso', 'Doação registrada!');
              loadDoadores();
            } catch (e) {
              Alert.alert('Erro', 'Falha ao registrar doação.');
            }
          },
        },
      ]
    );
  };

  const StatusBadge = ({ disponivel }) => (
    <View style={[styles.badge, { backgroundColor: disponivel ? '#E8F5E9' : '#FFEBEE' }]}>
      <Text style={[styles.badgeText, { color: disponivel ? '#2E7D32' : '#C62828' }]}>
        {disponivel ? 'Disponível' : 'Indisponível'}
      </Text>
    </View>
  );

  const TipoChip = ({ tipo, isSelected, onPress }) => (
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
        {tipo}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        {/* Header */}
        <View style={styles.row}>
          <View style={styles.nameContainer}>
            <MaterialCommunityIcons name="account" size={18} color="#666" />
            <Text style={styles.name}>{item.nome || 'Sem nome'}</Text>
          </View>
          <StatusBadge disponivel={item.disponivel} />
        </View>

        {/* Info Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="blood-bag" size={14} color="#E53935" />
            <Text style={styles.infoText}>{item.tipoSanguineo || 'N/I'}</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="phone" size={14} color="#666" />
            <Text style={styles.infoText}>{item.telefone || 'N/I'}</Text>
          </View>
        </View>

        {/* Localização */}
        {item.localizacao && item.compartilharLocalizacao !== false && (
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker" size={12} color="#999" />
            <Text style={styles.locationText}>
              {item.localizacao.lat?.toFixed(4)}, {item.localizacao.lng?.toFixed(4)}
            </Text>
          </View>
        )}

        {/* Última doação */}
        {item.ultimaDoacao && (
          <Text style={styles.lastDonation}>
            Última doação: {new Date(item.ultimaDoacao).toLocaleDateString('pt-BR')}
          </Text>
        )}

        {/* Botão de ação */}
        {item.disponivel && (
          <TouchableOpacity
            onPress={() => registrarDoacao(item)}
            style={styles.registerButton}
          >
            <MaterialCommunityIcons name="check-circle" size={16} color="#2E7D32" />
            <Text style={styles.registerText}>Registrar Doação</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <Text style={styles.loadingText}>Carregando doadores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header - safe area */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Doadores</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TipoChip 
            tipo="Todos" 
            isSelected={filtroTipo === 'todos'} 
            onPress={() => setFiltroTipo('todos')}
          />
          {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(tipo => (
            <TipoChip 
              key={tipo}
              tipo={tipo}
              isSelected={filtroTipo === tipo}
              onPress={() => setFiltroTipo(tipo)}
            />
          ))}
        </ScrollView>

        <View style={styles.statusFilters}>
          <TouchableOpacity
            onPress={() => setFiltroStatus('todos')}
            style={[
              styles.statusChip,
              filtroStatus === 'todos' && styles.statusChipSelected
            ]}
          >
            <Text style={[
              styles.statusChipText,
              filtroStatus === 'todos' && styles.statusChipTextSelected
            ]}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFiltroStatus('disponivel')}
            style={[
              styles.statusChip,
              filtroStatus === 'disponivel' && styles.statusChipSelected
            ]}
          >
            <Text style={[
              styles.statusChipText,
              filtroStatus === 'disponivel' && styles.statusChipTextSelected
            ]}>Disponíveis</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFiltroStatus('indisponivel')}
            style={[
              styles.statusChip,
              filtroStatus === 'indisponivel' && styles.statusChipSelected
            ]}
          >
            <Text style={[
              styles.statusChipText,
              filtroStatus === 'indisponivel' && styles.statusChipTextSelected
            ]}>Indisponíveis</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contador */}
      <View style={styles.resultCount}>
        <Text style={styles.resultText}>
          {filtered.length} doador{filtered.length !== 1 ? 'es' : ''}
        </Text>
      </View>

      {/* Lista */}
      {filtered.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-group" size={60} color="#DDD" />
          <Text style={styles.emptyText}>Nenhum doador encontrado</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(24, insets.bottom) }]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  filtersContainer: {
    backgroundColor: 'white',
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#E53935',
  },
  chipText: {
    fontSize: 13,
    color: '#666',
  },
  chipTextSelected: {
    color: 'white',
  },
  statusFilters: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    marginRight: 8,
  },
  statusChipSelected: {
    backgroundColor: '#E53935',
  },
  statusChipText: {
    fontSize: 12,
    color: '#666',
  },
  statusChipTextSelected: {
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
    marginBottom: 10,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  name: {
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
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 16,
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#999',
  },
  lastDonation: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    marginBottom: 8,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  registerText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});