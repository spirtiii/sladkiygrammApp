import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { langData } from '../../src/lib/i18n';

export default function TabLayout() {
  const { theme, lang } = useTheme();
  const t = langData[lang] || langData.en;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.nav_bg,
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 75,
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.text_secondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: t.chats,
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile,
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings,
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
