import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
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

  const handleLogout = () => {
    logout();
    router.replace('/auth');
  };

  const themeOptions: { name: ThemeName; label: string; color: string; textColor?: string }[] = [
    { name: 'space', label: 'Space', color: '#302b63' },
    { name: 'sunset', label: 'Sunset', color: '#ff5e62' },
    { name: 'dark', label: 'Dark', color: '#232526' },
    { name: 'light', label: 'Light', color: '#e0eafc', textColor: '#333' },
  ];

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.container}>
      <View style={[styles.header, { backgroundColor: theme.glass_bg, borderBottomColor: theme.glass_border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t.settings}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Language */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.language}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            testID="settings-lang-en"
            style={[styles.langBtn, lang === 'en' && { backgroundColor: theme.primary, borderColor: '#fff', borderWidth: 2 }]}
            onPress={() => setLang('en')}
          >
            <Text style={[styles.langText, { color: lang === 'en' ? '#fff' : theme.text }]}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="settings-lang-ru"
            style={[styles.langBtn, lang === 'ru' && { backgroundColor: theme.primary, borderColor: '#fff', borderWidth: 2 }]}
            onPress={() => setLang('ru')}
          >
            <Text style={[styles.langText, { color: lang === 'ru' ? '#fff' : theme.text }]}>Русский</Text>
          </TouchableOpacity>
        </View>

        {/* Theme */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 25 }]}>{t.theme}</Text>
        <View style={styles.themeGrid}>
          {themeOptions.map(opt => (
            <TouchableOpacity
              key={opt.name}
              testID={`theme-${opt.name}`}
              style={[
                styles.themeBtn,
                { backgroundColor: opt.color },
                themeName === opt.name && !autoTheme && { borderWidth: 3, borderColor: '#fff', shadowColor: opt.color, shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 }
              ]}
              onPress={() => { setAutoTheme(false); setThemeName(opt.name); }}
            >
              <Text style={[styles.themeBtnText, { color: opt.textColor || '#fff' }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Auto Theme */}
        <View style={[styles.settingRow, { borderColor: theme.glass_border }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="sunny" size={20} color={theme.primary} />
            <Text style={[styles.settingText, { color: theme.text }]}>{t.auto_theme}</Text>
          </View>
          <Switch
            testID="auto-theme-switch"
            value={autoTheme}
            onValueChange={setAutoTheme}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Notifications */}
        <View style={[styles.settingRow, { borderColor: theme.glass_border }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications" size={20} color={theme.primary} />
            <Text style={[styles.settingText, { color: theme.text }]}>{t.notifications}</Text>
          </View>
          <Switch
            testID="global-notifications-switch"
            value={globalNotifications}
            onValueChange={setGlobalNotifications}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Logout */}
        <TouchableOpacity testID="logout-btn" style={[styles.logoutBtn]} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={styles.logoutText}>{t.logout}</Text>
        </TouchableOpacity>

        {/* Legal */}
        <TouchableOpacity testID="legal-btn" style={[styles.legalBtn, { borderColor: theme.glass_border }]}>
          <Ionicons name="shield" size={16} color={theme.text_secondary} />
          <Text style={[styles.legalText, { color: theme.text_secondary }]}>{t.legal}</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.2)' },
  langText: { fontSize: 14, fontWeight: '500' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeBtn: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  themeBtnText: { fontSize: 16, fontWeight: '600' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, marginTop: 10 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { fontSize: 16 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff4444', padding: 14, borderRadius: 16, marginTop: 40, gap: 8 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  legalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, padding: 12, borderRadius: 12, marginTop: 25, gap: 8 },
  legalText: { fontSize: 13 },
});
