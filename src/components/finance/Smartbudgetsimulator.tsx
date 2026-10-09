// src/components/finance/SmartBudgetSimulator.tsx
// Fitur: User input budget/pemasukan → sistem kalkulasi berapa hari cukup
// berdasarkan behavior pengeluaran nyata + saran terbaik

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Installment, Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

// ─── Theme ──────────────────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
    transactions: Transaction[];
    installments?: Installment[];
    currentBalance?: number;
}

type SimMode = 'daily' | 'monthly';

interface BehaviorProfile {
    avgDailyExpense: number;
    avgDailyByCategory: Record<string, number>;
    topCategory: string;
    topCategoryPct: number;
    volatility: number;
    daysAnalyzed: number;
    hasEnoughData: boolean;
}

interface DailySimResult {
    budgetInput: number;
    avgDailyExpense: number;
    estimatedDays: number;
    projectedRunoutDate: Date;
    dailyBudgetIdeal: number;
    dailyBudgetSafe: number;
    savingPerDay: number;
    surplus: number;
    isSafe: boolean;
    riskLevel: 'safe' | 'warning' | 'danger';
    tips: Tip[];
    categoryBreakdown: CategoryItem[];
    whatIfScenarios: WhatIfScenario[];
}

interface MonthlySimResult {
    budgetInput: number;
    totalInstallments: number;
    netBudget: number;
    avgMonthlyExpense: number;
    estimatedDays: number;
    dailyAllowance: number;
    projectedSaving: number;
    projectedDeficit: number;
    isSafe: boolean;
    riskLevel: 'safe' | 'warning' | 'danger';
    breakEvenDay: number;
    tips: Tip[];
    categoryBreakdown: CategoryItem[];
    monthlyScenarios: MonthlyScenario[];
}

interface Tip {
    icon: string;
    text: string;
    type: 'success' | 'warning' | 'danger' | 'info';
    saving?: number;
}

interface CategoryItem {
    category: string;
    label: string;
    amount: number;
    percentage: number;
    dailyAvg: number;
    color: string;
}

interface WhatIfScenario {
    label: string;
    days: number;
    saving: number;
    description: string;
}

interface MonthlyScenario {
    label: string;
    dailyLimit: number;
    projectedSaving: number;
    daysItLasts: number;
    emoji: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; color: string; icon: string; essentialPct: number }> = {
    FOOD: { label: 'Makan & Minum', color: '#f97316', icon: '🍜', essentialPct: 0.85 },
    TRANSPORT: { label: 'Transportasi', color: '#3b82f6', icon: '🚗', essentialPct: 0.80 },
    SHOPPING: { label: 'Belanja', color: '#8b5cf6', icon: '🛍️', essentialPct: 0.40 },
    BILLS: { label: 'Tagihan', color: '#ef4444', icon: '💡', essentialPct: 1.00 },
    HEALTH: { label: 'Kesehatan', color: '#10b981', icon: '💊', essentialPct: 1.00 },
    EDUCATION: { label: 'Pendidikan', color: '#06b6d4', icon: '📚', essentialPct: 0.90 },
    ENTERTAINMENT: { label: 'Hiburan', color: '#ec4899', icon: '🎮', essentialPct: 0.20 },
    SAVINGS: { label: 'Tabungan', color: '#22c55e', icon: '🐷', essentialPct: 1.00 },
    OTHER: { label: 'Lainnya', color: '#94a3b8', icon: '📦', essentialPct: 0.50 },
};

const DAYS_IN_MONTH = 30;

