import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { langData } from '../../src/lib/i18n';
import { database, ref, onValue, off, get, update, remove, push, set, query, limitToLast, serverTimestamp } from '../../src/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatItem { id: string; lastMsg: string; timestamp: number; pinned?: boolean; nick?: string; avatar?: string; online?: boolean; }
const cleanNick = (n: string) => (n || '').replace(/^\$/, '');

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
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{visible: boolean; chat: ChatItem | null; isArchive: boolean}>({ visible: false, chat: null, isArchive: false });
  const [mutedChats, setMutedChats] = useState<Record<string, boolean>>({});
  const [archivedIds, setArchivedIds] = useState<Record<string, boolean>>({});
  const [showDelConfirm, setShowDelConfirm] = useState(false);
  const [delMode, setDelMode] = useState<'me'|'all'>('me');
  const [groupName, setGroupName] = useState('');
  const [myContacts, setMyContacts] = useState<any[]>([]);
  const [selMembers, setSelMembers] = useState<string[]>([]);
  const allRef = useRef<Record<string, ChatItem>>({});

  useEffect(() => {
    if (!myId) return;
    loadPrefs();
    const cRef = ref(database, `users/${myId}/chats`);
    onValue(cRef, snap => {
      const data = snap.val() || {};
      const nw: Record<string, ChatItem> = {};
      Object.keys(data).forEach(cid => { nw[cid] = { id: cid, lastMsg: data[cid].lastMsg || '...', timestamp: data[cid].timestamp || 0, pinned: data[cid].pinned || false }; });
      const fId = `favorites_${myId}`;
      if (!nw[fId]) nw[fId] = { id: fId, lastMsg: t.favorites_desc, timestamp: 0, nick: t.favorites };
      Object.keys(nw).forEach(cid => {
        if (cid.startsWith('favorites_')) { nw[cid].nick = t.favorites; return; }
        const ig = cid.startsWith('group_');
        onValue(ref(database, ig ? `groups/${cid}` : `users/${cid}`), s => {
          const u = s.val();
          if (u) { nw[cid].nick = cleanNick(u.name || u.nick || cid); nw[cid].avatar = u.avatar || ''; nw[cid].online = u.online || false; }
          allRef.current = { ...nw }; rebuild({ ...nw });
        }, { onlyOnce: false });
      });
      allRef.current = nw; rebuild(nw);
    });
    return () => off(cRef);
  }, [myId]);

  const loadPrefs = async () => { const m = await AsyncStorage.getItem('sladkiy_muted_' + myId); const a = await AsyncStorage.getItem('sladkiy_archived_' + myId); if (m) setMutedChats(JSON.parse(m)); if (a) setArchivedIds(JSON.parse(a)); };
  const saveMuted = async (d: Record<string, boolean>) => { setMutedChats(d); await AsyncStorage.setItem('sladkiy_muted_' + myId, JSON.stringify(d)); };
  const saveArchived = async (d: Record<string, boolean>) => { setArchivedIds(d); await AsyncStorage.setItem('sladkiy_archived_' + myId, JSON.stringify(d)); rebuild(allRef.current, d); };
  const rebuild = (all: Record<string, ChatItem>, aid?: Record<string, boolean>) => {
    const ar = aid || archivedIds; const arr = Object.values(all);
    setChats(arr.filter(c => !ar[c.id]).sort((a, b) => { if (a.id.startsWith('favorites_')) return 1; if (b.id.startsWith('favorites_')) return -1; if (a.pinned && !b.pinned) return -1; if (!a.pinned && b.pinned) return 1; return (b.timestamp || 0) - (a.timestamp || 0); }));
    setArchivedChats(arr.filter(c => ar[c.id]));
  };
  useEffect(() => { rebuild(allRef.current); }, [archivedIds]);

  const openChat = (id: string) => { id.startsWith('favorites_') ? router.push('/chat/favorites') : router.push(`/chat/${id}`); };
  const tglMute = () => { if (!ctxMenu.chat) return; const nm = { ...mutedChats }; const c = ctxMenu.chat.id; nm[c] ? delete nm[c] : nm[c] = true; saveMuted(nm); setCtxMenu({ visible: false, chat: null, isArchive: false }); };
  const tglArch = () => { if (!ctxMenu.chat) return; const na = { ...archivedIds }; const c = ctxMenu.chat.id; na[c] ? delete na[c] : na[c] = true; saveArchived(na); setCtxMenu({ visible: false, chat: null, isArchive: false }); };
  const tglPin = () => { if (!ctxMenu.chat || !myId) return; update(ref(database, `users/${myId}/chats/${ctxMenu.chat.id}`), { pinned: !ctxMenu.chat.pinned }); setCtxMenu({ visible: false, chat: null, isArchive: false }); };
  const confirmDel = (m: 'me'|'all') => { setDelMode(m); setShowDelConfirm(true); };
  const execDel = () => { if (!ctxMenu.chat || !myId) return; const c = ctxMenu.chat.id; remove(ref(database, `users/${myId}/chats/${c}`)); if (delMode === 'all') { const mp = c.startsWith('group_') ? c : [myId, c].sort().join('_'); remove(ref(database, `messages/${mp}`)); if (!c.startsWith('group_')) remove(ref(database, `users/${c}/chats/${myId}`)); } setShowDelConfirm(false); setCtxMenu({ visible: false, chat: null, isArchive: false }); };
  const doSearch = async () => { if (!searchQuery.trim()) { setSearchResults([]); return; } const snap = await get(query(ref(database, 'users'), limitToLast(100))); const res: any[] = []; const q = searchQuery.toLowerCase(); snap.forEach(s => { const u = s.val(); const nk = cleanNick(u.nick || '').toLowerCase(); if (s.key !== myId && nk.startsWith(q)) res.push({ id: s.key, ...u, nick: cleanNick(u.nick) }); }); setSearchResults(res); };
  useEffect(() => { doSearch(); }, [searchQuery]);
  const startChat = (uid: string) => { if (!myId) return; update(ref(database, `users/${myId}/chats/${uid}`), { lastMsg: '', timestamp: serverTimestamp() }); update(ref(database, `users/${uid}/chats/${myId}`), { lastMsg: '', timestamp: serverTimestamp() }); setShowSearchModal(false); router.push(`/chat/${uid}`); };
  const openGrp = () => { setShowFab(false); setShowGroupModal(true); setGroupName(''); setSelMembers([]); const c: any[] = []; Object.values(allRef.current).forEach(x => { if (x.id.startsWith('favorites_') || x.id.startsWith('group_')) return; c.push({ id: x.id, nick: cleanNick(x.nick || x.id), avatar: x.avatar }); }); setMyContacts(c); };
  const createGrp = async () => { if (!groupName.trim() || selMembers.length === 0 || !myId) return; const gid = 'group_' + Date.now(); const mem: Record<string, boolean> = { [myId]: true }; selMembers.forEach(u => { mem[u] = true; }); await set(ref(database, `groups/${gid}`), { name: groupName.trim(), owner: myId, members: mem, avatar: '', createdAt: serverTimestamp() }); await update(ref(database, `users/${myId}/chats/${gid}`), { lastMsg: '', timestamp: serverTimestamp() }); for (const u of selMembers) await update(ref(database, `users/${u}/chats/${gid}`), { lastMsg: '', timestamp: serverTimestamp() }); push(ref(database, `messages/${gid}`), { from: 'system', fromNick: 'System', text: `${myNick} created the group`, type: 'system', time: serverTimestamp(), status: 'sent' }); setShowGroupModal(false); router.push(`/chat/${gid}`); };

  const ava = (uri: string | undefined, letter: string, clr?: string) => (<View style={[s.avatar, { backgroundColor: clr || theme.primary }]}>{uri ? <Image source={{ uri }} style={s.avImg} /> : <Text style={s.avTxt}>{letter}</Text>}</View>);
  const gl = { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 };
  const rci = (item: ChatItem, isA?: boolean) => {
    const lt = cleanNick(item.nick || '').charAt(0).toUpperCase() || '?'; const isFav = item.id.startsWith('favorites_'); const isMtd = mutedChats[item.id];
    return (<TouchableOpacity key={item.id} testID={`chat-item-${item.id}`} style={[s.chatItem, gl, item.pinned && { borderLeftColor: theme.primary, borderLeftWidth: 4 }]} onPress={() => openChat(item.id)} onLongPress={() => !isFav && setCtxMenu({ visible: true, chat: item, isArchive: isA || false })} activeOpacity={0.7}>
      {isFav ? <View style={[s.avatar, { backgroundColor: '#FFD700' }]}><Ionicons name="bookmark" size={24} color="#fff" /></View> : ava(item.avatar, lt)}
      {item.online && !isFav && <View style={s.onDot} />}
      <View style={s.cInfo}><View style={s.nRow}><Text style={[s.cName, { color: theme.text }]} numberOfLines={1}>{cleanNick(item.nick || item.id)}</Text>{isMtd && <Ionicons name="notifications-off" size={14} color={theme.text_secondary} style={{ marginLeft: 4 }} />}{item.pinned && <Ionicons name="pin" size={12} color={theme.primary} style={{ marginLeft: 4 }} />}</View><Text style={[s.lastM, { color: theme.text_secondary }]} numberOfLines={1}>{item.lastMsg || '...'}</Text></View>
    </TouchableOpacity>);
  };

  return (
    <LinearGradient colors={theme.background_gradient as any} style={s.ctn}>
      <View style={[s.hdr, gl]}><Text style={[s.hdrT, { color: theme.text }]}>Sladkiygramm</Text></View>
      <FlatList testID="chat-list" data={chats} keyExtractor={i => i.id} renderItem={({ item }) => rci(item)} contentContainerStyle={s.lc}
        ListFooterComponent={() => (<View>{archivedChats.length > 0 && (<TouchableOpacity testID="archive-section-btn" style={[s.archBtn, gl]} onPress={() => setShowArchive(!showArchive)}><Ionicons name="archive" size={20} color={theme.primary} /><Text style={[s.archTxt, { color: theme.text }]}>{t.archive} ({archivedChats.length})</Text><Ionicons name={showArchive ? 'chevron-up' : 'chevron-down'} size={20} color={theme.text_secondary} /></TouchableOpacity>)}{showArchive && archivedChats.map(item => rci(item, true))}</View>)} />
      <View style={s.fabC}>{showFab && (<View style={s.fabM}><TouchableOpacity testID="fab-search" style={[s.fabI, gl]} onPress={() => { setShowFab(false); setShowSearchModal(true); }}><Ionicons name="person-add" size={18} color={theme.text} /><Text style={[s.fabIT, { color: theme.text }]}>{t.new_contact}</Text></TouchableOpacity><TouchableOpacity testID="fab-group" style={[s.fabI, gl]} onPress={openGrp}><Ionicons name="people" size={18} color={theme.text} /><Text style={[s.fabIT, { color: theme.text }]}>{t.new_group}</Text></TouchableOpacity></View>)}<TouchableOpacity testID="fab-btn" style={[s.fab, { backgroundColor: theme.primary }]} onPress={() => setShowFab(!showFab)}><Ionicons name={showFab ? 'close' : 'pencil'} size={26} color="#fff" /></TouchableOpacity></View>
      {/* Search */}
      <Modal visible={showSearchModal} transparent animationType="fade"><View style={s.ov}><View style={[s.mdl, gl, { backgroundColor: 'rgba(15,12,30,0.96)' }]}><TouchableOpacity style={s.clBtn} onPress={() => setShowSearchModal(false)}><Text style={[s.clTxt, { color: theme.text }]}>✕</Text></TouchableOpacity><Text style={[s.mdlT, { color: theme.text }]}>{t.search_users}</Text><TextInput testID="search-users-input" style={[s.inp, { color: theme.text, borderColor: theme.glass_border }]} placeholder={t.search_placeholder} placeholderTextColor={theme.text_secondary} value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" /><ScrollView style={s.resScr}>{searchResults.map(u => (<TouchableOpacity key={u.id} style={s.resI} onPress={() => startChat(u.id)}>{ava(u.avatar, (u.nick || '?').charAt(0).toUpperCase())}<Text style={[s.resN, { color: theme.text, marginLeft: 12 }]}>{u.nick}</Text></TouchableOpacity>))}</ScrollView></View></View></Modal>
      {/* Group */}
      <Modal visible={showGroupModal} transparent animationType="fade"><View style={s.ov}><View style={[s.mdl, gl, { backgroundColor: 'rgba(15,12,30,0.96)' }]}><TouchableOpacity style={s.clBtn} onPress={() => setShowGroupModal(false)}><Text style={[s.clTxt, { color: theme.text }]}>✕</Text></TouchableOpacity><Text style={[s.mdlT, { color: theme.text }]}>{t.create_group}</Text><TextInput testID="group-name-input" style={[s.inp, { color: theme.text, borderColor: theme.glass_border }]} placeholder={t.group_name_placeholder} placeholderTextColor={theme.text_secondary} value={groupName} onChangeText={setGroupName} /><Text style={[s.selL, { color: theme.text_secondary }]}>{t.select_members}</Text><ScrollView style={s.resScr}>{myContacts.map(c => (<TouchableOpacity key={c.id} style={[s.resI, selMembers.includes(c.id) && { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => setSelMembers(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])}>{ava(c.avatar, (c.nick || '?').charAt(0).toUpperCase())}<Text style={[s.resN, { color: theme.text, marginLeft: 12, flex: 1 }]}>{c.nick}</Text>{selMembers.includes(c.id) && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}</TouchableOpacity>))}</ScrollView><TouchableOpacity testID="create-group-btn" style={[s.crBtn, { backgroundColor: theme.primary }]} onPress={createGrp}><Ionicons name="people" size={20} color="#fff" /><Text style={s.crBtnT}>{t.create} ({selMembers.length})</Text></TouchableOpacity></View></View></Modal>
      {/* Context */}
      <Modal visible={ctxMenu.visible} transparent animationType="fade"><TouchableOpacity style={s.ov} onPress={() => setCtxMenu({ visible: false, chat: null, isArchive: false })} activeOpacity={1}><View style={[s.ctx, gl, { backgroundColor: 'rgba(15,12,30,0.96)' }]}><TouchableOpacity style={s.ctxI} onPress={tglPin}><Ionicons name="pin" size={18} color={theme.text} /><Text style={[s.ctxT, { color: theme.text }]}>{t.pin}</Text></TouchableOpacity><TouchableOpacity style={s.ctxI} onPress={tglMute}><Ionicons name={mutedChats[ctxMenu.chat?.id || ''] ? 'notifications' : 'notifications-off'} size={18} color={theme.text} /><Text style={[s.ctxT, { color: theme.text }]}>{mutedChats[ctxMenu.chat?.id || ''] ? t.unmute_notifications : t.mute_notifications}</Text></TouchableOpacity><TouchableOpacity style={s.ctxI} onPress={tglArch}><Ionicons name="archive" size={18} color={theme.text} /><Text style={[s.ctxT, { color: theme.text }]}>{ctxMenu.isArchive ? t.unarchive : t.archive}</Text></TouchableOpacity><TouchableOpacity style={s.ctxI} onPress={() => confirmDel('me')}><Ionicons name="trash-outline" size={18} color={theme.text} /><Text style={[s.ctxT, { color: theme.text }]}>{t.delete_for_me}</Text></TouchableOpacity><TouchableOpacity style={s.ctxI} onPress={() => confirmDel('all')}><Ionicons name="trash" size={18} color="#ff4444" /><Text style={[s.ctxT, { color: '#ff4444' }]}>{t.delete_for_all}</Text></TouchableOpacity></View></TouchableOpacity></Modal>
      {/* Delete confirm */}
      <Modal visible={showDelConfirm} transparent animationType="fade"><View style={s.ov}><View style={[s.cfmBox, gl, { backgroundColor: 'rgba(15,12,30,0.96)' }]}><Text style={[s.cfmTitle, { color: theme.text }]}>{t.are_you_sure}</Text><Text style={[s.cfmDesc, { color: theme.text_secondary }]}>{t.confirm_delete}</Text><View style={s.cfmBtns}><TouchableOpacity style={[s.cfmBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => setShowDelConfirm(false)}><Text style={[s.cfmBtnT, { color: theme.text }]}>{t.cancel}</Text></TouchableOpacity><TouchableOpacity style={[s.cfmBtn, { backgroundColor: '#ff4444' }]} onPress={execDel}><Text style={s.cfmBtnT}>{t.yes_sure}</Text></TouchableOpacity></View></View></View></Modal>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  ctn: { flex: 1 },
  hdr: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1 },
  hdrT: { fontSize: 18, fontWeight: '700' },
  lc: { padding: 10, paddingBottom: 100 },
  chatItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 8, minHeight: 72 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: 15, overflow: 'hidden' },
  avImg: { width: 50, height: 50, borderRadius: 25 },
  avTxt: { fontSize: 20, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  onDot: { position: 'absolute', left: 50, top: 48, width: 12, height: 12, backgroundColor: '#00e676', borderRadius: 6, borderWidth: 2, borderColor: '#111', zIndex: 2 },
  cInfo: { flex: 1 },
  nRow: { flexDirection: 'row', alignItems: 'center' },
  cName: { fontSize: 16, fontWeight: '700' },
  lastM: { fontSize: 14, opacity: 0.85, marginTop: 4 },
  archBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginTop: 10, gap: 10 },
  archTxt: { flex: 1, fontSize: 16, fontWeight: '600' },
  fabC: { position: 'absolute', bottom: 25, right: 25, alignItems: 'flex-end', gap: 10 },
  fabM: { gap: 10, marginBottom: 10 },
  fabI: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 18, borderRadius: 15, gap: 10 },
  fabIT: { fontSize: 14 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  ov: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  mdl: { padding: 25, borderRadius: 24, width: '85%', maxWidth: 360, maxHeight: '75%' },
  mdlT: { fontSize: 20, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
  clBtn: { position: 'absolute', top: 15, right: 20, zIndex: 10 },
  clTxt: { fontSize: 26, opacity: 0.7 },
  inp: { backgroundColor: 'rgba(0,0,0,0.15)', borderWidth: 1, padding: 14, borderRadius: 12, fontSize: 16, marginBottom: 12 },
  selL: { fontSize: 13, marginBottom: 8 },
  resScr: { maxHeight: 250 },
  resI: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', borderRadius: 10 },
  resN: { fontSize: 16, fontWeight: '600' },
  crBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, marginTop: 15, gap: 8 },
  crBtnT: { color: '#fff', fontSize: 16, fontWeight: '600' },
  ctx: { borderRadius: 16, minWidth: 220, overflow: 'hidden' },
  ctxI: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  ctxT: { fontSize: 14 },
  cfmBox: { padding: 25, borderRadius: 20, width: '80%', maxWidth: 320, alignItems: 'center' },
  cfmTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  cfmDesc: { fontSize: 14, opacity: 0.7, marginBottom: 20, textAlign: 'center' },
  cfmBtns: { flexDirection: 'row', gap: 12 },
  cfmBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14 },
  cfmBtnT: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
