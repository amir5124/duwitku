// src/components/dashboard/MiniSpendingChart.tsx
// Bar chart pengeluaran 7 hari terakhir — langsung di beranda

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface Props {
    transactions: Transaction[];
}

interface DayData {
    label: string;     // 'Sen', 'Sel', dst
    date: string;      // YYYY-MM-DD
    amount: number;
    isToday: boolean;
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getLast7Days(): DayData[] {
    const days: DayData[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        days.push({
            label: DAY_LABELS[d.getDay()],
            date: dateStr,
            amount: 0,
            isToday: i === 0,
        });
    }
    return days;
}

export function MiniSpendingChart({ transactions }: Props) {
    const chartData = useMemo<DayData[]>(() => {
        const days = getLast7Days();
        const byDay: Record<string, number> = {};

        transactions.forEach(t => {
            if (t.type !== 'EXPENSE') return;
            const dateStr = new Date(t.created_at).toISOString().slice(0, 10);
            byDay[dateStr] = (byDay[dateStr] || 0) + t.amount;
        });

        days.forEach(d => { d.amount = byDay[d.date] || 0; });
        return days;
    }, [transactions]);

    const maxAmount = Math.max(...chartData.map(d => d.amount), 1);
    const totalWeek = chartData.reduce((s, d) => s + d.amount, 0);
    const avgDay = totalWeek / 7;

    // Bandingkan minggu ini vs 7 hari sebelumnya
    const prevWeekTotal = useMemo(() => {
        const now = new Date();
        const since = new Date(now);
        since.setDate(since.getDate() - 14);
        const until = new Date(now);
        until.setDate(until.getDate() - 7);
        return transactions
            .filter(t => {
                if (t.type !== 'EXPENSE') return false;
                const d = new Date(t.created_at);
                return d >= since && d < until;
            })
            .reduce((s, t) => s + t.amount, 0);
    }, [transactions]);

    const vsLastWeek = prevWeekTotal > 0
        ? Math.round(((totalWeek - prevWeekTotal) / prevWeekTotal) * 100)
        : null;

    const hasData = chartData.some(d => d.amount > 0);

    return (
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Pengeluaran 7 Hari</Text>
                    {hasData && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                Total {formatCurrency(totalWeek)}
                            </Text>
                            {vsLastWeek !== null && (
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 2,
                                    backgroundColor: vsLastWeek > 0 ? '#fff1f2' : '#f0fdf4',
                                    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
                                }}>
                                    <Ionicons
                                        name={vsLastWeek > 0 ? 'trending-up' : 'trending-down'}
                                        size={11}
                                        color={vsLastWeek > 0 ? '#ef4444' : '#10b981'}
                                    />
                                    <Text style={{
                                        fontSize: 10, fontWeight: '600',
                                        color: vsLastWeek > 0 ? '#be123c' : '#15803d',
                                    }}>
                                        {Math.abs(vsLastWeek)}% vs minggu lalu
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')} activeOpacity={0.7}>
                    <Text style={{ fontSize: 13, color: '#6366f1' }}>Detail</Text>
                </TouchableOpacity>
            </View>

            {/* Chart card */}
            <View style={{
                backgroundColor: '#fff', borderRadius: 20,
                borderWidth: 1, borderColor: '#f1f5f9',
                padding: 16,
            }}>
                {!hasData ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                        <Ionicons name="bar-chart-outline" size={32} color="#d1d5db" />
                        <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>
                            Belum ada data pengeluaran minggu ini
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Bars */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80, marginBottom: 8 }}>
                            {chartData.map((day, i) => {
                                const barH = maxAmount > 0 ? Math.max((day.amount / maxAmount) * 72, day.amount > 0 ? 4 : 0) : 0;
                                const isHighest = day.amount === maxAmount && day.amount > 0;
                                const barColor = day.isToday
                                    ? '#3b6ef5'
                                    : isHighest
                                        ? '#ef4444'
                                        : '#a5b4fc';

                                return (
                                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 80 }}>
                                        {/* Tooltip amount di atas bar tertinggi */}
                                        {isHighest && day.amount > 0 && (
                                            <View style={{
                                                position: 'absolute', top: 0,
                                                backgroundColor: '#1f2937', borderRadius: 6,
                                                paddingHorizontal: 5, paddingVertical: 2,
                                            }}>
                                                <Text style={{ fontSize: 9, color: '#fff', fontWeight: '600' }}>
                                                    {formatCurrency(day.amount)}
                                                </Text>
                                            </View>
                                        )}
                                        {/* Bar */}
                                        <View style={{
                                            width: '100%', height: barH,
                                            backgroundColor: barColor,
                                            borderRadius: 5,
                                            opacity: day.amount === 0 ? 0.15 : 1,
                                        }} />
                                    </View>
                                );
                            })}
                        </View>

                        {/* Day labels */}
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {chartData.map((day, i) => (
                                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={{
                                        fontSize: 10, fontWeight: day.isToday ? '700' : '400',
                                        color: day.isToday ? '#3b6ef5' : '#9ca3af',
                                    }}>
                                        {day.isToday ? 'Hari\nini' : day.label}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Average line indicator */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                            marginTop: 12, paddingTop: 12,
                            borderTopWidth: 0.5, borderTopColor: '#f1f5f9',
                        }}>
                            <View style={{ width: 16, height: 2, backgroundColor: '#6366f1', borderRadius: 1 }} />
                            <Text style={{ fontSize: 11, color: '#6b7280' }}>
                                Rata-rata harian: <Text style={{ fontWeight: '600', color: '#374151' }}>{formatCurrency(avgDay)}</Text>
                            </Text>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}