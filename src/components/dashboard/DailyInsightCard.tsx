// src/components/dashboard/DailyInsightCard.tsx
// Insight dinamis kontekstual — 1 kartu, teks berubah sesuai kondisi hari ini

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Installment, Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface Props {
    transactions: Transaction[];
    installments?: Installment[];
    balance: number;
    totalIncome: number;
    totalExpense: number;
}

type InsightLevel = 'success' | 'warning' | 'danger' | 'info';

interface Insight {
    level: InsightLevel;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    action?: { label: string; route: string };
}

const LEVEL_STYLES: Record<InsightLevel, { bg: string; border: string; icon: string; text: string; sub: string }> = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#10b981', text: '#15803d', sub: '#166534' },
    warning: { bg: '#fffbeb', border: '#fde68a', icon: '#f59e0b', text: '#a16207', sub: '#92400e' },
    danger: { bg: '#fff1f2', border: '#fecdd3', icon: '#ef4444', text: '#be123c', sub: '#9f1239' },
    info: { bg: '#eff6ff', border: '#bfdbfe', icon: '#3b82f6', text: '#1d4ed8', sub: '#1e40af' },
};

function buildInsight(
    transactions: Transaction[],
    installments: Installment[],
    balance: number,
    totalIncome: number,
    totalExpense: number,
): Insight {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - dayOfMonth;

    // Pengeluaran hari ini
    const todayExpenses = transactions.filter(t => {
        const d = new Date(t.created_at);
        return t.type === 'EXPENSE' && d >= today;
    });
    const todayTotal = todayExpenses.reduce((s, t) => s + t.amount, 0);

    // Rata-rata harian bulan ini
    const monthExpenses = transactions.filter(t => {
        const d = new Date(t.created_at);
        return t.type === 'EXPENSE' && d >= startOfMonth;
    });
    const monthTotal = monthExpenses.reduce((s, t) => s + t.amount, 0);
    const avgDaily = dayOfMonth > 1 ? monthTotal / (dayOfMonth - 1) : monthTotal;

    // Angsuran jatuh tempo dalam 3 hari
    const dueSoon = installments.filter(i => {
        const daysUntilDue = i.due_date - dayOfMonth;
        return daysUntilDue >= 0 && daysUntilDue <= 3;
    });
    const overdue = installments.filter(i => i.due_date < dayOfMonth);

    // ── Prioritas insight: danger > warning > success > info ──────────────

    // 1. Angsuran terlewat
    if (overdue.length > 0) {
        const names = overdue.map(i => i.name).join(', ');
        return {
            level: 'danger',
            icon: 'alert-circle-outline',
            title: `${overdue.length} angsuran terlewat!`,
            subtitle: `${names} — segera bayar untuk hindari denda.`,
            action: { label: 'Lihat angsuran', route: '/(tabs)' },
        };
    }

    // 2. Saldo hampir habis
    if (balance < 100000) {
        return {
            level: 'danger',
            icon: 'warning-outline',
            title: `Saldo tinggal ${formatCurrency(balance)}`,
            subtitle: 'Segera isi saldo atau kurangi pengeluaran hari ini.',
        };
    }

    // 3. Saldo negatif
    if (balance < 0) {
        return {
            level: 'danger',
            icon: 'alert-circle-outline',
            title: `Saldo negatif ${formatCurrency(Math.abs(balance))}`,
            subtitle: 'Segera evaluasi pengeluaran dan cari solusi!',
        };
    }

    // 4. Angsuran jatuh tempo segera
    if (dueSoon.length > 0) {
        const nearest = dueSoon[0];
        const daysUntil = nearest.due_date - dayOfMonth;
        return {
            level: 'warning',
            icon: 'calendar-outline',
            title: `Angsuran "${nearest.name}" ${daysUntil === 0 ? 'jatuh tempo hari ini' : `${daysUntil} hari lagi`}`,
            subtitle: `Siapkan ${formatCurrency(nearest.amount)} sebelum tgl ${nearest.due_date}.`,
            action: { label: 'Lihat angsuran', route: '/(tabs)' },
        };
    }

    // 5. Pengeluaran hari ini vs rata-rata
    if (todayTotal > 0 && avgDaily > 0) {
        const diff = ((todayTotal - avgDaily) / avgDaily) * 100;
        if (diff > 30) {
            return {
                level: 'warning',
                icon: 'trending-up-outline',
                title: `Hari ini lebih boros ${Math.round(diff)}% dari biasanya`,
                subtitle: `Sudah ${formatCurrency(todayTotal)}, rata-rata harian ${formatCurrency(avgDaily)}.`,
                action: { label: 'Lihat detail', route: '/transactions' },
            };
        }
        if (diff < -20) {
            return {
                level: 'success',
                icon: 'trending-down-outline',
                title: `Hari ini lebih hemat ${Math.round(Math.abs(diff))}% 🎉`,
                subtitle: `Baru ${formatCurrency(todayTotal)}, jauh di bawah rata-rata ${formatCurrency(avgDaily)}.`,
            };
        }
    }

    // 6. Hari ini belum ada transaksi
    if (todayExpenses.length === 0 && todayTotal === 0) {
        return {
            level: 'info',
            icon: 'add-circle-outline',
            title: 'Belum ada transaksi hari ini',
            subtitle: 'Catat pengeluaranmu agar keuangan tetap terpantau.',
            action: { label: 'Catat sekarang', route: '/transactions/add-expense' },
        };
    }

    // 7. Budget sisa bulan
    if (daysLeft > 0 && balance > 0) {
        const dailyBudget = balance / daysLeft;
        if (dailyBudget < avgDaily && avgDaily > 0) {
            return {
                level: 'warning',
                icon: 'calculator-outline',
                title: `Batasi pengeluaran ${formatCurrency(dailyBudget)}/hari`,
                subtitle: `Saldo ${formatCurrency(balance)} untuk ${daysLeft} hari ke depan.`,
            };
        } else {
            return {
                level: 'success',
                icon: 'checkmark-circle-outline',
                title: `Jatah aman ${formatCurrency(dailyBudget)}/hari`,
                subtitle: `Saldo ${formatCurrency(balance)} cukup untuk ${daysLeft} hari.`,
            };
        }
    }

    // 8. Default — tabungan bulan ini
    const savingAmount = totalIncome - totalExpense;
    const savingRate = totalIncome > 0 ? (savingAmount / totalIncome) * 100 : 0;

    if (savingRate >= 20) {
        return {
            level: 'success',
            icon: 'shield-checkmark-outline',
            title: `Tabungan bulan ini ${Math.round(savingRate)}% — luar biasa!`,
            subtitle: `Sudah hemat ${formatCurrency(savingAmount)} dari ${formatCurrency(totalIncome)} pemasukan.`,
            action: { label: 'Lihat analitik', route: '/(tabs)/analytics' },
        };
    } else if (savingRate >= 10) {
        return {
            level: 'info',
            icon: 'analytics-outline',
            title: `Tabungan baru ${Math.round(savingRate)}%, targetkan 20%`,
            subtitle: `Tabungan ${formatCurrency(savingAmount)} dari ${formatCurrency(totalIncome)} pemasukan.`,
            action: { label: 'Lihat analitik', route: '/(tabs)/analytics' },
        };
    } else {
        return {
            level: 'warning',
            icon: 'trending-down-outline',
            title: `Tabungan hanya ${Math.round(savingRate)}% dari pemasukan`,
            subtitle: `Coba kurangi pengeluaran agar tabungan meningkat.`,
            action: { label: 'Lihat analitik', route: '/(tabs)/analytics' },
        };
    }
}

export function DailyInsightCard({ transactions, installments = [], balance, totalIncome, totalExpense }: Props) {
    const insight = useMemo(
        () => buildInsight(transactions, installments, balance, totalIncome, totalExpense),
        [transactions, installments, balance, totalIncome, totalExpense]
    );

    const s = LEVEL_STYLES[insight.level];

    return (
        <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: s.bg,
                borderWidth: 1,
                borderColor: s.border,
                borderRadius: 16,
                padding: 14,
            }}>
                {/* Icon */}
                <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: s.icon + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <Ionicons name={insight.icon} size={20} color={s.icon} />
                </View>

                {/* Text */}
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: s.text, lineHeight: 18 }}>
                        {insight.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: s.sub, marginTop: 2, lineHeight: 17 }}>
                        {insight.subtitle}
                    </Text>
                </View>

                {/* Action Button */}
                {insight.action && (
                    <TouchableOpacity
                        onPress={() => router.push(insight.action!.route as any)}
                        style={{
                            backgroundColor: s.icon + '20',
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            flexShrink: 0,
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: s.text }}>
                            {insight.action.label}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}