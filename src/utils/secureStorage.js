/**
 * Armazenamento seguro com criptografia para dados sensíveis.
 * Usa expo-secure-store (Keychain iOS / Keystore Android) para credenciais.
 * Fallback para AsyncStorage em ambiente web (sem criptografia).
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CREDENTIALS_KEY = 'bloodmap_credentials';
const REMEMBER_LOGIN_KEY = 'bloodmap_remember_login';
const IS_WEB = Platform.OS === 'web';

/**
 * Salva credenciais de forma criptografada (Keychain/Keystore no dispositivo).
 * @param {string} email 
 * @param {string} password 
 */
export async function saveCredentials(email, password) {
  try {
    if (IS_WEB) {
      // Web: SecureStore não disponível; usa AsyncStorage (sem criptografia)
      await AsyncStorage.setItem('savedEmail', email);
      await AsyncStorage.setItem('savedPassword', password);
    } else {
      await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }));
    }
  } catch (error) {
    console.warn('Erro ao salvar credenciais:', error);
    throw error;
  }
}

/**
 * Recupera credenciais salvas.
 * @returns {Promise<{email: string, password: string} | null>}
 */
export async function getCredentials() {
  try {
    if (IS_WEB) {
      const email = await AsyncStorage.getItem('savedEmail');
      const password = await AsyncStorage.getItem('savedPassword');
      if (email && password) return { email, password };
      return null;
    }
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (raw) return JSON.parse(raw);
    return null;
  } catch (error) {
    console.warn('Erro ao ler credenciais:', error);
    return null;
  }
}

/**
 * Remove credenciais salvas.
 */
export async function deleteCredentials() {
  try {
    if (IS_WEB) {
      await AsyncStorage.removeItem('savedEmail');
      await AsyncStorage.removeItem('savedPassword');
    } else {
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    }
  } catch (error) {
    console.warn('Erro ao remover credenciais:', error);
  }
}

/**
 * Salva preferência "lembrar login" (valor não sensível).
 */
export async function setRememberLogin(value) {
  try {
    await AsyncStorage.setItem(REMEMBER_LOGIN_KEY, value ? 'true' : 'false');
  } catch (error) {
    console.warn('Erro ao salvar preferência:', error);
  }
}

/**
 * Retorna se "lembrar login" está ativo.
 */
export async function getRememberLogin() {
  try {
    const v = await AsyncStorage.getItem(REMEMBER_LOGIN_KEY);
    return v === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * Migra credenciais antigas de AsyncStorage para SecureStore (uma vez).
 * Chamar no arranque do app para usuários que já tinham "lembrar login".
 */
export async function migrateFromAsyncStorage() {
  if (IS_WEB) return;
  try {
    const existing = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (existing) return; // já migrado

    const email = await AsyncStorage.getItem('savedEmail');
    const password = await AsyncStorage.getItem('savedPassword');
    if (email && password) {
      await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }));
      await AsyncStorage.removeItem('savedEmail');
      await AsyncStorage.removeItem('savedPassword');
    }
    // Migrar preferência lembrar login
    const oldRemember = await AsyncStorage.getItem('rememberLogin');
    if (oldRemember) {
      await AsyncStorage.setItem(REMEMBER_LOGIN_KEY, oldRemember);
      await AsyncStorage.removeItem('rememberLogin');
    }
  } catch (error) {
    console.warn('Erro na migração de credenciais:', error);
  }
}
