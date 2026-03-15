import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Modal, Alert, Animated, Easing, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { langData } from '../../src/lib/i18n';
import { database, ref, onValue, onChildAdded, onChildRemoved, onChildChanged, off, get, update, remove, push, query, limitToLast, serverTimestamp, set } from '../../src/lib/firebase';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

const REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢', '✅', '✨'];
const STICKERS = [
  ['🍬','🍭','🍫','🍩','🧁','🎂','🍰','🍪'],
  ['😍','🥰','😘','💕','💖','💝','🫶','❤️‍🔥'],
  ['🎉','🎊','🥳','🎈','🎁','🪅','✨','🌟'],
  ['😎','🤩','🥶','🤯','😈','👻','💀','🤖'],
  ['🐱','🐶','🦊','🐻','🐼','🦄','🐸','🐙'],
];
const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const { width: SCREEN_W } = Dimensions.get('window');

interface Msg {
  key: string;
  from: string;
  fromNick: string;
  text: string;
  type: string;
  time: number;
  status: string;
  replyTo?: { text: string; nick: string };
  giftIcon?: string;
  giftLabel?: string;
  reactions?: Record<string, string>;
  voiceDuration?: string;
  voiceUri?: string;
  photos?: string[];
  deletedFor?: Record<string, boolean>;
}

