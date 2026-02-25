import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, Animated, ScrollView } from 'react-native';
import { Card, Button, TextInput, Title, Paragraph } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { auth, db } from '../src/services/firebase';
import { FontAwesome } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function TelaCadastroDoador() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipoSanguineo, setTipoSanguineo] = useState('O+');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    obterLocalizacao();
  }, []);

  const obterLocalizacao = async () => {
    setLocationLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(loc);
      } else {
        Alert.alert('Permissão Necessária', 'Precisamos da sua localização para conectar você com quem precisa de ajuda.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível obter a localização.');
    }
    setLocationLoading(false);
  };

  const handleCadastroCompleto = async () => {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return;
    }

    if (!nome.trim()) {
      Alert.alert('Atenção', 'Por favor, informe seu nome completo.');
      return;
    }

    if (!telefone.trim()) {
      Alert.alert('Atenção', 'Por favor, informe seu telefone para contato.');
      return;
    }

    if (!location) {
      Alert.alert('Atenção', 'Precisamos da sua localização para conectar você com pessoas próximas.');
      return;
    }

    if (senha.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      await setDoc(doc(db, 'usuarios', user.uid), {
        nome: nome.trim(),
        tipoSanguineo,
        telefone: telefone.trim(),
        email: email.trim(),
        localizacao: { 
          lat: location.coords.latitude, 
          lng: location.coords.longitude 
        },
        disponivel: true,
        createdAt: new Date().toISOString(),
      });

      Alert.alert(
        '🎉 Cadastro Concluído!', 
        'Agora você faz parte da nossa rede de doadores. Sua ajuda pode salvar vidas!',
        [{ text: 'Ver Meu Perfil', onPress: () => router.push('/perfil') }]
      );
    } catch (error) {
      let mensagemErro = 'Não foi possível completar o cadastro. Tente novamente.';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          mensagemErro = 'Este e-mail já está em uso.';
          break;
        case 'auth/invalid-email':
          mensagemErro = 'E-mail inválido.';
          break;
        case 'auth/weak-password':
          mensagemErro = 'Senha muito fraca. Use pelo menos 6 caracteres.';
          break;
        default:
          mensagemErro = error.message;
      }
      
      Alert.alert('Erro', mensagemErro);
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <LinearGradient colors={['#DC2626', '#B91C1C']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <FontAwesome name="heart" size={32} color="#FFF" />
            </View>
            <Text style={styles.title}>Torne-se um Doador</Text>
            <Text style={styles.subtitle}>
              Cadastre-se e faça parte da nossa rede de doadores
            </Text>
          </View>

          <Card style={styles.formCard}>
            <LinearGradient colors={['#FFF', '#FEF2F2']} style={styles.formGradient}>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dados de Acesso</Text>
                
                <View style={styles.inputGroup}>
                  <TextInput
                    label="E-mail *"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    outlineColor="#E5E5E5"
                    activeOutlineColor="#DC2626"
                    left={<TextInput.Icon icon="email" color="#666" />}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <TextInput
                    label="Senha *"
                    value={senha}
                    onChangeText={setSenha}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    outlineColor="#E5E5E5"
                    activeOutlineColor="#DC2626"
                    left={<TextInput.Icon icon="lock" color="#666" />}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dados Pessoais</Text>
                
                <View style={styles.inputGroup}>
                  <TextInput
                    label="Nome Completo *"
                    value={nome}
                    onChangeText={setNome}
                    mode="outlined"
                    style={styles.input}
                    outlineColor="#E5E5E5"
                    activeOutlineColor="#DC2626"
                    placeholder="Digite seu nome completo"
                    left={<TextInput.Icon icon="account" color="#666" />}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <TextInput
                    label="Telefone *"
                    value={telefone}
                    onChangeText={setTelefone}
                    keyboardType="phone-pad"
                    mode="outlined"
                    style={styles.input}
                    outlineColor="#E5E5E5"
                    activeOutlineColor="#DC2626"
                    placeholder="(00) 00000-0000"
                    left={<TextInput.Icon icon="phone" color="#666" />}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Seu Tipo Sanguíneo *</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={tipoSanguineo}
                      onValueChange={setTipoSanguineo}
                      style={styles.picker}
                    >
                      <Picker.Item label="O+" value="O+" />
                      <Picker.Item label="O-" value="O-" />
                      <Picker.Item label="A+" value="A+" />
                      <Picker.Item label="A-" value="A-" />
                      <Picker.Item label="B+" value="B+" />
                      <Picker.Item label="B-" value="B-" />
                      <Picker.Item label="AB+" value="AB+" />
                      <Picker.Item label="AB-" value="AB-" />
                    </Picker>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Localização</Text>
                <Card style={styles.locationCard}>
                  <View style={styles.locationContent}>
                    <FontAwesome name="map-marker" size={20} color="#DC2626" />
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.locationStatus}>
                        {location ? 'Localização obtida ✓' : 'Aguardando localização...'}
                      </Text>
                      <Text style={styles.locationCoords}>
                        {location 
                          ? `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`
                          : 'Clique no botão abaixo para obter'
                        }
                      </Text>
                    </View>
                  </View>
                </Card>
                
                <Button
                  icon="crosshairs-gps"
                  mode="outlined"
                  onPress={obterLocalizacao}
                  loading={locationLoading}
                  disabled={locationLoading}
                  style={styles.locationButton}
                  contentStyle={styles.locationButtonContent}
                >
                  {locationLoading ? 'Obtendo...' : 'Atualizar Localização'}
                </Button>
              </View>

              <Button
                icon="heart-plus"
                mode="contained"
                onPress={handleCadastroCompleto}
                loading={loading}
                disabled={loading || !location}
                style={styles.primaryButton}
                contentStyle={styles.buttonContent}
              >
                {loading ? 'Cadastrando...' : 'Registrar e Tornar-se Doador'}
              </Button>

              <Button 
                mode="text" 
                onPress={() => router.push('/login')}
                style={styles.loginButton}
                labelStyle={styles.loginButtonText}
                icon="login"
              >
                Já tem uma conta? Fazer login
              </Button>

              <Button
                icon="arrow-left"
                mode="text"
                onPress={() => router.push('/')}
                style={styles.backButton}
                labelStyle={styles.backButtonText}
              >
                Voltar para o Mapa
              </Button>

            </LinearGradient>
          </Card>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  formCard: {
    width: width * 0.9,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#0f0404ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    marginBottom:30,
  },
  formGradient: {
    padding: 25,
  },
  section: {
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#DC2626',
    paddingBottom: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  picker: {
    height: 50,
  },
  locationCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  locationStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 2,
  },
  locationCoords: {
    fontSize: 12,
    color: '#666',
  },
  locationButton: {
    borderColor: '#DC2626',
    borderRadius: 8,
  },
  locationButtonContent: {
    paddingVertical: 6,
  },
  primaryButton: {
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginBottom: 15,
    backgroundColor: '#DC2626',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  loginButton: {
    marginBottom: 15,
  },
  loginButtonText: {
    color: '#666',
  },
  backButton: {
    marginTop: 10,
  },
  backButtonText: {
    color: '#666',
   
  },
});