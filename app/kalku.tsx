// app/kalku.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Easing,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UpgradeProModal from '../src/components/UpgradeProModal';
import { useTheme } from '../src/contexts/ThemeContext';
import { supabase } from '../src/services/supabase/client';
import { voiceAssistant } from '../src/services/voiceAssistant';
import { useTransactionStore } from '../src/store/transactionStore';
import { useUsageStore } from '../src/store/usageStore';

const { height } = Dimensions.get('window');

const getChatHistoryKey = (userId: string) => `kalku_chat_history_${userId}`;

const LIGHT = {
    bg: '#f8fafc',
    card: '#ffffff',
    border: '#f1f5f9',
    borderStrong: '#e5e7eb',
    text: '#111827',
    textSub: '#374151',
    textMuted: '#6b7280',
    textLight: '#9ca3af',
    accent: '#3b6ef5',
    accentBg: '#eef2ff',
    accentLight: '#e0e7ff',
    accentText: '#3b6ef5',
    accentTextStrong: '#3730a3',
    inputBg: '#f8fafc',
    inputBorder: '#e5e7eb',
    userBubble: '#3b6ef5',
    userBubbleText: '#ffffff',
    assistantBubble: '#ffffff',
    assistantBubbleBorder: '#e5e7eb',
    assistantBubbleText: '#1f2937',
    shadow: 'rgba(0,0,0,0.1)',
    shadowLight: 'rgba(0,0,0,0.05)',
    overlay: 'rgba(0,0,0,0.5)',
    modalBg: '#ffffff',
    quickQuestionBg: '#ffffff',
    quickQuestionBorder: '#e0e7ff',
    quickQuestionIconBg: '#eef2ff',
    divider: '#f1f5f9',
    dotBg: '#d1d5db',
    statusDot: '#10b981',
    modalOverlay: 'rgba(0,0,0,0.5)',
};

const DARK = {
    bg: '#080f24',
    card: '#0f1a3d',
    border: '#1a2a55',
    borderStrong: '#2a3470',
    text: '#f0f4ff',
    textSub: '#c3cee6',
    textMuted: '#5a6b94',
    textLight: '#4a5a7a',
    accent: '#818cf8',
    accentBg: '#1a2150',
    accentLight: '#2a3470',
    accentText: '#a5b4fc',
    accentTextStrong: '#c7d2fe',
    inputBg: '#0f1a3d',
    inputBorder: '#1a2a55',
    userBubble: '#818cf8',
    userBubbleText: '#ffffff',
    assistantBubble: '#0f1a3d',
    assistantBubbleBorder: '#1a2a55',
    assistantBubbleText: '#f0f4ff',
    shadow: 'rgba(0,0,0,0.3)',
    shadowLight: 'rgba(0,0,0,0.15)',
    overlay: 'rgba(0,0,0,0.7)',
    modalBg: '#0f1a3d',
    quickQuestionBg: '#0f1a3d',
    quickQuestionBorder: '#2a3470',
    quickQuestionIconBg: '#1a2150',
    divider: '#1a2a55',
    dotBg: '#2a3470',
    statusDot: '#34d399',
    modalOverlay: 'rgba(0,0,0,0.7)',
};

interface DynamicModalConfig {
    visible: boolean;
    title: string;
    description: string;
    cancelText: string;
    confirmText: string;
    isDestructive: boolean;
    onConfirm: () => void;
}

let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = null;

