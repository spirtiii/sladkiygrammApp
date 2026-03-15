# Sladkiygramm 3.6 🍬 - PRD

## Overview
Sladkiygramm is a Telegram-like messenger converted from HTML to a native Expo React Native mobile app with Firebase Realtime Database.

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, expo-router
- **Backend**: Firebase Realtime Database (direct client SDK)
- **Audio**: expo-av (voice messages)
- **Images**: expo-image-picker (avatars, photos)
- **UI**: expo-linear-gradient, @expo/vector-icons, Liquid Glass style

## Features

### Core
1. **Auth** - Nickname + 4-digit security code + recovery
2. **Chat List** - Real-time with favorites & archive sections
3. **Chat Room** - Full messaging with replies, reactions, search, voice
4. **Profile** - Avatar upload (Image from Firebase), bio, animated secret code
5. **Settings** - Language (EN/RU), 4 Themes + Auto, Notifications toggle, Logout
6. **Themes** - Space, Sunset, Dark, Light + Auto (day/night)

### Messaging
7. **Date Separators** - Telegram-style date clouds between messages
8. **Full Date/Time** - "14:30 • 15 Mar" on every message
9. **Message Reactions** - ❤️👍😂🔥😮😢✅✨ (single per user, toggle)
10. **Reply** - Quote reply with sender name
11. **Delete** - For me / For everyone
12. **Read Receipts** - ✓ sent, ✓✓ read

### Media
13. **Photos** - Pick up to 3, collage display, fullscreen preview
14. **Sticker Packs** - 40 stickers in 5 categories (candy, love, party, cool, animals)
15. **Voice Messages** - Hold to record, shows duration, play button
16. **Gifts** - 🧸💝🎂🍬 with animated gift messages

### Calls (Firebase signaling)
17. **Audio/Video Calls** - Calling → Incoming → Active states
18. **Mic Mute** - Toggle with status visible to both users
19. **Camera Toggle** - On/off for video calls
20. **Call Duration** - Timer displayed during active call
21. **Incoming Call UI** - Avatar, name, accept/decline buttons

### Social
22. **User Profile Modal** - Click header → avatar, bio, call, video, gift buttons
23. **User Search** - Find users by nickname
24. **Online Status** - Green dot + last seen with full date
25. **Typing Indicator** - Real-time

### Groups
26. **Group Info** - Avatar, name, member list with count
27. **Member Management** - Kick members (owner only)
28. **Transfer Ownership** - Long-press member → transfer
29. **System Messages** - "User was kicked", "Name changed"

### Chat Management
30. **Favorites** - Saved messages chat
31. **Archive** - Archive/unarchive with separate section
32. **Mute** - Per-chat with bell icon indicator
33. **Pin** - Pin important chats to top
34. **Context Menu** - Long-press for column-style actions

### UI/UX
35. **Liquid Glass Style** - Semi-transparent backgrounds with border effects
36. **Animated Profile** - Rotating ring, pulsing code, glow effects
37. **Search in Chat** - With highlight + up/down navigation
38. **i18n** - Full English/Russian localization
39. **Splash Screen** - Spinning candy animation

## File Structure
```
frontend/app/
  _layout.tsx         - Root layout with providers
  index.tsx           - Animated splash screen
  auth.tsx            - Authentication screen
  (tabs)/
    _layout.tsx       - Tab navigation (Chats/Profile/Settings)
    chats.tsx         - Chat list + archive + favorites
    profile.tsx       - Profile with animated code
    settings.tsx      - All settings
  chat/[id].tsx       - Full chat room with all features
frontend/src/
  contexts/ThemeContext.tsx  - 4 themes + auto
  contexts/AuthContext.tsx   - Firebase auth
  lib/firebase.ts           - Firebase SDK init
  lib/i18n.ts               - EN/RU translations
```

## Business Enhancement
- Premium sticker packs & themes as in-app purchases
- Referral rewards system for user growth
