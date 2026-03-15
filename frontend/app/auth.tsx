import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { langData } from '../src/lib/i18n';
import { database, ref, get } from '../src/lib/firebase';

export default function AuthScreen() {
  const { theme, lang, setLang } = useTheme();
  const { login, verifyCode, startSession } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [correctCode, setCorrectCode] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const [recoveryNick, setRecoveryNick] = useState('');
  const codeRefs = useRef<(TextInput | null)[]>([]);
  const t = langData[lang] || langData.en;

  const handleLogin = async () => {
    const nick = nickname.trim();
    if (!/^[a-zA-Z0-9]+$/.test(nick)) {
      Alert.alert('Error', 'English letters & numbers only!');
      return;
    }
    try {
      const result = await login(nick);
      if (result.needsCode) {
        setCorrectCode(result.code || '');
        setShowCodeModal(true);
      } else {
        router.replace('/(tabs)/chats');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const handleVerifyCode = async () => {
    const entered = codeDigits.join('');
    const ok = await verifyCode(entered, correctCode);
    if (ok) {
      const id = nickname.trim().toLowerCase();
      startSession(id, '$' + nickname.trim());
      setShowCodeModal(false);
      router.replace('/(tabs)/chats');
    } else {
      Alert.alert('Error', 'Wrong Code');
    }
  };

  const handleCodeInput = (text: string, index: number) => {
    const newDigits = [...codeDigits];
    newDigits[index] = text;
    setCodeDigits(newDigits);
    if (text && index < 3) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleRecovery = async () => {
    const friend = recoveryNick.trim().toLowerCase();
    if (!friend) return;
    const id = nickname.trim().toLowerCase();
    const snapshot = await get(ref(database, `users/${id}/chats/${friend}`));
    if (snapshot.exists()) {
      Alert.alert('Your Code', correctCode);
      setShowRecoveryModal(false);
      setShowCodeModal(true);
    } else {
      Alert.alert('Error', 'Wrong user or no chat history.');
    }
  };

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View testID="auth-screen" style={styles.authBox}>
            <View style={styles.langRow}>
              <TouchableOpacity
                testID="lang-en-btn"
                style={[styles.langBtn, lang === 'en' && { backgroundColor: theme.primary, borderColor: '#fff' }]}
                onPress={() => setLang('en')}
              >
                <Text style={[styles.langText, { color: theme.text }]}>English</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="lang-ru-btn"
                style={[styles.langBtn, lang === 'ru' && { backgroundColor: theme.primary, borderColor: '#fff' }]}
                onPress={() => setLang('ru')}
              >
                <Text style={[styles.langText, { color: theme.text }]}>Русский</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.title, { color: theme.text }]}>Sladkiygramm</Text>
            <Text style={[styles.version, { color: theme.text_secondary }]}>3.6</Text>
            <Text style={[styles.slogan, { color: theme.text_secondary }]}>{t.slogan}</Text>

            <TextInput
              testID="nickname-input"
              style={[styles.input, { color: theme.text, borderColor: theme.glass_border }]}
              placeholder={t.nickname_placeholder}
              placeholderTextColor={theme.text_secondary}
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="none"
            />

            <TouchableOpacity
              testID="login-btn"
              style={[styles.btn, { backgroundColor: theme.primary }]}
              onPress={handleLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>{t.login_btn}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Code Modal */}
      <Modal visible={showCodeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.glass_bg, borderColor: theme.glass_border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.enter_code}</Text>
            <Text style={[styles.modalDesc, { color: theme.text_secondary }]}>{t.code_desc}</Text>
            <View style={styles.codeRow}>
              {[0, 1, 2, 3].map(i => (
                <TextInput
                  key={i}
                  ref={r => { codeRefs.current[i] = r; }}
                  testID={`code-digit-${i}`}
                  style={[styles.codeDigit, { color: '#fff', borderColor: theme.primary }]}
                  keyboardType="numeric"
                  maxLength={1}
                  value={codeDigits[i]}
                  onChangeText={text => handleCodeInput(text, i)}
                />
              ))}
            </View>
            <TouchableOpacity testID="verify-code-btn" style={[styles.btn, { backgroundColor: theme.primary }]} onPress={handleVerifyCode}>
              <Text style={styles.btnText}>{t.enter}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowCodeModal(false); setShowRecoveryModal(true); }}>
              <Text style={[styles.forgotText, { color: theme.text_secondary }]}>{t.forgot_code}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Recovery Modal */}
      <Modal visible={showRecoveryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.glass_bg, borderColor: theme.glass_border }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowRecoveryModal(false)}>
              <Text style={[styles.closeText, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.recovery_title}</Text>
            <Text style={[styles.modalDesc, { color: theme.text_secondary }]}>{t.recovery_desc}</Text>
            <TextInput
              testID="recovery-input"
              style={[styles.input, { color: theme.text, borderColor: theme.glass_border }]}
              placeholder={t.friend_placeholder}
              placeholderTextColor={theme.text_secondary}
              value={recoveryNick}
              onChangeText={setRecoveryNick}
              autoCapitalize="none"
            />
            <TouchableOpacity testID="recovery-btn" style={[styles.btn, { backgroundColor: theme.primary }]} onPress={handleRecovery}>
              <Text style={styles.btnText}>{t.check_btn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  authBox: { width: '100%', maxWidth: 320, alignItems: 'center' },
  langRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  langBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.2)' },
  langText: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 0 },
  version: { fontSize: 14, opacity: 0.6, fontWeight: '500', marginTop: -5, marginBottom: 10 },
  slogan: { marginBottom: 30, fontSize: 14 },
  input: { backgroundColor: 'rgba(0,0,0,0.15)', borderWidth: 1, padding: 14, borderRadius: 12, width: '100%', fontSize: 16, marginBottom: 15 },
  btn: { padding: 14, borderRadius: 16, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 30, borderRadius: 28, borderWidth: 1, width: '85%', maxWidth: 360, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  modalDesc: { fontSize: 13, opacity: 0.7, marginBottom: 15, textAlign: 'center' },
  codeRow: { flexDirection: 'row', gap: 12, marginVertical: 20 },
  codeDigit: { width: 55, height: 65, fontSize: 32, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 2, borderRadius: 12, fontWeight: 'bold' },
  forgotText: { marginTop: 20, fontSize: 13, textDecorationLine: 'underline' },
  closeBtn: { position: 'absolute', top: 15, right: 20 },
  closeText: { fontSize: 26, opacity: 0.7 },
});
