const path = require('path');
const fs = require('fs');

// Carregar Firebase config: env vars (EXPO_PUBLIC_* ou NEXT_PUBLIC_*) ou google-services.json
function getFirebaseConfig() {
  const fromEnv = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (fromEnv.apiKey && fromEnv.projectId) return fromEnv;

  try {
    const gsPath = path.join(__dirname, 'google-services.json');
    const gs = JSON.parse(fs.readFileSync(gsPath, 'utf8'));
    const projectId = gs.project_info?.project_id || 'doadores-sangue';
    const bucket = gs.project_info?.storage_bucket || projectId + '.firebasestorage.app';
    const projectNumber = gs.project_info?.project_number || '';
    const client = gs.client?.[0];
    const apiKey = client?.api_key?.[0]?.current_key;
    const appId = client?.client_info?.mobilesdk_app_id || '1:' + projectNumber + ':android:default';
    return {
      apiKey: apiKey || '',
      authDomain: projectId + '.firebaseapp.com',
      projectId,
      storageBucket: bucket,
      messagingSenderId: projectNumber,
      appId,
    };
  } catch (e) {
    return {
      apiKey: '',
      authDomain: '',
      projectId: 'doadores-sangue',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    };
  }
}

const appJson = require('./app.json');
const expo = appJson.expo || {};

module.exports = {
  expo: {
    ...expo,
    extra: {
      ...expo.extra,
      firebase: getFirebaseConfig(),
    },
  },
};
