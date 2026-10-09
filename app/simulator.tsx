// app/simulator.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SmartBudgetSimulator } from '../src/components/finance/Smartbudgetsimulator';
import { useTheme } from '../src/contexts/ThemeContext';
import { supabase } from '../src/services/supabase/client';
import { useBudgetStore } from '../src/store/budgetStore';
import { useTransactionStore } from '../src/store/transactionStore';
import { Installment } from '../src/types';

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

interface DynamicModalConfig {
    visible: boolean;
    title: string;
    description: string;
    cancelText: string;
    confirmText: string;
    isDestructive: boolean;
    onConfirm: () => void;
}

// ── Loading Modal dengan Progress Bar ──────────────────────────────────────
function LoadingModal({ visible, message = 'Memproses...', progress = 0 }: {
    visible: boolean;
    message?: string;
    progress?: number;
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
                backgroundColor: 'rgba(0,0,0,0.6)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 24,
                    padding: 32,
                    width: '100%',
                    maxWidth: 320,
                    alignItems: 'center',
                }}>
                    <ActivityIndicator size="large" color="#3b6ef5" style={{ marginBottom: 16 }} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b1437', marginBottom: 8 }}>
                        {message}
                    </Text>
                    <View style={{
                        width: '100%',
                        height: 6,
                        backgroundColor: '#e8edf5',
                        borderRadius: 3,
                        overflow: 'hidden',
                        marginTop: 8,
                    }}>
                        <Animated.View style={{
                            height: '100%',
                            backgroundColor: '#3b6ef5',
                            borderRadius: 3,
                            width: progressAnim.interpolate({
                                inputRange: [0, 100],
                                outputRange: ['0%', '100%'],
                            }),
                        }} />
                    </View>
                    <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                        {Math.round(progress)}%
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

// ── Toast Modal ─────────────────────────────────────────────────────────────
function ToastModal({ visible, onClose, title, message, icon, iconColor = '#10b981', T }: {
    visible: boolean; onClose: () => void; title: string; message: string;
    icon: keyof typeof Ionicons.glyphMap; iconColor?: string; T: typeof LIGHT;
}) {
    useEffect(() => { if (visible) { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); } }, [visible]);
    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 24, paddingBottom: 90 }}>
                    <TouchableWithoutFeedback>
                        <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 }}>
                            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: iconColor + '15', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name={icon} size={24} color={iconColor} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: T.text }}>{title}</Text>
                                <Text style={{ fontSize: 13, color: T.textSub, marginTop: 2 }}>{message}</Text>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

