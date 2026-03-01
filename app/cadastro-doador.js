import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  Animated, 
  ScrollView, 
  TouchableOpacity, 
  Linking,
  TextInput,
  Pressable,
  Platform,
  Dimensions
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { auth, db } from '../src/services/firebase';
import { FontAwesome } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');
const TERMOS_USO_URL = 'https://exemplo.com/termos-bloodmap';

const tiposSanguineos = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export default function TelaCadastroDoador() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [sexo, setSexo] = useState('M');
  const [tipoSanguineo, setTipoSanguineo] = useState('O+');
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showSexoPicker, setShowSexoPicker] = useState(false);
  const [showTipoPicker, setShowTipoPicker] = useState(false);

  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 300, 
      useNativeDriver: true 
    }).start();
    obterLocalizacao();
  }, []);

  const obterLocalizacao = async () => {
    setLocationLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({ 
          accuracy: Location.Accuracy.High 
        });
        setLocation(loc);
      } else {
        Alert.alert('Permissão Necessária', 'Precisamos da sua localização para conectar você com quem precisa de ajuda.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível obter a localização.');
    }
    setLocationLoading(false);
  };

  const validar = () => {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return false;
    }
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe seu nome completo.');
      return false;
    }
    if (!telefone.trim()) {
      Alert.alert('Atenção', 'Informe seu telefone.');
      return false;
    }
    if (!location) {
      Alert.alert('Atenção', 'Precisamos da sua localização.');
      return false;
    }
    if (senha.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
      return false;
    }
    if (!termosAceitos) {
      Alert.alert('Atenção', 'Você precisa aceitar os termos de uso.');
      return false;
    }
    return true;
  };

  const handleCadastro = async () => {
    if (!validar()) return;

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      await setDoc(doc(db, 'usuarios', user.uid), {
        nome: nome.trim(),
        sexo,
        tipoSanguineo,
        telefone: telefone.trim(),
        email: email.trim(),
        localizacao: { 
          lat: location.coords.latitude, 
          lng: location.coords.longitude 
        },
        disponivel: true,
        termosAceitos: true,
        termosAceitosEm: new Date().toISOString(),
        compartilharLocalizacao: true,
        historicoDoacoes: [],
        createdAt: new Date().toISOString(),
      });

      Alert.alert(
        '✅ Cadastro Concluído!', 
        'Agora você faz parte da nossa rede de doadores.',
        [{ text: 'Ver Perfil', onPress: () => router.push('/perfil') }]
      );
    } catch (error) {
      let mensagem = 'Não foi possível completar o cadastro.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          mensagem = 'Este e-mail já está em uso.';
          break;
        case 'auth/invalid-email':
          mensagem = 'E-mail inválido.';
          break;
        case 'auth/weak-password':
          mensagem = 'Senha muito fraca. Use pelo menos 6 caracteres.';
          break;
      }
      Alert.alert('Erro', mensagem);
    }
    setLoading(false);
  };

  const PickerModal = ({ visible, onClose, options, selected, onSelect, title }) => {
    if (!visible) return null;

    return (
      <View style={styles.pickerModal}>
        <View style={styles.pickerContent}>
          <Text style={styles.pickerTitle}>{title}</Text>
          {options.map((option) => (
            <Pressable
              key={option}
              style={[
                styles.pickerOption,
                selected === option && styles.pickerOptionSelected
              ]}
              onPress={() => {
                onSelect(option);
                onClose();
              }}
            >
              <Text style={[
                styles.pickerOptionText,
                selected === option && styles.pickerOptionTextSelected
              ]}>
                {option === 'M' ? 'Masculino' : 
                 option === 'F' ? 'Feminino' : option}
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
      
      {/* Header Fixo */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <FontAwesome name="heart" size={20} color="white" />
          <Text style={styles.headerTitle}>Novo Doador</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          
          {/* Header do Conteúdo */}
          <View style={styles.contentHeader}>
            <View style={styles.iconContainer}>
              <FontAwesome name="heart" size={30} color="#E53935" />
            </View>
            <Text style={styles.title}>Torne-se um Doador</Text>
            <Text style={styles.subtitle}>
              Faça parte da nossa rede e salve vidas
            </Text>
          </View>

          {/* Formulário */}
          <View style={styles.form}>

            {/* E-mail */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>E-mail</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <FontAwesome name="envelope" size={16} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Senha */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Senha</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <FontAwesome name="lock" size={16} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#999"
                  secureTextEntry
                />
              </View>
            </View>

            {/* Nome */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Nome Completo</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <FontAwesome name="user" size={16} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Digite seu nome"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Telefone */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Telefone</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <FontAwesome name="phone" size={16} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Sexo */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Sexo</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <Pressable
                style={styles.picker}
                onPress={() => setShowSexoPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {sexo === 'M' ? 'Masculino' : 'Feminino'}
                </Text>
                <FontAwesome name="chevron-down" size={14} color="#666" />
              </Pressable>
            </View>

            {/* Tipo Sanguíneo */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Tipo Sanguíneo</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <Pressable
                style={styles.picker}
                onPress={() => setShowTipoPicker(true)}
              >
                <Text style={styles.pickerText}>{tipoSanguineo}</Text>
                <FontAwesome name="chevron-down" size={14} color="#666" />
              </Pressable>
            </View>

            {/* Termos */}
            <Pressable 
              style={styles.termosRow}
              onPress={() => setTermosAceitos(!termosAceitos)}
            >
              <View style={[styles.checkbox, termosAceitos && styles.checkboxChecked]}>
                {termosAceitos && <FontAwesome name="check" size={12} color="white" />}
              </View>
              <Text style={styles.termosText}>
                Li e aceito os{' '}
                <Text style={styles.termosLink} onPress={() => Linking.openURL(TERMOS_USO_URL)}>
                  termos de uso
                </Text>
                <Text style={styles.required}> *</Text>
              </Text>
            </Pressable>

            {/* Localização */}
            <View style={styles.locationCard}>
              <View style={styles.locationRow}>
                <FontAwesome 
                  name={location ? "check-circle" : "map-marker"} 
                  size={16} 
                  color={location ? "#4CAF50" : "#E53935"} 
                />
                <Text style={[styles.locationText, location && styles.locationTextOk]}>
                  {location ? 'Localização obtida' : 'Aguardando localização...'}
                </Text>
                {!location && (
                  <TouchableOpacity onPress={obterLocalizacao} disabled={locationLoading}>
                    <Text style={styles.locationButton}>
                      {locationLoading ? '...' : 'Obter'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {location && (
                <Text style={styles.locationCoords}>
                  {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
                </Text>
              )}
            </View>

            {/* Botão Cadastrar */}
            <TouchableOpacity
              style={[
                styles.registerButton,
                (loading || !location) && styles.registerButtonDisabled
              ]}
              onPress={handleCadastro}
              disabled={loading || !location}
            >
              <Text style={styles.registerButtonText}>
                {loading ? 'Cadastrando...' : 'Registrar e Tornar-se Doador'}
              </Text>
            </TouchableOpacity>

            {/* Links */}
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.linkText}>Já tem conta? Fazer login</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.linkText}>← Voltar para o Mapa</Text>
            </TouchableOpacity>

          </View>
        </Animated.View>
      </ScrollView>

      {/* Modais */}
      <PickerModal
        visible={showSexoPicker}
        onClose={() => setShowSexoPicker(false)}
        options={['M', 'F']}
        selected={sexo}
        onSelect={setSexo}
        title="Selecione o sexo"
      />

      <PickerModal
        visible={showTipoPicker}
        onClose={() => setShowTipoPicker(false)}
        options={tiposSanguineos}
        selected={tipoSanguineo}
        onSelect={setTipoSanguineo}
        title="Selecione o tipo sanguíneo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 45,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E53935',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 100,
  },
  backBtn: {
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
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  scroll: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  contentHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E53935',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignSelf: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  required: {
    fontSize: 14,
    color: '#E53935',
    marginLeft: 4,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: 'white',
    height: 42,
  },
  inputIcon: {
    paddingHorizontal: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 6,
    paddingRight: 10,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'white',
    height: 42,
  },
  pickerText: {
    fontSize: 14,
    color: '#333',
  },
  termosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E53935',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#E53935',
  },
  termosText: {
    flex: 1,
    fontSize: 12,
    color: '#333',
  },
  termosLink: {
    color: '#E53935',
    fontWeight: '600',
  },
  locationCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  locationTextOk: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  locationButton: {
    color: '#E53935',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  locationCoords: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    marginLeft: 22,
  },
  registerButton: {
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  registerButtonDisabled: {
    backgroundColor: '#FFCDD2',
  },
  registerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#666',
    fontSize: 12,
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
    padding: 16,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 2,
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
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  pickerCloseText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
});