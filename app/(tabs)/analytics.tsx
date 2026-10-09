// app/(tabs)/analytics.tsx
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../src/contexts/ThemeContext';
import { financeAnalytics } from '../../src/services/financeAnalytics';
import { supabase } from '../../src/services/supabase/client';
import { useBudgetStore } from '../../src/store/budgetStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { MonthlyProjection } from '../../src/types';
import { formatCurrency } from '../../src/utils/formatters';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Theme ─────────────────────────────────────────────────────────────────────
const LIGHT = {
    bg: '#f5f6fa',
    card: '#ffffff',
    border: '#e8e8e8',
    divider: '#f0f0f5',
    text: '#111827',
    textSub: '#444444',
    textMuted: '#9ca3af',
    accent: '#3b6ef5',
    accentBg: '#e0e7ff',
    barInactive: '#c7d2fe',
    avgLine: '#F5A623',
    cardLighter: '#f8f8f8',
    chipBg: '#f0f0f5',
    chipText: '#374151',
    success: '#10b981',
    sectionBg: '#f5f6fa',
};

const DARK = {
    bg: '#080f24',
    card: '#0f1a3d',
    border: '#1a2a55',
    divider: '#1a2a55',
    text: '#f0f4ff',
    textSub: '#8899bb',
    textMuted: '#5a6b94',
    accent: '#818cf8',
    accentBg: '#23306b',
    barInactive: '#1e3a6e',
    avgLine: '#F5A623',
    cardLighter: '#0a1530',
    chipBg: '#1a2a55',
    chipText: '#c3cee6',
    success: '#34d399',
    sectionBg: '#080f24',
};

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
    MAKANAN: { label: 'Makanan', emoji: '🍔', color: '#4CAF50' },
    TRANSPORTASI: { label: 'Transportasi', emoji: '🚗', color: '#2196F3' },
    BELANJA: { label: 'Shopping', emoji: '🛍️', color: '#8B4513' },
    TAGIHAN: { label: 'Tagihan', emoji: '📄', color: '#FF9800' },
    KESEHATAN: { label: 'Kesehatan', emoji: '🏥', color: '#E91E63' },
    PENDIDIKAN: { label: 'Pendidikan', emoji: '📚', color: '#9C27B0' },
    HIBURAN: { label: 'Hiburan', emoji: '🎬', color: '#00BCD4' },
    KUOTA: { label: 'Kuota', emoji: '📱', color: '#26C6DA' },
    KOS: { label: 'Kos/Sewa', emoji: '🏠', color: '#4CAF50' },
    HUTANG: { label: 'Hutang', emoji: '💳', color: '#EF5350' },
    ZAKAT: { label: 'Zakat', emoji: '🤲', color: '#66BB6A' },
    LAINNYA: { label: 'Lainnya', emoji: '📦', color: '#7E57C2' },
    FOOD: { label: 'Makanan', emoji: '🍔', color: '#4CAF50' },
    TRANSPORT: { label: 'Transportasi', emoji: '🚗', color: '#2196F3' },
    SHOPPING: { label: 'Shopping', emoji: '🛍️', color: '#8B4513' },
    BILLS: { label: 'Tagihan', emoji: '📄', color: '#FF9800' },
    HEALTH: { label: 'Kesehatan', emoji: '🏥', color: '#E91E63' },
    EDUCATION: { label: 'Pendidikan', emoji: '📚', color: '#9C27B0' },
    ENTERTAINMENT: { label: 'Hiburan', emoji: '🎬', color: '#00BCD4' },
    OTHER: { label: 'Lainnya', emoji: '📦', color: '#7E57C2' },
    KEBUTUHAN_RUMAH: { label: 'Kebutuhan rumah', emoji: '🏡', color: '#4CAF50' },
};

// ── Types ─────────────────────────────────────────────────────────────────────
type GaugeItem = {
    category: string;
    label: string;
    emoji: string;
    color: string;
    amount: number;
    percentage: number;
};

type ThemeColors = typeof LIGHT;

