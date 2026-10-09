// src/services/financeAnalytics.ts
import { MonthlyProjection, SpendingHabit } from '../types';
import { supabase } from './supabase/client';
import { voiceAssistant } from './voiceAssistant';

// ── Helper: safely format currency for voice (no "Rp" prefix confusion) ──────
const fmt = (n: number) => n.toLocaleString('id-ID');

class FinanceAnalyticsService {
    private static instance: FinanceAnalyticsService;

    static getInstance(): FinanceAnalyticsService {
        if (!FinanceAnalyticsService.instance) {
            FinanceAnalyticsService.instance = new FinanceAnalyticsService();
        }
        return FinanceAnalyticsService.instance;
    }

    // ============ 1. DETEKSI KEBIASAAN PENGELUARAN ============
    async detectSpendingHabits(userId: string): Promise<SpendingHabit[]> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'EXPENSE')
            .gte('created_at', thirtyDaysAgo.toISOString()); // ✅ pakai created_at (kolom Supabase)

        if (!transactions || transactions.length === 0) return [];

        const merchantMap = new Map<string, {
            transactions: any[];
            total: number;
            dates: Date[];
        }>();

        transactions.forEach((t: any) => {
            const key = t.merchant || t.category || 'OTHER';
            if (!merchantMap.has(key)) {
                merchantMap.set(key, { transactions: [], total: 0, dates: [] });
            }
            const entry = merchantMap.get(key)!;
            entry.transactions.push(t);
            entry.total += t.amount;
            entry.dates.push(new Date(t.created_at));
        });

        const habits: SpendingHabit[] = [];

        merchantMap.forEach((value, merchant) => {
            const frequency = value.transactions.length;
            const average = value.total / frequency;

            const days  = value.dates.map(d => d.getDay());
            const hours = value.dates.map(d => d.getHours());

            habits.push({
                merchant,
                category: value.transactions[0].category,
                average_amount: average,
                frequency_per_month: frequency,
                last_transaction: value.transactions[0].created_at,
                typical_days: this.getMostFrequent(days),
                typical_hours: this.getMostFrequent(hours),
            });
        });

        return habits.sort((a, b) => b.frequency_per_month - a.frequency_per_month);
    }

    private getMostFrequent(arr: number[]): number[] {
        const freq = new Map<number, number>();
        arr.forEach(n => freq.set(n, (freq.get(n) || 0) + 1));
        const maxFreq = Math.max(...freq.values());
        return Array.from(freq.entries())
            .filter(([, count]) => count === maxFreq)
            .map(([num]) => num);
    }

    // ============ 2. AMBIL DATA ANGSURAN ============
    async getActiveInstallments(userId: string): Promise<any[]> {
        const { data } = await supabase
            .from('installments')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);

        return data || [];
    }

    // ============ 3. HITUNG RATA-RATA PENGELUARAN HARIAN ============
    async getDailyAverageExpense(userId: string): Promise<number> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('type', 'EXPENSE')
            .gte('created_at', thirtyDaysAgo.toISOString()); // ✅ created_at

        if (!transactions || transactions.length === 0) return 0;

        const totalExpense = transactions.reduce((sum, t) => sum + t.amount, 0);
        return totalExpense / 30;
    }

    // ============ 4. PROYEKSI SALDO BULANAN ============
    async calculateMonthlyProjection(userId: string): Promise<MonthlyProjection> {
        const now          = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Ambil semua transaksi bulan ini
        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', startOfMonth.toISOString())   // ✅ created_at
            .lte('created_at', endOfMonth.toISOString());

        const installments     = await this.getActiveInstallments(userId);
        const totalInstallments = installments.reduce((sum, i) => sum + (i.amount ?? 0), 0);

        let totalIncome  = 0;
        let totalExpense = 0;

        transactions?.forEach((t: any) => {
            if (t.type === 'INCOME') totalIncome  += t.amount;
            else                     totalExpense  += t.amount;
        });

        // ── PERBAIKAN: jangan kurangi installments dari expense
        // karena angsuran yang sudah dibayar sudah masuk sebagai EXPENSE transaction.
        // totalInstallments hanya dipakai untuk memproyeksikan kewajiban
        // yang BELUM tercatat (angsuran bulan ini yg belum dibayar).

        const daysPassed   = now.getDate();
        const daysInMonth  = endOfMonth.getDate();
        const daysRemaining = daysInMonth - daysPassed;

        // Proyeksi sisa pengeluaran (berdasarkan rata-rata harian bulan ini)
        let projectedRemainingExpense = 0;
        if (daysPassed > 0 && totalExpense > 0) {
            const avgDaily = totalExpense / daysPassed;
            projectedRemainingExpense = avgDaily * daysRemaining;

            // Batasi maksimal 2x dari pengeluaran saat ini agar tidak terlalu pesimis
            projectedRemainingExpense = Math.min(projectedRemainingExpense, totalExpense * 2);
        } else {
            const avgDaily = await this.getDailyAverageExpense(userId);
            projectedRemainingExpense = avgDaily * daysRemaining;
        }

        const totalProjectedExpense   = totalExpense + projectedRemainingExpense;

        // ── Sisa saldo SEKARANG (real, tanpa proyeksi) ──────────────────────
        // TIDAK dikurangi total_installments supaya tidak double-count
        // dengan EXPENSE transactions yang sudah dibayar
        const currentBalance = totalIncome - totalExpense;

        // ── Proyeksi akhir bulan ─────────────────────────────────────────────
        const projectedBalance = totalIncome - totalProjectedExpense;

        // Tampilkan yang lebih konservatif (lebih kecil) tapi jangan negatif palsu
        const displayProjected = Math.min(currentBalance, projectedBalance);

        // Warning level
        let warningLevel: 'safe' | 'warning' | 'danger' = 'safe';
        const recommendations: string[] = [];

        if (currentBalance < 0) {
            warningLevel = 'danger';
            recommendations.push(`⚠️ Saldo saat ini negatif: Rp${fmt(Math.abs(currentBalance))}`);
            recommendations.push('📉 Segera kurangi pengeluaran yang tidak perlu');
            recommendations.push('🏦 Prioritaskan pembayaran angsuran');
        } else if (currentBalance < 50_000) {
            warningLevel = 'warning';
            recommendations.push(`⚠️ Saldo saat ini tinggal Rp${fmt(currentBalance)}`);
            recommendations.push('💡 Hati-hati dengan pengeluaran berikutnya');
        } else if (projectedBalance < 0 && currentBalance > 0) {
            warningLevel = 'warning';
            recommendations.push('⚠️ Jika pola pengeluaran sama, diprediksi akan defisit akhir bulan');
            recommendations.push(`📊 Sisa saldo saat ini: Rp${fmt(currentBalance)}`);
        } else {
            recommendations.push(`✅ Sisa saldo saat ini: Rp${fmt(currentBalance)}`);
            recommendations.push('🎯 Pertahankan kebiasaan keuangan yang baik');
        }

        // Cek angsuran mendekati jatuh tempo — FIX: pakai due_date (snake_case Supabase)
        const today = now.getDate();
        const upcomingInstallments = installments.filter(
            i => i.due_date != null && i.due_date >= today && i.due_date <= today + 5
        );
        if (upcomingInstallments.length > 0) {
            recommendations.push(`📅 ${upcomingInstallments.length} angsuran dalam 5 hari ke depan`);
        }

        return {
            total_income       : totalIncome,
            total_expense      : totalExpense,
            total_installments : totalInstallments,
            projected_savings  : displayProjected,   // ✅ ini saldo real, tidak double-count
            current_balance    : currentBalance,      // ✅ field baru: saldo sesungguhnya sekarang
            is_safe            : currentBalance >= 0,
            warning_level      : warningLevel,
            recommendations,
        };
    }

    // ============ 5. CEK SETELAH TRANSAKSI BARU ============
    async checkAfterTransaction(
        userId: string,
        amount: number,
        category: string,
        merchant?: string
    ): Promise<{ warning: boolean; message: string; voiceMessage: string }> {
        const projection = await this.calculateMonthlyProjection(userId);
        const habits     = await this.detectSpendingHabits(userId);

        // Cek pemborosan
        const habit        = habits.find(h => h.merchant === merchant || h.category === category);
        const isOverspend  = habit != null && amount > habit.average_amount * 1.5;

        // ✅ Pakai current_balance (bukan projected_savings yang double-count)
        const balanceAfter = (projection.current_balance ?? projection.projected_savings) - amount;

        let message      = '';
        let voiceMessage = '';
        let warning      = false;

        if (balanceAfter < 0) {
            warning      = true;
            message      = `⚠️ Setelah transaksi ini, saldo menjadi negatif!`;
            voiceMessage = `Peringatan penting! Setelah pengeluaran ${fmt(amount)} rupiah, saldo Anda menjadi minus ${fmt(Math.abs(balanceAfter))} rupiah. Segera evaluasi pengeluaran Anda!`;
        } else if (balanceAfter < 50_000) {
            warning      = true;
            message      = `⚠️ Sisa saldo tinggal Rp${fmt(balanceAfter)} setelah transaksi ini.`;
            voiceMessage = `Perhatian! Sisa saldo Anda tinggal ${fmt(balanceAfter)} rupiah. Coba kurangi pengeluaran yang tidak terlalu penting ya.`;
        } else if (isOverspend) {
            warning      = true;
            const ratio  = Math.round((amount / (habit!.average_amount)) * 100);
            message      = `⚠️ Pengeluaran ini ${ratio}% di atas kebiasaan`;
            voiceMessage = `Perhatian! Anda biasanya belanja di ${merchant || category} sekitar ${fmt(habit!.average_amount)} rupiah, tapi kali ini ${fmt(amount)} rupiah. Coba periksa kembali apakah ini kebutuhan mendesak?`;
        }

        // Info angsuran mendekati jatuh tempo
        const installments = await this.getActiveInstallments(userId);
        const today        = new Date().getDate();
        const upcoming     = installments.filter(
            i => i.due_date != null && i.due_date >= today && i.due_date <= today + 3
        );

        if (upcoming.length > 0 && !warning) {
            const daysLeft = upcoming[0].due_date - today;
            voiceMessage   = `Info tambahan: angsuran ${upcoming[0].name} sebesar ${fmt(upcoming[0].amount)} rupiah jatuh tempo ${daysLeft === 0 ? 'hari ini' : `${daysLeft} hari lagi`}. Pastikan dana mencukupi ya.`;
        }

        if (warning && voiceMessage) {
            await voiceAssistant.speak(voiceMessage, { personality: 'firm' });
        } else if (voiceMessage && !warning) {
            await voiceAssistant.speak(voiceMessage, { personality: 'supportive' });
        }

        return { warning, message, voiceMessage };
    }

    // ============ 6. REKOMENDASI HARIAN ============
    async getDailyAdvice(userId: string): Promise<string> {
        const projection   = await this.calculateMonthlyProjection(userId);
        const habits       = await this.detectSpendingHabits(userId);
        const installments = await this.getActiveInstallments(userId);

        const today   = new Date();
        const dayName = today.toLocaleDateString('id-ID', { weekday: 'long' });

        // ✅ Pakai current_balance untuk angka yang diomongkan (bukan projected)
        const balanceNow = projection.current_balance ?? projection.projected_savings;

        let advice = `Halo! Hari ${dayName}. `;

        if (projection.warning_level === 'danger') {
            advice += `Saldo Anda saat ini negatif ${fmt(Math.abs(balanceNow))} rupiah. Segera evaluasi pengeluaran!`;
        } else if (projection.warning_level === 'warning') {
            advice += `Sisa saldo Anda saat ini ${fmt(balanceNow)} rupiah. Mulai hemat dari sekarang.`;
        } else {
            advice += `Keuangan Anda sehat! Sisa saldo ${fmt(balanceNow)} rupiah. Pertahankan!`;
        }

        // Kebiasaan hari ini
        const todayHabits = habits.filter(h => h.typical_days.includes(today.getDay()));
        if (todayHabits.length > 0) {
            advice += ` Biasanya hari ${dayName} Anda sering belanja di ${todayHabits[0].merchant}. Cek dulu apakah benar-benar perlu.`;
        }

        // Angsuran mendekati jatuh tempo — FIX: pakai due_date (snake_case Supabase)
        const todayDate = today.getDate();
        const nearestInstallment = installments
            .filter(i => i.due_date != null && i.due_date >= todayDate)
            .sort((a, b) => a.due_date - b.due_date)[0];

        if (nearestInstallment) {
            const daysLeft = nearestInstallment.due_date - todayDate;
            if (daysLeft <= 5) {
                advice += ` Jangan lupa, angsuran ${nearestInstallment.name} sebesar ${fmt(nearestInstallment.amount)} rupiah jatuh tempo ${daysLeft === 0 ? 'hari ini' : `${daysLeft} hari lagi`}.`;
            }
        }

        return advice;
    }
}

export const financeAnalytics = FinanceAnalyticsService.getInstance();