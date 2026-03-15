import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { langData } from '../../src/lib/i18n';
import { database, ref, onValue, onChildAdded, onChildRemoved, onChildChanged, off, get, update, remove, push, query, limitToLast, serverTimestamp } from '../../src/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatItem {
  id: string;
  lastMsg: string;
  timestamp: number;
  pinned?: boolean;
  nick?: string;
  avatar?: string;
  online?: boolean;
  muted?: boolean;
  archived?: boolean;
}

export default function ChatsScreen() {
  const { theme, lang } = useTheme();
  const { myId, myNick } = useAuth();
  const router = useRouter();
  const t = langData[lang] || langData.en;
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [archivedChats, setArchivedChats] = useState<ChatItem[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [contextMenu, setContextMenu] = useState<{visible: boolean; chat: ChatItem | null; isArchive: boolean}>({ visible: false, chat: null, isArchive: false });
  const [mutedChats, setMutedChats] = useState<Record<string, boolean>>({});
  const [archivedIds, setArchivedIds] = useState<Record<string, boolean>>({});
  const chatDataRef = useRef<Record<string, ChatItem>>({});

  useEffect(() => {
    if (!myId) return;
    loadMutedAndArchived();
    const chatsRef = ref(database, `users/${myId}/chats`);
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const chatIds = Object.keys(data);
      const newChats: ChatItem[] = [];
      chatIds.forEach(id => {
        newChats.push({
          id,
          lastMsg: data[id].lastMsg || '...',
          timestamp: data[id].timestamp || 0,
          pinned: data[id].pinned || false,
        });
      });
      // Add favorites if not exists
      const hasFav = newChats.find(c => c.id === 'favorites_' + myId);
      if (!hasFav) {
        newChats.unshift({ id: 'favorites_' + myId, lastMsg: t.favorites_desc, timestamp: 0, nick: t.favorites });
      }
      // Load user info for each chat
      newChats.forEach(chat => {
        if (chat.id.startsWith('favorites_')) {
          chat.nick = t.favorites;
          return;
        }
        const isGroup = chat.id.startsWith('group_');
        const userRef = ref(database, isGroup ? `groups/${chat.id}` : `users/${chat.id}`);
        onValue(userRef, (s) => {
          const u = s.val();
          if (u) {
            chat.nick = u.name || u.nick || chat.id;
            chat.avatar = u.avatar || '';
            chat.online = u.online || false;
          }
          chatDataRef.current[chat.id] = { ...chat };
          updateChatList();
        }, { onlyOnce: false });
      });
      chatDataRef.current = {};
      newChats.forEach(c => { chatDataRef.current[c.id] = c; });
      updateChatList();
    });
    return () => off(chatsRef);
  }, [myId]);

  const loadMutedAndArchived = async () => {
    const muted = await AsyncStorage.getItem('sladkiy_muted_' + myId);
    const archived = await AsyncStorage.getItem('sladkiy_archived_' + myId);
    if (muted) setMutedChats(JSON.parse(muted));
    if (archived) setArchivedIds(JSON.parse(archived));
  };

  const saveMuted = async (data: Record<string, boolean>) => {
    setMutedChats(data);
    await AsyncStorage.setItem('sladkiy_muted_' + myId, JSON.stringify(data));
  };

  const saveArchived = async (data: Record<string, boolean>) => {
    setArchivedIds(data);
    await AsyncStorage.setItem('sladkiy_archived_' + myId, JSON.stringify(data));
  };

  const updateChatList = () => {
    const all = Object.values(chatDataRef.current);
    setChats(all.filter(c => !archivedIds[c.id]).sort((a, b) => {
      if (a.id.startsWith('favorites_')) return 1;
      if (b.id.startsWith('favorites_')) return -1;
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    }));
    setArchivedChats(all.filter(c => archivedIds[c.id]));
  };

  useEffect(() => { updateChatList(); }, [archivedIds]);

  const openChat = (id: string) => {
    if (id.startsWith('favorites_')) {
      router.push(`/chat/favorites`);
    } else {
      router.push(`/chat/${id}`);
    }
  };

  const handleLongPress = (chat: ChatItem, isArchive: boolean) => {
    setContextMenu({ visible: true, chat, isArchive });
  };

  const toggleMute = () => {
    if (!contextMenu.chat) return;
    const id = contextMenu.chat.id;
    const newMuted = { ...mutedChats };
    if (newMuted[id]) delete newMuted[id]; else newMuted[id] = true;
    saveMuted(newMuted);
    setContextMenu({ visible: false, chat: null, isArchive: false });
  };

  const toggleArchive = () => {
    if (!contextMenu.chat) return;
    const id = contextMenu.chat.id;
    const newArchived = { ...archivedIds };
    if (newArchived[id]) delete newArchived[id]; else newArchived[id] = true;
    saveArchived(newArchived);
    setContextMenu({ visible: false, chat: null, isArchive: false });
  };

  const togglePinChat = () => {
    if (!contextMenu.chat || !myId) return;
    const id = contextMenu.chat.id;
    const pinned = !contextMenu.chat.pinned;
    update(ref(database, `users/${myId}/chats/${id}`), { pinned });
    setContextMenu({ visible: false, chat: null, isArchive: false });
  };

  const handleDeleteChat = (everyone: boolean) => {
    if (!contextMenu.chat || !myId) return;
    const cid = contextMenu.chat.id;
    remove(ref(database, `users/${myId}/chats/${cid}`));
    if (everyone) {
      const msgPath = cid.startsWith('group_') ? cid : [myId, cid].sort().join('_');
      remove(ref(database, `messages/${msgPath}`));
      if (!cid.startsWith('group_')) remove(ref(database, `users/${cid}/chats/${myId}`));
    }
    setContextMenu({ visible: false, chat: null, isArchive: false });
  };

  const doSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const snapshot = await get(query(ref(database, 'users'), limitToLast(50)));
    const results: any[] = [];
    snapshot.forEach(s => {
      const u = s.val();
      if (s.key !== myId && u.nick && u.nick.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push({ id: s.key, ...u });
      }
    });
    setSearchResults(results);
  };

  useEffect(() => { doSearch(); }, [searchQuery]);

  const startChat = (userId: string) => {
    if (!myId) return;
    update(ref(database, `users/${myId}/chats/${userId}`), { lastMsg: '', timestamp: serverTimestamp() });
    update(ref(database, `users/${userId}/chats/${myId}`), { lastMsg: '', timestamp: serverTimestamp() });
    setShowSearchModal(false);
    router.push(`/chat/${userId}`);
  };

  const renderChatItem = ({ item, isArchiveList }: { item: ChatItem; isArchiveList?: boolean }) => {
    const letter = item.nick ? item.nick.charAt(0).toUpperCase() : '?';
    const isFavorites = item.id.startsWith('favorites_');
    const isMuted = mutedChats[item.id];

    return (
      <TouchableOpacity
        testID={`chat-item-${item.id}`}
        style={[styles.chatItem, { backgroundColor: theme.glass_bg, borderColor: theme.glass_border },
          item.pinned && { borderLeftColor: theme.primary, borderLeftWidth: 4 }
        ]}
        onPress={() => openChat(item.id)}
        onLongPress={() => !isFavorites && handleLongPress(item, isArchiveList || false)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: isFavorites ? '#FFD700' : theme.primary }]}>
          {isFavorites ? (
            <Ionicons name="bookmark" size={24} color="#fff" />
          ) : (
            <Text style={styles.avatarText}>{letter}</Text>
          )}
          {item.online && !isFavorites && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.chatName, { color: theme.text }]} numberOfLines={1}>{item.nick || item.id}</Text>
            {isMuted && <Ionicons name="notifications-off" size={14} color={theme.text_secondary} style={{ marginLeft: 4 }} />}
            {item.pinned && <Ionicons name="pin" size={12} color={theme.primary} style={{ marginLeft: 4 }} />}
          </View>
          <Text style={[styles.lastMsg, { color: theme.text_secondary }]} numberOfLines={1}>{item.lastMsg || '...'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.glass_bg, borderBottomColor: theme.glass_border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Sladkiygramm</Text>
      </View>

      <FlatList
        testID="chat-list"
        data={chats}
        keyExtractor={item => item.id}
        renderItem={({ item }) => renderChatItem({ item })}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={() => (
          <View>
            {archivedChats.length > 0 && (
              <TouchableOpacity
                testID="archive-section-btn"
                style={[styles.archiveBtn, { backgroundColor: theme.glass_bg, borderColor: theme.glass_border }]}
                onPress={() => setShowArchive(!showArchive)}
              >
                <Ionicons name="archive" size={20} color={theme.primary} />
                <Text style={[styles.archiveText, { color: theme.text }]}>{t.archive} ({archivedChats.length})</Text>
                <Ionicons name={showArchive ? 'chevron-up' : 'chevron-down'} size={20} color={theme.text_secondary} />
              </TouchableOpacity>
            )}
            {showArchive && archivedChats.map(item => (
              <View key={item.id}>{renderChatItem({ item, isArchiveList: true })}</View>
            ))}
          </View>
        )}
      />

      {/* FAB */}
      <View style={styles.fabContainer}>
        {showFab && (
          <View style={styles.fabMenu}>
            <TouchableOpacity testID="fab-search" style={[styles.fabItem, { backgroundColor: theme.glass_bg }]} onPress={() => { setShowFab(false); setShowSearchModal(true); }}>
              <Ionicons name="search" size={18} color={theme.text} />
              <Text style={[styles.fabItemText, { color: theme.text }]}>{t.new_contact}</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          testID="fab-btn"
          style={[styles.fab, { backgroundColor: theme.primary, transform: [{ rotate: showFab ? '45deg' : '0deg' }] }]}
          onPress={() => setShowFab(!showFab)}
        >
          <Ionicons name={showFab ? 'close' : 'pencil'} size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Users Modal */}
      <Modal visible={showSearchModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.glass_bg, borderColor: theme.glass_border }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSearchModal(false)}>
              <Text style={[styles.closeText, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.search_users}</Text>
            <TextInput
              testID="search-users-input"
              style={[styles.input, { color: theme.text, borderColor: theme.glass_border }]}
              placeholder={t.search_placeholder}
              placeholderTextColor={theme.text_secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            <ScrollView style={styles.searchResults}>
              {searchResults.map(u => (
                <TouchableOpacity key={u.id} style={styles.searchItem} onPress={() => startChat(u.id)}>
                  <View style={[styles.searchAvatar, { backgroundColor: theme.primary }]}>
                    <Text style={styles.avatarText}>{u.nick?.charAt(0).toUpperCase() || '?'}</Text>
                  </View>
                  <Text style={[styles.searchName, { color: theme.text }]}>{u.nick}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Context Menu */}
      <Modal visible={contextMenu.visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setContextMenu({ visible: false, chat: null, isArchive: false })} activeOpacity={1}>
          <View style={[styles.contextMenu, { backgroundColor: 'rgba(20,20,30,0.95)', borderColor: theme.glass_border }]}>
            {!contextMenu.chat?.id.startsWith('favorites_') && (
              <>
                <TouchableOpacity testID="ctx-pin" style={styles.ctxItem} onPress={togglePinChat}>
                  <Ionicons name="pin" size={18} color={theme.text} />
                  <Text style={[styles.ctxText, { color: theme.text }]}>{t.pin}</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="ctx-mute" style={styles.ctxItem} onPress={toggleMute}>
                  <Ionicons name={mutedChats[contextMenu.chat?.id || ''] ? 'notifications' : 'notifications-off'} size={18} color={theme.text} />
                  <Text style={[styles.ctxText, { color: theme.text }]}>
                    {mutedChats[contextMenu.chat?.id || ''] ? t.unmute_notifications : t.mute_notifications}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity testID="ctx-archive" style={styles.ctxItem} onPress={toggleArchive}>
                  <Ionicons name="archive" size={18} color={theme.text} />
                  <Text style={[styles.ctxText, { color: theme.text }]}>
                    {contextMenu.isArchive ? t.unarchive : t.archive}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity testID="ctx-delete" style={styles.ctxItem} onPress={() => handleDeleteChat(false)}>
                  <Ionicons name="trash" size={18} color="#ff4444" />
                  <Text style={[styles.ctxText, { color: '#ff4444' }]}>{t.delete}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  listContent: { padding: 10, paddingBottom: 100 },
  chatItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 8, borderWidth: 1, minHeight: 72 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, backgroundColor: '#00e676', borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  chatInfo: { flex: 1, overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  chatName: { fontSize: 16, fontWeight: '700' },
  lastMsg: { fontSize: 14, opacity: 0.85, marginTop: 4 },
  archiveBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginTop: 10, borderWidth: 1, gap: 10 },
  archiveText: { flex: 1, fontSize: 16, fontWeight: '600' },
  fabContainer: { position: 'absolute', bottom: 25, right: 25, alignItems: 'flex-end', gap: 10 },
  fabMenu: { gap: 10, marginBottom: 10 },
  fabItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 18, borderRadius: 15, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  fabItemText: { fontSize: 14 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 30, borderRadius: 28, borderWidth: 1, width: '85%', maxWidth: 360, maxHeight: '70%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
  closeBtn: { position: 'absolute', top: 15, right: 20, zIndex: 10 },
  closeText: { fontSize: 26, opacity: 0.7 },
  input: { backgroundColor: 'rgba(0,0,0,0.15)', borderWidth: 1, padding: 14, borderRadius: 12, fontSize: 16, marginBottom: 15 },
  searchResults: { maxHeight: 250 },
  searchItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  searchAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  searchName: { fontSize: 16, fontWeight: '600' },
  contextMenu: { borderRadius: 16, borderWidth: 1, minWidth: 200, overflow: 'hidden' },
  ctxItem: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  ctxText: { fontSize: 14 },
});
