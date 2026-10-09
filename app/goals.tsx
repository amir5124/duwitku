// app/goals.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/contexts/ThemeContext';
import { supabase } from '../src/services/supabase/client';
import { formatCurrency } from '../src/utils/formatters';

const LIGHT = {
    bg: '#f4f6fb',
    card: '#ffffff',
    cardAlt: '#f8faff',
    text: '#0b1437',
    textSub: '#64748b',
    textMuted: '#94a3b8',
    border: '#e8edf5',
    borderLight: '#f1f5f9',
    accent: '#3b6ef5',
    accentLight: '#eef2ff',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    modalOverlay: 'rgba(0,0,0,0.5)',
    modalBg: '#ffffff',
};

const DARK = {
    bg: '#080f24',
    card: '#0f1a3d',
    cardAlt: '#111f47',
    text: '#f0f4ff',
    textSub: '#8899bb',
    textMuted: '#4b5a7a',
    border: '#1a2a55',
    borderLight: '#111f47',
    accent: '#3b6ef5',
    accentLight: '#1a2a55',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    modalOverlay: 'rgba(0,0,0,0.7)',
    modalBg: '#162235',
};

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Goal {
    id: string;
    user_id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    target_date?: string;
    emoji: string;
    color: string;
    status: string;
    created_at: string;
}

interface DynamicModalConfig {
    visible: boolean;
    title: string;
    description: string;
    cancelText: string;
    confirmText: string;
    isDestructive: boolean;
    onConfirm: () => void;
}

