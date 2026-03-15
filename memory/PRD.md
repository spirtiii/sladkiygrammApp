# Sladkiygramm 3.6 🍬 - PRD

## Overview
Sladkiygramm is a Telegram-like messenger converted from HTML to a native Expo React Native mobile app. It uses Firebase Realtime Database for all real-time communication.

## Tech Stack
- **Frontend**: Expo SDK 54, React Native 0.81.5, expo-router (file-based routing)
- **Backend**: Firebase Realtime Database (direct client SDK, no custom backend needed)
- **State Management**: React Context (ThemeContext, AuthContext)
- **Storage**: AsyncStorage for local persistence
- **Audio**: expo-av for voice messages
- **UI**: expo-linear-gradient, @expo/vector-icons (Ionicons)

## Features Implemented

### Core Features (from original HTML)
1. **Authentication**: Nickname-based login with 4-digit security code
2. **Chat List**: Real-time chat list synced with Firebase
3. **Chat Room**: Message sending/receiving, read receipts, typing indicators
4. **Profile**: Avatar upload, bio editing, animated secret code reveal
5. **Settings**: Language (EN/RU), Theme selection, Logout
6. **Themes**: Space, Sunset, Dark, Light with glassmorphism

### New Features Added
7. **Auto Theme**: Day/Night automatic theme switching in Settings
8. **Message Reactions**: ❤️ 👍 😂 🔥 😮 😢 ✅ ✨ - single per user, toggle on/off, chips with counter, saved to Firebase
9. **Search in Chat**: Search messages with up/down navigation and text highlight
10. **Favorites**: Saved messages chat at bottom of chat list
11. **Archive**: Archive/unarchive chats, separate section at bottom of chat list
12. **Mute Notifications**: Per-chat mute with bell icon indicator
13. **Voice Messages**: Hold mic button to record, release to send, shows duration
14. **Context Menu**: Long-press on chat for column-style menu (pin, mute, archive, delete)
15. **Three-dots Menu**: In chat header with search and mute options
16. **Global Notifications Toggle**: In Settings
17. **i18n**: Full English/Russian localization

## Firebase Configuration
- Project: sladkiygramm
- Database: sladkiygramm-default-rtdb (Europe West 1)
- Using Firebase JS SDK v9+ (modular API)

## File Structure
```
frontend/
  app/
    _layout.tsx          - Root layout with ThemeProvider + AuthProvider
    index.tsx            - Splash screen with candy spinner animation
    auth.tsx             - Auth screen (nickname + code verification)
    (tabs)/
      _layout.tsx        - Tab navigation (Chats, Profile, Settings)
      chats.tsx          - Chat list with favorites, archive, FAB, context menu
      profile.tsx        - Profile with avatar, bio, animated secret code
      settings.tsx       - Language, themes, auto theme, notifications, logout
    chat/
      [id].tsx           - Chat room with messages, reactions, search, voice
  src/
    contexts/
      ThemeContext.tsx    - Theme management with 4 themes + auto
      AuthContext.tsx     - Auth state with Firebase integration
    lib/
      firebase.ts        - Firebase SDK initialization
      i18n.ts            - EN/RU translations
```

## Business Enhancement
- **Monetization**: Premium themes/sticker packs could be sold as in-app purchases
- **Growth**: Referral system with gift rewards for inviting friends
