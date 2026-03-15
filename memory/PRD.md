# Sladkiygramm 3.6 🍬 - PRD

## Overview
Sladkiygramm — Telegram-like messenger, native Expo React Native app with Firebase Realtime Database.

## Tech Stack
- Expo SDK 54, React Native, expo-router, Firebase JS SDK v9+
- expo-av (voice), expo-image-picker (photos/avatars), expo-linear-gradient

## All Features

### Auth
- Nickname + 4-digit security code + recovery via friend's chat

### Messaging
- Real-time messages via Firebase RTDB
- Date separators (Telegram-style date clouds)
- Full date+time on messages: "14:30 • 15 Mar"
- Reply to messages with quote
- Delete for me / Delete for everyone (with confirmation dialog)
- Read receipts (✓ sent, ✓✓ read)
- Typing indicator
- Pin/unpin messages
- Message reactions: ❤️👍😂🔥😮😢✅✨ (single per user, toggle)
- Search in chat with text highlight + up/down navigation

### Media
- Photos: pick up to 3, collage display, fullscreen preview
- Sticker packs: 40 stickers in 5 categories
- Voice messages: hold mic to record, shows duration, play button
- Gifts: 🧸💝🎂🍬 with animated messages

### Calls (Firebase Signaling)
- Audio/Video calls: Calling → Incoming → Active
- Mic mute (visible to both), Camera toggle
- Call timer, Accept/Decline incoming calls

### Social
- User profile modal: avatar, bio, online status, call/video/gift buttons
- Smart prefix search for users (startsWith)
- Online status with smart "last seen" (minutes ago, yesterday, exact date)
- Block/unblock users

### Groups
- Create groups from FAB (select contacts)
- Member list with count, Creator badge
- Kick members, Transfer ownership (owner only)
- Leave group, Delete group
- System messages for group events

### Chat Management
- Favorites (saved messages)
- Archive/Unarchive
- Mute per-chat (bell icon indicator)
- Pin chats, Delete with confirmation (for me / for everyone)

### UI/UX
- 4 themes (Space/Sunset/Dark/Light) + Auto theme (day/night)
- Liquid glass style with transparent backgrounds
- Pleasant dark color palettes
- Animated profile (rotating ring, pulsing secret code)
- No $ in nicknames
- i18n: English/Russian
- Privacy & Terms page

## File Structure
```
frontend/app/
  _layout.tsx, index.tsx, auth.tsx
  (tabs)/ chats.tsx, profile.tsx, settings.tsx
  chat/ [id].tsx
frontend/src/
  contexts/ ThemeContext.tsx, AuthContext.tsx
  lib/ firebase.ts, i18n.ts
```
