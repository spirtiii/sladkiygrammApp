import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, push, onValue, onChildAdded, onChildRemoved, onChildChanged, off, query, limitToLast, orderByChild, serverTimestamp, onDisconnect } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAZV-wGHssi2yCMef3RlEszAadVOut7xsk",
  authDomain: "sladkiygramm.firebaseapp.com",
  databaseURL: "https://sladkiygramm-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sladkiygramm",
  storageBucket: "sladkiygramm.firebasestorage.app",
  messagingSenderId: "1086842108736",
  appId: "1:1086842108736:web:1827bc9ad50504572918a5"
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