const GIFTS = [
  { icon: '🧸', label: 'Sweet Toy', labelRu: 'Сладкая игрушка' },
  { icon: '💝', label: 'Sweet Love', labelRu: 'Сладкая любовь' },
  { icon: '🎂', label: 'Sweet Cake', labelRu: 'Сладкий торт' },
  { icon: '🍬', label: 'Sweet Candy', labelRu: 'Сладкая конфета' },
];

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, lang } = useTheme();
  const { myId, myNick, myAvatar } = useAuth();
  const router = useRouter();
  const t = langData[lang] || langData.en;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputText, setInputText] = useState('');
  const [peerNick, setPeerNick] = useState('');
  const [peerAvatar, setPeerAvatar] = useState('');
  const [peerBio, setPeerBio] = useState('');
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<{text: string; nick: string} | null>(null);
  const [showMsgMenu, setShowMsgMenu] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Msg | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  // Call state
  const [callState, setCallState] = useState<'none'|'calling'|'incoming'|'active'>('none');
  const [callType, setCallType] = useState<'audio'|'video'>('audio');
  const [callDuration, setCallDuration] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [peerMicMuted, setPeerMicMuted] = useState(false);
  const [callerInfo, setCallerInfo] = useState<{nick: string; avatar: string}>({nick:'', avatar:''});
  // Group
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [groupOwner, setGroupOwner] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showMemberMenu, setShowMemberMenu] = useState<{visible: boolean; member: any}>({visible: false, member: null});

  const userScrolledUp = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [voiceTooltip, setVoiceTooltip] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimer = useRef<any>(null);
  const callTimer = useRef<any>(null);
  const typingTimeout = useRef<any>(null);

  const isFavorites = id === 'favorites';
  const isGroup = id?.startsWith('group_') || false;
  const chatId = isFavorites ? `favorites_${myId}` : (isGroup ? id : [myId, id].sort().join('_'));

  // Load peer info
  useEffect(() => {
    if (!myId || !id) return;
    if (isFavorites) { setPeerNick(t.favorites); loadMessages(); return; }
    if (isGroup) {
      const gRef = ref(database, `groups/${id}`);
      onValue(gRef, s => {
        const g = s.val();
        if (g) {
          setPeerNick(g.name || id);
          setPeerAvatar(g.avatar || '');
          setGroupOwner(g.owner || '');
          if (g.members) {
            const mArr: any[] = [];
            Object.keys(g.members).forEach(uid => {
              get(ref(database, `users/${uid}`)).then(us => {
                const u = us.val();
                mArr.push({ id: uid, nick: u?.nick || uid, avatar: u?.avatar || '', online: u?.online || false });
                setGroupMembers([...mArr]);
              });
            });
          }
        }
      });
    } else {
      const uRef = ref(database, `users/${id}`);
      onValue(uRef, s => {
        const u = s.val();
        if (u) {
          setPeerNick(u.nick || id);
          setPeerAvatar(u.avatar || '');
          setPeerBio(u.bio || '');
          setPeerOnline(u.online || false);
          setPeerLastSeen(u.lastSeen || null);
        }
      });
      onValue(ref(database, `users/${id}/chats/${myId}/typing`), s => setPeerTyping(s.val() || false));
      // Listen for incoming calls
      onValue(ref(database, `calls/${myId}`), s => {
        const c = s.val();
        if (c && c.status === 'ringing' && c.from !== myId) {
          setCallState('incoming');
          setCallType(c.type || 'audio');
          setCallerInfo({ nick: c.fromNick || '', avatar: c.fromAvatar || '' });
        }
        if (c && c.status === 'active' && callState === 'calling') {
          setCallState('active');
          setCallDuration(0);
          callTimer.current = setInterval(() => setCallDuration(d => d + 1), 1000);
        }
        if (c && c.status === 'ended') {
          endCallLocal();
        }
        if (c && c.micMuted !== undefined) setPeerMicMuted(c.micMuted);
      });
    }
    loadMessages();
    return () => { clearInterval(callTimer.current); };
  }, [myId, id]);

  const loadMessages = () => {
    if (!chatId) return;
    const msgsRef = query(ref(database, `messages/${chatId}`), limitToLast(200));
    onChildAdded(msgsRef, s => {
      const msg = s.val();
      if (msg.deletedFor && msg.deletedFor[myId!]) return;
      const newMsg: Msg = { key: s.key!, ...msg };
      setMessages(prev => {
        if (prev.find(m => m.key === newMsg.key)) return prev;
        return [...prev, newMsg];
      });
      if (msg.from !== myId && msg.status !== 'read') {
        update(ref(database, `messages/${chatId}/${s.key}`), { status: 'read' });
      }
    });
    onChildChanged(ref(database, `messages/${chatId}`), s => {
      const val = s.val();
      setMessages(prev => prev.map(m => {
        if (m.key === s.key) {
          if (val.deletedFor && val.deletedFor[myId!]) return null as any;
          return { ...m, ...val, key: s.key! };
        }
        return m;
      }).filter(Boolean));
    });
    onChildRemoved(ref(database, `messages/${chatId}`), s => {
      setMessages(prev => prev.filter(m => m.key !== s.key));
    });
  };

  const sendMessage = () => {
    const txt = inputText.trim();
    if ((!txt && selectedPhotos.length === 0) || !chatId || !myId) return;
    const payload: any = {
      from: myId, fromNick: myNick, text: txt || (selectedPhotos.length > 0 ? '📷' : ''), type: selectedPhotos.length > 0 ? 'photo' : 'text',
      time: serverTimestamp(), status: 'sent',
    };
    if (selectedPhotos.length > 0) payload.photos = selectedPhotos;
    if (replyTo) { payload.replyTo = replyTo; setReplyTo(null); }
    push(ref(database, `messages/${chatId}`), payload);
    const lastMsg = txt || '📷 Photo';
    if (!isFavorites && !isGroup) {
      update(ref(database, `users/${myId}/chats/${id}`), { lastMsg, timestamp: serverTimestamp() });
      update(ref(database, `users/${id}/chats/${myId}`), { lastMsg, timestamp: serverTimestamp() });
    }
    if (isFavorites) update(ref(database, `users/${myId}/chats/favorites_${myId}`), { lastMsg, timestamp: serverTimestamp() });
    setInputText(''); setSelectedPhotos([]); clearTyping();
  };

  const sendSticker = (sticker: string) => {
    if (!chatId || !myId) return;
    push(ref(database, `messages/${chatId}`), {
      from: myId, fromNick: myNick, text: sticker, type: 'sticker',
      time: serverTimestamp(), status: 'sent',
    });
    const lastMsg = `${sticker}`;
    if (!isFavorites && !isGroup) {
      update(ref(database, `users/${myId}/chats/${id}`), { lastMsg, timestamp: serverTimestamp() });
      update(ref(database, `users/${id}/chats/${myId}`), { lastMsg, timestamp: serverTimestamp() });
    }
    setShowStickerPicker(false);
  };

  const sendGift = (gift: typeof GIFTS[0]) => {
    if (!chatId || !myId) return;
    push(ref(database, `messages/${chatId}`), {
      from: myId, fromNick: myNick, text: `${gift.icon} ${lang === 'ru' ? gift.labelRu : gift.label}`,
      type: 'gift', giftIcon: gift.icon, giftLabel: lang === 'ru' ? gift.labelRu : gift.label,
      time: serverTimestamp(), status: 'sent',
    });
    if (!isFavorites && !isGroup) {
      update(ref(database, `users/${myId}/chats/${id}`), { lastMsg: `🎁 ${gift.icon}`, timestamp: serverTimestamp() });
      update(ref(database, `users/${id}/chats/${myId}`), { lastMsg: `🎁 ${gift.icon}`, timestamp: serverTimestamp() });
    }
    setShowGiftModal(false);
  };

  // Photo picker
  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3, quality: 0.4, base64: true,
    });
    if (!result.canceled) {
      const photos = result.assets.slice(0, 3).map(a => `data:image/jpeg;base64,${a.base64}`).filter(Boolean);
      setSelectedPhotos(photos as string[]);
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    if (isFavorites || !myId || !id) return;
    update(ref(database, `users/${myId}/chats/${id}`), { typing: true }).catch(() => {});
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(clearTyping, 2000);
  };
  const clearTyping = () => {
    if (isFavorites || !myId || !id) return;
    update(ref(database, `users/${myId}/chats/${id}`), { typing: false }).catch(() => {});
  };

  const handleReaction = (msgKey: string, emoji: string) => {
    if (!myId || !chatId) return;
    const rRef = ref(database, `messages/${chatId}/${msgKey}/reactions/${myId}`);
    get(rRef).then(s => { s.val() === emoji ? remove(rRef) : set(rRef, emoji); });
    setShowMsgMenu(false); setSelectedMsg(null);
  };

  const deleteMessage = (everyone: boolean) => {
    if (!selectedMsg || !chatId || !myId) return;
    if (everyone) remove(ref(database, `messages/${chatId}/${selectedMsg.key}`));
    else update(ref(database, `messages/${chatId}/${selectedMsg.key}/deletedFor`), { [myId]: true });
    setShowMsgMenu(false); setSelectedMsg(null);
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true); setRecordingDuration(0);
      recordingTimer.current = setInterval(() => setRecordingDuration(d => d + 100), 100);
    } catch (e) { console.log('Rec err:', e); }
  };
  const stopRecording = async () => {
    if (!recordingRef.current) return;
    clearInterval(recordingTimer.current); setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (chatId && myId && uri) {
        const dur = fmtDur(recordingDuration);
        push(ref(database, `messages/${chatId}`), {
          from: myId, fromNick: myNick, text: `🎤 ${dur}`, type: 'voice',
          time: serverTimestamp(), status: 'sent', voiceDuration: dur, voiceUri: uri,
        });
        if (!isFavorites && !isGroup) {
          update(ref(database, `users/${myId}/chats/${id}`), { lastMsg: `🎤 ${dur}`, timestamp: serverTimestamp() });
          update(ref(database, `users/${id}/chats/${myId}`), { lastMsg: `🎤 ${dur}`, timestamp: serverTimestamp() });
        }
      }
    } catch (e) { console.log('Stop err:', e); }
  };
  const onVoiceTap = () => { setVoiceTooltip(true); setTimeout(() => setVoiceTooltip(false), 2000); };
  const playVoice = async (uri?: string) => {
    if (!uri) return;
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) { setPlayingKey(null); sound.unloadAsync(); }
      });
      await sound.playAsync();
    } catch (e) { console.log('Play err:', e); }
  };

  // Pick video
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.4, base64: false });
    if (!result.canceled && result.assets[0] && chatId && myId) {
      push(ref(database, `messages/${chatId}`), {
        from: myId, fromNick: myNick, text: '📹 Video', type: 'video',
        time: serverTimestamp(), status: 'sent',
      });
      if (!isFavorites && !isGroup) {
        update(ref(database, `users/${myId}/chats/${id}`), { lastMsg: '📹 Video', timestamp: serverTimestamp() });
        update(ref(database, `users/${id}/chats/${myId}`), { lastMsg: '📹 Video', timestamp: serverTimestamp() });
      }
    }
  };

  // Calls
  const startCall = async (type: 'audio'|'video') => {
    if (!myId || !id || isFavorites || isGroup) return;
    setCallType(type); setCallState('calling'); setMicMuted(false); setCamOn(type === 'video');
    await set(ref(database, `calls/${id}`), {
      from: myId, fromNick: myNick, fromAvatar: myAvatar || '', type, status: 'ringing', micMuted: false, time: serverTimestamp(),
    });
    push(ref(database, `messages/${chatId}`), {
      from: myId, fromNick: myNick, text: type === 'video' ? '📹 Video call' : '📞 Audio call',
      type: 'system', time: serverTimestamp(), status: 'sent',
    });
  };
  const acceptCall = async () => {
    if (!myId) return;
    await update(ref(database, `calls/${myId}`), { status: 'active' });
    setCallState('active'); setCallDuration(0);
    callTimer.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };
  const declineCall = async () => {
    if (!myId) return;
    await update(ref(database, `calls/${myId}`), { status: 'ended' });
    endCallLocal();
  };
  const endCall = async () => {
    if (!myId || !id) return;
    await update(ref(database, `calls/${id}`), { status: 'ended' }).catch(() => {});
    await update(ref(database, `calls/${myId}`), { status: 'ended' }).catch(() => {});
    const dur = fmtCallDur(callDuration);
    push(ref(database, `messages/${chatId}`), {
      from: myId, fromNick: myNick, text: `📞 ${lang === 'ru' ? 'Звонок завершён' : 'Call ended'} • ${dur}`,
      type: 'system', time: serverTimestamp(), status: 'sent',
    });
    endCallLocal();
  };
  const endCallLocal = () => {
    setCallState('none'); setCallDuration(0); clearInterval(callTimer.current);
  };
  const toggleMic = () => {
    setMicMuted(m => {
      const v = !m;
      if (id) update(ref(database, `calls/${id}`), { micMuted: v }).catch(() => {});
      return v;
    });
  };
  const toggleCam = () => setCamOn(c => !c);

  // Group actions
  const kickMember = (uid: string) => {
    if (!id || !myId || groupOwner !== myId) return;
    remove(ref(database, `groups/${id}/members/${uid}`));
    remove(ref(database, `users/${uid}/chats/${id}`));
    push(ref(database, `messages/${chatId}`), {
      from: 'system', fromNick: 'System', text: `${uid} ${lang === 'ru' ? 'был исключён' : 'was kicked'}`,
      type: 'system', time: serverTimestamp(), status: 'sent',
    });
    setShowMemberMenu({ visible: false, member: null });
  };
  const transferOwnership = (uid: string) => {
    if (!id || !myId || groupOwner !== myId) return;
    update(ref(database, `groups/${id}`), { owner: uid });
    push(ref(database, `messages/${chatId}`), {
      from: 'system', fromNick: 'System',
      text: `${lang === 'ru' ? 'Права переданы' : 'Ownership transferred to'} ${uid}`,
      type: 'system', time: serverTimestamp(), status: 'sent',
    });
    setShowMemberMenu({ visible: false, member: null });
  };
  const changeGroupName = () => {
    setNewGroupName(peerNick || '');
    setShowGroupNameInput(true);
  };
  const submitGroupName = () => {
    if (newGroupName.trim() && id && myId) {
      update(ref(database, `groups/${id}`), { name: newGroupName.trim() });
      push(ref(database, `messages/${chatId}`), {
        from: 'system', fromNick: 'System',
        text: `${myNick} ${lang === 'ru' ? 'изменил название' : 'changed name'}`,
        type: 'system', time: serverTimestamp(), status: 'sent',
      });
    }
    setShowGroupNameInput(false);
  };
  const changeGroupAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1,1], quality: 0.4, base64: true });
    if (!result.canceled && result.assets[0].base64 && id && myId) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      update(ref(database, `groups/${id}`), { avatar: base64 });
      push(ref(database, `messages/${chatId}`), { from: 'system', fromNick: 'System', text: `${myNick} ${lang === 'ru' ? 'изменил аватар' : 'changed avatar'}`, type: 'system', time: serverTimestamp(), status: 'sent' });
    }
  };

  // Helpers
  const fmtDur = (ms: number) => {
    const s = Math.floor(ms / 1000); const m = Math.floor(s / 60);
    return `${m.toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}.${Math.floor((ms%1000)/10).toString().padStart(2,'0')}`;
  };
  const fmtCallDur = (sec: number) => `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;
  const fmtLastSeen = (ts: number | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return t.just_now;
    if (diffMin < 60) return `${diffMin} ${t.min_ago}`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} ${t.hours_ago}`;
    const isYesterday = now.getDate() - d.getDate() === 1 && now.getMonth() === d.getMonth();
    const timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
    if (isYesterday) return `${t.yesterday} ${timeStr}`;
    const months = lang === 'ru' ? MONTHS_RU : MONTHS_EN;
    return `${t.last_seen} ${d.getDate()} ${months[d.getMonth()]} ${t.at} ${timeStr}`;
  };
  const fmtMsgDate = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const months = lang === 'ru' ? MONTHS_RU : MONTHS_EN;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  const fmtMsgTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const months = lang === 'ru' ? MONTHS_RU : MONTHS_EN;
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')} • ${d.getDate()} ${months[d.getMonth()].substring(0,3)}`;
  };
  const getStatusText = () => {
    if (isFavorites) return t.favorites_desc;
    if (isGroup) return `${groupMembers.length} ${lang === 'ru' ? 'участников' : 'members'}`;
    if (peerTyping) return t.typing;
    if (peerOnline) return t.online;
    return fmtLastSeen(peerLastSeen);
  };

  // Search
  useEffect(() => {
    if (!searchText.trim()) { setSearchResults([]); return; }
    const res: number[] = [];
    messages.forEach((m, i) => { if (m.text?.toLowerCase().includes(searchText.toLowerCase())) res.push(i); });
    setSearchResults(res); setSearchIndex(res.length > 0 ? res.length - 1 : 0);
  }, [searchText, messages]);
  const navSearch = (dir: 'up'|'down') => {
    if (!searchResults.length) return;
    let i = dir === 'up' ? searchIndex - 1 : searchIndex + 1;
    if (i < 0) i = searchResults.length - 1;
    if (i >= searchResults.length) i = 0;
    setSearchIndex(i);
    flatListRef.current?.scrollToIndex({ index: searchResults[i], animated: true });
  };
  const highlightText = (text: string, q: string) => {
    if (!q || !showSearch) return <Text style={[styles.msgText, { color: theme.text }]}>{text}</Text>;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'));
    return <Text style={[styles.msgText, { color: theme.text }]}>{parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase() ? <Text key={i} style={styles.highlight}>{p}</Text> : <Text key={i}>{p}</Text>
    )}</Text>;
  };

  const renderAvatar = (uri: string, letter: string, size: number, bg?: string) => (
    <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg || theme.primary }]}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <Text style={[styles.avatarLetter, { fontSize: size * 0.4 }]}>{letter}</Text>}
    </View>
  );

  // Date separator logic
  const getDateKey = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  const renderReactions = (msg: Msg) => {
    if (!msg.reactions) return null;
    const counts: Record<string, { count: number; mine: boolean }> = {};
    Object.entries(msg.reactions).forEach(([uid, emoji]) => {
      if (!counts[emoji]) counts[emoji] = { count: 0, mine: false };
      counts[emoji].count++; if (uid === myId) counts[emoji].mine = true;
    });
    return (
      <View style={styles.reactionsRow}>
        {Object.entries(counts).map(([emoji, d]) => (
          <TouchableOpacity key={emoji} testID={`rchip-${emoji}`}
            style={[styles.reactionChip, d.mine && { borderColor: theme.primary, borderWidth: 2 }]}
            onPress={() => handleReaction(msg.key, emoji)}>
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {d.count > 1 && <Text style={[styles.reactionCount, { color: theme.text }]}>{d.count}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderPhotos = (photos: string[]) => {
    if (!photos || photos.length === 0) return null;
    if (photos.length === 1) return (
      <TouchableOpacity onPress={() => setFullScreenPhoto(photos[0])}>
        <Image source={{ uri: photos[0] }} style={styles.singlePhoto} />
      </TouchableOpacity>
    );
    return (
      <View style={styles.photoGrid}>
        {photos.map((p, i) => (
          <TouchableOpacity key={i} onPress={() => setFullScreenPhoto(p)} style={photos.length === 2 ? styles.halfPhoto : styles.thirdPhoto}>
            <Image source={{ uri: p }} style={styles.gridImg} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: Msg; index: number }) => {
    const isMe = item.from === myId;
    const isSystem = item.type === 'system' || item.from === 'system';
    const isHighlighted = showSearch && searchResults[searchIndex] === index;
    const timeStr = fmtMsgTime(item.time);
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDateSep = !prevMsg || getDateKey(prevMsg.time) !== getDateKey(item.time);

    if (isSystem) {
      return (
        <View>
          {showDateSep && <View style={styles.dateSep}><View style={[styles.dateBubble, { backgroundColor: theme.glass_bg }]}><Text style={[styles.dateText, { color: theme.text_secondary }]}>{fmtMsgDate(item.time)}</Text></View></View>}
          <View style={styles.systemMsg}><Text style={[styles.systemText, { color: theme.text_secondary }]}>{item.text}</Text></View>
        </View>
      );
    }
    return (
      <View>
        {showDateSep && <View style={styles.dateSep}><View style={[styles.dateBubble, { backgroundColor: theme.glass_bg }]}><Text style={[styles.dateText, { color: theme.text_secondary }]}>{fmtMsgDate(item.time)}</Text></View></View>}
        <TouchableOpacity testID={`msg-${item.key}`}
          style={[styles.msgBubble, isMe ? { backgroundColor: theme.message_out, alignSelf: 'flex-end', borderBottomRightRadius: 4 }
            : { backgroundColor: theme.message_in, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
            isHighlighted && { borderWidth: 2, borderColor: '#FFD700' }
          ]}
          onPress={() => { setSelectedMsg(item); setShowMsgMenu(true); }}
          activeOpacity={0.7}>
          {!isMe && !isFavorites && <Text style={[styles.senderName, { color: theme.primary }]}>{item.fromNick}</Text>}
          {item.replyTo && (
            <View style={[styles.replyContent, { borderLeftColor: theme.primary }]}>
              <Text style={[styles.replyName, { color: theme.primary }]}>{item.replyTo.nick}</Text>
              <Text style={[styles.replyText, { color: theme.text_secondary }]} numberOfLines={1}>{item.replyTo.text}</Text>
            </View>
          )}
          {item.type === 'gift' ? (
            <View style={styles.giftMsg}><Text style={styles.giftIcon}>{item.giftIcon}</Text><Text style={[styles.giftLabel, { color: theme.primary }]}>{item.giftLabel}</Text></View>
          ) : item.type === 'voice' ? (
            <View style={styles.voiceMsg}>
              <Ionicons name="mic" size={20} color={theme.primary} />
              <Text style={[styles.voiceDuration, { color: theme.text }]}>{item.voiceDuration || '00:00'}</Text>
              <TouchableOpacity style={[styles.playBtn, { backgroundColor: playingKey === item.key ? '#ff4444' : theme.primary }]}
                onPress={() => { setPlayingKey(item.key); playVoice(item.voiceUri); }}>
                <Ionicons name={playingKey === item.key ? 'pause' : 'play'} size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : item.type === 'sticker' ? (
            <Text style={styles.stickerText}>{item.text}</Text>
          ) : item.type === 'photo' ? (
            <View>{renderPhotos(item.photos || [])}{item.text && item.text !== '📷' && <Text style={[styles.msgText, { color: theme.text, marginTop: 6 }]}>{item.text}</Text>}</View>
          ) : (
            showSearch && searchText ? highlightText(item.text, searchText)
              : <Text style={[styles.msgText, { color: theme.text }]}>{item.text}</Text>
          )}
          <View style={styles.msgTimeRow}>
            <Text style={[styles.msgTime, { color: theme.text_secondary }]}>{timeStr}</Text>
            {isMe && <Ionicons name={item.status === 'read' ? 'checkmark-done' : 'checkmark'} size={12} color={item.status === 'read' ? '#00e676' : theme.text_secondary} />}
          </View>
          {renderReactions(item)}
        </TouchableOpacity>
      </View>
    );
  };

  const glassStyle = { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 };

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.container}>
      {/* Header */}
      <TouchableOpacity testID="chat-header" activeOpacity={0.8}
        onPress={() => !isFavorites && (isGroup ? setShowGroupInfo(true) : setShowProfileModal(true))}
        style={[styles.header, glassStyle]}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        {renderAvatar(isFavorites ? '' : peerAvatar, peerNick?.charAt(0).toUpperCase() || '?', 38, isFavorites ? '#FFD700' : undefined)}
        {peerOnline && !isFavorites && !isGroup && <View style={styles.miniOnline} />}
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{peerNick || id}</Text>
          <Text style={[styles.headerStatus, { color: theme.text_secondary }]}>{getStatusText()}</Text>
        </View>
        {!isFavorites && !isGroup && (
          <TouchableOpacity testID="call-audio-btn" onPress={() => startCall('audio')} style={styles.callBtn}>
            <Ionicons name="call" size={20} color={theme.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity testID="more-menu-btn" onPress={() => setShowMoreMenu(true)} style={styles.moreBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Search */}
      {showSearch && (
        <View style={[styles.searchBar, glassStyle]}>
          <TextInput testID="chat-search-input" style={[styles.searchInput, { color: theme.text, borderColor: theme.glass_border }]}
            placeholder={t.search_in_chat} placeholderTextColor={theme.text_secondary}
            value={searchText} onChangeText={setSearchText} autoFocus />
          <Text style={[styles.searchCount, { color: theme.text_secondary }]}>{searchResults.length > 0 ? `${searchIndex+1}/${searchResults.length}` : '0/0'}</Text>
          <TouchableOpacity onPress={() => navSearch('up')}><Ionicons name="chevron-up" size={20} color={theme.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => navSearch('down')}><Ionicons name="chevron-down" size={20} color={theme.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowSearch(false); setSearchText(''); }}><Ionicons name="close" size={20} color={theme.text} /></TouchableOpacity>
        </View>
      )}

      {peerTyping && <View style={[styles.typingBar, glassStyle]}><Text style={[styles.typingText, { color: theme.primary }]}>{peerNick} {t.typing}</Text></View>}

      {/* Messages */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex} keyboardVerticalOffset={0}>
        <FlatList ref={flatListRef} testID="messages-list" data={messages} keyExtractor={item => item.key}
          renderItem={renderMessage} contentContainerStyle={styles.msgList}
          onContentSizeChange={() => { if (!userScrolledUp.current) flatListRef.current?.scrollToEnd({ animated: false }); }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const atBottom = contentOffset.y >= contentSize.height - layoutMeasurement.height - 100;
            userScrolledUp.current = !atBottom;
          }}
          scrollEventThrottle={100}
          ListEmptyComponent={<View style={styles.emptyChat}><Text style={styles.emptyCandyIcon}>🍬</Text><Text style={[styles.emptyTitle, { color: theme.text }]}>{t.new_chat_title}</Text><Text style={[styles.emptyDesc, { color: theme.text_secondary }]}>{isFavorites ? t.favorites_desc : t.new_chat_desc}</Text></View>}
        />
        {replyTo && (
          <View style={[styles.replyBar, glassStyle, { borderLeftColor: theme.primary, borderLeftWidth: 4 }]}>
            <View style={styles.replyBarInfo}><Text style={[styles.replyBarName, { color: theme.primary }]}>{replyTo.nick}</Text><Text style={[styles.replyBarText, { color: theme.text_secondary }]} numberOfLines={1}>{replyTo.text}</Text></View>
            <TouchableOpacity onPress={() => setReplyTo(null)}><Ionicons name="close" size={20} color={theme.text_secondary} /></TouchableOpacity>
          </View>
        )}
        {selectedPhotos.length > 0 && (
          <View style={[styles.photoPreview, glassStyle]}>
            <Text style={[styles.photoPreviewLabel, { color: theme.text }]}>📷 {selectedPhotos.length} {lang === 'ru' ? 'фото выбрано' : 'photo(s) selected'}</Text>
            <View style={styles.photoPreviewRow}>{selectedPhotos.map((p, i) => <Image key={i} source={{ uri: p }} style={styles.thumbImg} />)}</View>
            <TouchableOpacity onPress={() => setSelectedPhotos([])}><Ionicons name="close-circle" size={22} color="#ff4444" /></TouchableOpacity>
          </View>
        )}
        {isRecording && (
          <View style={[styles.recordingBar, { backgroundColor: 'rgba(255,0,0,0.12)' }]}>
            <View style={styles.recordDot} /><Text style={[styles.recordText, { color: '#ff4444' }]}>{t.recording} {fmtDur(recordingDuration)}</Text>
          </View>
        )}
        {/* Input */}
        <View style={[styles.inputContainer, glassStyle]}>
          <TouchableOpacity testID="sticker-btn" onPress={() => setShowStickerPicker(!showStickerPicker)} style={styles.iconBtn}>
            <Ionicons name="happy-outline" size={24} color={theme.text_secondary} />
          </TouchableOpacity>
          <TouchableOpacity testID="photo-btn" onPress={pickPhotos} style={styles.iconBtn}>
            <Ionicons name="image-outline" size={24} color={theme.text_secondary} />
          </TouchableOpacity>
          <TextInput testID="message-input" style={[styles.msgInput, { color: theme.text, backgroundColor: 'rgba(255,255,255,0.06)' }]}
            placeholder={t.message_placeholder} placeholderTextColor={theme.text_secondary}
            value={inputText} onChangeText={handleTyping} multiline />
          {(inputText.trim() || selectedPhotos.length > 0) ? (
            <TouchableOpacity testID="send-btn" style={[styles.sendBtn, { backgroundColor: theme.primary }]} onPress={sendMessage}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={{ position: 'relative' }}>
              {voiceTooltip && <View style={styles.tooltip}><Text style={styles.tooltipText}>{t.hold_to_record}</Text></View>}
              <TouchableOpacity testID="voice-btn" style={[styles.sendBtn, { backgroundColor: isRecording ? '#ff4444' : theme.primary }]}
                onPress={onVoiceTap} onLongPress={startRecording} onPressOut={() => { if (isRecording) stopRecording(); }}
                delayLongPress={300}>
                <Ionicons name="mic" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Sticker picker */}
      {showStickerPicker && (
        <View style={[styles.stickerPanel, glassStyle]}>
          {STICKERS.map((row, ri) => (
            <View key={ri} style={styles.stickerRow}>
              {row.map(s => <TouchableOpacity key={s} onPress={() => sendSticker(s)} style={styles.stickerItem}><Text style={styles.stickerEmoji}>{s}</Text></TouchableOpacity>)}
            </View>
          ))}
        </View>
      )}

      {/* Message menu */}
      <Modal visible={showMsgMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => { setShowMsgMenu(false); setSelectedMsg(null); }} activeOpacity={1}>
          <View style={[styles.contextMenu, glassStyle, { backgroundColor: 'rgba(15,12,30,0.95)' }]}>
            <View style={styles.reactionsSelector}>{REACTIONS.map(e => <TouchableOpacity key={e} style={styles.reactionOption} onPress={() => selectedMsg && handleReaction(selectedMsg.key, e)}><Text style={styles.reactionOptionText}>{e}</Text></TouchableOpacity>)}</View>
            <TouchableOpacity style={styles.ctxItem} onPress={() => { if (selectedMsg) setReplyTo({ text: selectedMsg.text, nick: selectedMsg.fromNick }); setShowMsgMenu(false); }}>
              <Ionicons name="return-up-back" size={18} color={theme.text} /><Text style={[styles.ctxText, { color: theme.text }]}>{t.reply}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctxItem} onPress={() => deleteMessage(false)}>
              <Ionicons name="trash-outline" size={18} color={theme.text} /><Text style={[styles.ctxText, { color: theme.text }]}>{t.delete_me}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctxItem} onPress={() => deleteMessage(true)}>
              <Ionicons name="trash" size={18} color="#ff4444" /><Text style={[styles.ctxText, { color: '#ff4444' }]}>{t.delete_all}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* More menu */}
      <Modal visible={showMoreMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMoreMenu(false)} activeOpacity={1}>
          <View style={[styles.contextMenu, glassStyle, { backgroundColor: 'rgba(15,12,30,0.95)' }]}>
            <TouchableOpacity style={styles.ctxItem} onPress={() => { setShowMoreMenu(false); setShowSearch(true); }}>
              <Ionicons name="search" size={18} color={theme.text} /><Text style={[styles.ctxText, { color: theme.text }]}>{t.search_in_chat}</Text>
            </TouchableOpacity>
            {!isFavorites && !isGroup && (
              <>
                <TouchableOpacity style={styles.ctxItem} onPress={() => { setShowMoreMenu(false); startCall('video'); }}>
                  <Ionicons name="videocam" size={18} color={theme.text} /><Text style={[styles.ctxText, { color: theme.text }]}>Video call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctxItem} onPress={() => { setShowMoreMenu(false); setShowGiftModal(true); }}>
                  <Ionicons name="gift" size={18} color={theme.text} /><Text style={[styles.ctxText, { color: theme.text }]}>{t.give_gift}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Profile modal */}
      <Modal visible={showProfileModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowProfileModal(false)} activeOpacity={1}>
          <View style={[styles.profileModal, glassStyle, { backgroundColor: 'rgba(15,12,30,0.96)' }]}>
            {renderAvatar(peerAvatar, peerNick?.charAt(0).toUpperCase() || '?', 100)}
            <Text style={[styles.profileNick, { color: theme.text }]}>{peerNick}</Text>
            <Text style={[styles.profileBio, { color: theme.text_secondary }]}>{peerBio || '...'}</Text>
            <Text style={[styles.profileStatus, { color: peerOnline ? '#00e676' : theme.text_secondary }]}>{peerOnline ? t.online : fmtLastSeen(peerLastSeen)}</Text>
            <View style={styles.profileActions}>
              <TouchableOpacity testID="profile-call-audio" style={[styles.profileActionBtn, { backgroundColor: theme.primary }]} onPress={() => { setShowProfileModal(false); startCall('audio'); }}>
                <Ionicons name="call" size={22} color="#fff" /><Text style={styles.profileActionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="profile-call-video" style={[styles.profileActionBtn, { backgroundColor: '#9b59b6' }]} onPress={() => { setShowProfileModal(false); startCall('video'); }}>
                <Ionicons name="videocam" size={22} color="#fff" /><Text style={styles.profileActionText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.profileActionBtn, { backgroundColor: '#e67e22' }]} onPress={() => { setShowProfileModal(false); setShowGiftModal(true); }}>
                <Ionicons name="gift" size={22} color="#fff" /><Text style={styles.profileActionText}>Gift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Gift modal */}
      <Modal visible={showGiftModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowGiftModal(false)} activeOpacity={1}>
          <View style={[styles.giftModalContent, glassStyle, { backgroundColor: 'rgba(15,12,30,0.96)' }]}>
            <Text style={[styles.giftTitle, { color: theme.text }]}>{t.give_gift}</Text>
            {GIFTS.map((g, i) => (
              <TouchableOpacity key={i} style={styles.giftItem} onPress={() => sendGift(g)}>
                <Text style={styles.giftItemIcon}>{g.icon}</Text>
                <Text style={[styles.giftItemLabel, { color: theme.text }]}>{lang === 'ru' ? g.labelRu : g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Group info modal */}
      <Modal visible={showGroupInfo} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowGroupInfo(false)} activeOpacity={1}>
          <View style={[styles.groupModal, glassStyle, { backgroundColor: 'rgba(15,12,30,0.96)' }]}>
            {renderAvatar(peerAvatar, peerNick?.charAt(0).toUpperCase() || '?', 80)}
            <Text style={[styles.profileNick, { color: theme.text }]}>{peerNick}</Text>
            <Text style={[styles.profileBio, { color: theme.text_secondary }]}>{groupMembers.length} {t.members}</Text>
            {groupOwner === myId && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={[styles.profileActionBtn, { backgroundColor: theme.primary }]} onPress={() => { setShowGroupInfo(false); changeGroupName(); }}>
                  <Ionicons name="pencil" size={18} color="#fff" /><Text style={styles.profileActionText}>{t.change_name}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.profileActionBtn, { backgroundColor: '#9b59b6' }]} onPress={() => { setShowGroupInfo(false); changeGroupAvatar(); }}>
                  <Ionicons name="camera" size={18} color="#fff" /><Text style={styles.profileActionText}>{t.change_avatar}</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.membersList}>
              {groupMembers.map(m => (
                <TouchableOpacity key={m.id} style={styles.memberItem}
                  onLongPress={() => groupOwner === myId && m.id !== myId && setShowMemberMenu({ visible: true, member: m })}>
                  {renderAvatar(m.avatar, m.nick?.charAt(0).toUpperCase() || '?', 36)}
                  <Text style={[styles.memberName, { color: theme.text }]}>{m.nick}{m.id === groupOwner ? ` 👑 ${t.group_creator}` : ''}</Text>
                  {m.online && <View style={[styles.miniOnline, { position: 'relative', marginLeft: 'auto' }]} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Member action menu */}
      <Modal visible={showMemberMenu.visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMemberMenu({ visible: false, member: null })} activeOpacity={1}>
          <View style={[styles.contextMenu, glassStyle, { backgroundColor: 'rgba(15,12,30,0.96)' }]}>
            <TouchableOpacity style={styles.ctxItem} onPress={() => showMemberMenu.member && transferOwnership(showMemberMenu.member.id)}>
              <Ionicons name="shield" size={18} color={theme.text} /><Text style={[styles.ctxText, { color: theme.text }]}>{lang === 'ru' ? 'Передать права' : 'Transfer ownership'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctxItem} onPress={() => showMemberMenu.member && kickMember(showMemberMenu.member.id)}>
              <Ionicons name="person-remove" size={18} color="#ff4444" /><Text style={[styles.ctxText, { color: '#ff4444' }]}>{lang === 'ru' ? 'Выгнать' : 'Kick'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Photo fullscreen */}
      <Modal visible={!!fullScreenPhoto} transparent animationType="fade">
        <View style={styles.fullscreenOverlay}>
          <View style={styles.fullscreenTopBar}>
            <TouchableOpacity style={styles.fullscreenClose} onPress={() => setFullScreenPhoto(null)}>
              <Ionicons name="close-circle" size={36} color="#fff" />
            </TouchableOpacity>
          </View>
          {fullScreenPhoto && <Image source={{ uri: fullScreenPhoto }} style={styles.fullscreenImg} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Group name edit modal */}
      <Modal visible={showGroupNameInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.contextMenu, glassStyle, { backgroundColor: 'rgba(15,12,30,0.96)', padding: 20 }]}>
            <Text style={[styles.callName, { fontSize: 18, marginBottom: 10, color: theme.text }]}>{lang === 'ru' ? 'Название группы' : 'Group Name'}</Text>
            <TextInput style={[styles.searchInput, { color: theme.text, borderColor: theme.glass_border, marginBottom: 15 }]}
              value={newGroupName} onChangeText={setNewGroupName} autoFocus />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.callControlBtn, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1, borderRadius: 12, height: 44 }]} onPress={() => setShowGroupNameInput(false)}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.callControlBtn, { backgroundColor: theme.primary, flex: 1, borderRadius: 12, height: 44 }]} onPress={submitGroupName}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>{t.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Call overlay */}
      {callState !== 'none' && (
        <View style={styles.callOverlay}>
          <LinearGradient colors={['rgba(0,0,0,0.95)', 'rgba(30,10,50,0.95)']} style={styles.callGradient}>
            {renderAvatar(callState === 'incoming' ? callerInfo.avatar : peerAvatar, callState === 'incoming' ? callerInfo.nick?.charAt(0).toUpperCase() || '?' : peerNick?.charAt(0).toUpperCase() || '?', 120)}
            <Text style={styles.callName}>{callState === 'incoming' ? callerInfo.nick : peerNick}</Text>
            {callState === 'calling' && <Text style={styles.callStatus}>{lang === 'ru' ? 'Звоним...' : 'Calling...'}</Text>}
            {callState === 'incoming' && <Text style={styles.callStatus}>{lang === 'ru' ? 'Входящий звонок...' : 'Incoming call...'}</Text>}
            {callState === 'active' && <Text style={styles.callTimer}>{fmtCallDur(callDuration)}</Text>}
            {(micMuted || peerMicMuted) && <Text style={styles.micMutedText}>{micMuted ? (lang === 'ru' ? '🔇 Ваш микрофон выключен' : '🔇 Your mic is muted') : (lang === 'ru' ? '🔇 Собеседник выключил микро' : '🔇 Peer muted mic')}</Text>}
            <View style={styles.callControls}>
              {callState === 'incoming' ? (
                <>
                  <TouchableOpacity testID="accept-call-btn" style={[styles.callControlBtn, { backgroundColor: '#00e676' }]} onPress={acceptCall}>
                    <Ionicons name="call" size={28} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity testID="decline-call-btn" style={[styles.callControlBtn, { backgroundColor: '#ff4444' }]} onPress={declineCall}>
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity testID="toggle-mic-btn" style={[styles.callControlBtn, { backgroundColor: micMuted ? '#ff4444' : 'rgba(255,255,255,0.2)' }]} onPress={toggleMic}>
                    <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
                  </TouchableOpacity>
                  {callType === 'video' && (
                    <TouchableOpacity testID="toggle-cam-btn" style={[styles.callControlBtn, { backgroundColor: camOn ? 'rgba(255,255,255,0.2)' : '#ff4444' }]} onPress={toggleCam}>
                      <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity testID="end-call-btn" style={[styles.callControlBtn, { backgroundColor: '#ff4444' }]} onPress={endCall}>
                    <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </LinearGradient>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8, borderBottomWidth: 1, borderRadius: 0 },
  backBtn: { padding: 8 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarLetter: { fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  miniOnline: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, backgroundColor: '#00e676', borderRadius: 5, borderWidth: 2, borderColor: '#111' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700' },
  headerStatus: { fontSize: 12, opacity: 0.7 },
  callBtn: { padding: 8 },
  moreBtn: { padding: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6, borderBottomWidth: 1 },
  searchInput: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, fontSize: 14 },
  searchCount: { fontSize: 12, marginHorizontal: 4 },
  typingBar: { padding: 6, paddingHorizontal: 15, borderBottomWidth: 1 },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  msgList: { padding: 12, paddingBottom: 10, flexGrow: 1, justifyContent: 'flex-end' },
  dateSep: { alignItems: 'center', marginVertical: 12 },
  dateBubble: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  dateText: { fontSize: 12, fontWeight: '600' },
  systemMsg: { alignItems: 'center', marginVertical: 6 },
  systemText: { fontSize: 12, fontStyle: 'italic', opacity: 0.7 },
  senderName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  msgBubble: { maxWidth: '80%', padding: 10, paddingHorizontal: 14, borderRadius: 18, marginBottom: 6 },
  msgText: { fontSize: 15, lineHeight: 20 },
  highlight: { backgroundColor: '#FFD700', color: '#000' },
  msgTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  msgTime: { fontSize: 10, opacity: 0.6 },
  replyContent: { borderLeftWidth: 3, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: 6, paddingHorizontal: 8, marginBottom: 6 },
  replyName: { fontWeight: 'bold', fontSize: 11, marginBottom: 2 },
  replyText: { fontSize: 12, opacity: 0.85 },
  giftMsg: { alignItems: 'center', paddingVertical: 10 },
  giftIcon: { fontSize: 50, marginBottom: 8 },
  giftLabel: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  voiceMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 150 },
  voiceDuration: { fontSize: 14, fontWeight: '600', flex: 1 },
  playBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stickerText: { fontSize: 60, textAlign: 'center' },
  singlePhoto: { width: 200, height: 200, borderRadius: 12 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 210 },
  halfPhoto: { width: 100, height: 100 },
  thirdPhoto: { width: 65, height: 65 },
  gridImg: { width: '100%', height: '100%', borderRadius: 8 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, gap: 2, borderWidth: 1, borderColor: 'transparent' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11 },
  emptyChat: { alignItems: 'center', padding: 25, marginTop: 100 },
  emptyCandyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  emptyDesc: { fontSize: 13, opacity: 0.7, textAlign: 'center', lineHeight: 20 },
  replyBar: { flexDirection: 'row', alignItems: 'center', padding: 10, marginHorizontal: 10, marginBottom: 5, borderRadius: 15 },
  replyBarInfo: { flex: 1, marginLeft: 8 },
  replyBarName: { fontWeight: 'bold', fontSize: 13 },
  replyBarText: { fontSize: 12, opacity: 0.8 },
  photoPreview: { flexDirection: 'row', alignItems: 'center', padding: 8, marginHorizontal: 10, borderRadius: 12, gap: 8 },
  photoPreviewLabel: { fontSize: 13, fontWeight: '600' },
  photoPreviewRow: { flexDirection: 'row', gap: 4, flex: 1 },
  thumbImg: { width: 40, height: 40, borderRadius: 8 },
  recordingBar: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, marginHorizontal: 10, borderRadius: 10 },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff4444' },
  recordText: { fontSize: 14, fontWeight: '600' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6, borderTopWidth: 1 },
  iconBtn: { padding: 6 },
  msgInput: { flex: 1, padding: 10, borderRadius: 20, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stickerPanel: { padding: 10, borderTopWidth: 1, maxHeight: 200 },
  stickerRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  stickerItem: { padding: 4 },
  stickerEmoji: { fontSize: 28 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  contextMenu: { borderRadius: 16, minWidth: 250, overflow: 'hidden' },
  reactionsSelector: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  reactionOption: { padding: 6 },
  reactionOptionText: { fontSize: 24 },
  ctxItem: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  ctxText: { fontSize: 14 },
  profileModal: { borderRadius: 24, padding: 30, alignItems: 'center', width: '85%', maxWidth: 350 },
  profileNick: { fontSize: 24, fontWeight: '800', marginTop: 15 },
  profileBio: { fontSize: 14, opacity: 0.7, marginTop: 5, textAlign: 'center' },
  profileStatus: { fontSize: 13, marginTop: 8, fontWeight: '600' },
  profileActions: { flexDirection: 'row', gap: 15, marginTop: 20 },
  profileActionBtn: { alignItems: 'center', padding: 12, paddingHorizontal: 20, borderRadius: 16, gap: 4 },
  profileActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  giftModalContent: { borderRadius: 24, padding: 25, width: '80%', maxWidth: 320 },
  giftTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 15 },
  giftItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  giftItemIcon: { fontSize: 36 },
  giftItemLabel: { fontSize: 16, fontWeight: '600' },
  groupModal: { borderRadius: 24, padding: 25, alignItems: 'center', width: '85%', maxWidth: 350, maxHeight: '80%' },
  btn: { padding: 12, borderRadius: 14, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  membersList: { width: '100%', marginTop: 15 },
  memberItem: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  memberName: { fontSize: 15, fontWeight: '600' },
  fullscreenOverlay: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  fullscreenTopBar: { position: 'absolute', top: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, zIndex: 10 },
  fullscreenClose: {},
  fullscreenImg: { width: SCREEN_W, height: '80%' },
  tooltip: { position: 'absolute', bottom: 55, right: -20, backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, width: 160 },
  tooltipText: { color: '#fff', fontSize: 12, textAlign: 'center' },
  callOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  callGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 15 },
  callName: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 10 },
  callStatus: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  callTimer: { fontSize: 22, color: '#fff', fontWeight: '700', fontFamily: 'monospace' },
  micMutedText: { fontSize: 14, color: '#ff4444', marginTop: 5 },
  callControls: { flexDirection: 'row', gap: 25, marginTop: 30 },
  callControlBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
