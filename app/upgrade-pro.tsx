// app/settings/upgrade-pro.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    ImageBackground,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/contexts/ThemeContext';
import {
    checkPaymentStatus,
    checkProStatus,
    createPaymentOrder,
} from '../src/services/featureLimits';

const { width, height } = Dimensions.get('window');

// ── Theme ─────────────────────────────────────────────────────────────────────
const LIGHT = {
    bg: '#f8fafc',
    card: '#ffffff',
    border: '#e5e7eb',
    text: '#111827',
    textSub: '#374151',
    textMuted: '#9ca3af',
    accent: '#3b6ef5',
    accentBg: '#eef2ff',
    accentBorder: '#e0e7ff',
    success: '#10b981',
    successBg: '#d1fae5',
    warning: '#f59e0b',
    danger: '#ef4444',
    overlay: 'rgba(0,0,0,0.5)',
    shimmer: '#f3f4f6',
    modalOverlay: 'rgba(0,0,0,0.5)',
    modalBg: '#ffffff',
};

const DARK = {
    bg: '#080f24',
    card: '#0f1a3d',
    border: '#1a2a55',
    text: '#f0f4ff',
    textSub: '#c3cee6',
    textMuted: '#5a6b94',
    accent: '#818cf8',
    accentBg: '#1a2150',
    accentBorder: '#2a3470',
    success: '#34d399',
    successBg: '#10362b',
    warning: '#fbbf24',
    danger: '#ef4444',
    overlay: 'rgba(0,0,0,0.75)',
    shimmer: '#1a2a55',
    modalOverlay: 'rgba(0,0,0,0.7)',
    modalBg: '#0f1a3d',
};

// ─── Interface Modal ──────────────────────────────────────────────────────────
interface DynamicModalConfig {
    visible: boolean;
    title: string;
    description: string;
    cancelText: string;
    confirmText: string;
    isDestructive: boolean;
    onConfirm: () => void;
}

// ─── Data Bank ────────────────────────────────────────────────────────────────
const BANKS = [
    { code: '002', name: 'BRI', icon: '🏦', color: '#004d7c' },
    { code: '008', name: 'Mandiri', icon: '🏦', color: '#003d5c' },
    { code: '009', name: 'BNI', icon: '🏦', color: '#004d7c' },
    { code: '014', name: 'BCA', icon: '🏦', color: '#004e8c' },
    { code: '013', name: 'Permata', icon: '🏦', color: '#800000' },
    { code: '022', name: 'CIMB Niaga', icon: '🏦', color: '#0e1f3d' },
    { code: '200', name: 'BTN', icon: '🏦', color: '#003d7a' },
    { code: '441', name: 'Danamon', icon: '🏦', color: '#003366' },
    { code: '016', name: 'Maybank', icon: '🏦', color: '#d40000' },
    { code: '451', name: 'BSI', icon: '🏦', color: '#006633' },
];

// ─── Bottom Sheet Modal Gaya GoPay ───────────────────────────────────────────
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
                backgroundColor: T.modalBg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                paddingHorizontal: 24, paddingTop: 32, paddingBottom: 50,
                transform: [{ translateY: slideAnim }],
                shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
            }}>
                <TouchableOpacity
                    onPress={onClose}
                    style={{
                        position: 'absolute', right: 24, top: -64,
                        backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22,
                        alignItems: 'center', justifyContent: 'center',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.18, shadowRadius: 4, elevation: 5,
                    }}
                >
                    <Ionicons name="close" size={24} color="#1c1c1c" />
                </TouchableOpacity>

                <Text style={{ fontSize: 22, fontWeight: '700', color: T.text, marginBottom: 10 }}>
                    {config.title}
                </Text>
                <Text style={{
                    fontSize: 15, color: isDark ? T.textSub : '#555555',
                    lineHeight: 22, marginBottom: 32,
                }}>
                    {config.description}
                </Text>

                <View style={{ flexDirection: 'row', gap: 14, width: '100%' }}>
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

