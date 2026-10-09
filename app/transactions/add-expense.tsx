// app/transactions/add-expense.tsx
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraType, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UpgradeProModal from '../../src/components/UpgradeProModal';
import { useTheme } from '../../src/contexts/ThemeContext';
import { supabase } from '../../src/services/supabase/client';
import { useTransactionStore } from '../../src/store/transactionStore';
import { useUsageStore } from '../../src/store/usageStore';
import { TransactionCategory } from '../../src/types';

const { width, height } = Dimensions.get('window');

// ── Theme colors ──────────────────────────────────────────────────────────────
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
    accentText: '#3b6ef5',
    accentTextStrong: '#3730a3',
    inputBg: '#ffffff',
    overlay: 'rgba(0,0,0,0.5)',
    overlayCard: '#ffffff',
    dropdownBg: '#ffffff',
    dropdownSelectedBg: '#eef2ff',
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
    accentText: '#a5b4fc',
    accentTextStrong: '#c7d2fe',
    inputBg: '#0f1a3d',
    overlay: 'rgba(0,0,0,0.7)',
    overlayCard: '#0f1a3d',
    dropdownBg: '#0f1a3d',
    dropdownSelectedBg: '#1a2150',
    modalOverlay: 'rgba(0,0,0,0.7)',
    modalBg: '#162235',
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

