import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Modal, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { haversineDistance } from '../src/utils/distance';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { auth, db } from '../src/services/firebase';

export default function TelaMapaDoadores() {
  const [location, setLocation] = useState(null);
  const [doadores, setDoadores] = useState([]);
  const [selectedDoador, setSelectedDoador] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    // Geolocalização do usuário
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão negada!');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
    })();

    // Listener real-time do Firestore
    if (auth.currentUser) {
      const q = query(collection(db, 'usuarios'), where('disponivel', '==', true));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const doadoresList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDoadores(doadoresList);
      });
      return unsubscribe;  // Limpa listener ao desmontar
    }
  }, []);

  // Filtra doadores próximos (<10km)
  const doadoresProximos = location ? doadores
    .filter(doador => {
      const dist = haversineDistance(
        location.coords.latitude, location.coords.longitude,
        doador.localizacao.lat, doador.localizacao.lng
      );
      return dist < 10;  // Ajuste o raio se quiser
    })
    .sort((a, b) => {
      const distA = haversineDistance(location.coords.latitude, location.coords.longitude, a.localizacao.lat, a.localizacao.lng);
      const distB = haversineDistance(location.coords.latitude, location.coords.longitude, b.localizacao.lat, b.localizacao.lng);
      return distA - distB;
    }) : [];

  const initialRegion = location ? {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  } : { latitude: -7.612, longitude: 15.056, latitudeDelta: 0.0922, longitudeDelta: 0.0421 };

  const ligarDoador = (telefone) => {
    Alert.alert('Ligar', `Ligando para ${telefone}...`, [{ text: 'OK' }]);
    // Em prod: Linking.openURL(`tel:${telefone}`);
  };

  const whatsappDoador = (telefone) => {
    Alert.alert('WhatsApp', `Abrindo WhatsApp para ${telefone}...`, [{ text: 'OK' }]);
    // Em prod: Linking.openURL(`whatsapp://send?phone=${telefone.replace(/\D/g, '')}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mapa de Doadores Próximos ({doadoresProximos.length}) 🗺️</Text>
      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
      <MapView style={styles.map} initialRegion={initialRegion} showsUserLocation={true}>
        {location && (
          <Marker
            coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
            title="Você"
            pinColor="blue"
          />
        )}
        {doadoresProximos.map((doador) => {
          const dist = haversineDistance(location?.coords.latitude || -7.612, location?.coords.longitude || 15.056, doador.localizacao.lat, doador.localizacao.lng);
          return (
            <Marker
              key={doador.id}
              coordinate={{ latitude: doador.localizacao.lat, longitude: doador.localizacao.lng }}
              title={`${doador.nome} (${doador.tipoSanguineo})`}
              pinColor="red"
              onPress={() => setSelectedDoador({ ...doador, dist })}
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{doador.nome}</Text>
                  <Text>Tipo: {doador.tipoSanguineo} | Dist: {dist.toFixed(1)}km</Text>
                  <TouchableOpacity onPress={() => { ligarDoador(doador.telefone); setSelectedDoador(null); }}>
                    <Text style={styles.buttonText}>📞 Ligar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { whatsappDoador(doador.telefone); setSelectedDoador(null); }}>
                    <Text style={styles.buttonText}>💬 WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
      <View style={styles.buttons}>
        <Button title="Perfil" onPress={() => router.push('/perfil')} />
        <Button title="Pedidos Urgentes" onPress={() => router.push('/pedidos-urgentes')} />
        <Button title="Logout" onPress={() => { auth.signOut(); router.push('/'); }} color="gray" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', padding: 20, backgroundColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: 'red' },
  error: { color: 'red', marginBottom: 10 },
  map: { width: '100%', height: 400, marginBottom: 20, borderRadius: 10 },
  buttons: { width: '100%', alignItems: 'center' },
  callout: { width: 200, padding: 10 },
  calloutTitle: { fontWeight: 'bold' },
  buttonText: { color: 'blue', marginTop: 5, textDecorationLine: 'underline' },
});