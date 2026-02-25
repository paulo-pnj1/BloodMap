import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { NotificationService } from '../services/notifications';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      // Registrar token de notificação quando usuário faz login
      if (user) {
        try {
          const pushToken = await NotificationService.registerForPushNotifications();
          if (pushToken) {
            await NotificationService.savePushToken(user.uid, pushToken);
          }
        } catch (error) {
          console.error('Erro ao registrar token de notificação:', error);
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}