// ─── Data Gaya Hidup ──────────────────────────────────────────────────────────
const LIFESTYLE_DATA = [
    { id: 'santai', label: '🌿 Santai', description: 'Fokus pada kenyamanan dan relaksasi', color: '#10b981', icon: 'leaf-outline' },
    { id: 'seimbang', label: '⚖️ Seimbang', description: 'Keseimbangan antara kerja dan hidup', color: '#3b82f6', icon: 'scale-outline' },
    { id: 'produktif', label: '🚀 Produktif', description: 'Maksimalkan waktu dan energi', color: '#8b5cf6', icon: 'rocket-outline' },
    { id: 'minimalis', label: '✨ Minimalis', description: 'Hidup sederhana dan efisien', color: '#f59e0b', icon: 'sparkles-outline' },
    { id: 'sosial', label: '👥 Sosial', description: 'Bersosialisasi dan membangun relasi', color: '#ec4899', icon: 'people-outline' },
    { id: 'petualang', label: '🏔️ Petualang', description: 'Eksplorasi dan pengalaman baru', color: '#ef4444', icon: 'compass-outline' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDateShort(date: Date): string {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function riskColor(level: 'safe' | 'warning' | 'danger') {
    return level === 'safe' ? '#10b981' : level === 'warning' ? '#f59e0b' : '#ef4444';
}

function riskBg(level: 'safe' | 'warning' | 'danger') {
    return level === 'safe' ? '#f0fdf4' : level === 'warning' ? '#fffbeb' : '#fff1f2';
}

function riskBorder(level: 'safe' | 'warning' | 'danger') {
    return level === 'safe' ? '#bbf7d0' : level === 'warning' ? '#fde68a' : '#fecdd3';
}

// ─── Core Hook: Analisis Behavior ─────────────────────────────────────────────

function useBehaviorProfile(transactions: Transaction[]): BehaviorProfile {
    return useMemo(() => {
        const now = new Date();
        const since = new Date(now);
        since.setDate(since.getDate() - 60);

        const expenses = transactions.filter(t => {
            const d = new Date(t.created_at);
            return t.type === 'EXPENSE' && d >= since;
        });

        if (expenses.length === 0) {
            return {
                avgDailyExpense: 0,
                avgDailyByCategory: {},
                topCategory: '-',
                topCategoryPct: 0,
                volatility: 0,
                daysAnalyzed: 0,
                hasEnoughData: false,
            };
        }

        const byDay: Record<string, number> = {};
        const byCat: Record<string, number> = {};

        expenses.forEach(t => {
            const dayKey = new Date(t.created_at).toISOString().slice(0, 10);
            byDay[dayKey] = (byDay[dayKey] || 0) + t.amount;
            byCat[t.category] = (byCat[t.category] || 0) + t.amount;
        });

        const dailyValues = Object.values(byDay);
        const daysAnalyzed = dailyValues.length;
        const totalExpense = dailyValues.reduce((s, v) => s + v, 0);
        const avgDailyExpense = totalExpense / Math.max(daysAnalyzed, 1);

        const variance = dailyValues.reduce((s, v) => s + Math.pow(v - avgDailyExpense, 2), 0) / daysAnalyzed;
        const volatility = Math.sqrt(variance);

        const avgDailyByCategory: Record<string, number> = {};
        Object.entries(byCat).forEach(([cat, total]) => {
            avgDailyByCategory[cat] = total / Math.max(daysAnalyzed, 1);
        });

        const topCatEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
        const topCategory = topCatEntry?.[0] ?? '-';
        const topCategoryPct = topCatEntry ? (topCatEntry[1] / totalExpense) * 100 : 0;

        return {
            avgDailyExpense,
            avgDailyByCategory,
            topCategory,
            topCategoryPct,
            volatility,
            daysAnalyzed,
            hasEnoughData: daysAnalyzed >= 1,
        };
    }, [transactions]);
}

// ─── Simulasi Harian ──────────────────────────────────────────────────────────

function calcDailySimulation(
    budgetInput: number,
    profile: BehaviorProfile,
    transactions: Transaction[],
): DailySimResult | null {
    if (budgetInput <= 0 || !profile.hasEnoughData) return null;

    const { avgDailyExpense, avgDailyByCategory, topCategory, topCategoryPct, volatility } = profile;

    const conservativeDaily = avgDailyExpense + volatility * 0.5;
    const estimatedDays = Math.floor(budgetInput / Math.max(conservativeDaily, 1));
    const projectedRunoutDate = addDays(new Date(), estimatedDays);

    const dailyBudgetIdeal = budgetInput / DAYS_IN_MONTH;
    const dailyBudgetSafe = (budgetInput * 0.8) / DAYS_IN_MONTH;
    const savingPerDay = Math.max(0, avgDailyExpense - dailyBudgetIdeal);
    const surplus = budgetInput - avgDailyExpense * DAYS_IN_MONTH;

    const riskLevel: 'safe' | 'warning' | 'danger' =
        estimatedDays >= 30 ? 'safe' :
            estimatedDays >= 20 ? 'warning' : 'danger';

    const totalCatSpend = Object.values(avgDailyByCategory).reduce((s, v) => s + v, 0);
    const categoryBreakdown: CategoryItem[] = Object.entries(avgDailyByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, dailyAvg]) => ({
            category: cat,
            label: CATEGORY_META[cat]?.label ?? cat,
            amount: dailyAvg * DAYS_IN_MONTH,
            percentage: totalCatSpend > 0 ? (dailyAvg / totalCatSpend) * 100 : 0,
            dailyAvg,
            color: CATEGORY_META[cat]?.color ?? '#94a3b8',
        }));

    const nonEssentialCats = Object.entries(avgDailyByCategory).filter(([cat]) => {
        const meta = CATEGORY_META[cat];
        return meta && meta.essentialPct < 0.7;
    });

    const whatIfScenarios: WhatIfScenario[] = [];

    nonEssentialCats.slice(0, 3).forEach(([cat, dailyAmt]) => {
        const meta = CATEGORY_META[cat];
        if (!meta) return;
        const reduction = dailyAmt * (1 - meta.essentialPct);
        const newDaily = avgDailyExpense - reduction;
        const newDays = Math.floor(budgetInput / Math.max(newDaily, 1));
        const extraDays = newDays - estimatedDays;
        if (extraDays > 0) {
            whatIfScenarios.push({
                label: `Kurangi ${meta.label} 60%`,
                days: newDays,
                saving: reduction * DAYS_IN_MONTH,
                description: `+${extraDays} hari lebih tahan`,
            });
        }
    });

    const totalNonEssentialSaving = Object.entries(avgDailyByCategory).reduce((sum, [cat, amt]) => {
        const meta = CATEGORY_META[cat];
        return sum + (meta ? amt * (1 - meta.essentialPct) : 0);
    }, 0);
    const maxSaveDaily = avgDailyExpense - totalNonEssentialSaving;
    const maxSaveDays = Math.floor(budgetInput / Math.max(maxSaveDaily, 1));
    if (maxSaveDays > estimatedDays) {
        whatIfScenarios.push({
            label: 'Mode Hemat Maksimal',
            days: maxSaveDays,
            saving: totalNonEssentialSaving * DAYS_IN_MONTH,
            description: `+${maxSaveDays - estimatedDays} hari lebih tahan`,
        });
    }

    const tips: Tip[] = [];

    if (riskLevel === 'danger') {
        tips.push({
            icon: '🚨',
            text: `Budget hanya cukup ${estimatedDays} hari. Harus hemat ${formatCurrency(savingPerDay)}/hari agar tahan sebulan.`,
            type: 'danger',
        });
    } else if (riskLevel === 'warning') {
        tips.push({
            icon: '⚠️',
            text: `Budget cukup ${estimatedDays} hari. Kurangi sedikit pengeluaran agar aman sampai akhir bulan.`,
            type: 'warning',
        });
    } else {
        tips.push({
            icon: '✅',
            text: `Budget aman! Dengan pola saat ini, bisa tahan ${estimatedDays} hari. Ada sisa ${formatCurrency(surplus)}.`,
            type: 'success',
        });
    }

    if (topCategoryPct > 35) {
        const topMeta = CATEGORY_META[topCategory];
        tips.push({
            icon: topMeta?.icon ?? '📊',
            text: `${topMeta?.label ?? topCategory} menyedot ${Math.round(topCategoryPct)}% pengeluaran. Pertimbangkan untuk dioptimalkan.`,
            type: 'warning',
            saving: avgDailyByCategory[topCategory] * 0.2 * DAYS_IN_MONTH,
        });
    }

    if (volatility > avgDailyExpense * 0.5) {
        tips.push({
            icon: '📈',
            text: `Pengeluaranmu tidak konsisten (±${formatCurrency(volatility)}/hari). Budget yang aman adalah +20% dari estimasi.`,
            type: 'info',
        });
    }

    tips.push({
        icon: '💡',
        text: `Jatah ideal per hari: ${formatCurrency(dailyBudgetIdeal)}. Mode aman: ${formatCurrency(dailyBudgetSafe)}/hari (ada buffer 20%).`,
        type: 'info',
    });

    return {
        budgetInput,
        avgDailyExpense,
        estimatedDays,
        projectedRunoutDate,
        dailyBudgetIdeal,
        dailyBudgetSafe,
        savingPerDay,
        surplus,
        isSafe: riskLevel === 'safe',
        riskLevel,
        tips,
        categoryBreakdown,
        whatIfScenarios,
    };
}

// ─── Simulasi Bulanan ─────────────────────────────────────────────────────────

function calcMonthlySimulation(
    budgetInput: number,
    profile: BehaviorProfile,
    installments: Installment[],
): MonthlySimResult | null {
    if (budgetInput <= 0 || !profile.hasEnoughData) return null;

    const totalInstallments = installments.reduce((s, i) => s + i.amount, 0);
    const netBudget = budgetInput - totalInstallments;
    const avgMonthlyExpense = profile.avgDailyExpense * DAYS_IN_MONTH;
    const dailyAllowance = netBudget / DAYS_IN_MONTH;
    const estimatedDays = Math.floor(netBudget / Math.max(profile.avgDailyExpense, 1));
    const projectedSaving = netBudget - avgMonthlyExpense;
    const projectedDeficit = Math.max(0, -projectedSaving);
    const breakEvenDay = estimatedDays;

    const riskLevel: 'safe' | 'warning' | 'danger' =
        projectedSaving > budgetInput * 0.2 ? 'safe' :
            projectedSaving >= 0 ? 'warning' : 'danger';

    const totalCatSpend = Object.values(profile.avgDailyByCategory).reduce((s, v) => s + v, 0) * DAYS_IN_MONTH;
    const categoryBreakdown: CategoryItem[] = Object.entries(profile.avgDailyByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, dailyAvg]) => {
            const monthlyAmt = dailyAvg * DAYS_IN_MONTH;
            return {
                category: cat,
                label: CATEGORY_META[cat]?.label ?? cat,
                amount: monthlyAmt,
                percentage: totalCatSpend > 0 ? (monthlyAmt / totalCatSpend) * 100 : 0,
                dailyAvg,
                color: CATEGORY_META[cat]?.color ?? '#94a3b8',
            };
        });

    const monthlyScenarios: MonthlyScenario[] = [
        {
            label: '😌 Santai',
            dailyLimit: profile.avgDailyExpense * 1.1,
            projectedSaving: netBudget - profile.avgDailyExpense * 1.1 * DAYS_IN_MONTH,
            daysItLasts: Math.floor(netBudget / (profile.avgDailyExpense * 1.1)),
            emoji: '😌',
        },
        {
            label: '⚖️ Seimbang',
            dailyLimit: dailyAllowance,
            projectedSaving: 0,
            daysItLasts: DAYS_IN_MONTH,
            emoji: '⚖️',
        },
        {
            label: '💰 Hemat',
            dailyLimit: dailyAllowance * 0.75,
            projectedSaving: netBudget * 0.25,
            daysItLasts: DAYS_IN_MONTH,
            emoji: '💰',
        },
        {
            label: '🔒 Super Hemat',
            dailyLimit: dailyAllowance * 0.55,
            projectedSaving: netBudget * 0.45,
            daysItLasts: DAYS_IN_MONTH,
            emoji: '🔒',
        },
    ];

    const tips: Tip[] = [];

    if (netBudget <= 0) {
        tips.push({
            icon: '🚨',
            text: `Angsuran ${formatCurrency(totalInstallments)} sudah melebihi pemasukan! Darurat finansial.`,
            type: 'danger',
        });
    } else if (riskLevel === 'danger') {
        tips.push({
            icon: '🚨',
            text: `Defisit ${formatCurrency(projectedDeficit)}/bulan. Pengeluaran rata-rata melebihi budget bersih.`,
            type: 'danger',
        });
    } else if (riskLevel === 'warning') {
        tips.push({
            icon: '⚠️',
            text: `Hampir pas-pasan. Tabungan proyeksi hanya ${formatCurrency(projectedSaving)}. Targetkan minimal 20% dari pemasukan.`,
            type: 'warning',
        });
    } else {
        tips.push({
            icon: '✅',
            text: `Sehat! Proyeksi tabungan ${formatCurrency(projectedSaving)} (${Math.round((projectedSaving / budgetInput) * 100)}% dari pemasukan).`,
            type: 'success',
        });
    }

    if (totalInstallments > budgetInput * 0.3) {
        tips.push({
            icon: '🏦',
            text: `Angsuran ${Math.round((totalInstallments / budgetInput) * 100)}% dari pemasukan. Batas aman: 30%. Pertimbangkan restrukturisasi.`,
            type: 'warning',
        });
    }

    tips.push({
        icon: '📆',
        text: `Dengan pola saat ini, budget bersih habis di hari ke-${breakEvenDay}. Jatah ideal ${formatCurrency(dailyAllowance)}/hari.`,
        type: estimatedDays >= 30 ? 'info' : 'warning',
    });

    const bigCat = categoryBreakdown[0];
    if (bigCat && bigCat.percentage > 35) {
        const potential = bigCat.amount * 0.2;
        tips.push({
            icon: CATEGORY_META[bigCat.category]?.icon ?? '📊',
            text: `Kurangi ${bigCat.label} 20% → hemat ${formatCurrency(potential)}/bulan.`,
            type: 'info',
            saving: potential,
        });
    }

    return {
        budgetInput,
        totalInstallments,
        netBudget,
        avgMonthlyExpense,
        estimatedDays,
        dailyAllowance,
        projectedSaving,
        projectedDeficit,
        isSafe: riskLevel === 'safe',
        riskLevel,
        breakEvenDay,
        tips,
        categoryBreakdown,
        monthlyScenarios,
    };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TipCard({ tip }: { tip: Tip }) {
    const colors = {
        success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
        warning: { bg: '#fffbeb', border: '#fde68a', text: '#a16207' },
        danger: { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' },
        info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    }[tip.type];

    return (
        <View style={{
            borderRadius: 16,
            padding: 12,
            marginBottom: 8,
            flexDirection: 'row',
            gap: 8,
            backgroundColor: colors.bg,
            borderWidth: 1,
            borderColor: colors.border,
        }}>
            <Text style={{ fontSize: 16 }}>{tip.icon}</Text>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>{tip.text}</Text>
                {tip.saving && tip.saving > 0 && (
                    <View style={{
                        marginTop: 4,
                        alignSelf: 'flex-start',
                        backgroundColor: 'rgba(255,255,255,0.8)',
                        borderRadius: 12,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                    }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>
                            Potensi hemat: {formatCurrency(tip.saving)}/bln
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

function CategoryBar({ item, maxAmount }: { item: CategoryItem; maxAmount: number }) {
    const barWidth = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
    return (
        <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <Text style={{ color: '#64748b', fontSize: 11, flex: 1 }} numberOfLines={1}>
                    {CATEGORY_META[item.category]?.icon ?? '📦'} {item.label}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 10 }}>{Math.round(item.percentage)}%</Text>
                    <Text style={{ color: '#334155', fontSize: 11, fontWeight: '600', width: 80, textAlign: 'right' }}>
                        {formatCurrency(item.amount)}
                    </Text>
                </View>
            </View>
            <View style={{ height: 5, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <View
                    style={{
                        height: '100%',
                        borderRadius: 4,
                        width: `${Math.min(barWidth, 100)}%`,
                        backgroundColor: item.color,
                    }}
                />
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                Rata-rata {formatCurrency(item.dailyAvg)}/hari
            </Text>
        </View>
    );
}

function ScenarioCard({ scenario, isRecommended }: { scenario: MonthlyScenario; isRecommended: boolean }) {
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;

    return (
        <View style={{
            flex: 1,
            borderRadius: 14,
            padding: 10,
            borderWidth: 1,
            backgroundColor: isRecommended ? T.accentLight : T.cardAlt,
            borderColor: isRecommended ? T.accent : T.border,
        }}>
            <Text style={{ fontSize: 18, marginBottom: 2 }}>{scenario.emoji}</Text>
            <Text style={{ fontWeight: 'bold', color: T.text, fontSize: 11, marginBottom: 2 }}>{scenario.label}</Text>
            <Text style={{ color: T.textMuted, fontSize: 10 }}>{formatCurrency(scenario.dailyLimit)}/hari</Text>
            {scenario.projectedSaving > 0 ? (
                <Text style={{ color: T.success, fontSize: 10, fontWeight: '600', marginTop: 3 }}>
                    +{formatCurrency(scenario.projectedSaving)} tabung
                </Text>
            ) : scenario.projectedSaving < 0 ? (
                <Text style={{ color: T.danger, fontSize: 10, fontWeight: '600', marginTop: 3 }}>
                    -{formatCurrency(Math.abs(scenario.projectedSaving))} defisit
                </Text>
            ) : (
                <Text style={{ color: T.accent, fontSize: 10, fontWeight: '600', marginTop: 3 }}>Pas-pasan</Text>
            )}
            {isRecommended && (
                <View style={{
                    marginTop: 3,
                    backgroundColor: T.accent,
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    alignSelf: 'flex-start',
                }}>
                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>✓ Saran</Text>
                </View>
            )}
        </View>
    );
}

// ─── Bottom Sheet Modal ──────────────────────────────────────────────────────

interface SheetConfig {
    visible: boolean;
    title: string;
    description: string;
    cancelText: string;
    confirmText: string;
    isDestructive: boolean;
    onConfirm: () => void;
}

function BottomSheet({ config, onClose, isDark }: {
    config: SheetConfig;
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
                            <Text style={{ color: config.isDestructive ? T.danger : T.accent, fontWeight: '700', fontSize: 16 }}>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function SmartBudgetSimulator({ transactions, installments = [], currentBalance = 0 }: Props) {
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;

    const [mode, setMode] = useState<SimMode>('daily');
    const [budgetInput, setBudgetInput] = useState('');
    const [showResult, setShowResult] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [selectedLifestyle, setSelectedLifestyle] = useState<string>('seimbang');
    const resultAnim = useRef(new Animated.Value(0)).current;

    const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
        visible: false,
        title: '',
        description: '',
        cancelText: '',
        confirmText: '',
        isDestructive: false,
        onConfirm: () => { },
    });

    const profile = useBehaviorProfile(transactions);

    const dailyResult = useMemo(() =>
        showResult && mode === 'daily' && budgetInput
            ? calcDailySimulation(parseFloat(budgetInput.replace(/\./g, '').replace(',', '.')), profile, transactions)
            : null,
        [showResult, mode, budgetInput, profile, transactions]
    );

    const monthlyResult = useMemo(() =>
        showResult && mode === 'monthly' && budgetInput
            ? calcMonthlySimulation(parseFloat(budgetInput.replace(/\./g, '').replace(',', '.')), profile, installments)
            : null,
        [showResult, mode, budgetInput, profile, installments]
    );

    // ── Modal Helpers ──────────────────────────────────────────────────────
    const showSheet = (config: Omit<SheetConfig, 'visible'>) => {
        setSheetConfig({ ...config, visible: true });
    };

    const closeSheet = () => {
        setSheetConfig(prev => ({ ...prev, visible: false }));
    };

    // ── Handle Lifestyle Selection ──────────────────────────────────────
    const handleSelectLifestyle = (id: string) => {
        setSelectedLifestyle(id);
        const selected = LIFESTYLE_DATA.find(l => l.id === id);
        if (selected) {
            showSheet({
                title: `✨ Gaya Hidup ${selected.label} Dipilih!`,
                description: `Kamu memilih gaya hidup ${selected.label}. Simulasi akan disesuaikan dengan preferensimu.`,
                cancelText: 'Oke, Mantap!',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
            });
        }
    };

    const handleSimulate = useCallback(() => {
        Keyboard.dismiss();
        const val = parseFloat(budgetInput.replace(/\./g, '').replace(',', '.'));
        if (!val || val <= 0) return;
        setShowResult(true);
        setShowDetail(false);
        Animated.spring(resultAnim, {
            toValue: 1, useNativeDriver: true,
            tension: 80, friction: 8,
        }).start();
    }, [budgetInput]);

    const handleReset = () => {
        setShowResult(false);
        setBudgetInput('');
        setShowDetail(false);
        resultAnim.setValue(0);
    };

    const handleInputChange = (text: string) => {
        const digits = text.replace(/\D/g, '');
        const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        setBudgetInput(formatted);
    };

    const parsedBudget = parseFloat(budgetInput.replace(/\./g, '')) || 0;
    const canSimulate = parsedBudget > 0 && profile.hasEnoughData;

    // ─── RENDER GAYA HIDUP LIST ────────────────────────────────────────────
    const renderLifestyleList = () => {
        return (
            <View style={{ gap: 8, marginBottom: 16 }}>
                {LIFESTYLE_DATA.map((item) => {
                    const isSelected = selectedLifestyle === item.id;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => handleSelectLifestyle(item.id)}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: isSelected ? item.color + '15' : T.cardAlt,
                                borderRadius: 12,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                borderWidth: 2,
                                borderColor: isSelected ? item.color : T.border,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                            }}
                        >
                            <View style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                backgroundColor: item.color + '20',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Ionicons name={item.icon as any} size={20} color={item.color} />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: isSelected ? '700' : '600',
                                    color: isSelected ? item.color : T.text,
                                }}>
                                    {item.label}
                                </Text>
                                <Text style={{
                                    fontSize: 11,
                                    color: T.textMuted,
                                    marginTop: 1,
                                }}>
                                    {item.description}
                                </Text>
                            </View>

                            {isSelected && (
                                <View style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor: item.color,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    // ─── RENDER HARIAN ──────────────────────────────────────────────────────────
    const renderDailyResult = (result: DailySimResult) => {
        const maxCatAmount = result.categoryBreakdown[0]?.amount ?? 1;
        return (
            <Animated.View style={{
                opacity: resultAnim,
                transform: [{ translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }}>
                <View style={{
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 12,
                    backgroundColor: riskBg(result.riskLevel),
                    borderWidth: 1.5,
                    borderColor: riskBorder(result.riskLevel),
                }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', marginBottom: 4, color: riskColor(result.riskLevel) }}>
                        {result.riskLevel === 'safe' ? '✅ Budget Aman' : result.riskLevel === 'warning' ? '⚠️ Perhatian' : '🚨 Risiko Tinggi'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
                        <Text style={{ fontSize: 44, fontWeight: '900', color: riskColor(result.riskLevel), lineHeight: 52 }}>
                            {result.estimatedDays}
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: riskColor(result.riskLevel) }}>hari</Text>
                    </View>
                    <Text style={{ color: '#475569', fontSize: 12 }}>
                        Budget <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{formatCurrency(result.budgetInput)}</Text> cukup
                        hingga <Text style={{ fontWeight: '600', color: '#1e293b' }}>{formatDateShort(result.projectedRunoutDate)}</Text>
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                        Berdasarkan rata-rata pengeluaranmu {formatCurrency(result.avgDailyExpense)}/hari
                    </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                    <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10, borderWidth: 0.5, borderColor: '#f1f5f9' }}>
                        <Text style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2 }}>Jatah ideal/hari</Text>
                        <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 13 }}>{formatCurrency(result.dailyBudgetIdeal)}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 9, marginTop: 1 }}>agar 30 hari</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10, borderWidth: 0.5, borderColor: '#f1f5f9' }}>
                        <Text style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2 }}>Mode aman/hari</Text>
                        <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>{formatCurrency(result.dailyBudgetSafe)}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 9, marginTop: 1 }}>+ buffer 20%</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10, borderWidth: 0.5, borderColor: '#f1f5f9' }}>
                        <Text style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2 }}>{result.surplus >= 0 ? 'Surplus' : 'Defisit'}</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: result.surplus >= 0 ? '#10b981' : '#ef4444' }}>
                            {formatCurrency(Math.abs(result.surplus))}
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 9, marginTop: 1 }}>di akhir bulan</Text>
                    </View>
                </View>

                <Text style={{ color: '#334155', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>💡 Analisis & Saran</Text>
                {result.tips.map((tip, i) => <TipCard key={i} tip={tip} />)}

                <TouchableOpacity
                    onPress={() => setShowDetail(!showDetail)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginTop: 2 }}
                    activeOpacity={0.7}
                >
                    <Text style={{ color: '#6366f1', fontSize: 12, fontWeight: '600' }}>
                        {showDetail ? 'Sembunyikan detail' : 'Lihat detail & skenario'}
                    </Text>
                    <Ionicons name={showDetail ? 'chevron-up' : 'chevron-down'} size={14} color="#6366f1" />
                </TouchableOpacity>

                {showDetail && (
                    <View>
                        <Text style={{ color: '#334155', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>📊 Rincian per Kategori</Text>
                        {result.categoryBreakdown.map((item, i) => (
                            <CategoryBar key={i} item={item} maxAmount={maxCatAmount} />
                        ))}

                        {result.whatIfScenarios.length > 0 && (
                            <>
                                <Text style={{ color: '#334155', fontWeight: 'bold', fontSize: 13, marginTop: 12, marginBottom: 8 }}>🔮 Simulasi "Bagaimana Jika..."</Text>
                                {result.whatIfScenarios.map((s, i) => (
                                    <View key={i} style={{ backgroundColor: '#eef2ff', borderColor: '#c7d2fe', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Text style={{ color: '#3730a3', fontWeight: '600', fontSize: 12, flex: 1 }}>{s.label}</Text>
                                            <View style={{ backgroundColor: '#3b6ef5', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{s.days} hari</Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: '#4338ca', fontSize: 10, marginTop: 2 }}>{s.description}</Text>
                                        <Text style={{ color: '#6366f1', fontSize: 10, marginTop: 1 }}>
                                            Hemat {formatCurrency(s.saving)}/bulan
                                        </Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                )}
            </Animated.View>
        );
    };

    // ─── RENDER BULANAN ─────────────────────────────────────────────────────────
    const renderMonthlyResult = (result: MonthlySimResult) => {
        const maxCatAmount = result.categoryBreakdown[0]?.amount ?? 1;
        const recommendedIdx = result.monthlyScenarios.findIndex(s => s.daysItLasts >= 30 && s.projectedSaving >= 0);

        return (
            <Animated.View style={{
                opacity: resultAnim,
                transform: [{ translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }}>
                <View style={{
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 12,
                    backgroundColor: riskBg(result.riskLevel),
                    borderWidth: 1.5,
                    borderColor: riskBorder(result.riskLevel),
                }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', marginBottom: 4, color: riskColor(result.riskLevel) }}>
                        {result.riskLevel === 'safe' ? '✅ Keuangan Sehat' : result.riskLevel === 'warning' ? '⚠️ Perlu Perhatian' : '🚨 Kondisi Kritis'}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
                        <Text style={{ fontSize: 38, fontWeight: '900', color: riskColor(result.riskLevel), lineHeight: 46 }}>
                            {result.estimatedDays >= 30 ? '30+' : result.estimatedDays}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: riskColor(result.riskLevel) }}>hari</Text>
                    </View>
                    <Text style={{ color: '#475569', fontSize: 12, marginBottom: 8 }}>
                        Budget bersih <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{formatCurrency(result.netBudget)}</Text> cukup
                        {result.estimatedDays >= 30 ? ' hingga akhir bulan ✨' : ` sampai hari ke-${result.estimatedDays}`}
                    </Text>

                    <View style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 14, padding: 10, gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>Pemasukan/budget</Text>
                            <Text style={{ color: '#1e293b', fontWeight: '600', fontSize: 10 }}>{formatCurrency(result.budgetInput)}</Text>
                        </View>
                        {result.totalInstallments > 0 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#ef4444', fontSize: 10 }}>- Angsuran</Text>
                                <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 10 }}>({formatCurrency(result.totalInstallments)})</Text>
                            </View>
                        )}
                        <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 2 }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#334155', fontWeight: '600', fontSize: 10 }}>Budget bersih</Text>
                            <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 10 }}>{formatCurrency(result.netBudget)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>Jatah/hari</Text>
                            <Text style={{ color: '#334155', fontWeight: '600', fontSize: 10 }}>{formatCurrency(result.dailyAllowance)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#334155', fontWeight: '600', fontSize: 10 }}>
                                {result.projectedSaving >= 0 ? 'Proyeksi tabungan' : 'Proyeksi defisit'}
                            </Text>
                            <Text style={{ fontWeight: 'bold', fontSize: 10, color: result.projectedSaving >= 0 ? '#10b981' : '#ef4444' }}>
                                {result.projectedSaving >= 0 ? '+' : '-'}{formatCurrency(Math.abs(result.projectedSaving))}
                            </Text>
                        </View>
                    </View>
                </View>

                <Text style={{ color: '#334155', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>🎯 Pilih Gaya Hidup Bulan Ini</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {result.monthlyScenarios.map((s, i) => (
                        <View key={i} style={{ flex: 1, minWidth: '45%' }}>
                            <ScenarioCard scenario={s} isRecommended={i === recommendedIdx} />
                        </View>
                    ))}
                </View>

                <Text style={{ color: '#334155', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>💡 Analisis & Saran</Text>
                {result.tips.map((tip, i) => <TipCard key={i} tip={tip} />)}

                <TouchableOpacity
                    onPress={() => setShowDetail(!showDetail)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginTop: 2 }}
                    activeOpacity={0.7}
                >
                    <Text style={{ color: '#6366f1', fontSize: 12, fontWeight: '600' }}>
                        {showDetail ? 'Sembunyikan' : 'Rincian per kategori'}
                    </Text>
                    <Ionicons name={showDetail ? 'chevron-up' : 'chevron-down'} size={14} color="#6366f1" />
                </TouchableOpacity>

                {showDetail && (
                    <View>
                        <Text style={{ color: '#334155', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>📊 Rincian Bulanan per Kategori</Text>
                        {result.categoryBreakdown.map((item, i) => (
                            <CategoryBar key={i} item={item} maxAmount={maxCatAmount} />
                        ))}

                        <Text style={{ color: '#334155', fontWeight: 'bold', fontSize: 13, marginTop: 12, marginBottom: 8 }}>📅 Proyeksi Aliran Dana</Text>
                        {[7, 14, 21, 30].map(day => {
                            const spent = result.avgMonthlyExpense * (day / 30);
                            const remaining = result.netBudget - spent;
                            const pct = Math.max(0, Math.min(100, (remaining / result.netBudget) * 100));
                            return (
                                <View key={day} style={{ marginBottom: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <Text style={{ color: '#64748b', fontSize: 10 }}>Hari ke-{day}</Text>
                                        <Text style={{ fontSize: 10, fontWeight: '600', color: remaining >= 0 ? '#334155' : '#ef4444' }}>
                                            {remaining >= 0 ? `Sisa ${formatCurrency(remaining)}` : `Defisit ${formatCurrency(Math.abs(remaining))}`}
                                        </Text>
                                    </View>
                                    <View style={{ height: 4, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                        <View
                                            style={{
                                                height: '100%',
                                                borderRadius: 3,
                                                width: `${pct}%`,
                                                backgroundColor: pct > 50 ? '#10b981' : pct > 25 ? '#f59e0b' : '#ef4444',
                                            }}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </Animated.View>
        );
    };

    // ─── MAIN RENDER ────────────────────────────────────────────────────────────

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Bottom Sheet Modal */}
            <BottomSheet config={sheetConfig} onClose={closeSheet} isDark={isDark} />

            <View style={{ marginHorizontal: 10 }}>
                <View style={{
                    backgroundColor: T.card,
                    borderRadius: 20,
                    borderWidth: 0.5,
                    borderColor: T.border,
                    overflow: 'hidden',
                }}>

                    {/* Header */}
                    <View style={{
                        paddingHorizontal: 14,
                        paddingTop: 14,
                        paddingBottom: 12,
                        borderBottomWidth: 0.5,
                        borderBottomColor: T.borderLight,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <View style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: T.accentLight,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Text style={{ fontSize: 16 }}>🧮</Text>
                            </View>
                            <View>
                                <Text style={{ fontWeight: 'bold', fontSize: 14, color: T.text }}>Simulator Budget</Text>
                                <Text style={{ color: T.textMuted, fontSize: 10 }}>Berdasarkan perilaku pengeluaran nyata</Text>
                            </View>
                        </View>

                        {/* Tab Mode */}
                        <View style={{
                            flexDirection: 'row',
                            backgroundColor: isDark ? DARK.bg : '#f1f5f9',
                            borderRadius: 20,
                            padding: 3,
                        }}>
                            {(['daily', 'monthly'] as SimMode[]).map(m => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => { setMode(m); setShowResult(false); setBudgetInput(''); setShowDetail(false); resultAnim.setValue(0); }}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 6,
                                        borderRadius: 16,
                                        backgroundColor: mode === m ? T.card : 'transparent',
                                        shadowColor: mode === m ? '#000' : 'transparent',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 4,
                                        elevation: mode === m ? 2 : 0,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{
                                        textAlign: 'center',
                                        fontSize: 12,
                                        fontWeight: '600',
                                        color: mode === m ? T.accent : T.textMuted,
                                    }}>
                                        {m === 'daily' ? '📅 Harian' : '📊 Bulanan'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>

                            {/* ─── LIST GAYA HIDUP ─── */}
                            <View style={{
                                backgroundColor: T.cardAlt,
                                borderRadius: 14,
                                padding: 12,
                                marginBottom: 12,
                                borderWidth: 0.5,
                                borderColor: T.border,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Ionicons name="color-palette-outline" size={16} color={T.accent} />
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>
                                        Pilih Gaya Hidup
                                    </Text>
                                    <View style={{
                                        backgroundColor: T.accentLight,
                                        borderRadius: 10,
                                        paddingHorizontal: 6,
                                        paddingVertical: 1,
                                    }}>
                                        <Text style={{ fontSize: 8, color: T.accent, fontWeight: '600' }}>
                                            {selectedLifestyle ? '✓ Terpilih' : 'Pilih'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={{ fontSize: 10, color: T.textMuted, marginBottom: 10 }}>
                                    Pilih gaya hidup untuk simulasi yang lebih akurat
                                </Text>
                                {renderLifestyleList()}
                            </View>

                            {/* No data warning */}
                            {!profile.hasEnoughData && (
                                <View style={{
                                    backgroundColor: '#fffbeb',
                                    borderWidth: 1,
                                    borderColor: '#fde68a',
                                    borderRadius: 14,
                                    padding: 12,
                                    marginBottom: 12,
                                    flexDirection: 'row',
                                    gap: 8,
                                }}>
                                    <Text style={{ fontSize: 16 }}>📊</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#a16207', fontSize: 11, fontWeight: '600' }}>Data masih sedikit</Text>
                                        <Text style={{ color: '#b45309', fontSize: 10, marginTop: 1, lineHeight: 14 }}>
                                            Tambahkan minimal 1 hari transaksi untuk simulasi.
                                            ({profile.daysAnalyzed} hari teranalisis)
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Input */}
                            {!showResult ? (
                                <View>
                                    <Text style={{ fontWeight: '600', fontSize: 13, color: T.text, marginBottom: 2 }}>
                                        {mode === 'daily'
                                            ? '💵 Masukkan budget atau pemasukan hari ini'
                                            : '💰 Masukkan pemasukan bulan ini'}
                                    </Text>
                                    <Text style={{ color: T.textMuted, fontSize: 10, marginBottom: 8 }}>
                                        {mode === 'daily'
                                            ? 'Sistem akan menghitung cukup berapa hari berdasarkan kebiasaan pengeluaranmu'
                                            : 'Sistem akan kalkulasi proyeksi setelah potong angsuran & pengeluaran rutin'}
                                    </Text>

                                    {currentBalance > 0 && (
                                        <TouchableOpacity
                                            onPress={() => setBudgetInput(currentBalance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 6,
                                                backgroundColor: T.accentLight,
                                                borderWidth: 0.5,
                                                borderColor: T.accent,
                                                borderRadius: 12,
                                                paddingHorizontal: 10,
                                                paddingVertical: 8,
                                                marginBottom: 8,
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="wallet-outline" size={14} color={T.accent} />
                                            <Text style={{ color: T.accent, fontSize: 11, flex: 1 }}>
                                                Gunakan saldo: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(currentBalance)}</Text>
                                            </Text>
                                            <Ionicons name="chevron-forward" size={12} color={T.accent} />
                                        </TouchableOpacity>
                                    )}

                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: isDark ? DARK.bg : '#f8fafc',
                                        borderWidth: 2,
                                        borderColor: isDark ? DARK.border : '#e2e8f0',
                                        borderRadius: 14,
                                        paddingHorizontal: 12,
                                        marginBottom: 10,
                                    }}>
                                        <Text style={{ color: T.textMuted, fontWeight: '500', fontSize: 14, marginRight: 6 }}>Rp</Text>
                                        <TextInput
                                            style={{
                                                flex: 1,
                                                paddingVertical: 12,
                                                fontSize: 18,
                                                fontWeight: 'bold',
                                                color: T.text,
                                            }}
                                            placeholder="0"
                                            placeholderTextColor={T.textMuted}
                                            keyboardType="numeric"
                                            value={budgetInput}
                                            onChangeText={handleInputChange}
                                            returnKeyType="done"
                                            onSubmitEditing={handleSimulate}
                                        />
                                        {budgetInput.length > 0 && (
                                            <TouchableOpacity onPress={() => setBudgetInput('')}>
                                                <Ionicons name="close-circle" size={18} color={T.textMuted} />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {profile.hasEnoughData && (
                                        <View style={{
                                            backgroundColor: isDark ? DARK.cardAlt : '#f8fafc',
                                            borderRadius: 14,
                                            padding: 10,
                                            marginBottom: 10,
                                            borderWidth: 0.5,
                                            borderColor: T.border,
                                        }}>
                                            <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 4 }}>
                                                📈 Profil pengeluaranmu ({profile.daysAnalyzed} hari terakhir)
                                            </Text>
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: T.textMuted, fontSize: 9 }}>Rata-rata/hari</Text>
                                                    <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 12 }}>
                                                        {formatCurrency(profile.avgDailyExpense)}
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: T.textMuted, fontSize: 9 }}>Terbesar</Text>
                                                    <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 12 }}>
                                                        {CATEGORY_META[profile.topCategory]?.label ?? profile.topCategory}
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: T.textMuted, fontSize: 9 }}>Fluktuasi</Text>
                                                    <Text style={{
                                                        fontWeight: 'bold',
                                                        fontSize: 12,
                                                        color: profile.volatility > profile.avgDailyExpense * 0.5 ? T.warning : T.success,
                                                    }}>
                                                        ±{formatCurrency(profile.volatility)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        onPress={handleSimulate}
                                        disabled={!canSimulate}
                                        style={{
                                            paddingVertical: 14,
                                            borderRadius: 14,
                                            alignItems: 'center',
                                            backgroundColor: canSimulate ? T.accent : '#e2e8f0',
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={{
                                            fontWeight: 'bold',
                                            fontSize: 14,
                                            color: canSimulate ? '#fff' : T.textMuted,
                                        }}>
                                            🚀 Simulasikan Sekarang
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    {mode === 'daily' && dailyResult && renderDailyResult(dailyResult)}
                                    {mode === 'monthly' && monthlyResult && renderMonthlyResult(monthlyResult)}

                                    <TouchableOpacity
                                        onPress={handleReset}
                                        style={{
                                            marginTop: 8,
                                            paddingVertical: 12,
                                            borderRadius: 14,
                                            borderWidth: 1,
                                            borderColor: T.border,
                                            alignItems: 'center',
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="refresh-outline" size={16} color={T.textMuted} />
                                            <Text style={{ color: T.textMuted, fontWeight: '500', fontSize: 12 }}>Simulasi ulang</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}