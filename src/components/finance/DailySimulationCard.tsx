// src/components/finance/DailySimulationCard.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { voiceAssistant } from '../../services/voiceAssistant';
import { Installment, Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface Props {
    transactions: Transaction[];
    balance: number;
    installments?: Installment[];
    monthlyIncome?: number;
}

interface DailySimulationResult {
    avgDailyExpense: number;
    todayExpense: number;
    thisMonthExpense: number;
    remainingDays: number;
    estimatedNeed: number;
    surplus: number;
    isSafe: boolean;
    topCategory: string;
    topCategoryAmount: number;
    dailyBudgetIdeal: number;
    currentDayOfMonth: number;
    daysInMonth: number;
    burnRate: number;
}

interface MonthlySimulationResult {
    totalIncome: number;
    totalExpense: number;
    totalInstallments: number;
    netSavings: number;
    projectedEndBalance: number;
    isProjectedSafe: boolean;
    topExpenseCategory: string;
    topExpenseAmount: number;
    categoryBreakdown: { category: string; amount: number; percentage: number }[];
    vsLastMonth: { percentage: number; isIncreased: boolean };
    recommendations: string[];
    savingPotential: number;
}

const CATEGORY_LABELS: Record<string, string> = {
    FOOD: 'Makanan',
    TRANSPORT: 'Transportasi',
    SHOPPOPPING: 'Belanja',
    BILLS: 'Tagihan',
    HEALTH: 'Kesehatan',
    EDUCATION: 'Pendidikan',
    ENTERTAINMENT: 'Hiburan',
    SAVINGS: 'Tabungan',
    OTHER: 'Lainnya',
};

type TabType = 'daily' | 'monthly';

export function DailySimulationCard({ transactions, balance, installments = [], monthlyIncome = 0 }: Props) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('daily');

    // ============ SIMULASI HARIAN ============
    const dailySimulation = useMemo<DailySimulationResult>(() => {
        const now = new Date();
        const currentDay = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const remainingDays = daysInMonth - currentDay;

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthExpenses = transactions.filter(t => {
            const tDate = new Date(t.created_at);
            return t.type === 'EXPENSE' && tDate >= startOfMonth;
        });

        const thisMonthExpense = thisMonthExpenses.reduce((sum, t) => sum + t.amount, 0);

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayExpense = thisMonthExpenses
            .filter(t => new Date(t.created_at) >= startOfToday)
            .reduce((sum, t) => sum + t.amount, 0);

        const daysPassed = Math.max(currentDay, 1);
        const avgDailyExpense = thisMonthExpense / daysPassed;
        const estimatedNeed = avgDailyExpense * remainingDays;
        const surplus = balance - estimatedNeed;
        const dailyBudgetIdeal = remainingDays > 0 ? balance / remainingDays : 0;

        const categoryTotals: Record<string, number> = {};
        thisMonthExpenses.forEach(t => {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        });
        const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
        const topCategory = topCategoryEntry ? CATEGORY_LABELS[topCategoryEntry[0]] || topCategoryEntry[0] : '-';
        const topCategoryAmount = topCategoryEntry ? topCategoryEntry[1] : 0;

        const estimatedMonthlyIncome = balance + thisMonthExpense;
        const burnRate = estimatedMonthlyIncome > 0
            ? Math.round((thisMonthExpense / estimatedMonthlyIncome) * 100)
            : 0;

        return {
            avgDailyExpense,
            todayExpense,
            thisMonthExpense,
            remainingDays,
            estimatedNeed,
            surplus,
            isSafe: surplus >= 0,
            topCategory,
            topCategoryAmount,
            dailyBudgetIdeal,
            currentDayOfMonth: currentDay,
            daysInMonth,
            burnRate,
        };
    }, [transactions, balance]);

    // ============ SIMULASI BULANAN ============
    const monthlySimulation = useMemo<MonthlySimulationResult>(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const thisMonthTransactions = transactions.filter(t => {
            const tDate = new Date(t.created_at);
            return tDate >= startOfMonth;
        });

        const lastMonthTransactions = transactions.filter(t => {
            const tDate = new Date(t.created_at);
            return tDate >= startOfLastMonth && tDate <= endOfLastMonth;
        });

        const totalIncome = thisMonthTransactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => sum + t.amount, 0) + monthlyIncome;

        const totalExpense = thisMonthTransactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalInstallmentsAmount = installments.reduce((sum, i) => sum + i.amount, 0);
        const netSavings = totalIncome - totalExpense - totalInstallmentsAmount;
        const projectedEndBalance = balance - totalInstallmentsAmount;

        const categoryTotals: Record<string, number> = {};
        thisMonthTransactions
            .filter(t => t.type === 'EXPENSE')
            .forEach(t => {
                categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
            });

        const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
        const topExpenseCategory = topCategoryEntry ? CATEGORY_LABELS[topCategoryEntry[0]] || topCategoryEntry[0] : '-';
        const topExpenseAmount = topCategoryEntry ? topCategoryEntry[1] : 0;

        const categoryBreakdown = Object.entries(categoryTotals)
            .map(([cat, amount]) => ({
                category: CATEGORY_LABELS[cat] || cat,
                amount,
                percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        const lastMonthExpense = lastMonthTransactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + t.amount, 0);

        let vsLastMonth = { percentage: 0, isIncreased: false };
        if (lastMonthExpense > 0) {
            const diff = totalExpense - lastMonthExpense;
            vsLastMonth = {
                percentage: Math.abs(Math.round((diff / lastMonthExpense) * 100)),
                isIncreased: diff > 0,
            };
        }

        const recommendations: string[] = [];
        let savingPotential = 0;

        if (netSavings < 0) {
            recommendations.push(`⚠️ Defisit ${formatCurrency(Math.abs(netSavings))}. Segera evaluasi pengeluaran!`);
        } else if (netSavings < totalIncome * 0.1 && totalIncome > 0) {
            recommendations.push(`📉 Tabungan hanya ${Math.round((netSavings / totalIncome) * 100)}% dari pemasukan. Targetkan 20%.`);
        }

        if (totalInstallmentsAmount > totalIncome * 0.3 && totalIncome > 0) {
            recommendations.push(`🏦 Angsuran ${Math.round((totalInstallmentsAmount / totalIncome) * 100)}% dari pemasukan.`);
        }

        if (topExpenseCategory !== '-') {
            const idealPercentage = 20;
            const currentPercentage = totalExpense > 0 ? (topExpenseAmount / totalExpense) * 100 : 0;
            if (currentPercentage > idealPercentage) {
                recommendations.push(`🎯 Kurangi ${topExpenseCategory} (${Math.round(currentPercentage)}% dari total).`);
                savingPotential += topExpenseAmount * 0.15;
            }
        }

        if (recommendations.length === 0) {
            recommendations.push(`✅ Keuangan sehat! Pertahankan pola pengeluaran.`);
        }

        return {
            totalIncome,
            totalExpense,
            totalInstallments: totalInstallmentsAmount,
            netSavings,
            projectedEndBalance,
            isProjectedSafe: projectedEndBalance >= 0,
            topExpenseCategory,
            topExpenseAmount,
            categoryBreakdown,
            vsLastMonth,
            recommendations,
            savingPotential: Math.round(savingPotential),
        };
    }, [transactions, balance, installments, monthlyIncome]);

    // ============ VOICE SCRIPT ============
    // ============ VOICE SCRIPT ============
    const buildDailyVoiceScript = () => {
        const {
            avgDailyExpense,
            todayExpense,
            remainingDays,
            estimatedNeed,
            surplus,
            isSafe,
            topCategory,
            dailyBudgetIdeal,
            burnRate,
        } = dailySimulation;

        const parts: string[] = [
            `Halo! Ini laporan simulasi pengeluaran harianmu.`,
            todayExpense > 0
                ? `Hari ini kamu sudah menghabiskan ${formatCurrency(todayExpense)}.`
                : `Hari ini kamu belum mencatat pengeluaran.`,
            `Rata-rata pengeluaran harianmu bulan ini adalah ${formatCurrency(avgDailyExpense)}.`,
            `Masih ada ${remainingDays} hari sampai akhir bulan, estimasi kebutuhan sekitar ${formatCurrency(estimatedNeed)}.`,
            isSafe
                ? `Kabar baik, saldo masih cukup! Surplus sekitar ${formatCurrency(surplus)}. Budget ideal per hari ${formatCurrency(dailyBudgetIdeal)}.`
                : `Perhatian! Kamu perlu berhemat sekitar ${formatCurrency(Math.abs(surplus))}. Batasi pengeluaran maksimal ${formatCurrency(dailyBudgetIdeal)} per hari.`,
        ];

        if (topCategory !== '-') {
            parts.push(`Pengeluaran terbesar di kategori ${topCategory}.`);
        }

        parts.push(`Tingkat penggunaan saldo bulan ini ${burnRate} persen. Semangat!`);

        return parts.join(' ');
    };

    const buildMonthlyVoiceScript = () => {
        const {
            totalIncome,
            totalExpense,
            totalInstallments,
            netSavings,
            projectedEndBalance,
            isProjectedSafe,
            topExpenseCategory,
            vsLastMonth,
        } = monthlySimulation;

        const parts: string[] = [
            `Halo! Ini laporan simulasi keuangan bulananmu.`,
            `Total pemasukan ${formatCurrency(totalIncome)}. Total pengeluaran ${formatCurrency(totalExpense)}.`,
        ];

        if (totalInstallments > 0) {
            parts.push(`Angsuran ${formatCurrency(totalInstallments)} per bulan.`);
        }

        if (netSavings >= 0) {
            parts.push(`Tabungan bulan ini ${formatCurrency(netSavings)}.`);
        } else {
            parts.push(`Bulan ini defisit ${formatCurrency(Math.abs(netSavings))}.`);
        }

        if (vsLastMonth.percentage > 0) {
            parts.push(`Pengeluaran ${vsLastMonth.isIncreased ? 'naik' : 'turun'} ${vsLastMonth.percentage}% dibanding bulan lalu.`);
        }

        if (topExpenseCategory !== '-') {
            parts.push(`Kategori terbesar: ${topExpenseCategory}.`);
        }

        parts.push(`Proyeksi saldo akhir bulan ${formatCurrency(projectedEndBalance)}. ${isProjectedSafe ? 'Aman!' : 'Harap waspada!'}`);

        return parts.join(' ');
    };
    const handleSpeak = async () => {
        if (isSpeaking) {
            await voiceAssistant.stop?.();
            setIsSpeaking(false);
            return;
        }

        setIsSpeaking(true);
        const script = activeTab === 'daily' ? buildDailyVoiceScript() : buildMonthlyVoiceScript();
        await voiceAssistant.speak(script, { personality: 'supportive' });
        setIsSpeaking(false);
    };

    // ============ RENDER HARIAN ============
    const renderDailyContent = () => {
        const {
            avgDailyExpense,
            todayExpense,
            remainingDays,
            estimatedNeed,
            surplus,
            isSafe,
            topCategory,
            topCategoryAmount,
            dailyBudgetIdeal,
            burnRate,
            thisMonthExpense,
            daysInMonth,
            currentDayOfMonth,
        } = dailySimulation;

        const monthProgress = Math.round((currentDayOfMonth / daysInMonth) * 100);

        return (
            <>
                {/* Progress bulan */}
                <View className="px-5 pt-4 pb-2">
                    <View className="flex-row justify-between mb-1.5">
                        <Text className="text-gray-400 text-xs">Hari ke-{currentDayOfMonth}</Text>
                        <Text className="text-gray-400 text-xs">{daysInMonth} hari</Text>
                    </View>
                    <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <View
                            className="h-full bg-violet-400 rounded-full"
                            style={{ width: `${monthProgress}%` }}
                        />
                    </View>
                    <Text className="text-gray-400 text-xs mt-1">
                        {monthProgress}% bulan berjalan · {remainingDays} hari lagi
                    </Text>
                </View>

                {/* Stats Grid */}
                <View className="px-5 py-4">
                    <View className="flex-row gap-3 mb-3">
                        <View className="flex-1 bg-slate-50 rounded-2xl p-3.5">
                            <Text className="text-gray-400 text-xs mb-1">Hari ini</Text>
                            <Text className="text-gray-900 font-bold text-base">
                                {formatCurrency(todayExpense)}
                            </Text>
                            <Text className="text-gray-400 text-xs mt-0.5">pengeluaran</Text>
                        </View>
                        <View className="flex-1 bg-slate-50 rounded-2xl p-3.5">
                            <Text className="text-gray-400 text-xs mb-1">Rata-rata/hari</Text>
                            <Text className="text-violet-600 font-bold text-base">
                                {formatCurrency(avgDailyExpense)}
                            </Text>
                            <Text className="text-gray-400 text-xs mt-0.5">bulan ini</Text>
                        </View>
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1 bg-slate-50 rounded-2xl p-3.5">
                            <Text className="text-gray-400 text-xs mb-1">Budget ideal/hari</Text>
                            <Text className="text-emerald-600 font-bold text-base">
                                {formatCurrency(dailyBudgetIdeal)}
                            </Text>
                            <Text className="text-gray-400 text-xs mt-0.5">sisa bulan</Text>
                        </View>
                        <View className="flex-1 bg-slate-50 rounded-2xl p-3.5">
                            <Text className="text-gray-400 text-xs mb-1">Burn rate</Text>
                            <Text className={`font-bold text-base ${burnRate > 70 ? 'text-rose-500' : burnRate > 50 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                {burnRate}%
                            </Text>
                            <Text className="text-gray-400 text-xs mt-0.5">saldo terpakai</Text>
                        </View>
                    </View>
                </View>

                {/* Estimasi Sisa Bulan */}
                <View className={`mx-5 mb-4 rounded-2xl p-4 ${isSafe ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                    <View className="flex-row items-center gap-2 mb-2">
                        <Ionicons name={isSafe ? 'checkmark-circle' : 'alert-circle'} size={16} color={isSafe ? '#10b981' : '#ef4444'} />
                        <Text className={`text-xs font-semibold ${isSafe ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isSafe ? 'Keuangan aman' : 'Perlu penghematan!'}
                        </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Text className="text-gray-500 text-xs">Estimasi butuh</Text>
                            <Text className="text-gray-800 font-bold text-sm mt-0.5">{formatCurrency(estimatedNeed)}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={14} color="#9ca3af" />
                        <View className="items-end">
                            <Text className="text-gray-500 text-xs">{isSafe ? 'Surplus' : 'Defisit'}</Text>
                            <Text className={`font-bold text-sm mt-0.5 ${isSafe ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isSafe ? '+' : '-'}{formatCurrency(Math.abs(surplus))}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Detail lengkap - collapsed */}
                {expanded && (
                    <View className="border-t border-gray-50 px-5 pt-4 pb-5">
                        <Text className="text-gray-700 font-semibold text-sm mb-3">Rincian Bulan Ini</Text>
                        {[
                            { label: 'Total pengeluaran', value: formatCurrency(thisMonthExpense), color: 'text-gray-800' },
                            { label: 'Hari berjalan', value: `${currentDayOfMonth} hari`, color: 'text-gray-800' },
                            { label: 'Sisa hari', value: `${remainingDays} hari`, color: 'text-gray-800' },
                            { label: 'Kategori terbesar', value: topCategory, color: 'text-violet-600' },
                            { label: 'Total terbesar', value: formatCurrency(topCategoryAmount), color: 'text-violet-600' },
                            { label: 'Saldo saat ini', value: formatCurrency(balance), color: 'text-gray-800' },
                        ].map((row, i) => (
                            <View key={i} className="flex-row justify-between items-center py-2 border-b border-gray-50">
                                <Text className="text-gray-500 text-sm">{row.label}</Text>
                                <Text className={`font-semibold text-sm ${row.color}`}>{row.value}</Text>
                            </View>
                        ))}
                        <View className="mt-4 bg-violet-50 rounded-2xl p-3.5 border border-violet-100">
                            <Text className="text-violet-800 text-xs font-semibold mb-1">💡 Saran</Text>
                            <Text className="text-violet-700 text-xs leading-5">
                                {isSafe
                                    ? `Pertahankan di bawah ${formatCurrency(dailyBudgetIdeal)}/hari.`
                                    : `Kurangi minimal ${formatCurrency(avgDailyExpense - dailyBudgetIdeal)}/hari.`
                                }
                            </Text>
                        </View>
                    </View>
                )}
            </>
        );
    };

    // ============ RENDER BULANAN ============
    const renderMonthlyContent = () => {
        const {
            totalIncome,
            totalExpense,
            totalInstallments,
            netSavings,
            projectedEndBalance,
            isProjectedSafe,
            topExpenseCategory,
            topExpenseAmount,
            categoryBreakdown,
            vsLastMonth,
            recommendations,
            savingPotential,
        } = monthlySimulation;

        const netSavingsColor = netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600';
        const netSavingsBg = netSavings >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100';

        return (
            <>
                <View className="px-5 py-4">
                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-1 bg-slate-50 rounded-2xl p-3.5">
                            <Text className="text-gray-400 text-xs mb-1">Pemasukan</Text>
                            <Text className="text-emerald-600 font-bold text-base">{formatCurrency(totalIncome)}</Text>
                        </View>
                        <View className="flex-1 bg-slate-50 rounded-2xl p-3.5">
                            <Text className="text-gray-400 text-xs mb-1">Pengeluaran</Text>
                            <Text className="text-rose-500 font-bold text-base">{formatCurrency(totalExpense)}</Text>
                        </View>
                        <View className="flex-1 bg-slate-50 rounded-2xl p-3.5">
                            <Text className="text-gray-400 text-xs mb-1">Angsuran</Text>
                            <Text className="text-orange-500 font-bold text-base">{formatCurrency(totalInstallments)}</Text>
                        </View>
                    </View>

                    <View className={`rounded-2xl p-4 mb-4 ${netSavingsBg}`}>
                        <View className="flex-row justify-between items-center mb-1">
                            <Text className="text-gray-500 text-xs">Tabungan Bulan Ini</Text>
                            <Ionicons name="trending-up" size={14} color={netSavings >= 0 ? '#10b981' : '#ef4444'} />
                        </View>
                        <Text className={`font-bold text-2xl ${netSavingsColor}`}>
                            {netSavings >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netSavings))}
                        </Text>
                        {vsLastMonth.percentage > 0 && (
                            <Text className={`text-xs mt-1 ${vsLastMonth.isIncreased ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {vsLastMonth.isIncreased ? '↑' : '↓'} {vsLastMonth.percentage}% dari bulan lalu
                            </Text>
                        )}
                    </View>
                </View>

                <View className={`mx-5 mb-4 rounded-2xl p-4 ${isProjectedSafe ? 'bg-indigo-50 border border-indigo-100' : 'bg-amber-50 border border-amber-100'}`}>
                    <View className="flex-row items-center gap-2 mb-2">
                        <Ionicons name={isProjectedSafe ? 'checkmark-circle' : 'warning'} size={16} color={isProjectedSafe ? '#3b6ef5' : '#f59e0b'} />
                        <Text className={`text-xs font-semibold ${isProjectedSafe ? 'text-indigo-700' : 'text-amber-700'}`}>Proyeksi Akhir Bulan</Text>
                    </View>
                    <Text className={`font-bold text-xl ${isProjectedSafe ? 'text-indigo-600' : 'text-amber-600'}`}>{formatCurrency(projectedEndBalance)}</Text>
                </View>

                {topExpenseCategory !== '-' && (
                    <View className="mx-5 mb-4 bg-slate-50 rounded-2xl p-4">
                        <Text className="text-gray-400 text-xs mb-2">Kategori Terbesar</Text>
                        <View className="flex-row justify-between items-center">
                            <Text className="text-gray-800 font-semibold">{topExpenseCategory}</Text>
                            <Text className="text-violet-600 font-bold">{formatCurrency(topExpenseAmount)}</Text>
                        </View>
                    </View>
                )}

                {categoryBreakdown.length > 0 && (
                    <View className="mx-5 mb-4">
                        <Text className="text-gray-500 text-xs mb-2">Rincian per Kategori</Text>
                        {categoryBreakdown.map((item, idx) => (
                            <View key={idx} className="flex-row items-center gap-2 mb-2">
                                <View className="flex-1">
                                    <View className="flex-row justify-between mb-0.5">
                                        <Text className="text-gray-600 text-xs">{item.category}</Text>
                                        <Text className="text-gray-500 text-xs">{formatCurrency(item.amount)}</Text>
                                    </View>
                                    <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <View className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {expanded && (
                    <View className="border-t border-gray-50 px-5 pt-4 pb-5">
                        <Text className="text-gray-700 font-semibold text-sm mb-3">📋 Rekomendasi</Text>
                        {recommendations.map((rec, idx) => (
                            <View key={idx} className="bg-violet-50 rounded-2xl p-3.5 mb-3 border border-violet-100">
                                <Text className="text-violet-800 text-xs leading-5">{rec}</Text>
                            </View>
                        ))}
                        {savingPotential > 0 && (
                            <View className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-100">
                                <Text className="text-emerald-700 text-xs font-semibold">💰 Potensi Hemat</Text>
                                <Text className="text-emerald-600 text-xs mt-1">Hingga {formatCurrency(savingPotential)}/bulan dengan kurangi pengeluaran tidak perlu.</Text>
                            </View>
                        )}
                    </View>
                )}
            </>
        );
    };

    const monthProgress = Math.round((dailySimulation.currentDayOfMonth / dailySimulation.daysInMonth) * 100);

    return (
        <View className="mx-5 mt-4">
            <View className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                {/* Header dengan Tab */}
                <View className="px-5 pt-5 pb-3 border-b border-gray-50">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${activeTab === 'daily' ? 'bg-violet-100' : 'bg-indigo-100'}`}>
                                <Ionicons name={activeTab === 'daily' ? "calculator" : "calendar"} size={16} color={activeTab === 'daily' ? '#7c3aed' : '#3b6ef5'} />
                            </View>
                            <Text className="text-gray-900 font-bold text-base">
                                {activeTab === 'daily' ? 'Simulasi Harian' : 'Simulasi Bulanan'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleSpeak}
                            className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full ${isSpeaking ? (activeTab === 'daily' ? 'bg-violet-100' : 'bg-indigo-100') : 'bg-gray-100'}`}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={isSpeaking ? 'volume-high' : 'volume-medium-outline'} size={15} color={isSpeaking ? (activeTab === 'daily' ? '#7c3aed' : '#3b6ef5') : '#6b7280'} />
                            <Text className={`text-xs font-medium ${isSpeaking ? (activeTab === 'daily' ? 'text-violet-700' : 'text-indigo-700') : 'text-gray-500'}`}>
                                {isSpeaking ? 'Hentikan' : 'Dengarkan'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Buttons */}
                    <View className="flex-row bg-gray-100 rounded-full p-1">
                        <TouchableOpacity
                            onPress={() => setActiveTab('daily')}
                            className={`flex-1 py-2 rounded-full ${activeTab === 'daily' ? 'bg-white shadow-sm' : ''}`}
                            activeOpacity={0.7}
                        >
                            <Text className={`text-center text-sm font-semibold ${activeTab === 'daily' ? 'text-violet-600' : 'text-gray-500'}`}>
                                📅 Harian
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('monthly')}
                            className={`flex-1 py-2 rounded-full ${activeTab === 'monthly' ? 'bg-white shadow-sm' : ''}`}
                            activeOpacity={0.7}
                        >
                            <Text className={`text-center text-sm font-semibold ${activeTab === 'monthly' ? 'text-indigo-600' : 'text-gray-500'}`}>
                                📊 Bulanan
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Progress Bar untuk Daily (hanya tampil di tab daily) */}


                {/* Konten berdasarkan tab aktif */}
                {activeTab === 'daily' ? renderDailyContent() : renderMonthlyContent()}

                {/* Tombol Toggle Detail */}
                <TouchableOpacity
                    onPress={() => setExpanded(!expanded)}
                    className="flex-row items-center justify-center gap-1 py-4 border-t border-gray-50"
                    activeOpacity={0.7}
                >
                    <Text className="text-gray-400 text-xs">
                        {expanded ? 'Sembunyikan detail' : 'Lihat detail lengkap'}
                    </Text>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#9ca3af" />
                </TouchableOpacity>
            </View>
        </View>
    );
}