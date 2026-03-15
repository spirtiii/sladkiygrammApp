import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Modal, Alert, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { langData } from '../../src/lib/i18n';
import { database, ref, onValue, onChildAdded, onChildRemoved, onChildChanged, off, get, update, remove, push, query, limitToLast, serverTimestamp } from '../../src/lib/firebase';
import { Audio } from 'expo-av';

const REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢', '✅', '✨'];

interface Message {
  key: string;
  from: string;
  fromNick: string;
  text: string;
  type: string;
  time: number;
  status: string;
  replyTo?: { text: string; nick: string };
  giftIcon?: string;
  giftType?: string;
  giftLabel?: string;
  reactions?: Record<string, string>;
  voiceDuration?: string;
  voiceBase64?: string;
  deletedFor?: Record<string, boolean>;
}

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, lang } = useTheme();
  const { myId, myNick } = useAuth();
  const router = useRouter();
  const t = langData[lang] || langData.en;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [peerNick, setPeerNick] = useState('');
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<{ text: string; nick: string } | null>(null);
  const [showMsgMenu, setShowMsgMenu] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimer = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const typingTimeout = useRef<any>(null);
  const isFavorites = id === 'favorites';
  const isGroup = id?.startsWith('group_') || false;
  const chatId = isFavorites ? `favorites_${myId}` : (isGroup ? id : [myId, id].sort().join('_'));

  useEffect(() => {
    if (!myId || !id) return;
    if (isFavorites) {
      setPeerNick(t.favorites);
      loadMessages();
      return;
    }
    if (isGroup) {
      const groupRef = ref(database, `groups/${id}`);
      onValue(groupRef, s => {
        const g = s.val();
        if (g) setPeerNick(g.name || id);
      });
    } else {
      const userRef = ref(database, `users/${id}`);
      onValue(userRef, s => {
        const u = s.val();
        if (u) {
          setPeerNick(u.nick || id);
          setPeerOnline(u.online || false);
          setPeerLastSeen(u.lastSeen || null);
        }
      });
      const typingRef = ref(database, `users/${id}/chats/${myId}/typing`);
      onValue(typingRef, s => setPeerTyping(s.val() || false));
    }
    loadMessages();
    return () => {
      if (!isFavorites && !isGroup && myId) {
        update(ref(database, `users/${myId}/chats/${id}/typing`), {}).catch(() => {});
      }
    };
  }, [myId, id]);

  const loadMessages = () => {
    if (!chatId) return;
    const msgsRef = query(ref(database, `messages/${chatId}`), limitToLast(100));
    onChildAdded(msgsRef, s => {
      const msg = s.val();
      if (msg.deletedFor && msg.deletedFor[myId!]) return;
      const newMsg: Message = { key: s.key!, ...msg };
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
    if (!txt || !chatId || !myId) return;
    const payload: any = {
      from: myId, fromNick: myNick, text: txt, type: 'text',
      time: serverTimestamp(), status: 'sent'
    };
    if (replyTo) { payload.replyTo = replyTo; setReplyTo(null); }
    push(ref(database, `messages/${chatId}`), payload);
    if (!isFavorites && !isGroup) {
      update(ref(database, `users/${myId}/chats/${id}`), { lastMsg: txt, timestamp: serverTimestamp() });
      update(ref(database, `users/${id}/chats/${myId}`), { lastMsg: txt, timestamp: serverTimestamp() });
    }
    if (isFavorites) {
      update(ref(database, `users/${myId}/chats/favorites_${myId}`), { lastMsg: txt, timestamp: serverTimestamp() });
    }
    setInputText('');
    clearTyping();
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    if (isFavorites || !myId || !id) return;
    if (isGroup) {
      update(ref(database, `groups/${id}/typing/${myId}`), { '.sv': 'timestamp' }).catch(() => {});
    } else {
      update(ref(database, `users/${myId}/chats/${id}`), { typing: true }).catch(() => {});
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(clearTyping, 2000);
  };

  const clearTyping = () => {
    if (isFavorites || !myId || !id) return;
    if (isGroup) {
      remove(ref(database, `groups/${id}/typing/${myId}`)).catch(() => {});
    } else {
      update(ref(database, `users/${myId}/chats/${id}`), { typing: false }).catch(() => {});
    }
  };

  const handleReaction = (msgKey: string, emoji: string) => {
    if (!myId || !chatId) return;
    const reactionsRef = ref(database, `messages/${chatId}/${msgKey}/reactions/${myId}`);
    get(reactionsRef).then(s => {
      if (s.val() === emoji) {
        remove(reactionsRef);
      } else {
        update(ref(database, `messages/${chatId}/${msgKey}/reactions`), { [myId]: emoji });
      }
    });
    setShowReactions(false);
    setSelectedMsg(null);
  };

  const deleteMessage = (everyone: boolean) => {
    if (!selectedMsg || !chatId || !myId) return;
    if (everyone) {
      remove(ref(database, `messages/${chatId}/${selectedMsg.key}`));
    } else {
      update(ref(database, `messages/${chatId}/${selectedMsg.key}/deletedFor`), { [myId]: true });
    }
    setShowMsgMenu(false);
    setSelectedMsg(null);
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
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => setRecordingDuration(d => d + 100), 100);
    } catch (e) {
      console.log('Recording error:', e);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    clearInterval(recordingTimer.current);
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri && chatId && myId) {
        const durationStr = formatDuration(recordingDuration);
        const payload: any = {
          from: myId, fromNick: myNick, text: `🎤 ${durationStr}`, type: 'voice',
          time: serverTimestamp(), status: 'sent', voiceDuration: durationStr, voiceUri: uri
        };
        push(ref(database, `messages/${chatId}`), payload);
        const lastMsg = `🎤 ${t.voice_message} ${durationStr}`;
        if (!isFavorites && !isGroup) {
          update(ref(database, `users/${myId}/chats/${id}`), { lastMsg, timestamp: serverTimestamp() });
          update(ref(database, `users/${id}/chats/${myId}`), { lastMsg, timestamp: serverTimestamp() });
        }
      }
    } catch (e) {
      console.log('Stop recording error:', e);
    }
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    const milli = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${min}:${sec}.${milli}`;
  };

  const formatLastSeen = (ts: number | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 60000;
    if (diff < 2) return t.just_now;
    const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    return `${t.last_seen} ${dateStr} ${t.at} ${timeStr}`;
  };

  // Search in chat
  useEffect(() => {
    if (!searchText.trim()) { setSearchResults([]); return; }
    const results: number[] = [];
    messages.forEach((m, idx) => {
      if (m.text && m.text.toLowerCase().includes(searchText.toLowerCase())) {
        results.push(idx);
      }
    });
    setSearchResults(results);
    setSearchIndex(results.length > 0 ? results.length - 1 : 0);
  }, [searchText, messages]);

  const navigateSearch = (dir: 'up' | 'down') => {
    if (searchResults.length === 0) return;
    let newIdx = dir === 'up' ? searchIndex - 1 : searchIndex + 1;
    if (newIdx < 0) newIdx = searchResults.length - 1;
    if (newIdx >= searchResults.length) newIdx = 0;
    setSearchIndex(newIdx);
    flatListRef.current?.scrollToIndex({ index: searchResults[newIdx], animated: true });
  };

  const getStatusText = () => {
    if (isFavorites) return t.favorites_desc;
    if (peerTyping) return t.typing;
    if (peerOnline) return t.online;
    return formatLastSeen(peerLastSeen);
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !showSearch) return <Text>{text}</Text>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <Text>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <Text key={i} style={{ backgroundColor: '#FFD700', color: '#000', borderRadius: 2 }}>{part}</Text>
            : <Text key={i}>{part}</Text>
        )}
      </Text>
    );
  };

  const renderReactions = (msg: Message) => {
    if (!msg.reactions) return null;
    const counts: Record<string, { count: number; myReaction: boolean }> = {};
    Object.entries(msg.reactions).forEach(([uid, emoji]) => {
      if (!counts[emoji]) counts[emoji] = { count: 0, myReaction: false };
      counts[emoji].count++;
      if (uid === myId) counts[emoji].myReaction = true;
    });
    return (
      <View style={styles.reactionsRow}>
        {Object.entries(counts).map(([emoji, data]) => (
          <TouchableOpacity
            key={emoji}
            testID={`reaction-chip-${emoji}`}
            style={[styles.reactionChip, data.myReaction && { borderColor: theme.primary, borderWidth: 2 }]}
            onPress={() => handleReaction(msg.key, emoji)}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {data.count > 1 && <Text style={[styles.reactionCount, { color: theme.text }]}>{data.count}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.from === myId;
    const isHighlighted = showSearch && searchResults.includes(index) && searchResults[searchIndex] === index;
    const d = item.time ? new Date(item.time) : new Date();
    const timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;

    return (
      <TouchableOpacity
        testID={`msg-${item.key}`}
        style={[
          styles.msgBubble,
          isMe ? { backgroundColor: theme.message_out, alignSelf: 'flex-end', borderBottomRightRadius: 4 }
                : { backgroundColor: theme.message_in, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
          isHighlighted && { borderWidth: 2, borderColor: '#FFD700' }
        ]}
        onPress={() => { setSelectedMsg(item); setShowMsgMenu(true); }}
        activeOpacity={0.7}
      >
        {item.replyTo && (
          <View style={[styles.replyContent, { borderLeftColor: theme.primary }]}>
            <Text style={[styles.replyName, { color: theme.primary }]}>{item.replyTo.nick}</Text>
            <Text style={[styles.replyText, { color: theme.text_secondary }]} numberOfLines={1}>{item.replyTo.text}</Text>
          </View>
        )}
        {item.type === 'gift' ? (
          <View style={styles.giftMsg}>
            <Text style={styles.giftIcon}>{item.giftIcon}</Text>
            <Text style={[styles.giftLabel, { color: theme.primary }]}>{item.giftLabel}</Text>
          </View>
        ) : item.type === 'voice' ? (
          <View style={styles.voiceMsg}>
            <Ionicons name="mic" size={20} color={theme.primary} />
            <Text style={[styles.voiceDuration, { color: theme.text }]}>{item.voiceDuration || '00:00'}</Text>
            <TouchableOpacity testID={`play-voice-${item.key}`} style={[styles.playBtn, { backgroundColor: theme.primary }]}>
              <Ionicons name="play" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          showSearch && searchText ? highlightText(item.text, searchText)
            : <Text style={[styles.msgText, { color: theme.text }]}>{item.text}</Text>
        )}
        <View style={styles.msgTimeRow}>
          <Text style={[styles.msgTime, { color: theme.text_secondary }]}>{timeStr}</Text>
          {isMe && (
            <Ionicons
              name={item.status === 'read' ? 'checkmark-done' : 'checkmark'}
              size={12}
              color={item.status === 'read' ? '#00e676' : theme.text_secondary}
            />
          )}
        </View>
        {renderReactions(item)}
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={theme.background_gradient as any} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.glass_bg, borderBottomColor: theme.glass_border }]}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: isFavorites ? '#FFD700' : theme.primary }]}>
          {isFavorites ? (
            <Ionicons name="bookmark" size={16} color="#fff" />
          ) : (
            <Text style={styles.headerAvatarText}>{peerNick?.charAt(0).toUpperCase() || '?'}</Text>
          )}
          {peerOnline && !isFavorites && <View style={styles.miniOnline} />}
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{peerNick || id}</Text>
          <Text style={[styles.headerStatus, { color: theme.text_secondary }]}>{getStatusText()}</Text>
        </View>
        <TouchableOpacity testID="more-menu-btn" onPress={() => setShowMoreMenu(true)} style={styles.moreBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: theme.glass_bg, borderBottomColor: theme.glass_border }]}>
          <TextInput
            testID="chat-search-input"
            style={[styles.searchInput, { color: theme.text, borderColor: theme.glass_border }]}
            placeholder={t.search_in_chat}
            placeholderTextColor={theme.text_secondary}
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
          />
          <Text style={[styles.searchCount, { color: theme.text_secondary }]}>
            {searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length}` : '0/0'}
          </Text>
          <TouchableOpacity testID="search-up" onPress={() => navigateSearch('up')}>
            <Ionicons name="chevron-up" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity testID="search-down" onPress={() => navigateSearch('down')}>
            <Ionicons name="chevron-down" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity testID="close-search" onPress={() => { setShowSearch(false); setSearchText(''); }}>
            <Ionicons name="close" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Typing indicator */}
      {peerTyping && (
        <View style={[styles.typingBar, { backgroundColor: theme.glass_bg }]}>
          <Text style={[styles.typingText, { color: theme.primary }]}>{peerNick} {t.typing}</Text>
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          testID="messages-list"
          data={messages}
          keyExtractor={item => item.key}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyCandyIcon}>🍬</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>{t.new_chat_title}</Text>
              <Text style={[styles.emptyDesc, { color: theme.text_secondary }]}>{isFavorites ? t.favorites_desc : t.new_chat_desc}</Text>
            </View>
          }
        />

        {/* Reply bar */}
        {replyTo && (
          <View style={[styles.replyBar, { backgroundColor: theme.glass_bg, borderLeftColor: theme.primary }]}>
            <View style={styles.replyBarInfo}>
              <Text style={[styles.replyBarName, { color: theme.primary }]}>{replyTo.nick}</Text>
              <Text style={[styles.replyBarText, { color: theme.text_secondary }]} numberOfLines={1}>{replyTo.text}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={20} color={theme.text_secondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <View style={[styles.recordingBar, { backgroundColor: 'rgba(255,0,0,0.15)' }]}>
            <View style={styles.recordDot} />
            <Text style={[styles.recordText, { color: '#ff4444' }]}>{t.recording} {formatDuration(recordingDuration)}</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputContainer, { backgroundColor: theme.glass_bg, borderTopColor: theme.glass_border }]}>
          <TextInput
            testID="message-input"
            style={[styles.msgInput, { color: theme.text, backgroundColor: 'rgba(255,255,255,0.08)' }]}
            placeholder={t.message_placeholder}
            placeholderTextColor={theme.text_secondary}
            value={inputText}
            onChangeText={handleTyping}
            multiline
          />
          {inputText.trim() ? (
            <TouchableOpacity testID="send-btn" style={[styles.sendBtn, { backgroundColor: theme.primary }]} onPress={sendMessage}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="voice-btn"
              style={[styles.sendBtn, { backgroundColor: theme.primary }]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Ionicons name="mic" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Message context menu */}
      <Modal visible={showMsgMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => { setShowMsgMenu(false); setSelectedMsg(null); }} activeOpacity={1}>
          <View style={[styles.contextMenu, { backgroundColor: 'rgba(20,20,30,0.95)', borderColor: theme.glass_border }]}>
            {/* Reactions row */}
            <View style={styles.reactionsSelector}>
              {REACTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  testID={`select-reaction-${emoji}`}
                  style={styles.reactionOption}
                  onPress={() => selectedMsg && handleReaction(selectedMsg.key, emoji)}
                >
                  <Text style={styles.reactionOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.ctxItem} onPress={() => {
              if (selectedMsg) setReplyTo({ text: selectedMsg.text, nick: selectedMsg.fromNick });
              setShowMsgMenu(false);
            }}>
              <Ionicons name="return-up-back" size={18} color={theme.text} />
              <Text style={[styles.ctxText, { color: theme.text }]}>{t.reply}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctxItem} onPress={() => deleteMessage(false)}>
              <Ionicons name="trash-outline" size={18} color={theme.text} />
              <Text style={[styles.ctxText, { color: theme.text }]}>{t.delete_me}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctxItem} onPress={() => deleteMessage(true)}>
              <Ionicons name="trash" size={18} color="#ff4444" />
              <Text style={[styles.ctxText, { color: '#ff4444' }]}>{t.delete_all}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* More menu (three dots) */}
      <Modal visible={showMoreMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMoreMenu(false)} activeOpacity={1}>
          <View style={[styles.contextMenu, { backgroundColor: 'rgba(20,20,30,0.95)', borderColor: theme.glass_border }]}>
            <TouchableOpacity testID="more-search" style={styles.ctxItem} onPress={() => { setShowMoreMenu(false); setShowSearch(true); }}>
              <Ionicons name="search" size={18} color={theme.text} />
              <Text style={[styles.ctxText, { color: theme.text }]}>{t.search_in_chat}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="more-mute" style={styles.ctxItem} onPress={() => { setShowMoreMenu(false); }}>
              <Ionicons name="notifications-off" size={18} color={theme.text} />
              <Text style={[styles.ctxText, { color: theme.text }]}>{t.mute_notifications}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 1, gap: 8 },
  backBtn: { padding: 8 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  headerAvatarText: { fontSize: 14, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  miniOnline: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, backgroundColor: '#00e676', borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700' },
  headerStatus: { fontSize: 12, opacity: 0.7 },
  moreBtn: { padding: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6, borderBottomWidth: 1 },
  searchInput: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, fontSize: 14 },
  searchCount: { fontSize: 12, marginHorizontal: 4 },
  typingBar: { padding: 6, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  msgList: { padding: 15, paddingBottom: 10, flexGrow: 1, justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '80%', padding: 10, paddingHorizontal: 14, borderRadius: 18, marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  msgTime: { fontSize: 9, opacity: 0.6 },
  replyContent: { borderLeftWidth: 3, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: 6, paddingHorizontal: 8, marginBottom: 6 },
  replyName: { fontWeight: 'bold', fontSize: 11, marginBottom: 2 },
  replyText: { fontSize: 12, opacity: 0.85 },
  giftMsg: { alignItems: 'center', paddingVertical: 10 },
  giftIcon: { fontSize: 50, marginBottom: 8 },
  giftLabel: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  voiceMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 150 },
  voiceDuration: { fontSize: 14, fontWeight: '600', flex: 1 },
  playBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, gap: 2 },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11 },
  emptyChat: { alignItems: 'center', padding: 25, marginTop: 100 },
  emptyCandyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  emptyDesc: { fontSize: 13, opacity: 0.7, textAlign: 'center', lineHeight: 20 },
  replyBar: { flexDirection: 'row', alignItems: 'center', padding: 10, marginHorizontal: 10, marginBottom: 5, borderRadius: 15, borderLeftWidth: 4 },
  replyBarInfo: { flex: 1, marginLeft: 8 },
  replyBarName: { fontWeight: 'bold', fontSize: 13 },
  replyBarText: { fontSize: 12, opacity: 0.8 },
  recordingBar: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, marginHorizontal: 10, borderRadius: 10 },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff4444' },
  recordText: { fontSize: 14, fontWeight: '600' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10, borderTopWidth: 1 },
  msgInput: { flex: 1, padding: 12, borderRadius: 20, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  contextMenu: { borderRadius: 16, borderWidth: 1, minWidth: 250, overflow: 'hidden' },
  reactionsSelector: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  reactionOption: { padding: 6 },
  reactionOptionText: { fontSize: 24 },
  ctxItem: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  ctxText: { fontSize: 14 },
});