// ─── Preset Goals ─────────────────────────────────────────────────────────────
const PRESET_GOALS = [
    { emoji: '📱', label: 'Gadget', color: '#6366f1' },
    { emoji: '✈️', label: 'Liburan', color: '#0ea5e9' },
    { emoji: '🏠', label: 'Rumah', color: '#10b981' },
    { emoji: '🚗', label: 'Kendaraan', color: '#f59e0b' },
    { emoji: '💒', label: 'Nikah', color: '#ec4899' },
    { emoji: '📚', label: 'Pendidikan', color: '#8b5cf6' },
    { emoji: '💊', label: 'Kesehatan', color: '#ef4444' },
    { emoji: '🎯', label: 'Lainnya', color: '#64748b' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(dateStr?: string): number | null {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
}

function formatTargetDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatNumber(num: string): string {
    const clean = num.replace(/[^\d]/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseFormattedNumber(formatted: string): number {
    const clean = formatted.replace(/\./g, '');
    return parseInt(clean, 10) || 0;
}

// ─── Loading Modal ─────────────────────────────────────────────────────────────
function LoadingModal({ visible, message = 'Memproses...', progress = 0, T }: {
    visible: boolean;
    message?: string;
    progress?: number;
    T: typeof LIGHT;
}) {
    const [progressAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (visible) {
            Animated.timing(progressAnim, {
                toValue: progress,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }
    }, [visible, progress]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
            <View style={{
                flex: 1,
                backgroundColor: T.modalOverlay,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
                <View style={{
                    backgroundColor: T.modalBg,
                    borderRadius: 24,
                    padding: 32,
                    width: '100%',
                    maxWidth: 320,
                    alignItems: 'center',
                }}>
                    <ActivityIndicator size="large" color={T.accent} style={{ marginBottom: 16 }} />
                    <Text style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: T.text,
                        marginBottom: 8,
                        textAlign: 'center',
                    }}>
                        {message}
                    </Text>
                    <View style={{
                        width: '100%',
                        height: 6,
                        backgroundColor: T.border,
                        borderRadius: 3,
                        overflow: 'hidden',
                        marginTop: 8,
                    }}>
                        <Animated.View style={{
                            height: '100%',
                            backgroundColor: T.accent,
                            borderRadius: 3,
                            width: progressAnim.interpolate({
                                inputRange: [0, 100],
                                outputRange: ['0%', '100%'],
                            }),
                        }} />
                    </View>
                    <Text style={{
                        fontSize: 11,
                        color: T.textMuted,
                        marginTop: 4,
                    }}>
                        {Math.round(progress)}%
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

// ─── Bottom Sheet Modal ──────────────────────────────────────────────────────
function BottomSheetModal({ config, onClose, isDark }: {
    config: DynamicModalConfig;
    onClose: () => void;
    isDark: boolean;
}) {
    const T = isDark ? DARK : LIGHT;

    if (!config.visible) return null;

    return (
        <Modal
            transparent
            animationType="slide"
            statusBarTranslucent
            visible={config.visible}
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: T.modalOverlay,
                justifyContent: 'flex-end',
            }}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={{ flex: 1 }} />
                </TouchableWithoutFeedback>

                <View style={{
                    backgroundColor: T.modalBg,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingHorizontal: 24,
                    paddingTop: 32,
                    paddingBottom: 50,
                    width: '100%',
                    position: 'relative'
                }}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            position: 'absolute',
                            right: 24,
                            top: -64,
                            backgroundColor: '#fff',
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.18,
                            shadowRadius: 4,
                            elevation: 5,
                        }}
                    >
                        <Ionicons name="close" size={24} color="#1c1c1c" />
                    </TouchableOpacity>

                    <Text style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: T.text,
                        marginBottom: 10,
                    }}>
                        {config.title}
                    </Text>

                    <Text style={{
                        fontSize: 15,
                        color: isDark ? T.textSub : '#555555',
                        lineHeight: 22,
                        marginBottom: 32,
                    }}>
                        {config.description}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 14, width: '100%' }}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{
                                flex: 1,
                                backgroundColor: 'transparent',
                                borderRadius: 100,
                                paddingVertical: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1.5,
                                borderColor: config.isDestructive ? T.danger : T.accent,
                            }}
                        >
                            <Text style={{
                                color: config.isDestructive ? T.danger : T.accent,
                                fontWeight: '700',
                                fontSize: 16
                            }}>
                                {config.cancelText}
                            </Text>
                        </TouchableOpacity>

                        {config.confirmText !== '' && (
                            <TouchableOpacity
                                onPress={config.onConfirm}
                                style={{
                                    flex: 1,
                                    backgroundColor: config.isDestructive ? T.danger : T.accent,
                                    borderRadius: 100,
                                    paddingVertical: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                                    {config.confirmText}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default function GoalsScreen() {
    const insets = useSafeAreaInsets();
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;

    // ─── State ──────────────────────────────────────────────────────────────────
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState<Goal | null>(null);
    const [topUpAmount, setTopUpAmount] = useState('');

    // ─── Form State ─────────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        name: '',
        target_amount: '',
        current_amount: '0',
        target_date: '',
        emoji: '🎯',
        color: '#6366f1',
    });

    // ─── Modal State ──────────────────────────────────────────────────────────
    const [sheetConfig, setSheetConfig] = useState<DynamicModalConfig>({
        visible: false,
        title: '',
        description: '',
        cancelText: '',
        confirmText: '',
        isDestructive: false,
        onConfirm: () => { },
    });

    const [loadingModalVisible, setLoadingModalVisible] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Memproses...');
    const [loadingProgress, setLoadingProgress] = useState(0);

    // ─── Modal Helpers ──────────────────────────────────────────────────────
    const showSheet = (config: Omit<DynamicModalConfig, 'visible'>) => {
        setSheetConfig({ ...config, visible: true });
    };

    const closeSheet = () => {
        setSheetConfig(prev => ({ ...prev, visible: false }));
    };

    const showLoading = (message: string, progress: number = 0) => {
        setLoadingMessage(message);
        setLoadingProgress(progress);
        setLoadingModalVisible(true);
    };

    const updateLoadingProgress = (progress: number) => {
        setLoadingProgress(progress);
    };

    const hideLoading = () => {
        setLoadingModalVisible(false);
    };

    // ─── Load Goals ──────────────────────────────────────────────────────────
    const loadGoals = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }
            const { data, error } = await supabase
                .from('saving_goals')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (!error && data) {
                setGoals(data as Goal[]);
            }
        } catch (error) {
            console.error('Error loading goals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGoals();
    }, []);

    // ─── CRUD Operations ─────────────────────────────────────────────────────
    const handleAddGoal = async () => {
        if (!formData.name || !formData.target_amount) {
            showSheet({
                title: '😅 Eh, kurang!',
                description: 'Nama dan target nominal wajib diisi ya!',
                cancelText: 'Oke',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
            return;
        }

        showLoading('Menyimpan goal...', 0);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found');

            updateLoadingProgress(30);

            const { error } = await supabase.from('saving_goals').insert({
                user_id: user.id,
                name: formData.name,
                target_amount: parseFormattedNumber(formData.target_amount),
                current_amount: parseFormattedNumber(formData.current_amount) || 0,
                target_date: formData.target_date || null,
                emoji: formData.emoji,
                color: formData.color,
                is_active: true,
            });

            updateLoadingProgress(70);

            if (error) throw error;

            updateLoadingProgress(100);

            setTimeout(() => {
                hideLoading();
                setShowAddModal(false);
                setFormData({ name: '', target_amount: '', current_amount: '0', target_date: '', emoji: '🎯', color: '#6366f1' });
                loadGoals();
                showSheet({
                    title: '🎉 Berhasil!',
                    description: `Goal "${formData.name}" berhasil ditambahkan! 🎯`,
                    cancelText: 'Mantap!',
                    confirmText: '',
                    isDestructive: false,
                    onConfirm: closeSheet,
                });
            }, 500);
        } catch (error: any) {
            hideLoading();
            showSheet({
                title: '😱 Gagal!',
                description: error.message || 'Gagal menambahkan goal. Coba lagi ya!',
                cancelText: 'Coba lagi',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
        }
    };

    const handleTopUp = async () => {
        if (!showTopUpModal || !topUpAmount) {
            showSheet({
                title: '😅 Eh, kurang!',
                description: 'Masukkan nominal yang mau ditabung ya!',
                cancelText: 'Oke',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
            return;
        }

        const amount = parseFormattedNumber(topUpAmount);
        if (isNaN(amount) || amount <= 0) {
            showSheet({
                title: '😅 Eh, kurang!',
                description: 'Nominal harus lebih dari 0 ya!',
                cancelText: 'Oke',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
            return;
        }

        showLoading('Menambahkan tabungan...', 0);

        try {
            updateLoadingProgress(30);
            const newAmount = showTopUpModal.current_amount + amount;

            const { error } = await supabase
                .from('saving_goals')
                .update({ current_amount: newAmount })
                .eq('id', showTopUpModal.id);

            updateLoadingProgress(70);

            if (error) throw error;

            updateLoadingProgress(100);

            setTimeout(() => {
                hideLoading();
                setShowTopUpModal(null);
                setTopUpAmount('');
                loadGoals();
                showSheet({
                    title: '💰 Berhasil!',
                    description: `Tabungan "${showTopUpModal.name}" berhasil ditambah ${formatCurrency(amount)}! 🎉`,
                    cancelText: 'Keren!',
                    confirmText: '',
                    isDestructive: false,
                    onConfirm: closeSheet,
                });
            }, 500);
        } catch (error: any) {
            hideLoading();
            showSheet({
                title: '😱 Gagal!',
                description: error.message || 'Gagal menambah tabungan. Coba lagi ya!',
                cancelText: 'Coba lagi',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
        }
    };

    const handleDelete = (goal: Goal) => {
        showSheet({
            title: '🗑️ Hapus Goal?',
            description: `Yakin mau hapus "${goal.name}"? Data bakal ilang permanen!`,
            cancelText: 'Gak jadi',
            confirmText: 'Hapus!',
            isDestructive: true,
            onConfirm: async () => {
                closeSheet();
                showLoading('Menghapus goal...', 0);
                try {
                    updateLoadingProgress(30);
                    const { error } = await supabase
                        .from('saving_goals')
                        .update({ is_active: false })
                        .eq('id', goal.id);

                    updateLoadingProgress(70);

                    if (error) throw error;

                    updateLoadingProgress(100);

                    setTimeout(() => {
                        hideLoading();
                        loadGoals();
                        showSheet({
                            title: '🗑️ Berhasil dihapus!',
                            description: `Goal "${goal.name}" udah ilang.`,
                            cancelText: 'Oke',
                            confirmText: '',
                            isDestructive: false,
                            onConfirm: closeSheet,
                        });
                    }, 500);
                } catch (error: any) {
                    hideLoading();
                    showSheet({
                        title: '😱 Gagal!',
                        description: error.message || 'Gagal menghapus goal. Coba lagi ya!',
                        cancelText: 'Coba lagi',
                        confirmText: '',
                        isDestructive: false,
                        onConfirm: closeSheet,
                    });
                }
            },
        });
    };

    // ─── Refresh ──────────────────────────────────────────────────────────────
    const onRefresh = async () => {
        setRefreshing(true);
        await loadGoals();
        setRefreshing(false);
    };

    // ─── Render Goal Item ────────────────────────────────────────────────────
    const renderGoalItem = (goal: Goal, index: number) => {
        const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const remaining = goal.target_amount - goal.current_amount;
        const days = daysUntil(goal.target_date);
        const isDone = pct >= 100;

        return (
            <View
                key={goal.id}
                style={{
                    padding: 14,
                    borderBottomWidth: index < goals.length - 1 ? 0.5 : 0,
                    borderBottomColor: T.border,
                    backgroundColor: isDone ? '#f0fdf4' : T.card,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    {/* Emoji avatar */}
                    <View style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor: goal.color + '18',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <Text style={{ fontSize: 20 }}>{goal.emoji}</Text>
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: T.text, flex: 1 }} numberOfLines={1}>
                                {goal.name}
                            </Text>
                            {isDone && (
                                <View style={{ backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803d' }}>TERCAPAI 🎉</Text>
                                </View>
                            )}
                        </View>

                        {/* Target & current */}
                        <Text style={{ fontSize: 12, color: T.textSub, marginBottom: 7 }}>
                            <Text style={{ fontWeight: '600', color: goal.color }}>{formatCurrency(goal.current_amount)}</Text>
                            {' '}/ {formatCurrency(goal.target_amount)}
                        </Text>

                        {/* Progress bar */}
                        <View style={{ height: 6, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                            <View style={{
                                height: '100%',
                                borderRadius: 3,
                                width: `${pct}%`,
                                backgroundColor: isDone ? T.success : goal.color,
                            }} />
                        </View>

                        {/* Pct + deadline */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: T.textMuted }}>
                                {Math.round(pct)}% {!isDone && `· Sisa ${formatCurrency(remaining)}`}
                            </Text>
                            {days !== null && !isDone && (
                                <Text style={{
                                    fontSize: 11,
                                    fontWeight: '500',
                                    color: days < 30 ? T.danger : T.textMuted,
                                }}>
                                    {days > 0 ? `${days} hari lagi` : 'Sudah lewat target'}
                                </Text>
                            )}
                            {goal.target_date && isDone && (
                                <Text style={{ fontSize: 11, color: T.success, fontWeight: '500' }}>
                                    Target: {formatTargetDate(goal.target_date)}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Action buttons */}
                    <View style={{ gap: 6, flexShrink: 0 }}>
                        {!isDone && (
                            <TouchableOpacity
                                onPress={() => setShowTopUpModal(goal)}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    backgroundColor: goal.color + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="add" size={16} color={goal.color} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPress={() => handleDelete(goal)}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                backgroundColor: '#fff1f2',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="trash-outline" size={14} color={T.danger} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    // ─── Render Empty State ──────────────────────────────────────────────────
    const renderEmptyState = () => (
        <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{
                backgroundColor: T.card,
                borderRadius: 20,
                padding: 24,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: T.accentLight,
                borderStyle: 'dashed',
            }}
            activeOpacity={0.7}
        >
            <View style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: T.accentLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
            }}>
                <Ionicons name="trophy-outline" size={26} color={T.accent} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: T.accent }}>
                Buat tujuan nabung pertama
            </Text>
            <Text style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                Liburan, gadget, atau apa saja.{'\n'}KalKu bantu pantau progressnya!
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Loading Modal */}
            <LoadingModal
                visible={loadingModalVisible}
                message={loadingMessage}
                progress={loadingProgress}
                T={T}
            />

            {/* Bottom Sheet Modal */}
            <BottomSheetModal
                config={sheetConfig}
                onClose={closeSheet}
                isDark={isDark}
            />

            {/* Header */}
            <View style={{
                paddingHorizontal: 10,
                paddingTop: insets.top > 0 ? 4 : 10,
                paddingBottom: 12,
                backgroundColor: T.card,
                borderBottomWidth: 0.5,
                borderBottomColor: T.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
                    <Ionicons name="arrow-back" size={24} color={T.text} />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="trophy-outline" size={20} color={T.accent} />
                    <Text style={{ fontSize: 17, fontWeight: '700', color: T.text }}>
                        Goals
                    </Text>
                    {goals.length > 0 && (
                        <Text style={{ fontSize: 12, color: T.textMuted }}>
                            ({goals.length})
                        </Text>
                    )}
                </View>
                <TouchableOpacity
                    onPress={() => setShowAddModal(true)}
                    style={{ padding: 4 }}
                >
                    <Ionicons name="add-circle-outline" size={26} color={T.accent} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 40 }}
            >
                {loading ? (
                    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={T.accent} />
                        <Text style={{ color: T.textMuted, marginTop: 12, fontSize: 14 }}>
                            Loading goals...
                        </Text>
                    </View>
                ) : goals.length === 0 ? (
                    renderEmptyState()
                ) : (
                    <View style={{
                        backgroundColor: T.card,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: T.border,
                        overflow: 'hidden',
                    }}>
                        {goals.map((goal, idx) => renderGoalItem(goal, idx))}
                    </View>
                )}
            </ScrollView>

            {/* ─── MODAL: TAMBAH GOAL ─── */}
            <Modal
                animationType="slide"
                transparent
                visible={showAddModal}
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <View style={{
                            flex: 1,
                            justifyContent: 'flex-end',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                        }}>
                            <View style={{
                                backgroundColor: T.card,
                                borderTopLeftRadius: 28,
                                borderTopRightRadius: 28,
                                padding: 24,
                                paddingBottom: Math.max(insets.bottom, 24),
                            }}>
                                <View style={{
                                    width: 40,
                                    height: 4,
                                    backgroundColor: T.border,
                                    borderRadius: 2,
                                    alignSelf: 'center',
                                    marginBottom: 20,
                                }} />

                                <View style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 20,
                                }}>
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: T.text }}>
                                        🎯 Tambah Goals
                                    </Text>
                                    <TouchableOpacity onPress={() => {
                                        setShowAddModal(false);
                                        setFormData({ name: '', target_amount: '', current_amount: '0', target_date: '', emoji: '🎯', color: '#6366f1' });
                                    }}>
                                        <Ionicons name="close-outline" size={24} color={T.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                    {/* Pilih Preset */}
                                    <Text style={{
                                        fontSize: 11,
                                        fontWeight: '600',
                                        color: T.textMuted,
                                        marginBottom: 8,
                                    }}>
                                        PILIH KATEGORI
                                    </Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {PRESET_GOALS.map((p, i) => (
                                                <TouchableOpacity
                                                    key={i}
                                                    onPress={() => setFormData(f => ({
                                                        ...f,
                                                        emoji: p.emoji,
                                                        color: p.color,
                                                        name: f.name || p.label
                                                    }))}
                                                    style={{
                                                        alignItems: 'center',
                                                        padding: 10,
                                                        borderRadius: 14,
                                                        borderWidth: formData.emoji === p.emoji ? 2 : 1,
                                                        borderColor: formData.emoji === p.emoji ? p.color : T.border,
                                                        backgroundColor: formData.emoji === p.emoji ? p.color + '15' : T.bg,
                                                        minWidth: 60,
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={{ fontSize: 22, marginBottom: 3 }}>{p.emoji}</Text>
                                                    <Text style={{
                                                        fontSize: 10,
                                                        color: formData.emoji === p.emoji ? p.color : T.textMuted,
                                                        fontWeight: '500',
                                                    }}>
                                                        {p.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </ScrollView>

                                    {/* Nama Goal */}
                                    <View style={{ marginBottom: 14 }}>
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: '600',
                                            color: T.textMuted,
                                            marginBottom: 6,
                                        }}>
                                            Nama Goal <Text style={{ color: '#ef4444' }}>*</Text>
                                        </Text>
                                        <TextInput
                                            style={{
                                                backgroundColor: T.bg,
                                                borderRadius: 12,
                                                paddingHorizontal: 14,
                                                paddingVertical: 12,
                                                fontSize: 14,
                                                color: T.text,
                                                borderWidth: 1,
                                                borderColor: T.border,
                                            }}
                                            placeholder="Contoh: Liburan ke Bali"
                                            placeholderTextColor={T.textMuted}
                                            value={formData.name}
                                            onChangeText={(text) => setFormData({ ...formData, name: text })}
                                        />
                                    </View>

                                    {/* Target Amount */}
                                    <View style={{ marginBottom: 14 }}>
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: '600',
                                            color: T.textMuted,
                                            marginBottom: 6,
                                        }}>
                                            Target Nominal <Text style={{ color: '#ef4444' }}>*</Text>
                                        </Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: T.bg,
                                            borderRadius: 12,
                                            paddingHorizontal: 14,
                                            borderWidth: 1,
                                            borderColor: T.border,
                                        }}>
                                            <Text style={{ color: T.textMuted, fontSize: 14, marginRight: 6 }}>Rp</Text>
                                            <TextInput
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 12,
                                                    fontSize: 14,
                                                    color: T.text,
                                                }}
                                                placeholder="5.000.000"
                                                placeholderTextColor={T.textMuted}
                                                keyboardType="numeric"
                                                value={formData.target_amount}
                                                onChangeText={(text) => setFormData({ ...formData, target_amount: formatNumber(text) })}
                                            />
                                        </View>
                                    </View>

                                    {/* Current Amount */}
                                    <View style={{ marginBottom: 14 }}>
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: '600',
                                            color: T.textMuted,
                                            marginBottom: 6,
                                        }}>
                                            Sudah Terkumpul
                                        </Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: T.bg,
                                            borderRadius: 12,
                                            paddingHorizontal: 14,
                                            borderWidth: 1,
                                            borderColor: T.border,
                                        }}>
                                            <Text style={{ color: T.textMuted, fontSize: 14, marginRight: 6 }}>Rp</Text>
                                            <TextInput
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 12,
                                                    fontSize: 14,
                                                    color: T.text,
                                                }}
                                                placeholder="0"
                                                placeholderTextColor={T.textMuted}
                                                keyboardType="numeric"
                                                value={formData.current_amount}
                                                onChangeText={(text) => setFormData({ ...formData, current_amount: formatNumber(text) })}
                                            />
                                        </View>
                                    </View>

                                    {/* Target Date */}
                                    <View style={{ marginBottom: 20 }}>
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: '600',
                                            color: T.textMuted,
                                            marginBottom: 6,
                                        }}>
                                            Target Tanggal
                                        </Text>
                                        <TextInput
                                            style={{
                                                backgroundColor: T.bg,
                                                borderRadius: 12,
                                                paddingHorizontal: 14,
                                                paddingVertical: 12,
                                                fontSize: 14,
                                                color: T.text,
                                                borderWidth: 1,
                                                borderColor: T.border,
                                            }}
                                            placeholder="YYYY-MM-DD (Contoh: 2026-12-31)"
                                            placeholderTextColor={T.textMuted}
                                            value={formData.target_date}
                                            onChangeText={(text) => setFormData({ ...formData, target_date: text })}
                                        />
                                    </View>

                                    {/* Tombol Simpan */}
                                    <TouchableOpacity
                                        onPress={handleAddGoal}
                                        style={{
                                            backgroundColor: T.accent,
                                            borderRadius: 16,
                                            padding: 16,
                                            alignItems: 'center',
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            gap: 8,
                                            marginBottom: 24,
                                        }}
                                    >
                                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                                            Simpan Goal
                                        </Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            {/* ─── MODAL: TOP UP ─── */}
            <Modal
                animationType="slide"
                transparent
                visible={!!showTopUpModal}
                onRequestClose={() => { setShowTopUpModal(null); setTopUpAmount(''); }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <View style={{
                            flex: 1,
                            justifyContent: 'flex-end',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                        }}>
                            <View style={{
                                backgroundColor: T.card,
                                borderTopLeftRadius: 28,
                                borderTopRightRadius: 28,
                                padding: 24,
                                paddingBottom: Math.max(insets.bottom, 24),
                            }}>
                                <View style={{
                                    width: 40,
                                    height: 4,
                                    backgroundColor: T.border,
                                    borderRadius: 2,
                                    alignSelf: 'center',
                                    marginBottom: 20,
                                }} />

                                {showTopUpModal && (
                                    <>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                            <View style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 16,
                                                backgroundColor: showTopUpModal.color + '18',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Text style={{ fontSize: 24 }}>{showTopUpModal.emoji}</Text>
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 16, fontWeight: '700', color: T.text }}>
                                                    Tambah Tabungan
                                                </Text>
                                                <Text style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                                                    {showTopUpModal.name}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Progress info */}
                                        <View style={{
                                            backgroundColor: T.bg,
                                            borderRadius: 12,
                                            padding: 12,
                                            marginBottom: 16,
                                        }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <Text style={{ fontSize: 12, color: T.textMuted }}>Sudah terkumpul</Text>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: showTopUpModal.color }}>
                                                    {formatCurrency(showTopUpModal.current_amount)}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontSize: 12, color: T.textMuted }}>Sisa target</Text>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>
                                                    {formatCurrency(showTopUpModal.target_amount - showTopUpModal.current_amount)}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: '600',
                                            color: T.textMuted,
                                            marginBottom: 6,
                                        }}>
                                            JUMLAH YANG DITABUNG
                                        </Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: T.bg,
                                            borderWidth: 1.5,
                                            borderColor: showTopUpModal.color,
                                            borderRadius: 12,
                                            paddingHorizontal: 14,
                                            marginBottom: 20,
                                        }}>
                                            <Text style={{ fontSize: 14, color: T.textMuted, marginRight: 6 }}>Rp</Text>
                                            <TextInput
                                                style={{
                                                    flex: 1,
                                                    fontSize: 16,
                                                    fontWeight: '700',
                                                    color: T.text,
                                                    paddingVertical: 14,
                                                }}
                                                placeholder="0"
                                                placeholderTextColor={T.textMuted}
                                                keyboardType="numeric"
                                                value={topUpAmount}
                                                onChangeText={(text) => setTopUpAmount(formatNumber(text))}
                                                autoFocus
                                            />
                                        </View>

                                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                                            <TouchableOpacity
                                                onPress={() => { setShowTopUpModal(null); setTopUpAmount(''); }}
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: T.bg,
                                                    borderRadius: 14,
                                                    padding: 14,
                                                    alignItems: 'center',
                                                    borderWidth: 1,
                                                    borderColor: T.border,
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={{ color: T.textSub, fontWeight: '600' }}>Batal</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={handleTopUp}
                                                style={{
                                                    flex: 2,
                                                    backgroundColor: showTopUpModal.color,
                                                    borderRadius: 14,
                                                    padding: 14,
                                                    alignItems: 'center',
                                                }}
                                                activeOpacity={0.85}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: '700' }}>
                                                    Simpan Tabungan
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}