export default function SimulatorScreen() {
    const insets = useSafeAreaInsets();
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [installments, setInstallments] = useState<Installment[]>([]);
    const { transactions, balance, fetchTransactions } = useTransactionStore();
    const { fetchBudgets } = useBudgetStore();

    // ── Modal State ──────────────────────────────────────────────────────────
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

    const [toastVisible, setToastVisible] = useState(false);
    const [toastData, setToastData] = useState({ title: '', message: '', icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap, iconColor: '#10b981' });

    // ── Modal Helpers ──────────────────────────────────────────────────────
    const showSheet = (config: Omit<DynamicModalConfig, 'visible'>) => {
        setSheetConfig({ ...config, visible: true });
    };

    const closeSheet = () => {
        setSheetConfig(prev => ({ ...prev, visible: false }));
    };

    const showToast = (title: string, message: string, icon: keyof typeof Ionicons.glyphMap = 'checkmark-circle', iconColor = '#10b981') => {
        setToastData({ title, message, icon, iconColor });
        setToastVisible(true);
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

    // ── Load Data ──────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        try {
            showLoading('Memuat data simulasi...', 0);

            await Promise.all([
                fetchTransactions(),
                fetchBudgets(),
                loadInstallments()
            ]);

            updateLoadingProgress(80);
            await new Promise(resolve => setTimeout(resolve, 300));
            updateLoadingProgress(100);

            setTimeout(hideLoading, 300);
        } catch (error) {
            hideLoading();
            showSheet({
                title: '😱 Gagal Muat!',
                description: 'Ada masalah saat memuat data. Coba tarik ke bawah untuk refresh!',
                cancelText: 'Coba lagi',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
        } finally {
            setLoading(false);
        }
    }, [fetchTransactions, fetchBudgets]);

    const loadInstallments = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('installments')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('is_active', true);
                if (!error && data) setInstallments(data as Installment[]);
            }
        } catch (error) {
            console.error('Load installments error:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    useEffect(() => {
        loadData();
    }, [loadData]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Loading Modal */}
            <LoadingModal
                visible={loadingModalVisible}
                message={loadingMessage}
                progress={loadingProgress}
            />

            {/* Toast Modal */}
            <ToastModal
                visible={toastVisible}
                onClose={() => setToastVisible(false)}
                title={toastData.title}
                message={toastData.message}
                icon={toastData.icon}
                iconColor={toastData.iconColor}
                T={T}
            />

            {/* ─── UNIVERSAL GOPAY STYLE BOTTOM SHEET MODAL ─── */}
            <Modal
                visible={sheetConfig.visible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={closeSheet}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: T.modalOverlay,
                    justifyContent: 'flex-end',
                }}>
                    <TouchableWithoutFeedback onPress={closeSheet}>
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
                            onPress={closeSheet}
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
                            {sheetConfig.title}
                        </Text>

                        <Text style={{
                            fontSize: 15,
                            color: isDark ? T.textSub : '#555555',
                            lineHeight: 22,
                            marginBottom: 32,
                        }}>
                            {sheetConfig.description}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 14, width: '100%' }}>
                            <TouchableOpacity
                                onPress={closeSheet}
                                style={{
                                    flex: 1,
                                    backgroundColor: 'transparent',
                                    borderRadius: 100,
                                    paddingVertical: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1.5,
                                    borderColor: sheetConfig.isDestructive ? T.danger : T.accent,
                                }}
                            >
                                <Text style={{ color: sheetConfig.isDestructive ? T.danger : T.accent, fontWeight: '700', fontSize: 16 }}>
                                    {sheetConfig.cancelText}
                                </Text>
                            </TouchableOpacity>

                            {sheetConfig.confirmText !== '' && (
                                <TouchableOpacity
                                    onPress={sheetConfig.onConfirm}
                                    style={{
                                        flex: 1,
                                        backgroundColor: sheetConfig.isDestructive ? T.danger : T.accent,
                                        borderRadius: 100,
                                        paddingVertical: 14,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                                        {sheetConfig.confirmText}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── HEADER ─── */}
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
                marginHorizontal: 0,
            }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ padding: 4 }}
                >
                    <Ionicons name="arrow-back" size={24} color={T.text} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="stats-chart-outline" size={20} color={T.accent} />
                    <Text style={{ fontSize: 17, fontWeight: '700', color: T.text }}>
                        Simulator Keuangan
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={onRefresh}
                    style={{ padding: 4 }}
                >
                    <Ionicons name="refresh-outline" size={22} color={T.textSub} />
                </TouchableOpacity>
            </View>

            {/* ─── CONTENT ─── */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 40 }}
            >
                {loading ? (
                    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={T.accent} />
                        <Text style={{ color: T.textSub, marginTop: 12, fontSize: 14 }}>
                            Loading simulator...
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Info Card */}
                        <View style={{
                            backgroundColor: T.card,
                            borderRadius: 14,
                            padding: 14,
                            marginBottom: 12,
                            borderWidth: 0.5,
                            borderColor: T.border,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                        }}>
                            <View style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: T.accentLight,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Ionicons name="wallet-outline" size={20} color={T.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: T.textSub, fontWeight: '500' }}>
                                    Saldo Saat Ini
                                </Text>
                                <Text style={{ fontSize: 18, fontWeight: '800', color: balance >= 0 ? T.text : T.danger }}>
                                    Rp {balance.toLocaleString('id-ID')}
                                </Text>
                            </View>
                            <View style={{
                                backgroundColor: balance >= 0 ? '#10b98115' : '#ef444415',
                                borderRadius: 20,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                            }}>
                                <Text style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: balance >= 0 ? T.success : T.danger,
                                }}>
                                    {balance >= 0 ? '✅ Sehat' : '⚠️ Defisit'}
                                </Text>
                            </View>
                        </View>

                        {/* Simulator Component */}
                        <SmartBudgetSimulator
                            transactions={transactions}
                            installments={installments}
                            currentBalance={balance}
                        />

                        {/* Footer */}
                        <View style={{
                            marginTop: 20,
                            alignItems: 'center',
                            paddingVertical: 16,
                            borderTopWidth: 0.5,
                            borderTopColor: T.border,
                        }}>
                            <Text style={{ fontSize: 12, color: T.textMuted }}>
                                💡 Simulasi berdasarkan data transaksimu
                            </Text>
                            <Text style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                                {transactions.length} transaksi · {installments.length} cicilan aktif
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}