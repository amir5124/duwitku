// app/(tabs)/profile.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { removeFCMToken } from '../../src/services/fcmService'; // ← TAMBAH
import { supabase } from '../../src/services/supabase/client';
import { useAuthStore } from '../../src/store/authStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { formatCurrency } from '../../src/utils/formatters';

// ── Theme colors ──────────────────────────────────────────────────────────────
const LIGHT = {
    bg: '#f6f7f9',
    card: '#ffffff',
    text: '#1c1c1c',
    textSub: '#4a4a4a',
    textMuted: '#9b9b9b',
    border: '#f0f0f0',
    accent: '#3b6ef5',
    gopayGreen: '#3b6ef5',
    success: '#25a65a',
    danger: '#e53935',
    warning: '#f1c40f',
    shadow: 'rgba(0,0,0,0.04)',
    modalOverlay: 'rgba(0,0,0,0.5)',
    modalBg: '#ffffff',
};

const DARK = {
    bg: '#0b121f',
    card: '#162235',
    text: '#f3f4f6',
    textSub: '#9ca3af',
    textMuted: '#6b7280',
    border: '#24354b',
    accent: '#00bcd4',
    gopayGreen: '#25a65a',
    success: '#25a65a',
    danger: '#ef4444',
    warning: '#f59e0b',
    shadow: 'rgba(0,0,0,0.3)',
    modalOverlay: 'rgba(0,0,0,0.7)',
    modalBg: '#162235',
};

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
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

