import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, ScrollView } from 'react-native';
import { Card, Button, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { router } from 'expo-router';
import { auth } from '../src/services/firebase';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function TelaLoginDoador() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [lembrarLogin, setLembrarLogin] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [tipoErro, setTipoErro] = useState(''); // 'warning', 'error', 'info'
  const fadeAnim = useState(new Animated.Value(0))[0];

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    carregarDadosSalvos();
  }, []);

  // Carregar dados salvos ao iniciar o componente
  const carregarDadosSalvos = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      const savedPassword = await AsyncStorage.getItem('savedPassword');
      const rememberMe = await AsyncStorage.getItem('rememberLogin');
      
      if (savedEmail && savedPassword && rememberMe === 'true') {
        setEmail(savedEmail);
        setSenha(savedPassword);
        setLembrarLogin(true);
      }
    } catch (error) {
      console.log('Erro ao carregar dados salvos:', error);
      mostrarErro('Erro ao carregar dados salvos', 'warning');
    }
  };

  // Salvar dados de login
  const salvarDadosLogin = async (email, senha) => {
    try {
      if (lembrarLogin) {
        await AsyncStorage.setItem('savedEmail', email);
        await AsyncStorage.setItem('savedPassword', senha);
        await AsyncStorage.setItem('rememberLogin', 'true');
      } else {
        // Se não quiser lembrar, remove os dados salvos
        await AsyncStorage.removeItem('savedEmail');
        await AsyncStorage.removeItem('savedPassword');
        await AsyncStorage.setItem('rememberLogin', 'false');
      }
    } catch (error) {
      console.log('Erro ao salvar dados:', error);
      throw new Error('Não foi possível salvar os dados de login');
    }
  };

  // Alternar visibilidade da senha
  const toggleMostrarSenha = () => {
    setMostrarSenha(!mostrarSenha);
  };

  // Função para mostrar erros personalizados
  const mostrarErro = (mensagem, tipo = 'error') => {
    setErro(mensagem);
    setTipoErro(tipo);
    
    // Auto-limpar erros após 5 segundos
    setTimeout(() => {
      setErro('');
      setTipoErro('');
    }, 5000);
  };

  // Limpar erros
  const limparErros = () => {
    setErro('');
    setTipoErro('');
  };

  // Validar campos
  const validarCampos = () => {
    try {
      if (!email.trim() || !senha.trim()) {
        mostrarErro('Preencha todos os campos obrigatórios', 'warning');
        return false;
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        mostrarErro('Digite um e-mail válido', 'warning');
        return false;
      }

      // Validar tamanho da senha
      if (senha.length < 6) {
        mostrarErro('A senha deve ter pelo menos 6 caracteres', 'warning');
        return false;
      }

      return true;
    } catch (error) {
      mostrarErro('Erro na validação dos campos', 'error');
      return false;
    }
  };

  const handleLogin = async () => {
    try {
      // Limpar erros anteriores
      limparErros();

      // Validar campos
      if (!validarCampos()) {
        return;
      }

      setLoading(true);

      // Tentar autenticação com Firebase
      await signInWithEmailAndPassword(auth, email, senha);
      
      // Salvar dados se o usuário marcou "Lembrar login"
      try {
        await salvarDadosLogin(email, senha);
      } catch (saveError) {
        console.log('Aviso: Não foi possível salvar dados de login:', saveError.message);
        // Não impedir o login se falhar ao salvar
        mostrarErro('Login realizado, mas não foi possível salvar os dados para próximo acesso', 'info');
      }
      
      // Login bem-sucedido - navega diretamente para o perfil
      router.push('/perfil');
      
    } catch (error) {
      console.log('Erro no login:', error);
      
      // Tratamento personalizado de erros do Firebase
      let mensagemErro = '';
      let tipoMensagem = 'error';

      switch (error.code) {
        case 'auth/invalid-email':
          mensagemErro = '❌ E-mail inválido. Verifique o formato do email.';
          tipoMensagem = 'warning';
          break;
        case 'auth/user-not-found':
          mensagemErro = '👤 Usuário não encontrado. Verifique seu email ou crie uma conta.';
          tipoMensagem = 'warning';
          break;
        case 'auth/wrong-password':
          mensagemErro = '🔒 Senha incorreta. Tente novamente ou recupere sua senha.';
          tipoMensagem = 'error';
          break;
        case 'auth/too-many-requests':
          mensagemErro = '⏰ Muitas tentativas. Tente novamente em alguns minutos.';
          tipoMensagem = 'warning';
          break;
        case 'auth/network-request-failed':
          mensagemErro = '📡 Erro de conexão. Verifique sua internet.';
          tipoMensagem = 'warning';
          break;
        case 'auth/user-disabled':
          mensagemErro = '🚫 Esta conta foi desativada. Entre em contato com o suporte.';
          tipoMensagem = 'error';
          break;
        default:
          mensagemErro = `❌ Erro inesperado: ${error.message}`;
          tipoMensagem = 'error';
      }
      
      mostrarErro(mensagemErro, tipoMensagem);
    } finally {
      setLoading(false);
    }
  };

  // Função para obter estilos baseados no tipo de erro
  const getEstilosErro = () => {
    switch (tipoErro) {
      case 'warning':
        return {
          container: styles.erroWarningContainer,
          text: styles.erroWarningText,
          icon: '⚠️'
        };
      case 'info':
        return {
          container: styles.erroInfoContainer,
          text: styles.erroInfoText,
          icon: 'ℹ️'
        };
      case 'error':
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
    <LinearGradient colors={['#FFF', '#E3F2FD']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <FontAwesome name="heart" size={32} color="#FF4444" />
            </View>
            <Text style={styles.title}>Acessar Conta</Text>
            <Text style={styles.subtitle}>
              Entre para acessar sua conta de doador
            </Text>
          </View>

          {/* Form Card */}
          <Card style={styles.formCard}>
            <LinearGradient colors={['#FFF', '#F8F9FA']} style={styles.formGradient}>
              
              {/* Mensagem de erro personalizada */}
              {erro ? (
                <View style={estilosErro.container}>
                  <Text style={styles.erroIcon}>{estilosErro.icon}</Text>
                  <Text style={estilosErro.text}>{erro}</Text>
                </View>
              ) : null}

              {/* Campos de Login */}
              <View style={styles.inputGroup}>
                <TextInput
                  label="E-mail *"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    limparErros();
                  }}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  outlineColor={tipoErro ? '#FF6B6B' : '#E0E0E0'}
                  activeOutlineColor="#FF4444"
                  left={<TextInput.Icon icon="email" color="#666" />}
                />
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  label="Senha *"
                  value={senha}
                  onChangeText={(text) => {
                    setSenha(text);
                    limparErros();
                  }}
                  mode="outlined"
                  secureTextEntry={!mostrarSenha}
                  style={styles.input}
                  outlineColor={tipoErro ? '#FF6B6B' : '#E0E0E0'}
                  activeOutlineColor="#FF4444"
                  left={<TextInput.Icon icon="lock" color="#666" />}
                  right={
                    <TextInput.Icon 
                      icon={mostrarSenha ? "eye-off" : "eye"} 
                      color="#666"
                      onPress={toggleMostrarSenha}
                    />
                  }
                />
              </View>

              {/* Checkbox Lembrar Login */}
              <View style={styles.rememberContainer}>
                <Button
                  mode={lembrarLogin ? "contained" : "outlined"}
                  onPress={() => setLembrarLogin(!lembrarLogin)}
                  style={styles.rememberButton}
                  icon={lembrarLogin ? "check" : "checkbox-blank-outline"}
                >
                  Lembrar login
                </Button>
              </View>

              {/* Botão Principal */}
              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={[
                  styles.primaryButton,
                  tipoErro === 'error' && styles.buttonError
                ]}
                contentStyle={styles.buttonContent}
                icon="login"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>

              {/* Alternar para Registro */}
              <Button 
                mode="text" 
                onPress={() => router.push('/cadastro-doador')}
                style={styles.registerButton}
                labelStyle={styles.registerButtonText}
                icon="account-plus"
              >
                Novo por aqui? Criar conta
              </Button>

              {/* Botão Voltar */}
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
    backgroundColor: 'rgba(255,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  formCard: {
    width: width * 0.9,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  formGradient: {
    padding: 25,
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFF',
    fontSize: 16,
  },
  rememberContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  rememberButton: {
    borderRadius: 8,
  },
  primaryButton: {
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginBottom: 15,
    backgroundColor: '#FF4444',
  },
  buttonError: {
    backgroundColor: '#DC3545',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  registerButton: {
    marginBottom: 15,
  },
  registerButtonText: {
    color: '#666',
  },
  backButton: {
    marginTop: 10,
  },
  backButtonText: {
    color: '#666',
  },
  // Estilos para diferentes tipos de erro
  erroContainer: {
    backgroundColor: '#FFEAA7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
    flexDirection: 'row',
    alignItems: 'center',
  },
  erroWarningContainer: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA000',
    flexDirection: 'row',
    alignItems: 'center',
  },
  erroInfoContainer: {
    backgroundColor: '#D1ECF1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0DCAF0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  erroText: {
    color: '#D63031',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  erroWarningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  erroInfoText: {
    color: '#055160',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  erroIcon: {
    marginRight: 8,
    fontSize: 16,
  },
});