// ─── Modal Pilih Metode Pembayaran ──────────────────────────────────────────
function PaymentMethodModal({ visible, onClose, onSelectMethod, isDark }: {
    visible: boolean;
    onClose: () => void;
    onSelectMethod: (method: 'VA' | 'QRIS') => void;
    isDark: boolean;
}) {
    const T = isDark ? DARK : LIGHT;
    const slideAnim = useRef(new Animated.Value(400)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        if (visible) {
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
    }, [visible]);

    if (!isMounted) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Animated.View style={{ flex: 1, backgroundColor: T.modalOverlay, opacity: fadeAnim }}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            <Animated.View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: T.modalBg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40,
                transform: [{ translateY: slideAnim }],
                shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
            }}>
                <View style={{ alignItems: 'center', paddingBottom: 16 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.border }} />
                </View>

                <Text style={{ fontSize: 20, fontWeight: '700', color: T.text, textAlign: 'center', marginBottom: 4 }}>
                    💳 Pilih Metode Pembayaran
                </Text>
                <Text style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', marginBottom: 24 }}>
                    Pilih metode pembayaran yang paling nyaman untukmu
                </Text>

                {/* Virtual Account */}
                <TouchableOpacity
                    onPress={() => { onSelectMethod('VA'); onClose(); }}
                    activeOpacity={0.85}
                    style={{
                        backgroundColor: T.accentBg, borderRadius: 16, padding: 18, marginBottom: 12,
                        flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.accentBorder,
                    }}
                >
                    <View style={{
                        width: 48, height: 48, borderRadius: 14,
                        backgroundColor: T.accent + '20', alignItems: 'center', justifyContent: 'center', marginRight: 14,
                    }}>
                        <Ionicons name="card-outline" size={24} color={T.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: T.text }}>Virtual Account</Text>
                        <Text style={{ fontSize: 13, color: T.textMuted }}>Transfer via ATM / m-Banking</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
                </TouchableOpacity>

                {/* QRIS */}
                <TouchableOpacity
                    onPress={() => { onSelectMethod('QRIS'); onClose(); }}
                    activeOpacity={0.85}
                    style={{
                        backgroundColor: T.accentBg, borderRadius: 16, padding: 18, marginBottom: 12,
                        flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.accentBorder,
                    }}
                >
                    <View style={{
                        width: 48, height: 48, borderRadius: 14,
                        backgroundColor: '#10b981' + '20', alignItems: 'center', justifyContent: 'center', marginRight: 14,
                    }}>
                        <Ionicons name="scan-outline" size={24} color="#10b981" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: T.text }}>QRIS</Text>
                        <Text style={{ fontSize: 13, color: T.textMuted }}>Scan dengan GoPay, OVO, DANA, dll</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity onPress={onClose} style={{ marginTop: 8, paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: T.textMuted, fontSize: 14 }}>Nanti saja</Text>
                </TouchableOpacity>
            </Animated.View>
        </Modal>
    );
}

