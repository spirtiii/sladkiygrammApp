import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';

export default function Index() {
  const { isLoggedIn, isLoading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [spinAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [opacityAnim] = useState(new Animated.Value(1));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]),
      ])
    ).start();
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || isLoading) return;
    Animated.timing(opacityAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
      if (isLoggedIn) {
        router.replace('/(tabs)/chats');
      } else {
        router.replace('/auth');
      }
    });
  }, [ready, isLoading, isLoggedIn]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.container}>
      <Animated.View style={[styles.center, { opacity: opacityAnim }]} testID="splash-screen">
        <Animated.Text style={[styles.candy, { transform: [{ rotate: spin }, { scale: scaleAnim }] }]}>
          🍬
        </Animated.Text>
        <Text style={[styles.title, { color: theme.text }]}>Sladkiygramm</Text>
        <Text style={[styles.version, { color: theme.text_secondary }]}>3.6</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  candy: { fontSize: 90, marginBottom: 25 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  version: { fontSize: 14, opacity: 0.6, fontWeight: '500', marginTop: -5 },
});
