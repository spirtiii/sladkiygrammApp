import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Animated, Easing, Alert } from 'react-native';
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
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const codeScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const glowColor = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [theme.primary, '#fff', theme.primary]
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      updateAvatar(base64);
    }
  };

  const saveProfile = () => {
    if (!myId) return;
    update(ref(database, `users/${myId}`), { bio });
    Alert.alert('✓', t.save);
  };

  const letter = myNick ? myNick.charAt(0).toUpperCase() : '?';

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.container}>
      <View style={[styles.header, { backgroundColor: theme.glass_bg, borderBottomColor: theme.glass_border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t.profile}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity testID="profile-avatar" style={[styles.profilePic, { borderColor: theme.primary }]} onPress={pickImage}>
          {myAvatar ? (
            <View style={[styles.profilePicInner, { backgroundColor: '#444' }]}>
              <Text style={styles.avatarLetter}>{letter}</Text>
            </View>
          ) : (
            <View style={[styles.profilePicInner, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarLetter}>{letter}</Text>
            </View>
          )}
          <View style={[styles.editIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text testID="profile-nick" style={[styles.nickDisplay, { color: theme.text }]}>{myNick}</Text>

        <TextInput
          testID="bio-input"
          style={[styles.bioInput, { color: theme.text, borderColor: theme.glass_border }]}
          placeholder="Bio / Description..."
          placeholderTextColor={theme.text_secondary}
          multiline
          numberOfLines={3}
          value={bio}
          onChangeText={setBio}
        />

        <View style={[styles.secretBox, { borderColor: theme.glass_border }]}>
          <Text style={[styles.secretLabel, { color: theme.text_secondary }]}>{t.enter_code}</Text>
          <TouchableOpacity onPress={() => setCodeBlurred(!codeBlurred)} testID="secret-code">
            <Animated.Text
              style={[
                styles.secretCode,
                {
                  color: glowColor,
                  textShadowColor: theme.primary,
                  textShadowRadius: codeBlurred ? 0 : 10,
                  transform: [{ scale: codeScale }],
                  opacity: codeBlurred ? 0.3 : 1,
                }
              ]}
            >
              {codeBlurred ? '••••' : loginCode}
            </Animated.Text>
          </TouchableOpacity>
          <Text style={[styles.tapReveal, { color: theme.text_secondary }]}>Tap to reveal</Text>
        </View>

        <TouchableOpacity testID="save-profile-btn" style={[styles.btn, { backgroundColor: theme.primary }]} onPress={saveProfile}>
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
  content: { padding: 20, alignItems: 'center' },
  profilePic: { width: 130, height: 130, borderRadius: 65, borderWidth: 4, marginBottom: 25, position: 'relative' },
  profilePicInner: { width: '100%', height: '100%', borderRadius: 65, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 50, fontWeight: 'bold', color: '#fff' },
  editIcon: { position: 'absolute', bottom: 5, right: 5, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  nickDisplay: { fontSize: 26, fontWeight: '800', marginBottom: 10 },
  bioInput: { backgroundColor: 'rgba(0,0,0,0.15)', borderWidth: 1, padding: 14, borderRadius: 12, width: '100%', fontSize: 15, textAlign: 'center', minHeight: 80, textAlignVertical: 'top' },
  secretBox: { marginTop: 25, padding: 15, borderWidth: 1, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.2)', width: '100%', alignItems: 'center' },
  secretLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  secretCode: { fontSize: 36, fontWeight: 'bold', letterSpacing: 8, marginVertical: 10, fontFamily: 'monospace' },
  tapReveal: { fontSize: 11, opacity: 0.5 },
  btn: { padding: 14, borderRadius: 16, width: '100%', alignItems: 'center', marginTop: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
