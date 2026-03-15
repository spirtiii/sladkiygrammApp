import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, ThemeName } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { langData } from '../../src/lib/i18n';

export default function SettingsScreen() {
  const { theme, themeName, setThemeName, lang, setLang, autoTheme, setAutoTheme, globalNotifications, setGlobalNotifications } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const t = langData[lang] || langData.en;
  const [showPrivacy, setShowPrivacy] = useState(false);
  const gl = { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 };

  const themeOpts: { name: ThemeName; label: string; colors: string[]; textColor?: string }[] = [
    { name: 'space', label: 'Space', colors: ['#667eea', '#764ba2'] },
    { name: 'sunset', label: 'Sunset', colors: ['#f093fb', '#f5576c'] },
    { name: 'dark', label: 'Dark', colors: ['#434343', '#000000'] },
    { name: 'light', label: 'Light', colors: ['#e0eafc', '#cfdef3'], textColor: '#333' },
  ];

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.ctn}>
      <View style={[styles.hdr, gl]}><Text style={[styles.hdrT, { color: theme.text }]}>{t.settings}</Text></View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.secT, { color: theme.text }]}>{t.language}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity testID="settings-lang-en" style={[styles.langBtn, lang === 'en' && { backgroundColor: theme.primary }]} onPress={() => setLang('en')}>
            <Text style={[styles.langTxt, { color: lang === 'en' ? '#fff' : theme.text }]}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="settings-lang-ru" style={[styles.langBtn, lang === 'ru' && { backgroundColor: theme.primary }]} onPress={() => setLang('ru')}>
            <Text style={[styles.langTxt, { color: lang === 'ru' ? '#fff' : theme.text }]}>Русский</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.secT, { color: theme.text, marginTop: 25 }]}>{t.theme}</Text>
        <View style={styles.themeGrid}>
          {themeOpts.map(o => (
            <TouchableOpacity key={o.name} testID={`theme-${o.name}`}
              style={[styles.themeBtn, themeName === o.name && !autoTheme && styles.themeActive]}
              onPress={() => { setAutoTheme(false); setThemeName(o.name); }}>
              <LinearGradient colors={o.colors as any} style={styles.themeBtnInner}>
                <Text style={[styles.themeBtnTxt, { color: o.textColor || '#fff' }]}>{o.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.settRow, { borderColor: theme.glass_border }]}>
          <View style={styles.settLeft}><Ionicons name="sunny" size={20} color={theme.primary} /><Text style={[styles.settTxt, { color: theme.text }]}>{t.auto_theme}</Text></View>
          <Switch testID="auto-theme-switch" value={autoTheme} onValueChange={setAutoTheme} trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.primary }} thumbColor="#fff" />
        </View>
        <View style={[styles.settRow, { borderColor: theme.glass_border }]}>
          <View style={styles.settLeft}><Ionicons name="notifications" size={20} color={theme.primary} /><Text style={[styles.settTxt, { color: theme.text }]}>{t.notifications}</Text></View>
          <Switch testID="global-notifications-switch" value={globalNotifications} onValueChange={setGlobalNotifications} trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.primary }} thumbColor="#fff" />
        </View>
        <TouchableOpacity testID="legal-btn" style={[styles.legalBtn, gl]} onPress={() => setShowPrivacy(true)}>
          <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
          <Text style={[styles.legalTxt, { color: theme.text }]}>{t.legal}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={() => { logout(); router.replace('/auth'); }}>
          <Ionicons name="log-out" size={20} color="#fff" /><Text style={styles.logoutTxt}>{t.logout}</Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal visible={showPrivacy} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.privacyBox, gl, { backgroundColor: 'rgba(15,12,30,0.96)' }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowPrivacy(false)}><Text style={[styles.closeTxt, { color: theme.text }]}>✕</Text></TouchableOpacity>
            <Text style={[styles.privacyTitle, { color: theme.text }]}>{t.privacy_title}</Text>
            <ScrollView style={styles.privacyScroll}>
              <Text style={[styles.privacyText, { color: theme.text_secondary }]}>{t.privacy_text}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ctn: { flex: 1 },
  hdr: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1 },
  hdrT: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 100 },
  secT: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  langTxt: { fontSize: 15, fontWeight: '600' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeBtn: { flex: 1, minWidth: '45%', borderRadius: 16, overflow: 'hidden' },
  themeActive: { borderWidth: 3, borderColor: '#fff' },
  themeBtnInner: { padding: 18, alignItems: 'center', borderRadius: 14 },
  themeBtnTxt: { fontSize: 16, fontWeight: '700' },
  settRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, marginTop: 10 },
  settLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settTxt: { fontSize: 16 },
  legalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, marginTop: 30, gap: 10 },
  legalTxt: { fontSize: 15, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff4444', padding: 14, borderRadius: 16, marginTop: 15, gap: 8 },
  logoutTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  privacyBox: { padding: 25, borderRadius: 24, width: '88%', maxWidth: 400, maxHeight: '75%' },
  closeBtn: { position: 'absolute', top: 15, right: 20, zIndex: 10 },
  closeTxt: { fontSize: 26, opacity: 0.7 },
  privacyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
  privacyScroll: { maxHeight: 400 },
  privacyText: { fontSize: 14, lineHeight: 22, opacity: 0.85 },
});
