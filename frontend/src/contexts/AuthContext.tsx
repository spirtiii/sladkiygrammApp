import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database, ref, get, update, onValue, onDisconnect, serverTimestamp } from '../lib/firebase';

interface AuthContextType {
  myId: string | null;
  myNick: string | null;
  myAvatar: string;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (nick: string) => Promise<{ needsCode: boolean; code?: string }>;
  verifyCode: (code: string, correctCode: string) => Promise<boolean>;
  startSession: (id: string, nick: string) => void;
  logout: () => void;
  updateAvatar: (base64: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  myId: null, myNick: null, myAvatar: '', isLoggedIn: false, isLoading: true,
  login: async () => ({ needsCode: false }), verifyCode: async () => false,
  startSession: () => {}, logout: () => {}, updateAvatar: () => {},
});

export const useAuth = () => useContext(AuthContext);

const cleanNick = (n: string) => n.replace(/^\$/, '');

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [myId, setMyId] = useState<string | null>(null);
  const [myNick, setMyNick] = useState<string | null>(null);
  const [myAvatar, setMyAvatar] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem('sladkiy_session_user');
        const savedNick = await AsyncStorage.getItem('sladkiy_session_nick');
        if (savedUser && savedNick) await startSession(savedUser, savedNick);
      } catch (e) { console.log('Auth restore:', e); }
      finally { setIsLoading(false); }
    })();
  }, []);

  const login = async (nick: string): Promise<{ needsCode: boolean; code?: string }> => {
    const id = nick.toLowerCase();
    const trusted = await AsyncStorage.getItem('sladkiy_trusted_' + id);
    if (trusted === 'true') { await startSession(id, nick); return { needsCode: false }; }
    const snapshot = await get(ref(database, `users/${id}`));
    if (snapshot.exists() && snapshot.val().loginCode) {
      return { needsCode: true, code: snapshot.val().loginCode };
    }
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    await update(ref(database, `users/${id}`), { loginCode: newCode, nick: cleanNick(nick) });
    await AsyncStorage.setItem('sladkiy_trusted_' + id, 'true');
    await startSession(id, nick);
    return { needsCode: false };
  };

  const verifyCode = async (entered: string, correct: string) => entered === correct;

  const startSession = async (id: string, nick: string) => {
    const displayNick = cleanNick(nick);
    setMyId(id); setMyNick(displayNick); setIsLoggedIn(true);
    await AsyncStorage.setItem('sladkiy_session_user', id);
    await AsyncStorage.setItem('sladkiy_session_nick', displayNick);
    await AsyncStorage.setItem('sladkiy_trusted_' + id, 'true');
    const userRef = ref(database, `users/${id}`);
    await update(userRef, { online: true, nick: displayNick });
    onDisconnect(userRef).update({ online: false, lastSeen: serverTimestamp() });
    const s = await get(userRef);
    if (s.exists()) {
      const v = s.val();
      if (v.avatar) setMyAvatar(v.avatar);
      if (v.nick) setMyNick(cleanNick(v.nick));
    }
  };

  const logout = async () => {
    if (myId) {
      await update(ref(database, `users/${myId}`), { online: false, lastSeen: serverTimestamp() });
      await AsyncStorage.removeItem('sladkiy_session_user');
      await AsyncStorage.removeItem('sladkiy_session_nick');
      await AsyncStorage.removeItem('sladkiy_trusted_' + myId);
    }
    setMyId(null); setMyNick(null); setMyAvatar(''); setIsLoggedIn(false);
  };

  const updateAvatar = (base64: string) => {
    setMyAvatar(base64);
    if (myId) update(ref(database, `users/${myId}`), { avatar: base64 });
  };

  return (
    <AuthContext.Provider value={{ myId, myNick, myAvatar, isLoggedIn, isLoading, login, verifyCode, startSession, logout, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  );
};
