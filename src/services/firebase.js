import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBgGFYWZ4hItU6TIPNuZ-4jr_oBFBEzMKw",
  authDomain: "doadores-sangue.firebaseapp.com",
  projectId: "doadores-sangue",
  storageBucket: "doadores-sangue.appspot.com",
  messagingSenderId: "181001697977",
  appId: "1:181001697977:web:1df7fa3c68b200a60fb968"
};

// ✅ Garante que o app não é inicializado duas vezes
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Garante que o Auth também não é inicializado mais de uma vez
let auth;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export const db = getFirestore(app);
export { auth };
export default app;

// === Cache de Doadores (AsyncStorage) ===
export const cacheDoadores = async (doadores) => {
  try {
    await AsyncStorage.setItem('doadores_cache', JSON.stringify({
      data: doadores,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Erro ao cachear doadores:', error);
  }
};

export const getCachedDoadores = async () => {
  try {
    const cached = await AsyncStorage.getItem('doadores_cache');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 300000) { // 5 minutos
        return data;
      }
    }
  } catch (error) {
    console.warn('Erro ao ler cache de doadores:', error);
  }
  return null;
};