// ── Semi-Circle Gauge ─────────────────────────────────────────────────────────
function SemiCircleGauge({ items, total, T }: { items: GaugeItem[]; total: number; T: ThemeColors }) {
    const size = SCREEN_W - 32;
    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 36;
    const strokeW = 32;

    const x1 = cx - R;
    const y1 = cy;
    const x2 = cx + R;
    const y2 = cy;
    const arcLen = Math.PI * R;

    const biggestItem = items[0];

    return (
        <View style={{ alignItems: 'center' }}>
            <Svg width={size} height={cy + 24} style={{ overflow: 'visible' }}>
                {/* Background arc */}
                <Path
                    d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`}
                    fill="none"
                    stroke={T.divider}
                    strokeWidth={strokeW}
                    strokeLinecap="butt"
                />

                {/* Colored segments */}
                {items.map((item, index) => {
                    const prevPct = items.slice(0, index).reduce((s, i) => s + i.percentage, 0);
                    const segLen = (item.percentage / 100) * arcLen;
                    const offset = -(prevPct / 100) * arcLen;
                    return (
                        <Path
                            key={item.category}
                            d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`}
                            fill="none"
                            stroke={item.color}
                            strokeWidth={strokeW + 2}
                            strokeLinecap="butt"
                            strokeDasharray={`${segLen} ${arcLen}`}
                            strokeDashoffset={`${offset}`}
                        />
                    );
                })}

                {/* Badge terbesar (kanan) */}
                {biggestItem && (
                    <G>
                        <Circle cx={x2 + 2} cy={y2} r={24} fill={T.card} stroke={T.border} strokeWidth={1.5} />
                        <SvgText x={x2 + 2} y={y2 + 5} textAnchor="middle" fontSize={12} fill={biggestItem.color} fontWeight="700">
                            {biggestItem.percentage}%
                        </SvgText>
                    </G>
                )}

                {/* Badge terkecil (kiri) */}
                {items.length > 1 && (
                    <G>
                        <Circle cx={x1 - 2} cy={y1} r={24} fill={T.card} stroke={T.border} strokeWidth={1.5} />
                        <SvgText x={x1 - 2} y={y1 + 5} textAnchor="middle" fontSize={12} fill={items[items.length - 1].color} fontWeight="700">
                            {items[items.length - 1].percentage}%
                        </SvgText>
                    </G>
                )}

                {/* Label total tengah */}
                <SvgText x={cx} y={cy - 14} textAnchor="middle" fontSize={13} fill={T.textSub} fontWeight="500">
                    Pengeluaran Bulan ini
                </SvgText>
                <SvgText x={cx} y={cy + 12} textAnchor="middle" fontSize={19} fontWeight="800" fill={T.text}>
                    {formatCurrency(total)}
                </SvgText>
            </Svg>

            {/* Legend chips */}
            <View style={{
                flexDirection: 'row', flexWrap: 'wrap',
                paddingHorizontal: 20, gap: 8, marginTop: 12, justifyContent: 'center',
            }}>
                {items.map(item => (
                    <View key={item.category} style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: T.chipBg, borderRadius: 20,
                        paddingHorizontal: 12, paddingVertical: 5,
                    }}>
                        <View style={{
                            width: 10, height: 10, borderRadius: 5,
                            backgroundColor: item.color, marginRight: 6,
                        }} />
                        <Text style={{ fontSize: 12, color: T.textSub, fontWeight: '500' }}>
                            {item.label}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Category list cards */}
            <View style={{ paddingHorizontal: 16, width: SCREEN_W, marginTop: 20 }}>
                {items.map(item => (
                    <TouchableOpacity
                        key={item.category}
                        activeOpacity={0.8}
                        style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: T.card, borderRadius: 16,
                            marginBottom: 10, padding: 14,
                            borderLeftWidth: 4, borderLeftColor: item.color,
                            borderWidth: 1, borderColor: T.border,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.06, shadowRadius: 4,
                            elevation: 2,
                        }}
                    >
                        <View style={{
                            width: 46, height: 46, borderRadius: 23,
                            backgroundColor: T.chipBg,
                            alignItems: 'center', justifyContent: 'center', marginRight: 14,
                        }}>
                            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }} numberOfLines={1}>
                                {item.label}
                            </Text>
                            <Text style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                                {item.percentage}% · -{formatCurrency(item.amount)}
                            </Text>
                        </View>
                        <View style={{
                            width: 30, height: 30, borderRadius: 15,
                            backgroundColor: T.chipBg,
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Ionicons name="chevron-forward" size={14} color={T.textMuted} />
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({
    months, values, avg, currentMonth, T,
}: {
    months: string[];
    values: number[];
    avg: number;
    currentMonth: number;
    T: ThemeColors;
}) {
    const chartH = 160;
    const chartW = SCREEN_W - 64;
    const barCount = months.length;
    const barW = Math.floor((chartW - 32) / barCount) - 6;
    const maxVal = Math.max(...values, avg * 1.2, 50000);
    const maxValRounded = Math.ceil(maxVal / 50000) * 50000;
    const yForVal = (v: number) => chartH - 10 - (v / maxValRounded) * (chartH - 20);
    const avgY = yForVal(avg);

    const ySteps = 6;
    const yAxisLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
        const val = Math.round((maxValRounded * (ySteps - i)) / ySteps);
        return val >= 1000 ? `${(val / 1000).toFixed(0)}rb` : `${val}`;
    });

    return (
        <View style={{ flexDirection: 'row' }}>
            {/* Y axis */}
            <View style={{ width: 36, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6, height: chartH }}>
                {yAxisLabels.map((l, i) => (
                    <Text key={i} style={{ fontSize: 10, color: T.textMuted }}>{l}</Text>
                ))}
            </View>

            {/* Chart area */}
            <View style={{ width: chartW, height: chartH + 30 }}>
                <Svg width={chartW} height={chartH + 30}>
                    <Defs>
                        <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={T.accent} stopOpacity="1" />
                            <Stop offset="1" stopColor={T.accent} stopOpacity="0.7" />
                        </LinearGradient>
                    </Defs>

                    {/* Grid lines */}
                    {Array.from({ length: 5 }, (_, i) => {
                        const yy = 10 + (i / 4) * (chartH - 20);
                        return (
                            <Path key={i} d={`M 0 ${yy} L ${chartW} ${yy}`}
                                stroke={T.border} strokeWidth={1} strokeDasharray="4,4" />
                        );
                    })}

                    {/* Avg line */}
                    {avg > 0 && (
                        <Path d={`M 0 ${avgY} L ${chartW} ${avgY}`}
                            stroke={T.avgLine} strokeWidth={2} />
                    )}

                    {/* Bars */}
                    {values.map((v, i) => {
                        const barH = Math.max(v > 0 ? 6 : 0, ((v / maxValRounded) * (chartH - 20)));
                        const x = i * (barW + 6) + 2;
                        const y = chartH - 10 - barH;
                        return (
                            <Rect key={i} x={x} y={y} width={barW} height={barH}
                                rx={5} ry={5}
                                fill={i === currentMonth ? 'url(#barGrad)' : T.barInactive} />
                        );
                    })}

                    {/* Month labels */}
                    {months.map((m, i) => (
                        <SvgText key={i}
                            x={i * (barW + 6) + 2 + barW / 2}
                            y={chartH + 20}
                            textAnchor="middle" fontSize={10}
                            fill={i === currentMonth ? T.text : T.textMuted}
                            fontWeight={i === currentMonth ? 'bold' : 'normal'}
                        >
                            {m}
                        </SvgText>
                    ))}
                </Svg>

                {/* Avg label */}
                {avg > 0 && (
                    <View style={{
                        position: 'absolute', top: Math.max(2, avgY - 14), left: 6,
                        backgroundColor: T.avgLine, borderRadius: 6,
                        paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                        <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>
                            Avg 6 bulan Rp{Math.round(avg / 1000)}rb
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;

    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'kategori' | 'akun' | 'merchant'>('kategori');
    const [projection, setProjection] = useState<MonthlyProjection | null>(null);

    const { transactions, totalExpense, fetchTransactions } = useTransactionStore();
    const { fetchBudgets } = useBudgetStore();

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        await fetchTransactions();
        await fetchBudgets();
        await loadProjection();
    };

    const loadProjection = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const proj = await financeAnalytics.calculateMonthlyProjection(user.id);
            setProjection(proj);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    };

    const categoryBreakdown = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const expenses = transactions.filter(t =>
            t.type === 'EXPENSE' && new Date(t.created_at) >= startOfMonth
        );
        const totals: Record<string, number> = {};
        expenses.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
        const total = Object.values(totals).reduce((s, v) => s + v, 0);
        return {
            items: Object.entries(totals)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => {
                    const cfg = CATEGORY_CONFIG[cat] || { label: cat, emoji: '📦', color: '#7E57C2' };
                    return {
                        category: cat,
                        label: cfg.label,
                        emoji: cfg.emoji,
                        color: cfg.color,
                        amount,
                        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
                    };
                }),
            total,
        };
    }, [transactions]);

    const { monthLabels, monthValues, avgMonthly } = useMemo(() => {
        const now = new Date();
        const labels = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
            return d.toLocaleDateString('id-ID', { month: 'short' }) + ` '` + String(d.getFullYear()).slice(2);
        });
        const values = [0, 0, 0, 0, 0, totalExpense];
        const avg = values.reduce((s, v) => s + v, 0) / 6;
        return { monthLabels: labels, monthValues: values, avgMonthly: avg };
    }, [totalExpense]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
            >
                {/* Header */}
                <View style={{
                    paddingHorizontal: 20, paddingVertical: 16,
                    backgroundColor: T.card,
                    borderBottomWidth: 1, borderBottomColor: T.border,
                    alignItems: 'center',
                }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: T.text }}>
                        {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </Text>
                </View>

                {/* Total & Bar Chart */}
                <View style={{
                    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
                    backgroundColor: T.card, marginBottom: 8,
                }}>
                    <Text style={{ fontSize: 13, color: T.textSub, marginBottom: 2, fontWeight: '600' }}>
                        Total pengeluaran
                    </Text>
                    <Text style={{ fontSize: 34, fontWeight: '900', color: T.text, marginBottom: 20 }}>
                        {formatCurrency(totalExpense)}
                    </Text>
                    <BarChart
                        months={monthLabels}
                        values={monthValues}
                        avg={avgMonthly}
                        currentMonth={5}
                        T={T}
                    />
                </View>

                {/* Tabs */}
                <View style={{
                    flexDirection: 'row', paddingHorizontal: 20,
                    backgroundColor: T.card,
                    borderBottomWidth: 1, borderBottomColor: T.border,
                }}>
                    {(['kategori', 'akun', 'merchant'] as const).map(tab => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            style={{
                                paddingVertical: 13, marginRight: 28,
                                borderBottomWidth: 3,
                                borderBottomColor: activeTab === tab ? T.accent : 'transparent',
                            }}
                        >
                            <Text style={{
                                fontSize: 15, fontWeight: '700',
                                color: activeTab === tab ? T.text : T.textMuted,
                            }}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Tab Content */}
                <View style={{ paddingTop: 16, backgroundColor: T.bg }}>
                    {activeTab === 'kategori' && (
                        categoryBreakdown.items.length > 0 ? (
                            <SemiCircleGauge
                                items={categoryBreakdown.items}
                                total={categoryBreakdown.total}
                                T={T}
                            />
                        ) : (
                            <View style={{ padding: 60, alignItems: 'center' }}>
                                <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
                                <Text style={{ color: T.textMuted, fontSize: 14, textAlign: 'center' }}>
                                    Belum ada data pengeluaran{'\n'}bulan ini
                                </Text>
                            </View>
                        )
                    )}

                    {activeTab !== 'kategori' && (
                        <View style={{ padding: 60, alignItems: 'center' }}>
                            <Text style={{ fontSize: 40, marginBottom: 12 }}>🚧</Text>
                            <Text style={{ color: T.textMuted, fontSize: 14 }}>
                                Halaman {activeTab} segera hadir
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}