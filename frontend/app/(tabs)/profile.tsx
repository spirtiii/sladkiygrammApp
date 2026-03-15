import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Animated, Easing, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { langData } from '../../src/lib/i18n';
import { database, ref, get, update } from '../../src/lib/firebase';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const { theme, lang } = useTheme();
  const { myId, myNick, myAvatar, updateAvatar } = useAuth();
  const t = langData[lang] || langData.en;
  const [bio, setBio] = useState('');
  const [loginCode, setLoginCode] = useState('----');
  const [codeBlurred, setCodeBlurred] = useState(true);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!myId) return;
    get(ref(database, `users/${myId}`)).then(s => {
      if (s.exists()) {
        const val = s.val();
        setBio(val.bio || '');
        setLoginCode(val.loginCode || '----');
      }
    });
  }, [myId]);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(rotAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }),
    ])).start();
  }, []);

  const codeScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glowColor = glowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [theme.primary, '#fff', theme.primary] });
  const borderRot = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow access to photos'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true });
    if (!result.canceled && result.assets[0].base64) {
      updateAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const saveProfile = () => {
    if (!myId) return;
    update(ref(database, `users/${myId}`), { bio });
    Alert.alert('✓', lang === 'ru' ? 'Сохранено' : 'Saved');
  };

  const letter = myNick ? myNick.replace('$', '').charAt(0).toUpperCase() : '?';
  const glassStyle = { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 };

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.container}>
      <View style={[styles.header, glassStyle]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t.profile}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity testID="profile-avatar" style={styles.avatarOuter} onPress={pickImage}>
          <Animated.View style={[styles.avatarRing, { borderColor: theme.primary, transform: [{ rotate: borderRot }] }]}>
            <LinearGradient colors={[theme.primary, '#fff', theme.primary]} style={styles.avatarRingGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          </Animated.View>
          <View style={[styles.profilePicInner, { backgroundColor: myAvatar ? '#222' : theme.primary }]}>
            {myAvatar ? <Image source={{ uri: myAvatar }} style={styles.avatarImage} /> : <Text style={styles.avatarLetter}>{letter}</Text>}
          </View>
          <View style={[styles.editIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text testID="profile-nick" style={[styles.nickDisplay, { color: theme.text }]}>{myNick?.replace('$', '')}</Text>

        <TextInput testID="bio-input" style={[styles.bioInput, { color: theme.text, borderColor: theme.glass_border }]}
          placeholder="Bio / Description..." placeholderTextColor={theme.text_secondary}
          multiline numberOfLines={3} value={bio} onChangeText={setBio} />

        {/* Animated secret code box */}
        <View style={[styles.secretBox, glassStyle]}>
          <Text style={[styles.secretLabel, { color: theme.text_secondary }]}>{t.enter_code}</Text>
          <TouchableOpacity onPress={() => setCodeBlurred(!codeBlurred)} testID="secret-code">
            <Animated.View style={[styles.codeContainer, { transform: [{ scale: codeScale }] }]}>
              {(codeBlurred ? ['•', '•', '•', '•'] : loginCode.split('')).map((ch, i) => (
                <Animated.Text key={i} style={[styles.codeDigitDisplay, { color: glowColor, textShadowColor: theme.primary, textShadowRadius: codeBlurred ? 0 : 12 }]}>
                  {ch}
                </Animated.Text>
              ))}
            </Animated.View>
          </TouchableOpacity>
          <Text style={[styles.tapReveal, { color: theme.text_secondary }]}>{lang === 'ru' ? 'Нажмите чтобы показать' : 'Tap to reveal'}</Text>
        </View>

        <TouchableOpacity testID="save-profile-btn" style={[styles.btn, { backgroundColor: theme.primary }]} onPress={saveProfile}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.btnText}>{t.save}</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, alignItems: 'center', paddingBottom: 100 },
  avatarOuter: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' },
  avatarRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 3, overflow: 'hidden' },
  avatarRingGrad: { width: '100%', height: '100%' },
  profilePicInner: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 120, height: 120, borderRadius: 60 },
  avatarLetter: { fontSize: 50, fontWeight: 'bold', color: '#fff' },
  editIcon: { position: 'absolute', bottom: 5, right: 5, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#111', zIndex: 5 },
  nickDisplay: { fontSize: 26, fontWeight: '800', marginBottom: 10 },
  bioInput: { backgroundColor: 'rgba(0,0,0,0.15)', borderWidth: 1, padding: 14, borderRadius: 12, width: '100%', fontSize: 15, textAlign: 'center', minHeight: 70, textAlignVertical: 'top' },
  secretBox: { marginTop: 25, padding: 20, borderRadius: 20, width: '100%', alignItems: 'center' },
  secretLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  codeContainer: { flexDirection: 'row', gap: 12 },
  codeDigitDisplay: { fontSize: 40, fontWeight: 'bold', letterSpacing: 4, fontFamily: 'monospace' },
  tapReveal: { fontSize: 11, opacity: 0.5, marginTop: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, width: '100%', marginTop: 30, gap: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