try {
    const module = require('expo-speech-recognition');
    ExpoSpeechRecognitionModule = module.ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent = module.useSpeechRecognitionEvent;
} catch (error) {
    console.warn('⚠️ expo-speech-recognition not available');
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

// ── Bottom Sheet Modal ────────────────────────────────────────────────────────
function BottomSheetModal({ config, onClose, isDark }: {
    config: DynamicModalConfig;
    onClose: () => void;
    isDark: boolean;
}) {
    const T = isDark ? DARK : LIGHT;
    const slideAnim = useRef(new Animated.Value(400)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        if (config.visible) {
            setIsMounted(true);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
            ]).start(() => setIsMounted(false));
        }
    }, [config.visible]);

    if (!isMounted) return null;

    return (
        <Modal transparent visible={config.visible} animationType="none" onRequestClose={onClose}>
            <Animated.View style={{ flex: 1, backgroundColor: T.modalOverlay, opacity: fadeAnim }}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
            </Animated.View>
            <Animated.View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: T.modalBg,
                borderTopLeftRadius: 28, borderTopRightRadius: 28,
                paddingHorizontal: 24, paddingTop: 32, paddingBottom: 50,
                transform: [{ translateY: slideAnim }],
                shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
            }}>
                <TouchableOpacity
                    onPress={onClose}
                    style={{
                        position: 'absolute', right: 24, top: -64,
                        backgroundColor: '#fff', width: 44, height: 44,
                        borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.18, shadowRadius: 4, elevation: 5,
                    }}
                >
                    <Ionicons name="close" size={24} color="#1c1c1c" />
                </TouchableOpacity>
                <Text style={{ fontSize: 22, fontWeight: '700', color: T.text, marginBottom: 10 }}>
                    {config.title}
                </Text>
                <Text style={{ fontSize: 15, color: isDark ? T.textSub : '#555555', lineHeight: 22, marginBottom: 32 }}>
                    {config.description}
                </Text>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            flex: 1, backgroundColor: 'transparent', borderRadius: 100,
                            paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1.5, borderColor: config.isDestructive ? '#ef4444' : T.accent,
                        }}
                    >
                        <Text style={{ color: config.isDestructive ? '#ef4444' : T.accent, fontWeight: '700', fontSize: 16 }}>
                            {config.cancelText}
                        </Text>
                    </TouchableOpacity>
                    {config.confirmText !== '' && (
                        <TouchableOpacity
                            onPress={config.onConfirm}
                            style={{
                                flex: 1, backgroundColor: config.isDestructive ? '#ef4444' : T.accent,
                                borderRadius: 100, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                                {config.confirmText}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        </Modal>
    );
}

function formatMessageDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (msgDate.getTime() === today.getTime()) return 'Hari ini';
    if (msgDate.getTime() === yesterday.getTime()) return 'Kemarin';
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[date.getDay()];
    }
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function VoiceRecordButton({ onPress, isRecording, isProcessing, T }: {
    onPress: () => void;
    isRecording: boolean;
    isProcessing: boolean;
    T: typeof LIGHT;
}) {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
            pulseAnim.stopAnimation();
        }
    }, [isRecording]);
    return (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
                onPress={onPress}
                disabled={isProcessing}
                style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: isRecording ? '#ef4444' : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                }}
                activeOpacity={0.8}
            >
                {isProcessing
                    ? <ActivityIndicator color={T.accent} size="small" />
                    : <Ionicons name={isRecording ? 'stop' : 'mic'} size={20} color={isRecording ? '#ef4444' : T.textLight} />
                }
            </TouchableOpacity>
        </Animated.View>
    );
}

function TypingDots({ T }: { T: typeof LIGHT }) {
    const dots = [
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
    ];
    useEffect(() => {
        const animations = dots.map((dot, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(i * 150),
                    Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 400, easing: Easing.ease, useNativeDriver: true }),
                    Animated.delay(450),
                ])
            )
        );
        animations.forEach(a => a.start());
        return () => animations.forEach(a => a.stop());
    }, []);
    return (
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 4 }}>
            {dots.map((dot, i) => (
                <Animated.View key={i} style={{
                    width: 8, height: 8, borderRadius: 4, backgroundColor: T.accent,
                    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
                    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                }} />
            ))}
        </View>
    );
}

function SoundWave({ isActive, T }: { isActive: boolean; T: typeof LIGHT }) {
    const bars = Array.from({ length: 5 }, () => useRef(new Animated.Value(0.3)).current);
    useEffect(() => {
        if (isActive) {
            const animations = bars.map((bar, i) =>
                Animated.loop(
                    Animated.sequence([
                        Animated.delay(i * 80),
                        Animated.timing(bar, { toValue: 1, duration: 300 + i * 50, useNativeDriver: true }),
                        Animated.timing(bar, { toValue: 0.2, duration: 300 + i * 50, useNativeDriver: true }),
                    ])
                )
            );
            animations.forEach(a => a.start());
            return () => animations.forEach(a => a.stop());
        } else {
            bars.forEach(bar => {
                Animated.timing(bar, { toValue: 0.3, duration: 200, useNativeDriver: true }).start();
            });
        }
    }, [isActive]);
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 24 }}>
            {bars.map((bar, i) => (
                <Animated.View key={i} style={{
                    width: 3, height: 20, borderRadius: 2,
                    backgroundColor: isActive ? T.accentText : T.accent,
                    transform: [{ scaleY: bar }],
                }} />
            ))}
        </View>
    );
}

function DateDivider({ date, T }: { date: Date; T: typeof LIGHT }) {
    return (
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <View style={{
                backgroundColor: T.card, paddingHorizontal: 14, paddingVertical: 4,
                borderRadius: 12, borderWidth: 0.5, borderColor: T.borderStrong,
            }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: T.textMuted }}>
                    {formatMessageDate(date)}
                </Text>
            </View>
        </View>
    );
}

