// src/services/kalKuProactiveService.ts
// KalKu yang proaktif — generate insight harian dan kirim via FCM

import { supabase } from './supabase/client';

interface ProactiveInsight {
  title: string;
  body: string;
  type: 'streak' | 'spending' | 'saving' | 'installment' | 'weekly' | 'goal';
  data?: Record<string, string>;
}

// ── Generate insight berdasarkan kondisi user ─────────────────────────────────
export function generateLocalInsight(params: {
  transactions: any[];
  balance: number;
  totalIncome: number;
  totalExpense: number;
  installments: any[];
  streakDays: number;
  goals?: any[];
}): ProactiveInsight | null {
  const { transactions, balance, totalIncome, totalExpense, installments, streakDays, goals } = params;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfMonth = now.getDate();
  const hour = now.getHours();

  // ── Cek pengeluaran hari ini ──────────────────────────────────────────────
  const todayExpenses = transactions.filter(t => {
    const d = new Date(t.created_at);
    return t.type === 'EXPENSE' && d >= today;
  });
  const todayTotal = todayExpenses.reduce((s: number, t: any) => s + t.amount, 0);

  // ── Rata-rata harian ──────────────────────────────────────────────────────
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthExpenses = transactions.filter(t => {
    const d = new Date(t.created_at);
    return t.type === 'EXPENSE' && d >= startOfMonth;
  });
  const monthTotal = monthExpenses.reduce((s: number, t: any) => s + t.amount, 0);
  const avgDaily = dayOfMonth > 1 ? monthTotal / (dayOfMonth - 1) : monthTotal;

  // ── Daysuntil installment ─────────────────────────────────────────────────
  const urgentInstallments = installments.filter(i => {
    const daysUntil = i.due_date - dayOfMonth;
    return daysUntil >= 0 && daysUntil <= 3;
  });

  const overdueInstallments = installments.filter(i => i.due_date < dayOfMonth);

  // ── Saldo per hari ────────────────────────────────────────────────────────
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - dayOfMonth;
  const dailyAllowance = daysLeft > 0 ? balance / daysLeft : 0;

  // ── Prioritas insight (dari paling kritis) ────────────────────────────────

  // 1. Angsuran terlewat (KRITIS)
  if (overdueInstallments.length > 0 && hour >= 9) {
    const names = overdueInstallments.map((i: any) => i.name).join(', ');
    return {
      type: 'installment',
      title: '🚨 Angsuran Terlewat!',
      body: `${names} sudah melewati jatuh tempo. Segera bayar untuk hindari denda.`,
      data: { screen: 'home', action: 'installment' },
    };
  }

  // 2. Angsuran jatuh tempo segera
  if (urgentInstallments.length > 0 && hour >= 8) {
    const nearest = urgentInstallments[0];
    const daysUntil = nearest.due_date - dayOfMonth;
    return {
      type: 'installment',
      title: '📅 Angsuran Jatuh Tempo',
      body: `"${nearest.name}" jatuh tempo ${daysUntil === 0 ? 'hari ini' : `${daysUntil} hari lagi`}. Siapkan Rp ${nearest.amount.toLocaleString('id-ID')}.`,
      data: { screen: 'home', action: 'installment' },
    };
  }

  // 3. Streak terancam (jam 20.00-21.00)
  if (hour >= 20 && hour < 21 && todayExpenses.length === 0 && streakDays > 3) {
    return {
      type: 'streak',
      title: '🔥 Streak kamu terancam!',
      body: `Streak ${streakDays} hari akan hilang dalam 4 jam. Catat satu transaksi aja dulu biar aman!`,
      data: { screen: 'add-expense', action: 'record' },
    };
  }

  // 4. Lebih boros dari biasanya (sore hari)
  if (hour >= 15 && hour < 19 && todayTotal > 0 && avgDaily > 0) {
    const pct = Math.round(((todayTotal - avgDaily) / avgDaily) * 100);
    if (pct > 40) {
      return {
        type: 'spending',
        title: '📈 Pengeluaran di atas rata-rata',
        body: `Hari ini kamu sudah keluar Rp ${todayTotal.toLocaleString('id-ID')}, lebih ${pct}% dari biasanya. KalKu ada saran nih!`,
        data: { screen: 'kalku', action: 'chat' },
      };
    }
  }

  // 5. Lebih hemat dari biasanya (sore hari)
  if (hour >= 17 && hour < 20 && todayTotal > 0 && avgDaily > 0) {
    const pct = Math.round(((avgDaily - todayTotal) / avgDaily) * 100);
    if (pct > 30) {
      return {
        type: 'spending',
        title: `💚 Hari ini lebih hemat ${pct}%`,
        body: `Baru Rp ${todayTotal.toLocaleString('id-ID')} hari ini, di bawah rata-rata. Jatah aman ${dailyAllowance > 0 ? `Rp ${Math.round(dailyAllowance).toLocaleString('id-ID')}/hari` : 'masih tersedia'}.`,
        data: { screen: 'home', action: 'insight' },
      };
    }
  }

  // 6. Belum catat transaksi hari ini (siang hari)
  if (hour >= 12 && hour < 15 && todayExpenses.length === 0) {
    return {
      type: 'streak',
      title: '📝 Belum ada catatan hari ini',
      body: `Jangan lupa catat pengeluaranmu ya! Jatah aman ${dailyAllowance > 0 ? `Rp ${Math.round(dailyAllowance).toLocaleString('id-ID')}/hari` : 'masih aman'}.`,
      data: { screen: 'add-expense', action: 'record' },
    };
  }

  // 7. Goal hampir tercapai
  if (goals && goals.length > 0 && hour >= 10) {
    const nearGoal = goals.find((g: any) => {
      const pct = (g.current_amount / g.target_amount) * 100;
      return pct >= 80 && pct < 100;
    });
    if (nearGoal) {
      const pct = Math.round((nearGoal.current_amount / nearGoal.target_amount) * 100);
      const remaining = nearGoal.target_amount - nearGoal.current_amount;
      return {
        type: 'goal',
        title: `🎯 Goals "${nearGoal.name}" ${pct}%!`,
        body: `Tinggal Rp ${remaining.toLocaleString('id-ID')} lagi untuk mencapai tujuanmu. Yuk tambah tabungan sekarang!`,
        data: { screen: 'home', action: 'goals' },
      };
    }
  }

  return null;
}

// ── Kirim insight ke KalKu AI untuk dibuat lebih personal ────────────────────
export async function generateKalKuInsight(params: {
  transactions: any[];
  balance: number;
  totalIncome: number;
  totalExpense: number;
  userName: string;
}): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return '';

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/kalku`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: `Buat insight proaktif singkat (1-2 kalimat) untuk ${params.userName} berdasarkan data keuangannya hari ini. Jadilah seperti teman yang peduli, bukan robot.`,
          transactions: params.transactions.slice(0, 5),
          balance: params.balance,
          totalIncome: params.totalIncome,
          totalExpense: params.totalExpense,
        }),
      }
    );

    const data = await response.json();
    return data.reply ?? '';
  } catch (e) {
    return '';
  }
}

// ── Kirim FCM notifikasi via Supabase Edge Function ───────────────────────────
export async function sendProactiveNotification(
  userId: string,
  insight: ProactiveInsight
): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/kalku-notify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          title: insight.title,
          body: insight.body,
          data: insight.data ?? {},
          type: insight.type,
        }),
      }
    );

    return response.ok;
  } catch (e) {
    console.error('[KalKu Proactive] Send notification error:', e);
    return false;
  }
}