// ─── Modal Pilih Bank (Virtual Account) ─────────────────────────────────────
function BankSelectionModal({ visible, onClose, onSelectBank, isDark }: {
    visible: boolean;
    onClose: () => void;
    onSelectBank: (bankCode: string) => void;
    isDark: boolean;
}) {
    const T = isDark ? DARK : LIGHT;
    const slideAnim = useRef(new Animated.Value(600)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [isMounted, setIsMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }),
            ]).start(() => setIsMounted(false));
        }
    }, [visible]);

    const filteredBanks = BANKS.filter(bank =>
        bank.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isMounted) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Animated.View style={{ flex: 1, backgroundColor: T.modalOverlay, opacity: fadeAnim }}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            <Animated.View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: T.modalBg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40,
                maxHeight: height * 0.8,
                transform: [{ translateY: slideAnim }],
                shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
            }}>
                <View style={{ alignItems: 'center', paddingBottom: 12 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.border }} />
                </View>

                <Text style={{ fontSize: 20, fontWeight: '700', color: T.text, textAlign: 'center', marginBottom: 4 }}>
                    🏦 Pilih Bank
                </Text>
                <Text style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', marginBottom: 16 }}>
                    Pilih bank untuk Virtual Account
                </Text>

                {/* Search Bar */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: T.shimmer, borderRadius: 12,
                    paddingHorizontal: 14, marginBottom: 14,
                    borderWidth: 1, borderColor: T.border,
                }}>
                    <Ionicons name="search-outline" size={18} color={T.textMuted} />
                    <TextInput
                        style={{
                            flex: 1, paddingVertical: 10, paddingHorizontal: 8,
                            color: T.text, fontSize: 14,
                        }}
                        placeholder="Cari bank..."
                        placeholderTextColor={T.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={T.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.5 }}>
                    {filteredBanks.map((bank) => (
                        <TouchableOpacity
                            key={bank.code}
                            onPress={() => { onSelectBank(bank.code); onClose(); }}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: 'row', alignItems: 'center',
                                paddingVertical: 14, paddingHorizontal: 4,
                                borderBottomWidth: 1, borderBottomColor: T.border,
                            }}
                        >
                            <View style={{
                                width: 40, height: 40, borderRadius: 20,
                                backgroundColor: bank.color + '20',
                                alignItems: 'center', justifyContent: 'center',
                                marginRight: 14,
                            }}>
                                <Text style={{ fontSize: 20 }}>{bank.icon}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: T.text }}>
                                    {bank.name}
                                </Text>
                                <Text style={{ fontSize: 12, color: T.textMuted }}>
                                    Kode: {bank.code}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
                        </TouchableOpacity>
                    ))}
                    {filteredBanks.length === 0 && (
                        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                            <Text style={{ color: T.textMuted }}>Bank tidak ditemukan</Text>
                        </View>
                    )}
                </ScrollView>
            </Animated.View>
        </Modal>
    );
}