function MessageBubble({ msg, idx, isCurrentlySpeaking, voiceEnabled, onSpeak, T, showDateDivider }: {
    msg: Message;
    idx: number;
    isCurrentlySpeaking: boolean;
    voiceEnabled: boolean;
    onSpeak: () => void;
    T: typeof LIGHT;
    showDateDivider?: boolean;
}) {
    const isUser = msg.role === 'user';
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(12)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
    }, []);
    return (
        <>
            {showDateDivider && <DateDivider date={msg.timestamp} T={T} />}
            <Animated.View style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                flexDirection: 'row',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                marginBottom: 4,
                gap: 8,
            }}>
                {!isUser && (
                    <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: isCurrentlySpeaking ? T.accentText : T.accent,
                        alignItems: 'center', justifyContent: 'center',
                        shadowColor: T.accent, shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
                    }}>
                        {isCurrentlySpeaking
                            ? <SoundWave isActive={true} T={T} />
                            : <Image source={require('../assets/icon/Mascot.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
                        }
                    </View>
                )}
                <View style={{ maxWidth: '75%' }}>
                    <View style={{
                        backgroundColor: isUser ? T.userBubble : T.assistantBubble,
                        borderWidth: isUser ? 0 : 1,
                        borderColor: T.assistantBubbleBorder,
                        borderRadius: 20,
                        borderBottomRightRadius: isUser ? 4 : 20,
                        borderBottomLeftRadius: isUser ? 20 : 4,
                        paddingHorizontal: 15, paddingVertical: 11,
                        shadowColor: isUser ? T.accent : T.shadow,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isUser ? 0.2 : 0.05,
                        shadowRadius: 6, elevation: isUser ? 4 : 2,
                    }}>
                        <Text style={{ fontSize: 14, lineHeight: 22, color: isUser ? T.userBubbleText : T.assistantBubbleText }}>
                            {msg.content}
                        </Text>
                    </View>
                    <View style={{
                        flexDirection: 'row', alignItems: 'center',
                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                        marginTop: 3, gap: 6, paddingHorizontal: 4,
                    }}>
                        <Text style={{ fontSize: 10, color: T.textLight }}>
                            {formatTime(msg.timestamp)}
                        </Text>
                        {isUser && <Ionicons name="checkmark-done" size={12} color={T.textLight} />}
                        {!isUser && voiceEnabled && (
                            <TouchableOpacity
                                onPress={onSpeak}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 3,
                                    backgroundColor: isCurrentlySpeaking ? T.accentBg : T.bg,
                                    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
                                    borderWidth: 1, borderColor: isCurrentlySpeaking ? T.accentLight : T.borderStrong,
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isCurrentlySpeaking ? 'stop-circle-outline' : 'volume-medium-outline'}
                                    size={12}
                                    color={isCurrentlySpeaking ? T.accentText : T.textLight}
                                />
                                <Text style={{ fontSize: 10, fontWeight: '500', color: isCurrentlySpeaking ? T.accentText : T.textLight }}>
                                    {isCurrentlySpeaking ? 'Stop' : 'Dengar'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                {isUser && (
                    <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: T.border, alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Ionicons name="person" size={16} color={T.textMuted} />
                    </View>
                )}
            </Animated.View>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function KalKuScreen() {
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [voiceModalVisible, setVoiceModalVisible] = useState(false);
    const [voiceInputText, setVoiceInputText] = useState('');
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isAvailable, setIsAvailable] = useState(false);
    const [isVoiceStarted, setIsVoiceStarted] = useState(false);
    const [isWaitingForSpeech, setIsWaitingForSpeech] = useState(false);
    const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const scrollRef = useRef<ScrollView>(null);
    const inputRef = useRef<TextInput>(null);
    const headerAnim = useRef(new Animated.Value(0)).current;
    const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isProcessingSubmit = useRef(false);
    const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFocused = useIsFocused();
    const isFocusedRef = useRef(true);

    useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

    const [sheetConfig, setSheetConfig] = useState<DynamicModalConfig>({
        visible: false, title: '', description: '',
        cancelText: '', confirmText: '', isDestructive: false, onConfirm: () => { },
    });

    const showSheet = (config: Omit<DynamicModalConfig, 'visible'>) => {
        setSheetConfig({ ...config, visible: true });
    };
    const closeSheet = () => setSheetConfig(prev => ({ ...prev, visible: false }));

    const { transactions, totalIncome, totalExpense, balance } = useTransactionStore();
    const consumeFeature = useUsageStore((s) => s.consume);
    const isSpeechRecognitionAvailable = !!ExpoSpeechRecognitionModule && !!useSpeechRecognitionEvent;

    // Tambah useEffect ini untuk listen logout/login
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_OUT') {
                    // Reset ke welcome message saat logout
                    setMessages([{
                        role: 'assistant',
                        content: '💰 Halo! Aku KalKu, asisten keuangan pribadimu. Tanya apa saja soal keuanganmu, aku siap bantu! 😊',
                        timestamp: new Date(),
                    }]);
                } else if (event === 'SIGNED_IN') {
                    // Load history akun yang baru login
                    setIsLoadingHistory(true);
                    await loadChatHistory();
                }
            }
        );
        return () => subscription.unsubscribe();
    }, []);

    // ── Get userId dari session ────────────────────────────────────────────────
    const getUserId = async (): Promise<string | null> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            return session?.user?.id ?? null;
        } catch (e) {
            return null;
        }
    };

    // ── Save chat history ──────────────────────────────────────────────────────
    const saveChatHistory = async (msgs: Message[]) => {
        try {
            const userId = await getUserId();
            if (!userId) return;
            const key = getChatHistoryKey(userId);
            const history = msgs.map(msg => ({ ...msg, timestamp: msg.timestamp.toISOString() }));
            await AsyncStorage.setItem(key, JSON.stringify(history));
        } catch (e) {
            console.error('❌ Save history error:', e);
        }
    };

    // ── Load chat history ──────────────────────────────────────────────────────
    const loadChatHistory = async () => {
        try {
            const userId = await getUserId();
            if (!userId) {
                setIsLoadingHistory(false);
                return;
            }
            const key = getChatHistoryKey(userId);
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                setMessages(parsed.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp),
                })));
            } else {
                setMessages([{
                    role: 'assistant',
                    content: '💰 Halo! Aku KalKu, asisten keuangan pribadimu. Tanya apa saja soal keuanganmu, aku siap bantu! 😊',
                    timestamp: new Date(),
                }]);
            }
        } catch (e) {
            setMessages([{
                role: 'assistant',
                content: '💰 Halo! Aku KalKu, asisten keuangan pribadimu. Tanya apa saja soal keuanganmu, aku siap bantu! 😊',
                timestamp: new Date(),
            }]);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // ── Clear chat history ─────────────────────────────────────────────────────
    const clearChatHistory = () => {
        showSheet({
            title: '🧹 Hapus Riwayat Chat?',
            description: 'Semua percakapan dengan KalKu akan hilang permanen. Yakin?',
            cancelText: 'Gak jadi', confirmText: 'Hapus!', isDestructive: true,
            onConfirm: async () => {
                closeSheet();
                try {
                    const userId = await getUserId();
                    if (!userId) return;
                    const key = getChatHistoryKey(userId);
                    await AsyncStorage.removeItem(key);
                    const welcome: Message[] = [{
                        role: 'assistant',
                        content: '💰 Halo! Aku KalKu, asisten keuangan pribadimu. Tanya apa saja soal keuanganmu, aku siap bantu! 😊',
                        timestamp: new Date(),
                    }];
                    setMessages(welcome);
                    await saveChatHistory(welcome);
                } catch (e) {
                    console.error('❌ Clear history error:', e);
                }
            },
        });
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;
        if (isSpeaking) await stopSpeaking();
        setInput('');
        const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        await saveChatHistory(newMessages);
        await sendMessageToKalKu(text, newMessages);
    };

    const sendMessageToKalKu = async (text: string, currentMessages: Message[]) => {
        if (!text || loading) return;
        if (isSpeaking) await stopSpeaking();
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/kalku`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token ?? ''}`,
                    },
                    body: JSON.stringify({ message: text, transactions: transactions.slice(0, 10), balance, totalIncome, totalExpense }),
                }
            );
            const data = await response.json();
            if (data?.error === 'limit_reached' || response.status === 429) {
                setUpgradeModalVisible(true);
                setLoading(false);
                const filtered = messages.filter(m => m.content !== text || m.role !== 'user');
                setMessages(filtered);
                await saveChatHistory(filtered);
                return;
            }
            const reply = data.reply ?? 'Maaf, KalKu sedang tidak bisa menjawab. Coba lagi ya! 🙏';
            const assistantMsg: Message = { role: 'assistant', content: reply, timestamp: new Date() };
            const updatedMessages = [...currentMessages, assistantMsg];
            setMessages(updatedMessages);
            await saveChatHistory(updatedMessages);
            setTimeout(() => speakMessage(reply, messages.length - 1), 300);
        } catch (e) {
            const errMsg: Message = {
                role: 'assistant',
                content: '😔 Koneksi bermasalah. Pastikan internet kamu aktif ya!',
                timestamp: new Date(),
            };
            const updatedMessages = [...currentMessages, errMsg];
            setMessages(updatedMessages);
            await saveChatHistory(updatedMessages);
        } finally {
            setLoading(false);
        }
    };

    const submitVoiceInput = async () => {
        if (isProcessingSubmit.current) return;
        const textToSend = voiceInputText.trim();
        if (!textToSend) return;
        isProcessingSubmit.current = true;
        if (isSpeechRecognitionAvailable && isVoiceStarted) {
            try { await ExpoSpeechRecognitionModule.stop(); } catch (e) { }
        }
        if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        if (isSpeechRecognitionAvailable) {
            try { await ExpoSpeechRecognitionModule.abort(); } catch (e) { }
        }
        setVoiceModalVisible(false);
        setVoiceInputText('');
        setIsRecording(false);
        setIsListening(false);
        setIsVoiceStarted(false);
        setIsProcessingVoice(false);
        setIsWaitingForSpeech(false);
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        const userMsg: Message = { role: 'user', content: textToSend, timestamp: new Date() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        await saveChatHistory(newMessages);
        await sendMessageToKalKu(textToSend, newMessages);
        isProcessingSubmit.current = false;
    };

    const stopListening = async () => {
        if (!isSpeechRecognitionAvailable || !isVoiceStarted) return;
        if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        try {
            await ExpoSpeechRecognitionModule.stop();
            setIsListening(false); setIsRecording(false);
            setIsVoiceStarted(false); setIsWaitingForSpeech(false);
        } catch (e) { console.error('Stop error:', e); }
    };

    const closeVoiceModal = async () => {
        if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        if (isSpeechRecognitionAvailable && isVoiceStarted) {
            try { await ExpoSpeechRecognitionModule.abort(); } catch (e) { }
        }
        setIsProcessingVoice(false); setVoiceModalVisible(false);
        setVoiceInputText(''); setIsRecording(false);
        setIsListening(false); setIsVoiceStarted(false); setIsWaitingForSpeech(false);
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
    };

    if (isSpeechRecognitionAvailable) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useSpeechRecognitionEvent('start', () => {
            if (!isFocusedRef.current) return;
            setIsListening(true); setIsRecording(true);
            setIsProcessingVoice(false); setIsVoiceStarted(true); setIsWaitingForSpeech(true);
            if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        });
        useSpeechRecognitionEvent('end', () => {
            if (!isFocusedRef.current) return;
            setIsListening(false); setIsRecording(false);
            setIsVoiceStarted(false); setIsWaitingForSpeech(false);
            if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        });
        useSpeechRecognitionEvent('result', (event: any) => {
            if (!isFocusedRef.current) return;
            const transcript = event.results?.[0]?.transcript;
            if (transcript) {
                setVoiceInputText(transcript);
                setIsWaitingForSpeech(false);
                if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
            }
        });
        useSpeechRecognitionEvent('error', (event: any) => {
            if (!isFocusedRef.current) return;
            if (event.error === 'aborted' || event.error === 'no-speech') {
                setIsListening(false); setIsRecording(false);
                setIsVoiceStarted(false); setIsWaitingForSpeech(false);
                if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
                return;
            }
            setIsListening(false); setIsRecording(false);
            setIsVoiceStarted(false); setIsWaitingForSpeech(false);
        });
    }

    useEffect(() => {
        const check = async () => {
            if (ExpoSpeechRecognitionModule) setIsAvailable(true);
        };
        check();
    }, []);

    useEffect(() => { loadChatHistory(); }, []);

    useEffect(() => {
        Animated.timing(headerAnim, {
            toValue: 1, duration: 600,
            easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }, [messages, loading]);

    const checkVoicePermission = async (): Promise<boolean> => {
        if (!ExpoSpeechRecognitionModule) return false;
        try {
            let permission = { granted: false };
            try { permission = await ExpoSpeechRecognitionModule.getPermissionsAsync(); } catch (e) { }
            if (!permission.granted) {
                let result = { granted: false };
                try { result = await ExpoSpeechRecognitionModule.requestPermissionsAsync(); } catch (e) { return false; }
                if (!result.granted) return false;
            }
            return true;
        } catch (e) { return false; }
    };

    const startListening = async () => {
        if (!ExpoSpeechRecognitionModule) return;
        const hasPermission = await checkVoicePermission();
        if (!hasPermission) { setIsProcessingVoice(false); return; }
        try {
            setVoiceInputText(''); setIsProcessingVoice(true); setIsWaitingForSpeech(true);
            await ExpoSpeechRecognitionModule.start({
                lang: 'id-ID', interimResults: true, continuous: true,
                maxAlternatives: 1, addsPunctuation: true,
            });
        } catch (e) {
            setIsProcessingVoice(false); setIsWaitingForSpeech(false);
        }
    };

    const openVoiceModal = async () => {
        setVoiceInputText(''); setVoiceModalVisible(true);
        setTimeout(() => startListening(), 500);
    };

    const speakMessage = async (text: string, idx: number) => {
        if (!voiceEnabled) return;
        const clean = text.replace(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/gu, '').trim();
        if (!clean) return;
        setSpeakingMsgIdx(idx); setIsSpeaking(true);
        await voiceAssistant.speak(clean, { personality: 'supportive' });
        setIsSpeaking(false); setSpeakingMsgIdx(null);
    };

    const stopSpeaking = async () => {
        await voiceAssistant.stop();
        setIsSpeaking(false); setSpeakingMsgIdx(null);
    };

    const quickQuestions = [
        { icon: 'wallet-outline' as const, label: 'Kondisi keuanganku?' },
        { icon: 'trending-down-outline' as const, label: 'Berapa yang kukeluarkan?' },
        { icon: 'bulb-outline' as const, label: 'Tips hemat bulan ini?' },
        { icon: 'pie-chart-outline' as const, label: 'Analisis pengeluaranku' },
    ];

    const shouldShowDateDivider = (index: number): boolean => {
        if (index === 0) return true;
        const cur = new Date(messages[index].timestamp);
        const prev = new Date(messages[index - 1].timestamp);
        return cur.getDate() !== prev.getDate() ||
            cur.getMonth() !== prev.getMonth() ||
            cur.getFullYear() !== prev.getFullYear();
    };

    if (isLoadingHistory) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={T.accent} />
                <Text style={{ color: T.textMuted, marginTop: 12 }}>Memuat riwayat chat...</Text>
            </SafeAreaView>
        );
    }

    return (
        <>
            <BottomSheetModal config={sheetConfig} onClose={closeSheet} isDark={isDark} />

            {/* ── KEY FIX: KeyboardAvoidingView di luar ImageBackground ── */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ImageBackground
                    source={require('../assets/icon/chat.png')}
                    style={{
                        flex: 1, width: '100%',
                        height: '100%',
                    }}
                    resizeMode="cover"
                >
                    {/* Overlay */}
                    <View style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: isDark ? 'rgba(8,15,36,0.85)' : 'rgba(248,250,252,0.85)',
                    }} />

                    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
                        <StatusBar style={isDark ? 'light' : 'dark'} />

                        {/* Header */}
                        <Animated.View style={{
                            opacity: headerAnim,
                            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
                            backgroundColor: T.card,
                            borderBottomWidth: 1, borderBottomColor: T.border,
                            paddingHorizontal: 16, paddingVertical: 12,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity
                                    onPress={() => router.back()}
                                    style={{
                                        width: 38, height: 38, borderRadius: 19,
                                        backgroundColor: T.border,
                                        alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="chevron-back" size={20} color={T.textSub} />
                                </TouchableOpacity>

                                <View style={{
                                    width: 42, height: 42, borderRadius: 21,
                                    backgroundColor: T.accent,
                                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                    shadowColor: T.accent, shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
                                }}>
                                    <Image source={require('../assets/icon/Mascot.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '700', fontSize: 16, color: T.text }}>KalKu</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                                        {isSpeaking ? (
                                            <>
                                                <SoundWave isActive={true} T={T} />
                                                <Text style={{ fontSize: 11, color: T.accentText, fontWeight: '500' }}>Sedang berbicara...</Text>
                                            </>
                                        ) : (
                                            <>
                                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.statusDot }} />
                                                <Text style={{ fontSize: 11, color: T.textMuted }}>Asisten keuangan AI</Text>
                                            </>
                                        )}
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                    <TouchableOpacity
                                        onPress={clearChatHistory}
                                        style={{
                                            width: 38, height: 38, borderRadius: 19,
                                            backgroundColor: T.border,
                                            alignItems: 'center', justifyContent: 'center',
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={T.textLight} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={async () => { if (isSpeaking) await stopSpeaking(); setVoiceEnabled(v => !v); }}
                                        style={{
                                            width: 38, height: 38, borderRadius: 19,
                                            backgroundColor: voiceEnabled ? T.accentBg : T.border,
                                            alignItems: 'center', justifyContent: 'center',
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name={voiceEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
                                            size={18}
                                            color={voiceEnabled ? T.accentText : T.textLight}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>

                        {/* Chat Area — flex:1 agar input tidak tertutup */}
                        <ScrollView
                            ref={scrollRef}
                            style={{ flex: 1 }}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 16,
                                paddingBottom: 16,
                            }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="interactive"
                        >
                            {messages.map((msg, i) => (
                                <MessageBubble
                                    key={i}
                                    msg={msg}
                                    idx={i}
                                    isCurrentlySpeaking={speakingMsgIdx === i}
                                    voiceEnabled={voiceEnabled}
                                    onSpeak={() => {
                                        if (isSpeaking && speakingMsgIdx === i) stopSpeaking();
                                        else speakMessage(msg.content, i);
                                    }}
                                    T={T}
                                    showDateDivider={shouldShowDateDivider(i)}
                                />
                            ))}

                            {loading && (
                                <View style={{ flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end', gap: 8 }}>
                                    <View style={{
                                        width: 36, height: 36, borderRadius: 18,
                                        backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Image source={require('../assets/icon/Mascot.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
                                    </View>
                                    <View style={{
                                        backgroundColor: T.assistantBubble,
                                        borderWidth: 1, borderColor: T.assistantBubbleBorder,
                                        borderRadius: 20, borderBottomLeftRadius: 4,
                                        paddingHorizontal: 16, paddingVertical: 12,
                                    }}>
                                        <TypingDots T={T} />
                                    </View>
                                </View>
                            )}

                            {messages.length === 1 && !loading && (
                                <View style={{ marginTop: 8, marginBottom: 8 }}>
                                    <Text style={{ fontSize: 11, color: T.textLight, textAlign: 'center', marginBottom: 10 }}>
                                        Coba tanya ini 👇
                                    </Text>
                                    <View style={{ gap: 8 }}>
                                        {quickQuestions.map((q, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                onPress={() => {
                                                    setInput(q.label);
                                                    setTimeout(() => sendMessage(), 300);
                                                }}
                                                style={{
                                                    flexDirection: 'row', alignItems: 'center', gap: 10,
                                                    backgroundColor: T.quickQuestionBg,
                                                    borderWidth: 1, borderColor: T.quickQuestionBorder,
                                                    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
                                                    shadowColor: T.accent, shadowOffset: { width: 0, height: 2 },
                                                    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={{
                                                    width: 32, height: 32, borderRadius: 10,
                                                    backgroundColor: T.quickQuestionIconBg,
                                                    alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    <Ionicons name={q.icon} size={16} color={T.accentText} />
                                                </View>
                                                <Text style={{ color: T.accentText, fontSize: 13, fontWeight: '500', flex: 1 }}>
                                                    {q.label}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={14} color={T.accentLight} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        {/* ── Input Bar — di luar ScrollView ── */}
                        <View style={{
                            paddingHorizontal: 16,
                            paddingTop: 8,
                            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
                            backgroundColor: T.card,
                            borderTopWidth: 1,
                            borderTopColor: T.border,
                        }}>
                            {isSpeaking && (
                                <TouchableOpacity
                                    onPress={stopSpeaking}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                        gap: 8, backgroundColor: T.accentBg, borderRadius: 12,
                                        paddingVertical: 6, marginBottom: 8,
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <SoundWave isActive={true} T={T} />
                                    <Text style={{ color: T.accentText, fontSize: 12, fontWeight: '600' }}>
                                        KalKu sedang berbicara — tap untuk hentikan
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <View style={{
                                flexDirection: 'row', alignItems: 'center', height: 50,
                                backgroundColor: T.inputBg,
                                borderWidth: 1.5,
                                borderColor: input.length > 0 ? T.accent : T.inputBorder,
                                borderRadius: 25, paddingHorizontal: 12,
                                shadowColor: input.length > 0 ? T.accent : 'transparent',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.15, shadowRadius: 6,
                            }}>
                                <VoiceRecordButton
                                    onPress={openVoiceModal}
                                    isRecording={isRecording}
                                    isProcessing={isProcessingVoice}
                                    T={T}
                                />
                                <TextInput
                                    ref={inputRef}
                                    value={input}
                                    onChangeText={setInput}
                                    placeholder="🎤 Tanya KalKu..."
                                    placeholderTextColor={T.textLight}
                                    style={{ flex: 1, fontSize: 14, color: T.text, height: 50, paddingVertical: 0 }}
                                    returnKeyType="send"
                                    onSubmitEditing={sendMessage}
                                    blurOnSubmit={false}
                                />
                                <TouchableOpacity
                                    onPress={sendMessage}
                                    disabled={!input.trim() || loading}
                                    style={{
                                        width: 36, height: 36, borderRadius: 18,
                                        backgroundColor: input.trim() && !loading ? T.accent : T.borderStrong,
                                        alignItems: 'center', justifyContent: 'center',
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={loading ? 'hourglass-outline' : 'send'}
                                        size={16}
                                        color={input.trim() && !loading ? 'white' : T.textLight}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </SafeAreaView>
                </ImageBackground>
            </KeyboardAvoidingView>

            {/* Voice Modal */}
            <Modal animationType="slide" transparent visible={voiceModalVisible} onRequestClose={closeVoiceModal}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: T.overlay }}>
                    <View style={{
                        backgroundColor: T.modalBg,
                        borderTopLeftRadius: 24, borderTopRightRadius: 24,
                        padding: 20,
                        paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 20 : 16),
                    }}>
                        <View style={{
                            width: 40, height: 4, backgroundColor: T.borderStrong,
                            borderRadius: 2, alignSelf: 'center', marginBottom: 16,
                        }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <View style={{
                                width: 44, height: 44, borderRadius: 22,
                                backgroundColor: isWaitingForSpeech ? '#ef4444' : isListening ? '#f59e0b' : T.accentBg,
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Ionicons
                                    name={isWaitingForSpeech ? 'mic' : isListening ? 'time' : 'mic-outline'}
                                    size={22}
                                    color={isWaitingForSpeech ? '#ef4444' : isListening ? '#f59e0b' : T.accentText}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: T.text }}>
                                    {isWaitingForSpeech ? '🎤 Dengarkan...' : isListening ? '⏳ Memproses...' : voiceInputText.trim() ? '📝 Selesai' : '🎤 Tanya KalKu'}
                                </Text>
                                <Text style={{ fontSize: 12, color: isWaitingForSpeech ? '#ef4444' : isListening ? '#f59e0b' : T.textMuted }}>
                                    {isWaitingForSpeech ? 'Bicaralah sekarang...' : isListening ? 'Sedang memproses suara...' : voiceInputText.trim() ? 'Sudah selesai, kirim sekarang?' : 'Tap mic dan bicara...'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={closeVoiceModal}
                                style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    backgroundColor: T.border, alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <Ionicons name="close" size={18} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                            minHeight: 60, marginBottom: 16,
                            backgroundColor: T.bg, borderRadius: 14, padding: 16,
                        }}>
                            {isWaitingForSpeech ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    {[1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1].map((h, i) => (
                                        <View key={i} style={{
                                            width: 4, height: h * 4 + 8, borderRadius: 2,
                                            backgroundColor: T.accent, opacity: 0.6 + (h / 10),
                                        }} />
                                    ))}
                                </View>
                            ) : voiceInputText.trim() ? (
                                <Text style={{ fontSize: 16, color: T.text, textAlign: 'center' }}>
                                    "{voiceInputText}"
                                </Text>
                            ) : (
                                <Text style={{ color: T.textLight, fontSize: 14 }}>
                                    {isListening ? '⏳ Memproses...' : 'Tap mic dan bicara...'}
                                </Text>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={closeVoiceModal}
                                style={{
                                    flex: 1, backgroundColor: T.border, borderRadius: 14,
                                    paddingVertical: 14, alignItems: 'center',
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={{ color: T.textMuted, fontWeight: '600' }}>Batal</Text>
                            </TouchableOpacity>
                            {isWaitingForSpeech ? (
                                <TouchableOpacity
                                    onPress={stopListening}
                                    style={{
                                        flex: 2, backgroundColor: '#ef4444', borderRadius: 14,
                                        paddingVertical: 14, alignItems: 'center',
                                        flexDirection: 'row', justifyContent: 'center', gap: 8,
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="stop" size={18} color="white" />
                                    <Text style={{ color: 'white', fontWeight: '600' }}>Stop</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={submitVoiceInput}
                                    disabled={!voiceInputText.trim() || isProcessingSubmit.current}
                                    style={{
                                        flex: 2,
                                        backgroundColor: voiceInputText.trim() && !isProcessingSubmit.current ? T.accent : T.borderStrong,
                                        borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                                        flexDirection: 'row', justifyContent: 'center', gap: 8,
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="send" size={18} color={voiceInputText.trim() ? 'white' : T.textLight} />
                                    <Text style={{ color: voiceInputText.trim() ? 'white' : T.textLight, fontWeight: '600' }}>
                                        {isProcessingSubmit.current ? 'Mengirim...' : 'Kirim'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            <UpgradeProModal
                visible={upgradeModalVisible}
                feature="kalku"
                onClose={() => setUpgradeModalVisible(false)}
                onUpgrade={() => { setUpgradeModalVisible(false); router.push('/upgrade-pro'); }}
            />
        </>
    );
}