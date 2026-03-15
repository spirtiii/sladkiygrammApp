import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, push, onValue, onChildAdded, onChildRemoved, onChildChanged, off, query, limitToLast, orderByChild, serverTimestamp, onDisconnect } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const database = getDatabase(app);

export {
  database,
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue,
  onChildAdded,
  onChildRemoved,
  onChildChanged,
  off,
  query,
  limitToLast,
  orderByChild,
  serverTimestamp,
  onDisconnect
};
