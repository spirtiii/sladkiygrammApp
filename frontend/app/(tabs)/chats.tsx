import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { langData } from '../../src/lib/i18n';
import { database, ref, onValue, off, get, update, remove, push, query, limitToLast, serverTimestamp } from '../../src/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatItem {
  id: string;
  lastMsg: string;
  timestamp: number;
  pinned?: boolean;
  nick?: string;
  avatar?: string;
  online?: boolean;
}

export default function ChatsScreen() {
  const { theme, lang } = useTheme();
  const { myId } = useAuth();
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
  const allChatsRef = useRef<Record<string, ChatItem>>({});

  useEffect(() => {
    if (!myId) return;
    loadLocalPrefs();
    const chatsRef = ref(database, `users/${myId}/chats`);
    onValue(chatsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const chatIds = Object.keys(data);
      const newAll: Record<string, ChatItem> = {};
      chatIds.forEach(cid => {
        newAll[cid] = {
          id: cid, lastMsg: data[cid].lastMsg || '...', timestamp: data[cid].timestamp || 0, pinned: data[cid].pinned || false,
        };
      });
      // Favorites
      const favId = `favorites_${myId}`;
      if (!newAll[favId]) newAll[favId] = { id: favId, lastMsg: t.favorites_desc, timestamp: 0, nick: t.favorites };
      // Fetch user info
      Object.keys(newAll).forEach(cid => {
        if (cid.startsWith('favorites_')) { newAll[cid].nick = t.favorites; return; }
        const isGroup = cid.startsWith('group_');
        const uRef = ref(database, isGroup ? `groups/${cid}` : `users/${cid}`);
        onValue(uRef, s => {
          const u = s.val();
          if (u) {
            newAll[cid].nick = u.name || u.nick || cid;
            newAll[cid].avatar = u.avatar || '';
            newAll[cid].online = u.online || false;
          }
          allChatsRef.current = { ...newAll };
          rebuildLists({ ...newAll });
        }, { onlyOnce: false });
      });
      allChatsRef.current = newAll;
      rebuildLists(newAll);
    });
    return () => off(chatsRef);
  }, [myId]);

  const loadLocalPrefs = async () => {
    const m = await AsyncStorage.getItem('sladkiy_muted_' + myId);
    const a = await AsyncStorage.getItem('sladkiy_archived_' + myId);
    if (m) setMutedChats(JSON.parse(m));
    if (a) setArchivedIds(JSON.parse(a));
  };
  const saveMuted = async (d: Record<string, boolean>) => { setMutedChats(d); await AsyncStorage.setItem('sladkiy_muted_' + myId, JSON.stringify(d)); };
  const saveArchived = async (d: Record<string, boolean>) => { setArchivedIds(d); await AsyncStorage.setItem('sladkiy_archived_' + myId, JSON.stringify(d)); rebuildLists(allChatsRef.current, d); };

  const rebuildLists = (all: Record<string, ChatItem>, archIds?: Record<string, boolean>) => {
    const aid = archIds || archivedIds;
    const arr = Object.values(all);
    setChats(arr.filter(c => !aid[c.id]).sort((a, b) => {
      if (a.id.startsWith('favorites_')) return 1;
      if (b.id.startsWith('favorites_')) return -1;
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    }));
    setArchivedChats(arr.filter(c => aid[c.id]));
  };
  useEffect(() => { rebuildLists(allChatsRef.current); }, [archivedIds]);

  const openChat = (id: string) => {
    if (id.startsWith('favorites_')) router.push('/chat/favorites');
    else router.push(`/chat/${id}`);
  };
  const toggleMute = () => {
    if (!contextMenu.chat) return;
    const cid = contextMenu.chat.id;
    const nm = { ...mutedChats }; if (nm[cid]) delete nm[cid]; else nm[cid] = true;
    saveMuted(nm); setContextMenu({ visible: false, chat: null, isArchive: false });
  };
  const toggleArchive = () => {
    if (!contextMenu.chat) return;
    const cid = contextMenu.chat.id;
    const na = { ...archivedIds }; if (na[cid]) delete na[cid]; else na[cid] = true;
    saveArchived(na); setContextMenu({ visible: false, chat: null, isArchive: false });
  };
  const togglePin = () => {
    if (!contextMenu.chat || !myId) return;
    update(ref(database, `users/${myId}/chats/${contextMenu.chat.id}`), { pinned: !contextMenu.chat.pinned });
    setContextMenu({ visible: false, chat: null, isArchive: false });
  };
  const deleteChat = () => {
    if (!contextMenu.chat || !myId) return;
    remove(ref(database, `users/${myId}/chats/${contextMenu.chat.id}`));
    setContextMenu({ visible: false, chat: null, isArchive: false });
  };
  const doSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const snap = await get(query(ref(database, 'users'), limitToLast(50)));
    const res: any[] = [];
    snap.forEach(s => {
      const u = s.val();
      if (s.key !== myId && u.nick?.toLowerCase().includes(searchQuery.toLowerCase()))
        res.push({ id: s.key, ...u });
    });
    setSearchResults(res);
  };
  useEffect(() => { doSearch(); }, [searchQuery]);
  const startChat = (uid: string) => {
    if (!myId) return;
    update(ref(database, `users/${myId}/chats/${uid}`), { lastMsg: '', timestamp: serverTimestamp() });
    update(ref(database, `users/${uid}/chats/${myId}`), { lastMsg: '', timestamp: serverTimestamp() });
    setShowSearchModal(false); router.push(`/chat/${uid}`);
  };

  const renderAvatar = (uri: string | undefined, letter: string, color?: string) => (
    <View style={[styles.avatar, { backgroundColor: color || theme.primary }]}>
      {uri ? <Image source={{ uri }} style={styles.avatarImg} /> : <Text style={styles.avatarText}>{letter}</Text>}
    </View>
  );

  const glassStyle = { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 };

  const renderChatItem = (item: ChatItem, isArchiveList?: boolean) => {
    const letter = item.nick?.charAt(0).toUpperCase() || '?';
    const isFav = item.id.startsWith('favorites_');
    const isMuted = mutedChats[item.id];
    return (
      <TouchableOpacity key={item.id} testID={`chat-item-${item.id}`}
        style={[styles.chatItem, glassStyle, item.pinned && { borderLeftColor: theme.primary, borderLeftWidth: 4 }]}
        onPress={() => openChat(item.id)}
        onLongPress={() => !isFav && setContextMenu({ visible: true, chat: item, isArchive: isArchiveList || false })}
        activeOpacity={0.7}>
        {isFav ? (
          <View style={[styles.avatar, { backgroundColor: '#FFD700' }]}><Ionicons name="bookmark" size={24} color="#fff" /></View>
        ) : renderAvatar(item.avatar, letter)}
        {item.online && !isFav && <View style={styles.onlineDot} />}
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
      <View style={[styles.header, glassStyle]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Sladkiygramm</Text>
      </View>
      <FlatList testID="chat-list" data={chats} keyExtractor={i => i.id}
        renderItem={({ item }) => renderChatItem(item)}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={() => (
          <View>
            {archivedChats.length > 0 && (
              <TouchableOpacity testID="archive-section-btn" style={[styles.archiveBtn, glassStyle]} onPress={() => setShowArchive(!showArchive)}>
                <Ionicons name="archive" size={20} color={theme.primary} />
                <Text style={[styles.archiveText, { color: theme.text }]}>{t.archive} ({archivedChats.length})</Text>
                <Ionicons name={showArchive ? 'chevron-up' : 'chevron-down'} size={20} color={theme.text_secondary} />
              </TouchableOpacity>
            )}
            {showArchive && archivedChats.map(item => renderChatItem(item, true))}
          </View>
        )}
      />
      {/* FAB */}
      <View style={styles.fabContainer}>
        {showFab && (
          <View style={styles.fabMenu}>
            <TouchableOpacity testID="fab-search" style={[styles.fabItem, glassStyle]} onPress={() => { setShowFab(false); setShowSearchModal(true); }}>
              <Ionicons name="search" size={18} color={theme.text} />
              <Text style={[styles.fabItemText, { color: theme.text }]}>{t.new_contact}</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity testID="fab-btn" style={[styles.fab, { backgroundColor: theme.primary }]} onPress={() => setShowFab(!showFab)}>
          <Ionicons name={showFab ? 'close' : 'pencil'} size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* Search Modal */}
      <Modal visible={showSearchModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, glassStyle, { backgroundColor: 'rgba(15,12,30,0.96)' }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSearchModal(false)}><Text style={[styles.closeText, { color: theme.text }]}>✕</Text></TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.search_users}</Text>
            <TextInput testID="search-users-input" style={[styles.input, { color: theme.text, borderColor: theme.glass_border }]}
              placeholder={t.search_placeholder} placeholderTextColor={theme.text_secondary} value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" />
            <ScrollView style={styles.searchResults}>
              {searchResults.map(u => (
                <TouchableOpacity key={u.id} style={styles.searchItem} onPress={() => startChat(u.id)}>
                  {renderAvatar(u.avatar, u.nick?.charAt(0).toUpperCase() || '?')}
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={[styles.searchName, { color: theme.text }]}>{u.nick}</Text>
                    {u.bio && <Text style={[styles.searchBio, { color: theme.text_secondary }]} numberOfLines={1}>{u.bio}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Context Menu */}
      <Modal visible={contextMenu.visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setContextMenu({ visible: false, chat: null, isArchive: false })} activeOpacity={1}>
          <View style={[styles.contextMenu, glassStyle, { backgroundColor: 'rgba(15,12,30,0.96)' }]}>
            <TouchableOpacity testID="ctx-pin" style={styles.ctxItem} onPress={togglePin}>
              <Ionicons name="pin" size={18} color={theme.text} /><Text style={[styles.ctxText, { color: theme.text }]}>{t.pin}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="ctx-mute" style={styles.ctxItem} onPress={toggleMute}>
              <Ionicons name={mutedChats[contextMenu.chat?.id || ''] ? 'notifications' : 'notifications-off'} size={18} color={theme.text} />
              <Text style={[styles.ctxText, { color: theme.text }]}>{mutedChats[contextMenu.chat?.id || ''] ? t.unmute_notifications : t.mute_notifications}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="ctx-archive" style={styles.ctxItem} onPress={toggleArchive}>
              <Ionicons name="archive" size={18} color={theme.text} />
              <Text style={[styles.ctxText, { color: theme.text }]}>{contextMenu.isArchive ? t.unarchive : t.archive}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="ctx-delete" style={styles.ctxItem} onPress={deleteChat}>
              <Ionicons name="trash" size={18} color="#ff4444" /><Text style={[styles.ctxText, { color: '#ff4444' }]}>{t.delete}</Text>
            </TouchableOpacity>
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
  chatItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 8, minHeight: 72 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: 15, overflow: 'hidden' },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  onlineDot: { position: 'absolute', left: 50, top: 48, width: 12, height: 12, backgroundColor: '#00e676', borderRadius: 6, borderWidth: 2, borderColor: '#111', zIndex: 2 },
  chatInfo: { flex: 1, overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  chatName: { fontSize: 16, fontWeight: '700' },
  lastMsg: { fontSize: 14, opacity: 0.85, marginTop: 4 },
  archiveBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginTop: 10, gap: 10 },
  archiveText: { flex: 1, fontSize: 16, fontWeight: '600' },
  fabContainer: { position: 'absolute', bottom: 25, right: 25, alignItems: 'flex-end', gap: 10 },
  fabMenu: { gap: 10, marginBottom: 10 },
  fabItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 18, borderRadius: 15, gap: 10 },
  fabItemText: { fontSize: 14 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 25, borderRadius: 24, width: '85%', maxWidth: 360, maxHeight: '70%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
  closeBtn: { position: 'absolute', top: 15, right: 20, zIndex: 10 },
  closeText: { fontSize: 26, opacity: 0.7 },
  input: { backgroundColor: 'rgba(0,0,0,0.15)', borderWidth: 1, padding: 14, borderRadius: 12, fontSize: 16, marginBottom: 15 },
  searchResults: { maxHeight: 250 },
  searchItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  searchName: { fontSize: 16, fontWeight: '600' },
  searchBio: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  contextMenu: { borderRadius: 16, minWidth: 220, overflow: 'hidden' },
  ctxItem: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  ctxText: { fontSize: 14 },
});