export default function ProfileScreen() {
    const { isDark, toggleTheme } = useTheme();
    const T = isDark ? DARK : LIGHT;

    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [modalConfig, setModalConfig] = useState<DynamicModalConfig>({
        visible: false,
        title: '',
        description: '',
        cancelText: '',
        confirmText: '',
        isDestructive: false,
        onConfirm: () => { },
    });

    const { totalIncome, totalExpense, balance, reset: resetTransactions } = useTransactionStore();

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        setLoading(true);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', authUser.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching user profile:', error);
                }

                setUser({
                    id: authUser.id,
                    email: authUser.email || '',
                    full_name: userData?.full_name || authUser.user_metadata?.full_name || null,
                    avatar_url: userData?.avatar_url || null,
                    created_at: userData?.created_at || authUser.created_at || new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const showCustomSheet = (config: Omit<DynamicModalConfig, 'visible'>) => {
        setModalConfig({ ...config, visible: true });
    };

    const closeCustomSheet = () => {
        setModalConfig(prev => ({ ...prev, visible: false }));
    };

    // ─── PERBAIKAN: Logout dengan hapus FCM token ─────────────────────────────
    const handleSignOutExecution = async () => {
        closeCustomSheet();
        setActionLoading(true);
        try {
            // ─── STEP 1: Hapus FCM token ─────────────────────────────────────
            console.log('[Profile] Removing FCM token...');
            await removeFCMToken();
            console.log('[Profile] FCM token removed ✅');

            // ─── STEP 2: Logout dari Supabase ──────────────────────────────
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            // ─── STEP 3: Reset state ────────────────────────────────────────
            useAuthStore.getState().reset();
            useTransactionStore.getState().reset();
            await AsyncStorage.removeItem('hasSeenOnboarding');

            // ─── STEP 4: Navigasi ke login ──────────────────────────────────
            router.replace('/(auth)/login');
        } catch (error: any) {
            showCustomSheet({
                title: 'Gagal Keluar',
                description: error.message || 'Terjadi kesalahan sistem saat mencoba keluar.',
                cancelText: 'Mengerti',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeCustomSheet
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetDataExecution = async () => {
        closeCustomSheet();
        setActionLoading(true);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;

            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('user_id', authUser.id);

            if (error) throw error;
            resetTransactions();

            showCustomSheet({
                title: 'Berhasil',
                description: 'Semua data histori transaksi Anda telah dibersihkan.',
                cancelText: 'Tutup',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeCustomSheet
            });
        } catch (error: any) {
            showCustomSheet({
                title: 'Gagal Reset',
                description: error.message || 'Proses pembersihan database gagal dilakukan.',
                cancelText: 'Kembali',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeCustomSheet
            });
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const getInitialName = () => {
        if (user?.full_name) return user.full_name.charAt(0).toUpperCase();
        if (user?.email) return user.email.charAt(0).toUpperCase();
        return 'U';
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={T.accent} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Profile Section */}
                <View style={{ backgroundColor: T.card, padding: 20, alignItems: 'center', marginBottom: 12 }}>
                    <View style={{
                        width: 88,
                        height: 88,
                        borderRadius: 44,
                        backgroundColor: isDark ? '#1a2a55' : '#eef2ff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 14,
                        borderWidth: 2,
                        borderColor: T.accent,
                    }}>
                        {user?.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} style={{ width: 84, height: 84, borderRadius: 42 }} />
                        ) : (
                            <Text style={{ color: T.accent, fontSize: 36, fontWeight: '700' }}>
                                {getInitialName()}
                            </Text>
                        )}
                    </View>

                    <Text style={{ fontSize: 22, fontWeight: '700', color: T.text }}>
                        {user?.full_name || 'Pengguna'}
                    </Text>
                    <Text style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>
                        {user?.email}
                    </Text>

                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 10,
                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20
                    }}>
                        <Ionicons name="calendar-outline" size={14} color={T.textSub} />
                        <Text style={{ color: T.textSub, fontSize: 12, marginLeft: 6, fontWeight: '500' }}>
                            Bergabung {user?.created_at ? formatDate(user.created_at) : '-'}
                        </Text>
                    </View>
                </View>

                {/* Ringkasan Dompet Keuangan */}
                <View style={{
                    marginHorizontal: 16,
                    marginBottom: 20,
                    backgroundColor: T.card,
                    borderRadius: 16,
                    padding: 16,
                    shadowColor: T.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 1,
                    shadowRadius: 4,
                    elevation: 2,
                }}>
                    <Text style={{ color: T.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Total Saldo Kamu
                    </Text>
                    <Text style={{ fontWeight: '800', fontSize: 26, color: balance >= 0 ? T.text : T.danger, marginTop: 4, marginBottom: 16 }}>
                        {formatCurrency(balance)}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <Ionicons name="arrow-down" size={16} color={T.success} />
                            </View>
                            <View>
                                <Text style={{ color: T.textMuted, fontSize: 11 }}>Pemasukan</Text>
                                <Text style={{ color: T.success, fontWeight: '700', fontSize: 14 }}>{formatCurrency(totalIncome)}</Text>
                            </View>
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffebee', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <Ionicons name="arrow-up" size={16} color={T.danger} />
                            </View>
                            <View>
                                <Text style={{ color: T.textMuted, fontSize: 11 }}>Pengeluaran</Text>
                                <Text style={{ color: T.danger, fontWeight: '700', fontSize: 14 }}>{formatCurrency(totalExpense)}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Group Menu 1: Aplikasi */}
                <Text style={{ marginHorizontal: 20, marginBottom: 8, fontSize: 13, fontWeight: '700', color: T.textMuted, textTransform: 'uppercase' }}>
                    Pengaturan Aplikasi
                </Text>
                <View style={{ marginHorizontal: 16, marginBottom: 20, backgroundColor: T.card, borderRadius: 16, overflow: 'hidden' }}>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}
                        activeOpacity={0.7}
                        onPress={toggleTheme}
                    >
                        <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={22} color={T.accent} />
                        <Text style={{ flex: 1, color: T.text, marginLeft: 14, fontSize: 15, fontWeight: '500' }}>
                            {isDark ? 'Mode Gelap' : 'Mode Terang'}
                        </Text>
                        <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: isDark ? T.accent : '#cbd5e1', justifyContent: 'center', paddingHorizontal: 2 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: isDark ? 'flex-end' : 'flex-start' }} />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}
                        activeOpacity={0.7}
                        onPress={() => router.push('/transactions')}
                    >
                        <Ionicons name="receipt-outline" size={22} color={T.accent} />
                        <Text style={{ flex: 1, color: T.text, marginLeft: 14, fontSize: 15, fontWeight: '500' }}>Riwayat Transaksi</Text>
                        <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
                        activeOpacity={0.7}
                        onPress={() => showCustomSheet({
                            title: 'Info Pengembangan',
                            description: 'Fitur Notifikasi saat ini sedang dalam pengerjaan intensif oleh tim pengembang kami.',
                            cancelText: 'Tutup',
                            confirmText: '',
                            isDestructive: false,
                            onConfirm: closeCustomSheet
                        })}
                    >
                        <Ionicons name="notifications-outline" size={22} color={T.accent} />
                        <Text style={{ flex: 1, color: T.text, marginLeft: 14, fontSize: 15, fontWeight: '500' }}>Notifikasi</Text>
                        <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Group Menu 2: Keamanan & Data */}
                <Text style={{ marginHorizontal: 20, marginBottom: 8, fontSize: 13, fontWeight: '700', color: T.textMuted, textTransform: 'uppercase' }}>
                    Keamanan & Data
                </Text>
                <View style={{ marginHorizontal: 16, marginBottom: 20, backgroundColor: T.card, borderRadius: 16, overflow: 'hidden' }}>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}
                        activeOpacity={0.7}
                        onPress={() => showCustomSheet({
                            title: 'Privasi & Keamanan',
                            description: 'Aplikasi menjaga keamanan enkripsi data end-to-end secara berkala untuk kenyamanan finansial Anda.',
                            cancelText: 'Oke, Paham',
                            confirmText: '',
                            isDestructive: false,
                            onConfirm: closeCustomSheet
                        })}
                    >
                        <Ionicons name="shield-checkmark-outline" size={22} color={T.accent} />
                        <Text style={{ flex: 1, color: T.text, marginLeft: 14, fontSize: 15, fontWeight: '500' }}>Privasi & Keamanan</Text>
                        <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}
                        activeOpacity={0.7}
                        onPress={() => showCustomSheet({
                            title: 'Reset Semua Transaksi?',
                            description: 'Yakin ingin menghapus semua data transaksi? Tindakan krusial ini bersifat permanen dan tidak bisa dibatalkan!',
                            cancelText: 'Batal',
                            confirmText: 'Reset',
                            isDestructive: true,
                            onConfirm: handleResetDataExecution
                        })}
                    >
                        <Ionicons name="trash-outline" size={22} color={T.danger} />
                        <Text style={{ flex: 1, color: T.danger, marginLeft: 14, fontSize: 15, fontWeight: '500' }}>Reset Semua Transaksi</Text>
                        <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
                        activeOpacity={0.7}
                        onPress={() => showCustomSheet({
                            title: 'Keluar dari akunmu?',
                            description: 'Nanti ketemu lagi di lain waktu, ya!',
                            cancelText: 'Gak jadi',
                            confirmText: 'Iya, keluar',
                            isDestructive: false,
                            onConfirm: handleSignOutExecution
                        })}
                    >
                        <Ionicons name="log-out-outline" size={22} color={T.danger} />
                        <Text style={{ flex: 1, color: T.danger, marginLeft: 14, fontSize: 15, fontWeight: '600' }}>Keluar dari Akun</Text>
                        <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* About Footer */}
                <View style={{ paddingHorizontal: 32, marginVertical: 24, alignItems: 'center' }}>
                    <Text style={{ color: T.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>Duwitku</Text>
                    <Text style={{ color: T.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                        Asisten keuangan pribadimu.
                    </Text>
                    <Text style={{ color: T.textMuted, fontSize: 11, marginTop: 12, fontWeight: '600' }}>Versi 1.1.0</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Indicator Loading Global */}
            {actionLoading && (
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            )}

            {/* ─── UNIVERSAL GOPAY STYLE BOTTOM SHEET MODAL ─── */}
            <Modal
                visible={modalConfig.visible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={closeCustomSheet}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: T.modalOverlay,
                    justifyContent: 'flex-end',
                }}>
                    <TouchableWithoutFeedback onPress={closeCustomSheet}>
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
                            onPress={closeCustomSheet}
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
                            {modalConfig.title}
                        </Text>

                        <Text style={{
                            fontSize: 15,
                            color: isDark ? T.textSub : '#555555',
                            lineHeight: 22,
                            marginBottom: 32,
                        }}>
                            {modalConfig.description}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 14, width: '100%' }}>
                            <TouchableOpacity
                                onPress={closeCustomSheet}
                                style={{
                                    flex: 1,
                                    backgroundColor: 'transparent',
                                    borderRadius: 100,
                                    paddingVertical: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1.5,
                                    borderColor: modalConfig.isDestructive ? T.danger : T.gopayGreen,
                                }}
                            >
                                <Text style={{ color: modalConfig.isDestructive ? T.danger : T.gopayGreen, fontWeight: '700', fontSize: 16 }}>
                                    {modalConfig.cancelText}
                                </Text>
                            </TouchableOpacity>

                            {modalConfig.confirmText !== '' && (
                                <TouchableOpacity
                                    onPress={modalConfig.onConfirm}
                                    style={{
                                        flex: 1,
                                        backgroundColor: modalConfig.isDestructive ? T.danger : T.gopayGreen,
                                        borderRadius: 100,
                                        paddingVertical: 14,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                                        {modalConfig.confirmText}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}