// app/(tabs)/transactions.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    SectionList,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useTransactionStore } from '../../src/store/transactionStore';
import { formatCurrency, formatDateTime } from '../../src/utils/formatters';

// ── Theme ─────────────────────────────────────────────────────────────────────
const LIGHT = {
    bg: '#f5f6fa',
    card: '#ffffff',
    border: '#f0f0f5',
    text: '#111827',
    textSub: '#6b7280',
    textMuted: '#9ca3af',
    textFaint: '#d1d5db',
    chipBg: '#f0f0f5',
    chipText: '#374151',
    accent: '#3b6ef5',
    accentBg: '#e0e7ff',
    success: '#10b981',
    successBg: '#d1fae5',
    danger: '#ef4444',
    dangerBg: '#fee2e2',
    overlay: 'rgba(0,0,0,0.45)',
    sheetBg: '#ffffff',
    rowBg: '#f8fafc',
    closeBtnBg: '#f3f4f6',
    sectionBg: '#f5f6fa',
    sectionText: '#6b7280',
    aiBanner: '#ffffff',
    aiBannerBorder: '#e5e7eb',
    feedbackBg: '#f5f6fa',
    badgeBg: '#ef4444',
    badgeText: '#ffffff',
    statusBarBg: '#3b6ef5',
};

const DARK = {
    bg: '#080f24',
    card: '#0f1a3d',
    border: '#1a2a55',
    text: '#f0f4ff',
    textSub: '#8899bb',
    textMuted: '#5a6b94',
    textFaint: '#3d4a6e',
    chipBg: '#1a2a55',
    chipText: '#c3cee6',
    accent: '#818cf8',
    accentBg: '#23306b',
    success: '#34d399',
    successBg: '#10362b',
    danger: '#fb7185',
    dangerBg: '#3b1219',
    overlay: 'rgba(0,0,0,0.7)',
    sheetBg: '#0f1a3d',
    rowBg: '#0a1530',
    closeBtnBg: '#1a2a55',
    sectionBg: '#080f24',
    sectionText: '#5a6b94',
    aiBanner: '#0f1a3d',
    aiBannerBorder: '#1a2a55',
    feedbackBg: '#0f1a3d',
    badgeBg: '#ef4444',
    badgeText: '#ffffff',
    statusBarBg: '#0f1a3d',
};

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
    MAKANAN: { emoji: '🍔', label: 'Makanan & Minuman' },
    TRANSPORTASI: { emoji: '🚗', label: 'Transportasi' },
    BELANJA: { emoji: '🛍️', label: 'Belanja' },
    TAGIHAN: { emoji: '📄', label: 'Tagihan' },
    KESEHATAN: { emoji: '🏥', label: 'Kesehatan' },
    PENDIDIKAN: { emoji: '📚', label: 'Pendidikan' },
    HIBURAN: { emoji: '🎬', label: 'Hiburan' },
    TABUNGAN: { emoji: '💰', label: 'Tabungan' },
    KUOTA: { emoji: '📱', label: 'Kuota/Pulsa' },
    KOS: { emoji: '🏠', label: 'Kos/Sewa' },
    HUTANG: { emoji: '💸', label: 'Bayar Hutang' },
    ZAKAT: { emoji: '🤲', label: 'Zakat/Sedekah' },
    KEBUTUHAN: { emoji: '🍽️', label: 'Kebutuhan Dapur' },
    GAJI: { emoji: '💼', label: 'Gaji' },
    BONUS: { emoji: '🎁', label: 'Bonus' },
    INVESTASI: { emoji: '📈', label: 'Investasi' },
    HADIAH: { emoji: '🎉', label: 'Hadiah' },
    FREELANCE: { emoji: '💻', label: 'Freelance' },
    BISNIS: { emoji: '🏢', label: 'Bisnis' },
    LAINNYA: { emoji: '📦', label: 'Lainnya' }, // ← Perbaikan di sini
};