// ─── Payment Bottom Sheet ────────────────────────────────────────────────────
function PaymentBottomSheet({ visible, onClose, paymentData, onCheckStatus, isDark }: {
    visible: boolean;
    onClose: () => void;
    paymentData: any;
    onCheckStatus: () => Promise<void>;
    isDark: boolean;
}) {
    const T = isDark ? DARK : LIGHT;
    const insets = useSafeAreaInsets();
    const [checking, setChecking] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const slideAnim = useRef(new Animated.Value(600)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }),
            ]).start(() => setIsMounted(false));
        }
    }, [visible]);

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `💎 Duwitku Pro\nTotal: Rp${paymentData?.amount?.toLocaleString('id-ID')}\nVA: ${paymentData?.va_number || '-'}\n\nBayar sebelum kadaluarsa!`,
            });
        } catch (e) { }
    };

    const handleCheckStatus = async () => {
        setChecking(true);
        await onCheckStatus();
        setChecking(false);
    };

    if (!isMounted) return null;

    const plan = paymentData?.plan === 'monthly' ? 'Bulanan' : 'Tahunan';
    const isQRIS = paymentData?.payment_method === 'QRIS';
    const bankName = BANKS.find(b => b.code === paymentData?.bankCode)?.name || 'BNI';

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Animated.View style={{ flex: 1, backgroundColor: T.modalOverlay, opacity: fadeAnim }}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            <Animated.View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: T.modalBg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                paddingBottom: insets.bottom + 16,
                transform: [{ translateY: slideAnim }],
                shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
            }}>
                {/* Handle */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.border }} />
                </View>

                {/* Header */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.border,
                }}>
                    <View>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: T.text }}>
                            {isQRIS ? '📱 Scan QRIS' : '💳 Virtual Account'}
                        </Text>
                        <Text style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                            {plan} · {paymentData?.amount?.toLocaleString('id-ID')}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: T.shimmer, alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <Ionicons name="close" size={18} color={T.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Total Amount */}
                <View style={{
                    marginHorizontal: 20, marginTop: 16,
                    backgroundColor: T.accentBg, borderRadius: 16, padding: 16,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <View>
                        <Text style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Total Pembayaran</Text>
                        <Text style={{ fontSize: 26, fontWeight: '800', color: T.accent }}>
                            Rp{paymentData?.amount?.toLocaleString('id-ID') || '0'}
                        </Text>
                    </View>
                    <View style={{ backgroundColor: T.accent + '20', borderRadius: 12, padding: 10 }}>
                        <Ionicons name="diamond" size={28} color={T.accent} />
                    </View>
                </View>

                {/* QRIS Content */}
                {isQRIS && paymentData?.qris_url && (
                    <View style={{ marginHorizontal: 20, marginTop: 16, alignItems: 'center' }}>
                        <View style={{
                            backgroundColor: '#ffffff', borderRadius: 20, padding: 16,
                            borderWidth: 1, borderColor: T.border,
                        }}>
                            <Image source={{ uri: paymentData.qris_url }} style={{ width: 200, height: 200 }} resizeMode="contain" />
                        </View>
                        <Text style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 18 }}>
                            📱 Scan dengan aplikasi apapun yang mendukung QRIS{'\n'}
                            (GoPay, OVO, DANA, ShopeePay, m-Banking, dll)
                        </Text>
                        <TouchableOpacity
                            onPress={handleShare}
                            style={{
                                marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
                                backgroundColor: T.accentBg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
                            }}
                        >
                            <Ionicons name="share-outline" size={16} color={T.accent} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: T.accent }}>📤 Bagikan QRIS</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* VA Content - Font Size Diperkecil */}
                {!isQRIS && paymentData?.va_number && (
                    <View style={{ marginHorizontal: 20, marginTop: 16 }}>
                        <Text style={{ fontSize: 12, color: T.textMuted, marginBottom: 8, fontWeight: '500' }}>
                            🏦 Transfer ke Virtual Account {bankName}
                        </Text>

                        {/* VA Number - Smaller Font */}
                        <View style={{
                            backgroundColor: T.bg, borderRadius: 16, padding: 16,
                            borderWidth: 1.5, borderColor: T.accent, alignItems: 'center', marginBottom: 12,
                        }}>
                            <Text style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>
                                Nomor Virtual Account
                            </Text>
                            <Text style={{
                                fontSize: 20, fontWeight: '800', color: T.accent,
                                letterSpacing: 2, textAlign: 'center',
                            }}>
                                {paymentData.va_number}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                <TouchableOpacity
                                    onPress={() => handleCopy(paymentData.va_number)}
                                    style={{
                                        backgroundColor: copied ? T.successBg : T.accentBg,
                                        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
                                        flexDirection: 'row', alignItems: 'center', gap: 4,
                                    }}
                                >
                                    <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? T.success : T.accent} />
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: copied ? T.success : T.accent }}>
                                        {copied ? 'Tersalin!' : 'Salin'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Instruksi */}
                        <View style={{ marginTop: 4 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: T.textSub, marginBottom: 6 }}>
                                📋 Cara Bayar:
                            </Text>
                            {[
                                'Buka aplikasi m-banking atau ATM',
                                'Pilih Transfer → Virtual Account',
                                'Masukkan nomor VA di atas',
                                'Masukkan nominal sesuai total',
                                'Konfirmasi dan selesaikan pembayaran',
                                'Klik "Cek Status" setelah transfer',
                            ].map((step, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <View style={{
                                        width: 18, height: 18, borderRadius: 9,
                                        backgroundColor: T.accentBg, alignItems: 'center', justifyContent: 'center',
                                        marginRight: 8, marginTop: 1, flexShrink: 0,
                                    }}>
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: T.accent }}>{i + 1}</Text>
                                    </View>
                                    <Text style={{ fontSize: 12, color: T.textSub, flex: 1, lineHeight: 18 }}>
                                        {step}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Expiry warning */}
                <View style={{ marginHorizontal: 20, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={14} color={T.warning} />
                    <Text style={{ fontSize: 11, color: T.warning }}>⏳ Berlaku 2 jam sejak order dibuat</Text>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 14 }}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{ flex: 1, backgroundColor: T.shimmer, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                    >
                        <Text style={{ color: T.textSub, fontWeight: '600' }}>Tutup</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleCheckStatus}
                        disabled={checking}
                        style={{
                            flex: 2, backgroundColor: T.accent, borderRadius: 14, paddingVertical: 14,
                            alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                            shadowColor: T.accent, shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
                        }}
                    >
                        {checking ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="refresh-outline" size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Cek Status</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </Modal>
    );
}

