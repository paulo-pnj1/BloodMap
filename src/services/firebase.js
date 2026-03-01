import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";

// Config: Expo extra (app.config.js) ou env (NEXT_PUBLIC_ / EXPO_PUBLIC_)
const extra = Constants.expoConfig?.extra?.firebase || {};
const firebaseConfig = {
  apiKey: extra.apiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: extra.authDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: extra.projectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: extra.storageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra.messagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: extra.appId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.warn("Firebase: apiKey ausente. Defina em .env (EXPO_PUBLIC_FIREBASE_API_KEY) ou use google-services.json.");
}

// ✅ Garante que o app não é inicializado duas vezes
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ React Native: persistência com AsyncStorage; se já inicializado (hot reload), usa getAuth
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  if (e.code === "auth/already-initialized") {
    auth = getAuth(app);
  } else {
    throw e;
  }
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