function getCategoryMeta(category: string) {
    return CATEGORY_META[category] ?? { emoji: '📦', label: category };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupByDate(transactions: any[]) {
    const map: Record<string, any[]> = {};
    transactions.forEach(t => {
        const key = new Date(t.timestamp).toDateString();
        if (!map[key]) map[key] = [];
        map[key].push(t);
    });

    return Object.entries(map).map(([dateStr, data]) => {
        const total = data.reduce((sum, t) =>
            t.type === 'INCOME' ? sum + t.amount : sum - t.amount, 0);
        return { title: dateStr, total, data };
    });
}

function formatSectionDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TransactionsScreen() {
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;
    const insets = useSafeAreaInsets();

    const { transactions, fetchTransactions, deleteTransaction, isLoading } = useTransactionStore();
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [feedbackGiven, setFeedbackGiven] = useState<null | 'up' | 'down'>(null);

    useEffect(() => { fetchTransactions(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTransactions();
        setRefreshing(false);
    };

    const handleDelete = (id: string, amount: number, type: string) => {
        Alert.alert(
            'Hapus Transaksi',
            `Yakin ingin menghapus ${type === 'INCOME' ? 'pemasukan' : 'pengeluaran'} ${formatCurrency(amount)}?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus', style: 'destructive',
                    onPress: async () => {
                        const result = await deleteTransaction(id);
                        Alert.alert(result.success ? 'Berhasil' : 'Gagal', result.message);
                    },
                },
            ]
        );
    };

    const filtered = useMemo(() =>
        transactions.filter(t => filter === 'ALL' || t.type === filter),
        [transactions, filter]
    );

    const sections = useMemo(() => groupByDate(filtered), [filtered]);

    // ── Render item ───────────────────────────────────────────────────────────
    const renderItem = ({ item }: { item: any }) => {
        const isIncome = item.type === 'INCOME';
        const meta = getCategoryMeta(item.category);
        const isNew = Date.now() - new Date(item.timestamp).getTime() < 24 * 60 * 60 * 1000;

        return (
            <TouchableOpacity
                onPress={() => { setSelectedTransaction(item); setDetailModalVisible(true); }}
                onLongPress={() => handleDelete(item.id, item.amount, item.type)}
                activeOpacity={0.75}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: T.card,
                    marginHorizontal: 16,
                    marginBottom: 8,
                    borderRadius: 14,
                    padding: 14,
                    shadowColor: '#000',
                    shadowOpacity: isDark ? 0.2 : 0.05,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                }}
            >
                {/* Emoji icon */}
                <View style={{
                    width: 46, height: 46, borderRadius: 12,
                    backgroundColor: isIncome ? T.successBg : T.accentBg,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                    <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: T.text }} numberOfLines={1}>
                            {meta.label}
                        </Text>
                        {isNew && (
                            <View style={{ backgroundColor: T.badgeBg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                                <Text style={{ color: T.badgeText, fontSize: 10, fontWeight: '700' }}>Baru</Text>
                            </View>
                        )}
                    </View>
                    <Text style={{ fontSize: 12, color: T.textMuted }} numberOfLines={1}>
                        Cash · Akun Manual
                    </Text>
                    {item.merchant ? (
                        <Text style={{ fontSize: 12, color: T.textSub, marginTop: 1 }} numberOfLines={1}>
                            {item.merchant}
                        </Text>
                    ) : null}
                </View>

                {/* Nominal */}
                <Text style={{
                    fontWeight: '700', fontSize: 14,
                    color: isIncome ? T.success : T.text,
                    marginLeft: 8,
                }}>
                    {isIncome ? '+' : '- '}{formatCurrency(item.amount)}
                </Text>
            </TouchableOpacity>
        );
    };

    // ── Section header ────────────────────────────────────────────────────────
    const renderSectionHeader = ({ section }: { section: any }) => (
        <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 10,
            backgroundColor: T.sectionBg,
        }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: T.sectionText }}>
                {formatSectionDate(section.title)}
            </Text>
            <Text style={{
                fontSize: 13, fontWeight: '600',
                color: section.total >= 0 ? T.success : T.text,
            }}>
                {section.total >= 0 ? '+' : ''}{formatCurrency(Math.abs(section.total))}
            </Text>
        </View>
    );

    // ── Footer: feedback + AI banner ──────────────────────────────────────────
    // const ListFooter = () => (
    //     <View style={{ paddingBottom: 16 }}>
    //         {/* Feedback */}
    //         <View style={{
    //             flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    //             marginHorizontal: 16, marginTop: 8, marginBottom: 8,
    //             backgroundColor: T.feedbackBg,
    //             borderRadius: 14, padding: 14,
    //         }}>
    //             <Text style={{ color: T.textSub, fontWeight: '500', fontSize: 14 }}>
    //                 Kamu suka halaman ini?
    //             </Text>
    //             <View style={{ flexDirection: 'row', gap: 8 }}>
    //                 <TouchableOpacity onPress={() => setFeedbackGiven('up')} style={{ opacity: feedbackGiven && feedbackGiven !== 'up' ? 0.4 : 1 }}>
    //                     <Text style={{ fontSize: 26 }}>👍</Text>
    //                 </TouchableOpacity>
    //                 <TouchableOpacity onPress={() => setFeedbackGiven('down')} style={{ opacity: feedbackGiven && feedbackGiven !== 'down' ? 0.4 : 1 }}>
    //                     <Text style={{ fontSize: 26 }}>👎</Text>
    //                 </TouchableOpacity>
    //             </View>
    //         </View>
    //     </View>
    // );

    const ListEmpty = () => (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🧾</Text>
            <Text style={{ color: T.textMuted, fontWeight: '600', fontSize: 15 }}>Belum ada transaksi</Text>
            <Text style={{ color: T.textFaint, fontSize: 13, marginTop: 4 }}>
                Tambahkan transaksi pertamamu
            </Text>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: T.bg }}>


            {/* ── Header ── */}
            <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 20, paddingVertical: 16,
                backgroundColor: T.card,
                borderBottomWidth: 1, borderBottomColor: T.border,
            }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: T.text }}>Semua Transaksi</Text>
                <TouchableOpacity
                    style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Ionicons name="options-outline" size={20} color={T.textSub} />
                </TouchableOpacity>
            </View>

            {/* ── Filter chips ── */}
            <View style={{
                flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
                gap: 8, backgroundColor: T.card,
                borderBottomWidth: 1, borderBottomColor: T.border,
            }}>
                {(['ALL', 'INCOME', 'EXPENSE'] as const).map(f => {
                    const active = filter === f;
                    const label = f === 'ALL' ? 'Semua' : f === 'INCOME' ? 'Pemasukan' : 'Pengeluaran';
                    const activeColor = f === 'INCOME' ? T.success : T.accent;
                    return (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            style={{
                                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999,
                                backgroundColor: active ? activeColor : T.chipBg,
                            }}
                        >
                            <Text style={{
                                fontSize: 13, fontWeight: active ? '600' : '400',
                                color: active ? '#ffffff' : T.chipText,
                            }}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── List ── */}
            <SectionList
                sections={sections}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                ListEmptyComponent={<ListEmpty />}
                // ListFooterComponent={sections.length > 0 ? <ListFooter /> : null}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />
                }
            />

            {/* ── AI Banner floating ── */}
            {/* <View style={{
                position: 'absolute',
                bottom: insets.bottom + 70, // di atas tab bar
                left: 16, right: 16,
                backgroundColor: T.aiBanner,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: T.aiBannerBorder,
                paddingVertical: 14,
                paddingHorizontal: 18,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOpacity: isDark ? 0.3 : 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
            }}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>✨</Text>
                <Text style={{ flex: 1, color: T.text, fontWeight: '500', fontSize: 14 }}>
                    Catat transaksi pakai AI
                </Text>
                <View style={{ backgroundColor: T.badgeBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>Baru</Text>
                </View>
            </View> */}

            {/* ── Modal Detail ── */}
            <Modal
                animationType="slide"
                transparent
                visible={detailModalVisible}
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: T.overlay }}>
                    <View style={{
                        backgroundColor: T.sheetBg,
                        borderTopLeftRadius: 28, borderTopRightRadius: 28,
                        padding: 20, paddingBottom: insets.bottom + 20,
                        maxHeight: '85%',
                    }}>
                        {/* Modal header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: T.text }}>Detail Transaksi</Text>
                            <TouchableOpacity
                                onPress={() => setDetailModalVisible(false)}
                                style={{
                                    width: 32, height: 32, borderRadius: 16,
                                    backgroundColor: T.closeBtnBg, alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <Ionicons name="close" size={18} color={T.textSub} />
                            </TouchableOpacity>
                        </View>

                        {selectedTransaction && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Icon + nominal */}
                                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                    <View style={{
                                        width: 72, height: 72, borderRadius: 20,
                                        backgroundColor: selectedTransaction.type === 'INCOME' ? T.successBg : T.accentBg,
                                        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
                                    }}>
                                        <Text style={{ fontSize: 36 }}>
                                            {getCategoryMeta(selectedTransaction.category).emoji}
                                        </Text>
                                    </View>
                                    <Text style={{
                                        fontSize: 26, fontWeight: '700',
                                        color: selectedTransaction.type === 'INCOME' ? T.success : T.text,
                                    }}>
                                        {selectedTransaction.type === 'INCOME' ? '+' : '- '}
                                        {formatCurrency(selectedTransaction.amount)}
                                    </Text>
                                    <Text style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>
                                        {selectedTransaction.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                                    </Text>
                                </View>

                                {/* Row detail */}
                                {[
                                    { label: 'Kategori', value: getCategoryMeta(selectedTransaction.category).label },
                                    { label: 'Tempat / Toko', value: selectedTransaction.merchant || '-' },
                                    { label: 'Tanggal', value: formatDateTime(selectedTransaction.timestamp).date },
                                    { label: 'Waktu', value: formatDateTime(selectedTransaction.timestamp).time },
                                    { label: 'Catatan', value: selectedTransaction.note || '-' },
                                ].map((row, i, arr) => (
                                    <View key={row.label} style={{
                                        flexDirection: 'row', paddingVertical: 12,
                                        borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                                        borderBottomColor: T.border,
                                    }}>
                                        <Text style={{ width: 120, color: T.textMuted, fontSize: 13 }}>{row.label}</Text>
                                        <Text style={{ flex: 1, color: T.text, fontSize: 13, fontWeight: '500' }}>{row.value}</Text>
                                    </View>
                                ))}

                                {selectedTransaction.isAutoDetected && (
                                    <View style={{
                                        backgroundColor: T.accentBg, borderRadius: 12, padding: 12,
                                        flexDirection: 'row', alignItems: 'center', marginTop: 16,
                                    }}>
                                        <Ionicons name="scan-outline" size={16} color={T.accent} />
                                        <Text style={{ color: T.accent, fontSize: 12, marginLeft: 8, flex: 1 }}>
                                            Terdeteksi otomatis dari struk belanja
                                        </Text>
                                    </View>
                                )}

                                {/* Actions */}
                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setDetailModalVisible(false);
                                            handleDelete(selectedTransaction.id, selectedTransaction.amount, selectedTransaction.type);
                                        }}
                                        style={{
                                            flex: 1, backgroundColor: T.dangerBg, paddingVertical: 14, borderRadius: 12,
                                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={T.danger} />
                                        <Text style={{ color: T.danger, fontWeight: '600' }}>Hapus</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setDetailModalVisible(false)}
                                        style={{
                                            flex: 1, backgroundColor: T.chipBg, paddingVertical: 14, borderRadius: 12,
                                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="close-outline" size={18} color={T.chipText} />
                                        <Text style={{ color: T.chipText, fontWeight: '600' }}>Tutup</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}