// ─── Plans ─────────────────────────────────────────────────────────────────────
const PLANS = [
    {
        id: 'monthly', name: 'Bulanan', price: 49000, priceDisplay: 'Rp49.000',
        perMonth: 'Rp49.000/bulan', period: '/bulan', savings: null, popular: false,
    },
    {
        id: 'yearly', name: 'Tahunan', price: 399000, priceDisplay: 'Rp399.000',
        perMonth: 'Rp33.250/bulan', period: '/tahun', savings: '-40%', popular: true,
        originalPrice: 'Rp588.000',
    },
];

const BENEFITS = [
    { icon: 'chatbubble-ellipses-outline', text: 'KalKu AI tanpa batas — catat & tanya soal keuangan' },
    { icon: 'scan-outline', text: 'Scan struk pembelanjaan tanpa batas' },
    { icon: 'mic-outline', text: 'Catat transaksi dengan suara tanpa batas' },
    { icon: 'bar-chart-outline', text: 'Analitik & proyeksi keuangan lanjutan' },
    { icon: 'cloud-upload-outline', text: 'Backup otomatis & export data' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function UpgradeProScreen() {
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;
    const insets = useSafeAreaInsets();
    const [selectedPlan, setSelectedPlan] = useState('yearly');
    const [loading, setLoading] = useState(false);
    const [isPro, setIsPro] = useState(false);
    const [proExpiresAt, setProExpiresAt] = useState<string | null>(null);
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
    const [paymentMethodModalVisible, setPaymentMethodModalVisible] = useState(false);
    const [bankModalVisible, setBankModalVisible] = useState(false);
    const [selectedBank, setSelectedBank] = useState('014');

    // ─── Modal State ──────────────────────────────────────────────────────────
    const [sheetConfig, setSheetConfig] = useState<DynamicModalConfig>({
        visible: false, title: '', description: '', cancelText: '', confirmText: '', isDestructive: false, onConfirm: () => { },
    });

    const showSheet = (config: Omit<DynamicModalConfig, 'visible'>) => {
        setSheetConfig({ ...config, visible: true });
    };
    const closeSheet = () => setSheetConfig(prev => ({ ...prev, visible: false }));

    const loadProStatus = async () => {
        try {
            const status = await checkProStatus();
            setIsPro(status.is_pro);
            setProExpiresAt(status.pro_expires_at);
            setDaysRemaining(status.days_remaining);
        } catch (e) { console.error('Load pro status error:', e); }
    };

    useEffect(() => { loadProStatus(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadProStatus();
        setRefreshing(false);
    };

    // ─── Handle Payment Flow ──────────────────────────────────────────────────
    const handleSelectPaymentMethod = (method: 'VA' | 'QRIS') => {
        if (method === 'VA') {
            // Tampilkan modal pilih bank
            setBankModalVisible(true);
        } else {
            // QRIS langsung
            handleCreatePayment('QRIS', '');
        }
    };

    const handleSelectBank = (bankCode: string) => {
        setSelectedBank(bankCode);
        handleCreatePayment('VA', bankCode);
    };

    const handleCreatePayment = async (method: 'VA' | 'QRIS', bankCode: string) => {
        setLoading(true);
        try {
            const result = await createPaymentOrder(
                selectedPlan as 'monthly' | 'yearly',
                method,
                bankCode
            );
            if (!result.success || !result.order_id) {
                showSheet({
                    title: '😱 Gagal!',
                    description: result.error || 'Terjadi kesalahan saat membuat pembayaran',
                    cancelText: 'Coba lagi', confirmText: '', isDestructive: false, onConfirm: closeSheet,
                });
                return;
            }
            setCurrentOrderId(result.order_id);
            setPaymentData({ ...result, plan: selectedPlan, payment_method: method, bankCode });
            setPaymentModalVisible(true);
        } catch (e: any) {
            showSheet({
                title: '😱 Gagal!',
                description: e.message || 'Terjadi kesalahan',
                cancelText: 'Coba lagi', confirmText: '', isDestructive: false, onConfirm: closeSheet,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async () => {
        setPaymentMethodModalVisible(true);
    };

    const handleCheckStatus = async () => {
        if (!currentOrderId) return;
        try {
            const status = await checkPaymentStatus(currentOrderId);
            if (status.payment_status === 'SUCCESS' || status.is_pro) {
                setPaymentModalVisible(false);
                showSheet({
                    title: '🎉 Berhasil!',
                    description: 'Selamat! Kamu sekarang pengguna Pro! 🚀\nNikmati semua fitur premium tanpa batas!',
                    cancelText: 'Kembali', confirmText: '', isDestructive: false,
                    onConfirm: () => { closeSheet(); loadProStatus(); router.back(); },
                });
            } else if (status.payment_status === 'EXPIRED') {
                showSheet({
                    title: '⏳ Kadaluarsa',
                    description: 'Waktu pembayaran telah habis. Silakan coba lagi.',
                    cancelText: 'Oke', confirmText: '', isDestructive: false,
                    onConfirm: () => { closeSheet(); setPaymentModalVisible(false); },
                });
            } else {
                showSheet({
                    title: '⏳ Menunggu',
                    description: 'Pembayaran masih diproses.\nTunggu beberapa saat dan cek lagi ya!',
                    cancelText: 'Oke', confirmText: '', isDestructive: false, onConfirm: closeSheet,
                });
            }
        } catch (e: any) {
            showSheet({
                title: '😱 Error!',
                description: e.message || 'Gagal cek status pembayaran',
                cancelText: 'Oke', confirmText: '', isDestructive: false, onConfirm: closeSheet,
            });
        }
    };

    // ── Already Pro ───────────────────────────────────────────────────────────
    if (isPro) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
                <View style={{
                    paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center',
                    borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.card,
                }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                        <Ionicons name="arrow-back" size={24} color={T.textSub} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: T.text }}>Duwitku Pro</Text>
                </View>
                <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
                    contentContainerStyle={{ padding: 20, alignItems: 'center', paddingBottom: 40 }}>
                    <View style={{
                        width: 100, height: 100, borderRadius: 50, backgroundColor: T.successBg,
                        alignItems: 'center', justifyContent: 'center', marginBottom: 16, marginTop: 20,
                    }}>
                        <Ionicons name="diamond" size={52} color={T.success} />
                    </View>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: T.text, marginBottom: 8 }}>🎉 Kamu Pengguna Pro!</Text>
                    <Text style={{ fontSize: 14, color: T.textSub, textAlign: 'center', marginBottom: 12 }}>
                        Nikmati semua fitur premium tanpa batas
                    </Text>
                    {daysRemaining !== null && (
                        <View style={{
                            backgroundColor: daysRemaining > 7 ? T.successBg : '#fef3c7',
                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 8,
                        }}>
                            <Text style={{ color: daysRemaining > 7 ? T.success : T.warning, fontWeight: '600', fontSize: 14 }}>
                                {daysRemaining > 0 ? `⏳ ${daysRemaining} hari tersisa` : '⚠️ Segera perpanjang!'}
                            </Text>
                        </View>
                    )}
                    {proExpiresAt && (
                        <Text style={{ fontSize: 12, color: T.textMuted, marginBottom: 24 }}>
                            Berakhir: {new Date(proExpiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                    )}
                    <TouchableOpacity onPress={() => router.back()} style={{
                        backgroundColor: T.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14,
                    }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Kembali</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ─── Main Upgrade Page ─────────────────────────────────────────────────────
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            {/* Modals */}
            <BottomSheetModal config={sheetConfig} onClose={closeSheet} isDark={isDark} />
            <PaymentMethodModal
                visible={paymentMethodModalVisible}
                onClose={() => setPaymentMethodModalVisible(false)}
                onSelectMethod={handleSelectPaymentMethod}
                isDark={isDark}
            />
            <BankSelectionModal
                visible={bankModalVisible}
                onClose={() => setBankModalVisible(false)}
                onSelectBank={handleSelectBank}
                isDark={isDark}
            />

            {/* Header */}
            <View style={{
                paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center',
                borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.card,
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                    <Ionicons name="arrow-back" size={24} color={T.textSub} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: '700', color: T.text }}>Upgrade ke Pro</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Hero with Full Screen Background */}
                <ImageBackground
                    source={require('../assets/images/profix.png')}
                    style={{
                        width: width - 40,
                        height: 220,
                        marginHorizontal: 20,
                        marginTop: 20,
                        borderRadius: 24,
                        overflow: 'hidden',
                        justifyContent: 'flex-end',
                    }}
                    resizeMode="cover"
                    imageStyle={{ borderRadius: 24 }}
                >
                    {/* Overlay gelap di atas gambar */}
                    <View style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: 'rgba(10, 31, 110, 0.75)',
                        borderRadius: 24,
                    }} />

                    {/* Konten di atas background */}
                    <View style={{
                        padding: 24,
                        position: 'relative',
                    }}>
                        <Text style={{
                            fontSize: 22, fontWeight: '800', color: '#ffffff',
                            lineHeight: 28, marginBottom: 6,
                        }}>
                            Atur keuangan{'\n'}jadi makin mudah!
                        </Text>
                        <Text style={{
                            fontSize: 13, color: 'rgba(255,255,255,0.8)',
                            lineHeight: 18, marginBottom: 12,
                        }}>
                            Nikmati akses fitur premium tanpa batas bersama KalKu AI
                        </Text>

                        {/* Steps */}
                        <View style={{
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            borderRadius: 16, padding: 12,
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
                        }}>
                            {[
                                { icon: 'list-outline', label: 'Pilih paket' },
                                { icon: 'card-outline', label: 'Bayar dalam app' },
                                { icon: 'checkmark-circle-outline', label: 'Mulai gunakan' },
                            ].map((step, i) => (
                                <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                                    <Ionicons name={step.icon as any} size={20} color="#ffffff" />
                                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10, marginTop: 4, textAlign: 'center' }}>
                                        {step.label}
                                    </Text>
                                    {i < 2 && (
                                        <View style={{
                                            position: 'absolute', right: 0, top: 10,
                                            width: 1, height: 16,
                                            backgroundColor: 'rgba(255,255,255,0.2)',
                                        }} />
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>
                </ImageBackground>

                {/* Benefits */}
                <View style={{
                    marginHorizontal: 20, marginTop: 20,
                    backgroundColor: T.card, borderRadius: 20,
                    padding: 20, borderWidth: 1, borderColor: T.border,
                }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 16 }}>🚀 Yang Kamu Dapatkan</Text>
                    {BENEFITS.map((benefit, i) => (
                        <View key={i} style={{
                            flexDirection: 'row', alignItems: 'center',
                            paddingVertical: 10,
                            borderBottomWidth: i < BENEFITS.length - 1 ? 1 : 0,
                            borderBottomColor: T.border,
                        }}>
                            <View style={{
                                width: 36, height: 36, borderRadius: 18,
                                backgroundColor: T.accentBg, alignItems: 'center', justifyContent: 'center', marginRight: 12,
                            }}>
                                <Ionicons name={benefit.icon as any} size={18} color={T.accent} />
                            </View>
                            <Text style={{ flex: 1, color: T.text, fontSize: 14, lineHeight: 20 }}>{benefit.text}</Text>
                            <Ionicons name="checkmark-circle" size={20} color={T.success} />
                        </View>
                    ))}
                </View>

                {/* Paket */}
                <View style={{ marginHorizontal: 20, marginTop: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 12 }}>💎 Pilih Paket</Text>

                    {PLANS.map(plan => {
                        const isSelected = selectedPlan === plan.id;
                        return (
                            <TouchableOpacity key={plan.id} onPress={() => setSelectedPlan(plan.id)} activeOpacity={0.85}
                                style={{
                                    backgroundColor: isSelected ? T.accentBg : T.card, borderRadius: 18,
                                    padding: 18, marginBottom: 12,
                                    borderWidth: 2, borderColor: isSelected ? T.accent : T.border,
                                    position: 'relative', overflow: 'visible',
                                }}
                            >
                                {plan.popular && (
                                    <View style={{
                                        position: 'absolute', top: -12, left: 16,
                                        backgroundColor: T.warning, paddingHorizontal: 12, paddingVertical: 4,
                                        borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4,
                                    }}>
                                        <Ionicons name="star" size={10} color="#fff" />
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>PALING HEMAT</Text>
                                    </View>
                                )}

                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{
                                        width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                                        borderColor: isSelected ? T.accent : T.border,
                                        alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                    }}>
                                        {isSelected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: T.accent }} />}
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: T.text }}>{plan.name}</Text>
                                            {plan.savings && (
                                                <View style={{ backgroundColor: T.danger, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{plan.savings}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{plan.perMonth}</Text>
                                    </View>

                                    <View style={{ alignItems: 'flex-end' }}>
                                        {plan.originalPrice && (
                                            <Text style={{ fontSize: 12, color: T.textMuted, textDecorationLine: 'line-through' }}>
                                                {plan.originalPrice}
                                            </Text>
                                        )}
                                        <Text style={{ fontSize: 20, fontWeight: '800', color: isSelected ? T.accent : T.text }}>
                                            {plan.priceDisplay}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: T.textMuted }}>{plan.period}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Trust badges */}
                <View style={{
                    marginHorizontal: 20, marginTop: 4,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={T.success} />
                    <Text style={{ fontSize: 12, color: T.textMuted }}>🔒 Pembayaran aman · Batalkan kapan saja</Text>
                </View>

                {/* CTA */}
                <View style={{ marginHorizontal: 20, marginTop: 20 }}>
                    <TouchableOpacity
                        onPress={handleUpgrade}
                        disabled={loading}
                        activeOpacity={0.85}
                        style={{
                            backgroundColor: T.accent, paddingVertical: 18, borderRadius: 16,
                            alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                            shadowColor: T.accent, shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
                        }}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="rocket-outline" size={20} color="#ffffff" />
                                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>Pilih Metode Bayar</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <Text style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', marginTop: 10 }}>
                        Dengan melanjutkan, kamu menyetujui Syarat & Ketentuan Duwitku
                    </Text>
                </View>
            </ScrollView>

            {/* Payment Bottom Sheet */}
            <PaymentBottomSheet
                visible={paymentModalVisible}
                onClose={() => setPaymentModalVisible(false)}
                paymentData={paymentData}
                onCheckStatus={handleCheckStatus}
                isDark={isDark}
            />
        </SafeAreaView>
    );
}