// ─── Format Helper ────────────────────────────────────────────────────────────
const formatNumber = (num: string): string => {
    const clean = num.replace(/[^\d]/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseFormattedNumber = (formatted: string): number => {
    const clean = formatted.replace(/\./g, '');
    return parseInt(clean, 10) || 0;
};

const formatNumberDisplay = (num: number): string => {
    if (num === 0) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// ─── Kategori ──────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES: { label: string; value: TransactionCategory; icon: string; iconColor: string }[] = [
    { label: '🍔 Makanan & Minuman', value: 'MAKANAN', icon: 'restaurant-outline', iconColor: '#f97316' },
    { label: '🚗 Transportasi', value: 'TRANSPORTASI', icon: 'car-outline', iconColor: '#3b82f6' },
    { label: '🛍️ Belanja', value: 'BELANJA', icon: 'cart-outline', iconColor: '#8b5cf6' },
    { label: '📄 Tagihan (Listrik/Air/Internet)', value: 'TAGIHAN', icon: 'document-text-outline', iconColor: '#ef4444' },
    { label: '📱 Kuota / Pulsa', value: 'KUOTA', icon: 'wifi-outline', iconColor: '#06b6d4' },
    { label: '🏠 Kos / Sewa', value: 'KOS', icon: 'home-outline', iconColor: '#14b8a6' },
    { label: '💊 Kesehatan / Obat', value: 'KESEHATAN', icon: 'medkit-outline', iconColor: '#10b981' },
    { label: '📚 Pendidikan', value: 'PENDIDIKAN', icon: 'school-outline', iconColor: '#6366f1' },
    { label: '🎬 Hiburan', value: 'HIBURAN', icon: 'tv-outline', iconColor: '#ec4899' },
    { label: '💰 Tabungan', value: 'TABUNGAN', icon: 'wallet-outline', iconColor: '#f59e0b' },
    { label: '💸 Bayar Hutang', value: 'HUTANG', icon: 'cash-outline', iconColor: '#ef4444' },
    { label: '🤲 Zakat / Sedekah', value: 'ZAKAT', icon: 'heart-outline', iconColor: '#10b981' },
    { label: '📦 Lainnya', value: 'LAINNYA', icon: 'ellipsis-horizontal-outline', iconColor: '#6b7280' },
];

// ─── Loading Overlay dengan Progress Bar ─────────────────────────────────────
function LoadingOverlay({ visible, text = 'Menyimpan transaksi...', progress = 0, T }: {
    visible: boolean;
    text?: string;
    progress?: number;
    T: typeof LIGHT;
}) {
    const spinValue = useRef(new Animated.Value(0)).current;
    const [progressAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (visible) {
            Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                })
            ).start();

            Animated.timing(progressAnim, {
                toValue: progress,
                duration: 300,
                useNativeDriver: false,
            }).start();
        } else {
            spinValue.setValue(0);
            progressAnim.setValue(0);
        }
    }, [visible, progress]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

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
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Ionicons name="refresh-outline" size={48} color={T.accent} />
                    </Animated.View>

                    <Text style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: T.text,
                        marginTop: 16,
                        textAlign: 'center',
                    }}>
                        {text}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: T.textMuted,
                        marginTop: 4,
                        textAlign: 'center',
                    }}>
                        Mohon tunggu sebentar...
                    </Text>

                    <View style={{
                        width: '100%',
                        height: 6,
                        backgroundColor: T.border,
                        borderRadius: 3,
                        overflow: 'hidden',
                        marginTop: 16,
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
                                borderColor: config.isDestructive ? '#ef4444' : T.accent,
                            }}
                        >
                            <Text style={{
                                color: config.isDestructive ? '#ef4444' : T.accent,
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
                                    backgroundColor: config.isDestructive ? '#ef4444' : T.accent,
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

// ─── Category Select ──────────────────────────────────────────────────────────
const CategorySelect = ({
    value,
    onSelect,
    T,
}: {
    value: TransactionCategory;
    onSelect: (val: TransactionCategory) => void;
    T: typeof LIGHT;
}) => {
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const selectedCategory = EXPENSE_CATEGORIES.find(c => c.value === value) || EXPENSE_CATEGORIES[0];

    const renderCategoryItem = ({ item: cat, index }: { item: typeof EXPENSE_CATEGORIES[0]; index: number }) => (
        <TouchableOpacity
            onPress={() => {
                onSelect(cat.value);
                setDropdownVisible(false);
            }}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: value === cat.value ? T.dropdownSelectedBg : 'transparent',
                borderBottomWidth: index < EXPENSE_CATEGORIES.length - 1 ? 1 : 0,
                borderBottomColor: T.border,
            }}
        >
            <Ionicons name={cat.icon as any} size={22} color={cat.iconColor} />
            <Text style={{
                flex: 1,
                fontSize: 14,
                color: value === cat.value ? T.accentText : T.textSub,
                fontWeight: value === cat.value ? '600' : '400',
            }}>
                {cat.label}
            </Text>
            {value === cat.value && (
                <Ionicons name="checkmark-circle" size={20} color={T.accent} />
            )}
        </TouchableOpacity>
    );

    return (
        <>
            <TouchableOpacity
                onPress={() => setDropdownVisible(true)}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: T.inputBg,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    borderWidth: 1,
                    borderColor: T.border,
                }}
                activeOpacity={0.8}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Ionicons name={selectedCategory.icon as any} size={22} color={selectedCategory.iconColor} />
                    <Text style={{ color: T.textSub, fontSize: 16 }}>{selectedCategory.label}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={T.textMuted} />
            </TouchableOpacity>

            <Modal
                transparent={true}
                visible={dropdownVisible}
                animationType="fade"
                onRequestClose={() => setDropdownVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
                    <View style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        <TouchableWithoutFeedback>
                            <View style={{
                                backgroundColor: T.dropdownBg,
                                borderRadius: 16,
                                padding: 16,
                                width: width * 0.9,
                                maxHeight: height * 0.6,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 8,
                            }}>
                                <View style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                    paddingBottom: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: T.border,
                                }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '600',
                                        color: T.text,
                                    }}>
                                        Pilih Kategori
                                    </Text>
                                    <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                                        <Ionicons name="close" size={24} color={T.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <FlatList
                                    data={EXPENSE_CATEGORIES}
                                    renderItem={renderCategoryItem}
                                    keyExtractor={(item) => item.value}
                                    showsVerticalScrollIndicator={true}
                                    nestedScrollEnabled={true}
                                    style={{ maxHeight: height * 0.5 }}
                                    contentContainerStyle={{ paddingVertical: 4 }}
                                />
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AddExpenseScreen() {
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;
    const insets = useSafeAreaInsets();

    const [amountDisplay, setAmountDisplay] = useState('');
    const [amountRaw, setAmountRaw] = useState(0);
    const [category, setCategory] = useState<TransactionCategory>('MAKANAN');
    const [merchant, setMerchant] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [scanModalVisible, setScanModalVisible] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cameraType, setCameraType] = useState<CameraType>('back');
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingText, setLoadingText] = useState('Menyimpan transaksi...');
    const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const scrollViewRef = useRef<ScrollView>(null);

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

    const { addTransaction, fetchTransactions, balance } = useTransactionStore();
    const consumeFeature = useUsageStore((s) => s.consume);

    // ─── Modal Helpers ──────────────────────────────────────────────────────
    const showSheet = (config: Omit<DynamicModalConfig, 'visible'>) => {
        setSheetConfig({ ...config, visible: true });
    };

    const closeSheet = () => {
        setSheetConfig(prev => ({ ...prev, visible: false }));
    };

    const showLoading = (text: string, progress: number = 0) => {
        setLoadingText(text);
        setLoadingProgress(progress);
        setShowLoadingOverlay(true);
    };

    const updateLoadingProgress = (progress: number) => {
        setLoadingProgress(progress);
    };

    const hideLoading = () => {
        setShowLoadingOverlay(false);
    };

    useEffect(() => {
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
    }, []);

    // app/transactions/add-expense.tsx - Update processImageWithClaude

    const processImageWithClaude = async (base64Image: string) => {
        setIsProcessing(true);
        showLoading('Membaca struk...', 10);

        try {
            updateLoadingProgress(30);

            const { data, error } = await supabase.functions.invoke('scan-receipt', {
                body: { base64Image }
            });

            updateLoadingProgress(70);

            if (error) throw error;

            // ─── SET AMOUNT ──────────────────────────────────────────────────
            if (data?.amount && data.amount > 0) {
                const amountStr = data.amount.toString();
                setAmountDisplay(formatNumber(amountStr));
                setAmountRaw(parseFormattedNumber(amountStr));
            }

            // ─── SET MERCHANT ──────────────────────────────────────────────
            if (data?.merchant) {
                setMerchant(data.merchant);
            }

            // ─── SET ITEMS SEBAGAI CATATAN ──────────────────────────────────
            let noteText = '';
            if (data?.items && data.items.length > 0) {
                noteText = data.items.map((item: any) => {
                    const qty = item.quantity || 1;
                    const price = item.price || 0;
                    return `• ${item.name || 'Item'} ${qty > 1 ? `x${qty}` : ''} = Rp${(price * qty).toLocaleString()}`;
                }).join('\n');

                // Tambahkan total items
                if (data.total_items > 0) {
                    noteText = `📋 ${data.total_items} item:\n${noteText}`;
                }
            }

            // ─── GABUNGKAN DENGAN CATATAN YANG SUDAH ADA ────────────────────
            if (noteText) {
                setNote(prev => prev ? `${prev}\n\n${noteText}` : noteText);
            }

            setScanModalVisible(false);
            updateLoadingProgress(100);

            setTimeout(() => {
                hideLoading();

                // ─── SHOW DETAIL HASIL SCAN ──────────────────────────────────
                let description = '';
                if (data?.amount > 0) {
                    description += `💰 Total: Rp${formatNumberDisplay(Number(data.amount))}\n`;
                }
                if (data?.merchant) {
                    description += `🏪 Toko: ${data.merchant}\n`;
                }
                if (data?.items && data.items.length > 0) {
                    description += `📦 ${data.items.length} item terdeteksi\n`;
                }
                if (data?.confidence) {
                    const pct = Math.round(data.confidence * 100);
                    description += `🎯 Akurasi: ${pct}%`;
                }

                if (data?.amount > 0) {
                    showSheet({
                        title: '✅ Scan Berhasil!',
                        description: description || 'Data struk berhasil dibaca',
                        cancelText: 'Oke',
                        confirmText: '',
                        isDestructive: false,
                        onConfirm: closeSheet,
                    });
                } else {
                    showSheet({
                        title: '⚠️ Kurang Jelas',
                        description: 'Struk kurang terbaca. Coba foto dengan pencahayaan lebih baik.',
                        cancelText: 'Coba lagi',
                        confirmText: '',
                        isDestructive: false,
                        onConfirm: closeSheet,
                    });
                }
            }, 500);

        } catch (err) {
            hideLoading();
            showSheet({
                title: '😱 Gagal Scan!',
                description: 'Gagal memproses gambar, coba lagi',
                cancelText: 'Coba lagi',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAmountChange = (text: string) => {
        const formatted = formatNumber(text);
        setAmountDisplay(formatted);
        setAmountRaw(parseFormattedNumber(formatted));
    };

    const handleSubmit = async () => {
        if (amountRaw <= 0) {
            showSheet({
                title: '😅 Eh, kurang!',
                description: 'Masukkan nominal pengeluaran yang valid ya!',
                cancelText: 'Oke',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
            return;
        }

        setLoading(true);
        showLoading('Menyimpan transaksi...', 0);

        updateLoadingProgress(30);
        const result = await addTransaction({
            amount: amountRaw,
            type: 'EXPENSE',
            category: category,
            merchant: merchant.trim() || undefined,
            note: note.trim() || undefined,
        });

        updateLoadingProgress(70);

        if (result.success) {
            await fetchTransactions();
            updateLoadingProgress(100);

            setTimeout(() => {
                hideLoading();
                showSheet({
                    title: '🎉 Berhasil!',
                    description: `${result.message}`,
                    cancelText: 'Kembali',
                    confirmText: '',
                    isDestructive: false,
                    onConfirm: () => {
                        closeSheet();
                        router.back();
                    },
                });
            }, 500);
        } else {
            hideLoading();
            showSheet({
                title: '😱 Gagal!',
                description: result.message,
                cancelText: 'Coba lagi',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
        }

        setLoading(false);
    };

    const handleScanReceipt = async () => {
        if (!hasPermission) {
            showSheet({
                title: '📷 Izin Diperlukan',
                description: 'Aplikasi memerlukan izin kamera untuk scan struk belanja',
                cancelText: 'Batal',
                confirmText: 'Buka Pengaturan',
                isDestructive: false,
                onConfirm: () => {
                    closeSheet();
                    // Buka pengaturan
                },
            });
            return;
        }

        const result = await consumeFeature('scan');
        if (!result.allowed) {
            setUpgradeModalVisible(true);
            return;
        }

        setScanModalVisible(true);
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            showSheet({
                title: '📷 Izin Diperlukan',
                description: 'Izin akses gallery diperlukan untuk memilih gambar',
                cancelText: 'Oke',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            await processImageWithClaude(result.assets[0].base64);
        }
    };

    const handleTakePicture = async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({ base64: true });
                if (photo?.base64) {
                    await processImageWithClaude(photo.base64);
                }
            } catch (error) {
                console.error('Error taking picture:', error);
                setIsProcessing(false);
                showSheet({
                    title: '😱 Gagal!',
                    description: 'Gagal mengambil gambar, coba lagi',
                    cancelText: 'Oke',
                    confirmText: '',
                    isDestructive: false,
                    onConfirm: closeSheet,
                });
            }
        }
    };

    const toggleCameraType = () => {
        setCameraType(current => (current === 'back' ? 'front' : 'back'));
    };

    const formattedBalance = formatNumberDisplay(balance);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            {/* Loading Overlay dengan Progress Bar */}
            <LoadingOverlay
                visible={showLoadingOverlay}
                text={loadingText}
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
                paddingHorizontal: 20,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: T.border,
                backgroundColor: T.card,
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                    <Ionicons name="arrow-back" size={24} color={T.textSub} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: '700', color: T.text }}>Tambah Pengeluaran</Text>
            </View>

            {/* Info Saldo Saat Ini */}
            <View style={{
                marginHorizontal: 20,
                marginTop: 16,
                backgroundColor: T.accentBg,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: T.accentBorder,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="wallet-outline" size={18} color={T.accentText} />
                    <Text style={{ color: T.accentText, fontSize: 13, fontWeight: '500' }}>Saldo Saat Ini</Text>
                </View>
                <Text style={{ color: T.accentTextStrong, fontSize: 24, fontWeight: '700', marginTop: 4 }}>
                    Rp{formattedBalance}
                </Text>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        ref={scrollViewRef}
                        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 40 }}
                    >
                        {/* Tombol Scan Struk */}
                        <View style={{ marginBottom: 24 }}>
                            <TouchableOpacity
                                onPress={handleScanReceipt}
                                style={{
                                    backgroundColor: T.accent,
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="camera" size={18} color="#ffffff" />
                                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Scan Struk</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Nominal */}
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ color: T.textSub, fontWeight: '500', marginBottom: 8 }}>Nominal *</Text>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: T.inputBg,
                                borderRadius: 12,
                                paddingHorizontal: 16,
                                borderWidth: 1,
                                borderColor: T.border,
                            }}>
                                <Text style={{ color: T.textMuted, fontSize: 18, marginRight: 8 }}>Rp</Text>
                                <TextInput
                                    style={{ flex: 1, paddingVertical: 16, fontSize: 18, color: T.text }}
                                    placeholder="0"
                                    placeholderTextColor={T.textMuted}
                                    keyboardType="numeric"
                                    value={amountDisplay}
                                    onChangeText={handleAmountChange}
                                />
                            </View>
                        </View>

                        {/* Kategori Dropdown */}
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ color: T.textSub, fontWeight: '500', marginBottom: 8 }}>Kategori</Text>
                            <CategorySelect value={category} onSelect={setCategory} T={T} />
                        </View>

                        {/* Tempat/Toko */}
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ color: T.textSub, fontWeight: '500', marginBottom: 8 }}>Tempat / Toko (Opsional)</Text>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: T.inputBg,
                                borderRadius: 12,
                                paddingHorizontal: 16,
                                borderWidth: 1,
                                borderColor: T.border,
                            }}>
                                <Ionicons name="location-outline" size={20} color={T.textMuted} />
                                <TextInput
                                    style={{ flex: 1, paddingVertical: 16, marginLeft: 8, color: T.text }}
                                    placeholder="Misal: Indomaret, Restoran"
                                    placeholderTextColor={T.textMuted}
                                    value={merchant}
                                    onChangeText={setMerchant}
                                />
                            </View>
                        </View>

                        {/* Catatan */}
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: T.textSub, fontWeight: '500', marginBottom: 8 }}>Catatan (Opsional)</Text>
                            <View style={{
                                backgroundColor: T.inputBg,
                                borderRadius: 12,
                                paddingHorizontal: 16,
                                borderWidth: 1,
                                borderColor: T.border
                            }}>
                                <TextInput
                                    style={{ paddingVertical: 16, color: T.text, minHeight: 80 }}
                                    placeholder="Tambahkan catatan..."
                                    placeholderTextColor={T.textMuted}
                                    multiline
                                    numberOfLines={3}
                                    value={note}
                                    onChangeText={setNote}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>

                        {/* Tombol Simpan */}
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={loading}
                            style={{
                                backgroundColor: T.accent,
                                paddingVertical: 16,
                                borderRadius: 12,
                                marginBottom: 32
                            }}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
                                    Simpan Pengeluaran
                                </Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {/* Modal Kamera untuk Scan Struk */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={scanModalVisible}
                onRequestClose={() => setScanModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: '#000000' }}>
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingTop: insets.top + 16,
                        paddingBottom: 16,
                        backgroundColor: '#000000',
                    }}>
                        <TouchableOpacity onPress={() => setScanModalVisible(false)}>
                            <Ionicons name="close" size={28} color="#ffffff" />
                        </TouchableOpacity>
                        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>Scan Struk Belanja</Text>
                        <TouchableOpacity onPress={toggleCameraType}>
                            <Ionicons name="camera-reverse" size={28} color="#ffffff" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                        <CameraView
                            ref={cameraRef}
                            style={{ flex: 1 }}
                            facing={cameraType}
                            mode="picture"
                        >
                            <View style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                                <View style={{
                                    width: 256,
                                    height: 384,
                                    borderWidth: 2,
                                    borderColor: '#ffffff',
                                    borderRadius: 8,
                                    backgroundColor: 'transparent'
                                }}>
                                    <View style={{
                                        position: 'absolute',
                                        top: -2,
                                        left: -2,
                                        width: 24,
                                        height: 24,
                                        borderTopWidth: 4,
                                        borderLeftWidth: 4,
                                        borderColor: '#facc15'
                                    }} />
                                    <View style={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        width: 24,
                                        height: 24,
                                        borderTopWidth: 4,
                                        borderRightWidth: 4,
                                        borderColor: '#facc15'
                                    }} />
                                    <View style={{
                                        position: 'absolute',
                                        bottom: -2,
                                        left: -2,
                                        width: 24,
                                        height: 24,
                                        borderBottomWidth: 4,
                                        borderLeftWidth: 4,
                                        borderColor: '#facc15'
                                    }} />
                                    <View style={{
                                        position: 'absolute',
                                        bottom: -2,
                                        right: -2,
                                        width: 24,
                                        height: 24,
                                        borderBottomWidth: 4,
                                        borderRightWidth: 4,
                                        borderColor: '#facc15'
                                    }} />
                                </View>
                                <Text style={{
                                    color: '#ffffff',
                                    textAlign: 'center',
                                    marginTop: 16,
                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    fontSize: 13,
                                }}>
                                    📄 Arahkan ke seluruh struk belanja
                                </Text>
                            </View>
                        </CameraView>
                    </View>

                    <View style={{
                        paddingHorizontal: 16,
                        paddingTop: 16,
                        paddingBottom: insets.bottom + 16,
                        backgroundColor: '#000000',
                        flexDirection: 'row',
                        gap: 16,
                    }}>
                        <TouchableOpacity
                            onPress={handlePickImage}
                            style={{
                                flex: 1,
                                backgroundColor: '#374151',
                                paddingVertical: 12,
                                borderRadius: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            <Ionicons name="images-outline" size={20} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Pilih dari Gallery</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleTakePicture}
                            disabled={isProcessing}
                            style={{
                                flex: 1,
                                backgroundColor: T.accent,
                                paddingVertical: 12,
                                borderRadius: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Ionicons name="camera" size={20} color="#ffffff" />
                                    <Text style={{ color: '#ffffff', fontWeight: '600' }}>Ambil Foto</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal Upgrade Pro */}
            <UpgradeProModal
                visible={upgradeModalVisible}
                feature="scan"
                onClose={() => setUpgradeModalVisible(false)}
                onUpgrade={() => {
                    setUpgradeModalVisible(false);
                    router.push('/upgrade-pro');
                }}
            />
        </SafeAreaView>
    );
}