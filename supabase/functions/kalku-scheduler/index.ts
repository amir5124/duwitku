// supabase/functions/kalku-scheduler/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Konstanta timing ──────────────────────────────────────────────────────────
const HOURS = (n: number) => n * 60 * 60 * 1000;
const DAYS  = (n: number) => n * 24 * 60 * 60 * 1000;

const MIN_GAP_ONBOARDING = HOURS(6);
const MIN_GAP_ATRISK     = HOURS(12); // diperpendek dari 18h → user at-risk juga dapat min. 2x/hari
const SILENT_AFTER_DAYS  = 5;

// Gap per tipe notif — diperpendek supaya user aktif minimal dapat 2 notif/hari
// (jendela aktif 07:00–22:00 WIB = 15 jam, jadi gap dibuat ≤10 jam untuk sebagian besar tipe)
const TYPE_GAPS: Record<string, number> = {
  installment_urgent:    HOURS(6),
  streak:                HOURS(4),
  streak_milestone:      HOURS(4),
  budget_warning:        HOURS(6),
  daily_reminder:        HOURS(6),
  spending_high:         HOURS(6),
  goal_near_complete:    HOURS(8),
  daily_allowance:       HOURS(8),
  saving:                HOURS(8),
  atrisk_1:              HOURS(12),
  atrisk_2:              HOURS(12),
  first_insight:         HOURS(20), // one-time-ish, biarkan jarang
  weekly_summary:        HOURS(20), // mingguan, biarkan jarang
  weekly_summary_hemat:  HOURS(20),
  weekly_summary_bocos:  HOURS(20),
  month_projection:      HOURS(20), // hanya relevan tgl 18-27
  goal_reminder:         HOURS(10),
  installment_reminder:  HOURS(10),
  balance_reminder:      HOURS(10),
  general_reminder:      HOURS(8),
  default:               HOURS(8),
};

// ── Timezone WIB (UTC+7) ─────────────────────────────────────────────────────
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Kembalikan Date yang merepresentasikan waktu sekarang dalam WIB */
function nowWIB(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS);
}

/** Jam saat ini dalam WIB (0-23) */
function hourWIB(): number {
  return nowWIB().getUTCHours();
}

/** Hari dalam minggu saat ini dalam WIB (0=Minggu … 6=Sabtu) */
function dayOfWeekWIB(): number {
  return nowWIB().getUTCDay();
}

/**
 * Kembalikan timestamp UTC yang setara pukul 00:00:00 WIB hari ini.
 * Dipakai sebagai batas bawah filter transaksi "hari ini".
 *
 * Contoh: jika sekarang WIB = 2025-06-15 09:00
 *   → midnight WIB = 2025-06-15 00:00 WIB = 2025-06-14 17:00 UTC
 */
function midnightTodayWIB(): Date {
  const wib = nowWIB();
  const midnightUTC = Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    wib.getUTCDate(),
    0, 0, 0, 0
  );
  return new Date(midnightUTC - WIB_OFFSET_MS);
}

/**
 * Kembalikan timestamp UTC yang setara pukul 00:00:00 WIB tanggal 1 bulan ini.
 * Dipakai sebagai batas bawah filter transaksi bulan ini.
 */
function midnightStartOfMonthWIB(): Date {
  const wib = nowWIB();
  const midnightUTC = Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    1,
    0, 0, 0, 0
  );
  return new Date(midnightUTC - WIB_OFFSET_MS);
}

/** 7 hari yang lalu — tidak bergantung pada tanggal lokal */
function sevenDaysAgo(): Date {
  return new Date(Date.now() - DAYS(7));
}

// ── Tipe ─────────────────────────────────────────────────────────────────────
interface NotifPayload {
  title: string;
  body: string;
  type: string;
  screen: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────
function getOnboardingNotif(params: {
  name: string;
  count: number;
  hoursSinceRegister: number;
  hasAnyTransaction: boolean;
  hasIncome: boolean;
  hasExpense: boolean;
}): NotifPayload | null {
  const { name, count, hoursSinceRegister, hasAnyTransaction, hasIncome, hasExpense } = params;

  if (hasIncome && hasExpense) return null;

  const messages = [
    {
      condition: count === 0 && hoursSinceRegister >= 2 && !hasAnyTransaction,
      payload: {
        type: 'onboarding_1',
        title: `👋 Hai ${name}!`,
        body: 'Yuk mulai catat pengeluaran pertamamu — cuma 10 detik aja!',
        screen: '/transactions/add-expense',
      },
    },
    {
      condition: count === 1 && hoursSinceRegister >= 8 && !hasAnyTransaction,
      payload: {
        type: 'onboarding_2',
        title: '💡 Kamu tahu nggak?',
        body: `Orang yang catat keuangan punya 40% lebih sedikit pengeluaran impulsif. Yuk mulai, ${name}!`,
        screen: '/transactions/add-expense',
      },
    },
    {
      condition: count === 2 && hoursSinceRegister >= 24 && !hasAnyTransaction,
      payload: {
        type: 'onboarding_3',
        title: '🎯 Satu langkah kecil',
        body: `Catat satu transaksi aja dulu, ${name}. Dari situ kebiasaan baik akan terbentuk!`,
        screen: '/transactions/add-expense',
      },
    },
    {
      condition: count <= 3 && hasExpense && !hasIncome && hoursSinceRegister >= 12,
      payload: {
        type: 'onboarding_income',
        title: '💰 Jangan lupa pemasukan!',
        body: `${name}, catatan pengeluaranmu sudah ada. Sekarang tambah pemasukanmu biar saldo akurat!`,
        screen: '/transactions/add-income',
      },
    },
    {
      condition: count <= 3 && hasIncome && !hasExpense && hoursSinceRegister >= 12,
      payload: {
        type: 'onboarding_expense',
        title: '📝 Catat pengeluaranmu juga',
        body: `Pemasukan sudah tercatat, ${name}! Sekarang coba catat pengeluaran biar kamu tahu kemana uangnya pergi.`,
        screen: '/transactions/add-expense',
      },
    },
  ];

  for (const m of messages) {
    if (m.condition) return m.payload;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE — window jam diperlebar, tambah fallback
// ─────────────────────────────────────────────────────────────────────────────
function getActiveNotif(params: {
  name: string;
  hour: number;       // jam WIB
  dayOfWeek: number;  // hari WIB
  dayOfMonth: number; // tanggal WIB
  daysInMonth: number;
  todayExpense: number;
  weeklyExpense: number;
  avgDailyExpense: number;
  avgWeeklyExpense: number;
  balance: number;
  dailyAllowance: number;
  streakDays: number;
  urgentInstallments: any[];
  nearGoal: any | null;
  goalsCount: number;
  installmentsCount: number;
  hasBudgetOverspend: boolean;
  totalBudgetLimit: number;
  totalBudgetSpent: number;
  txCountThisMonth: number;
  isFirstInsight: boolean;
  lastNotifType: string;
}): NotifPayload | null {
  const {
    name, hour, dayOfWeek, dayOfMonth, daysInMonth,
    todayExpense, weeklyExpense, avgDailyExpense, avgWeeklyExpense,
    balance, dailyAllowance, streakDays,
    urgentInstallments, nearGoal, goalsCount, installmentsCount,
    hasBudgetOverspend, totalBudgetLimit, totalBudgetSpent,
    txCountThisMonth, isFirstInsight, lastNotifType,
  } = params;

  // Semua pengecekan jam di sini sudah dalam WIB
  if (hour < 7 || hour > 22) return null;

  // ── 1. FIRST INSIGHT ─────────────────────────────────────────────────────
  if (isFirstInsight && txCountThisMonth >= 3 && hour >= 8 && hour <= 20) {
    return {
      type: 'first_insight',
      title: '✨ Insight pertamamu siap!',
      body: `${name}, kamu udah punya ${txCountThisMonth} transaksi tercatat. Yuk lihat kemana uangmu pergi selama ini!`,
      screen: '/(tabs)/analytics',
    };
  }

  // ── 2. ANGSURAN URGENT — kapan saja selama jam aktif WIB ─────────────────
  if (urgentInstallments.length > 0 && lastNotifType !== 'installment_urgent') {
    const item = urgentInstallments[0];
    const daysUntil = item.due_date - dayOfMonth;
    return {
      type: 'installment_urgent',
      title: daysUntil <= 0 ? '🚨 Angsuran Terlewat!' : '📅 Angsuran Jatuh Tempo',
      body: daysUntil <= 0
        ? `"${item.name}" sudah lewat jatuh tempo! Bayar sekarang hindari denda, ${name}.`
        : `"${item.name}" jatuh tempo ${daysUntil === 0 ? 'hari ini' : daysUntil + ' hari lagi'}. Siapkan Rp ${item.amount.toLocaleString('id-ID')}.`,
      screen: '/installments',
    };
  }

  // ── 3. WEEKLY SUMMARY — Minggu-Senin, jam 8-20 WIB ──────────────────────
  if ((dayOfWeek === 0 || dayOfWeek === 1) && hour >= 8 && hour <= 20 && weeklyExpense > 0
    && lastNotifType !== 'weekly_summary' && lastNotifType !== 'weekly_summary_hemat' && lastNotifType !== 'weekly_summary_bocos') {
    const diff = weeklyExpense - avgWeeklyExpense;
    const isHemat = diff < 0 && avgWeeklyExpense > 0;
    const isBocos = diff > 0 && avgWeeklyExpense > 0;

    if (isHemat) {
      return {
        type: 'weekly_summary_hemat',
        title: '📊 Minggu lalu kamu hemat!',
        body: `Minggu lalu kamu keluar Rp ${weeklyExpense.toLocaleString('id-ID')}, lebih hemat Rp ${Math.abs(diff).toLocaleString('id-ID')} dari biasanya. Pertahankan, ${name}!`,
        screen: '/(tabs)/analytics',
      };
    }
    if (isBocos) {
      return {
        type: 'weekly_summary_bocos',
        title: '📊 Ringkasan minggu lalu',
        body: `Minggu lalu kamu keluar Rp ${weeklyExpense.toLocaleString('id-ID')}, lebih boros Rp ${Math.abs(diff).toLocaleString('id-ID')} dari biasanya. Yuk lebih hemat minggu ini, ${name}!`,
        screen: '/(tabs)/analytics',
      };
    }
    return {
      type: 'weekly_summary',
      title: '📊 Ringkasan minggu lalu',
      body: `Minggu lalu kamu keluar Rp ${weeklyExpense.toLocaleString('id-ID')}. Yuk cek breakdown lengkapnya!`,
      screen: '/(tabs)/analytics',
    };
  }

  // ── 4. PROYEKSI AKHIR BULAN — tanggal 18-27, jam 17-22 WIB ──────────────
  if (dayOfMonth >= 18 && dayOfMonth <= 27 && hour >= 17 && hour <= 22
    && lastNotifType !== 'month_projection') {
    const projectedBalance = balance - (avgDailyExpense * (daysInMonth - dayOfMonth));
    const isOverspend = projectedBalance < 0;
    return {
      type: 'month_projection',
      title: isOverspend ? '⚠️ Proyeksi akhir bulan' : '📈 Proyeksi akhir bulan',
      body: isOverspend
        ? `Kalau terus begini, kamu akan minus Rp ${Math.abs(projectedBalance).toLocaleString('id-ID')} akhir bulan. Yuk rem pengeluaran, ${name}!`
        : `Kalau terus begini, kamu masih sisa Rp ${projectedBalance.toLocaleString('id-ID')} akhir bulan. Keren banget, ${name}!`,
      screen: '/(tabs)/analytics',
    };
  }

  // ── 5. GOALS HAMPIR TERCAPAI ──────────────────────────────────────────────
  if (nearGoal && hour >= 8 && lastNotifType !== 'goal_near_complete') {
    const pct = Math.round((nearGoal.current_amount / nearGoal.target_amount) * 100);
    const sisa = (nearGoal.target_amount - nearGoal.current_amount).toLocaleString('id-ID');
    return {
      type: 'goal_near_complete',
      title: `🎯 Goals ${pct}% tercapai!`,
      body: `Tinggal Rp ${sisa} lagi buat "${nearGoal.name}". Yuk tambah sekarang, ${name}!`,
      screen: '/goals',
    };
  }

  // ── 6. GOALS REMINDER — Rabu, Sabtu, Minggu jam 8-20 WIB ────────────────
  if (goalsCount > 0 && hour >= 8 && hour <= 20
    && (dayOfWeek === 3 || dayOfWeek === 6 || dayOfWeek === 0)
    && lastNotifType !== 'goal_reminder') {
    return {
      type: 'goal_reminder',
      title: '🎯 Progress Goals-mu gimana?',
      body: `Kamu punya ${goalsCount} goals aktif. Jangan lupa cek progress dan tambahin ya, ${name}!`,
      screen: '/goals',
    };
  }

  // ── 7. BUDGET OVERSPEND — jam 14-22 WIB ──────────────────────────────────
  if (hasBudgetOverspend && hour >= 14 && hour <= 22 && lastNotifType !== 'budget_warning') {
    const pct = Math.round((totalBudgetSpent / totalBudgetLimit) * 100);
    return {
      type: 'budget_warning',
      title: '⚠️ Anggaran Menipis!',
      body: `Kamu udah pakai ${pct}% dari total anggaran bulan ini. Yuk cek lagi pengeluarannya, ${name}!`,
      screen: '/(tabs)/analytics',
    };
  }

  // ── 8. DAILY ALLOWANCE — pagi-siang jam 7-11 WIB ─────────────────────────
  if (dailyAllowance > 0 && balance > 0 && hour >= 7 && hour <= 11
    && lastNotifType !== 'daily_allowance') {
    return {
      type: 'daily_allowance',
      title: '💰 Jatah hari ini',
      body: `Selamat pagi ${name}! Jatah amanmu hari ini Rp ${Math.round(dailyAllowance).toLocaleString('id-ID')}. Semangat hemat!`,
      screen: '/',
    };
  }

  // ── 9. PENGELUARAN TINGGI — jam 14-22 WIB ────────────────────────────────
  if (hour >= 14 && hour <= 22 && todayExpense > 0 && avgDailyExpense > 0
    && lastNotifType !== 'spending_high') {
    const pct = Math.round(((todayExpense - avgDailyExpense) / avgDailyExpense) * 100);
    if (pct > 40) {
      return {
        type: 'spending_high',
        title: '📈 Pengeluaran tinggi hari ini',
        body: `Udah Rp ${todayExpense.toLocaleString('id-ID')} hari ini, ${pct}% di atas rata-rata. KalKu punya saran hemat nih!`,
        screen: '/kalku',
      };
    }
  }

  // ── 10. LEBIH HEMAT DARI BIASANYA — jam 16-22 WIB ────────────────────────
  if (hour >= 16 && hour <= 22 && todayExpense > 0 && avgDailyExpense > 0
    && lastNotifType !== 'saving') {
    const pct = Math.round(((avgDailyExpense - todayExpense) / avgDailyExpense) * 100);
    if (pct > 30) {
      return {
        type: 'saving',
        title: `💚 Hemat ${pct}% hari ini!`,
        body: `Kamu cuma keluar Rp ${todayExpense.toLocaleString('id-ID')} hari ini. ${dailyAllowance > 0 ? `Jatah aman Rp ${Math.round(dailyAllowance).toLocaleString('id-ID')}/hari.` : 'Pertahankan ya!'}`,
        screen: '/',
      };
    }
  }

  // ── 11. CICILAN REMINDER — Selasa, Jumat, Minggu jam 9-20 WIB ────────────
  if (installmentsCount > 0 && hour >= 9 && hour <= 20
    && (dayOfWeek === 2 || dayOfWeek === 5 || dayOfWeek === 0)
    && lastNotifType !== 'installment_reminder') {
    return {
      type: 'installment_reminder',
      title: '📋 Cek Cicilanmu Yuk!',
      body: `Kamu punya ${installmentsCount} cicilan aktif. Jangan sampai kelewat tanggal jatuh tempo, ${name}!`,
      screen: '/installments',
    };
  }

  // ── 12. STREAK MILESTONE — kelipatan 7 hari, jam 7-22 WIB ───────────────
  if (streakDays > 0 && streakDays % 7 === 0 && hour >= 7 && hour <= 22
    && lastNotifType !== 'streak_milestone') {
    const weeks = streakDays / 7;
    const emoji = weeks >= 4 ? '🏆' : weeks >= 2 ? '🌟' : '🎉';
    return {
      type: 'streak_milestone',
      title: `${emoji} ${weeks} Minggu Konsisten!`,
      body: `Kamu udah catat transaksi ${streakDays} hari berturut-turut! Keren banget, ${name}! Terus pertahankan ya!`,
      screen: '/',
    };
  }

  // ── 13. STREAK REMINDER MALAM — jam 19-22 WIB, streak > 1 ───────────────
  if (hour >= 19 && hour <= 22 && streakDays > 1 && todayExpense === 0
    && lastNotifType !== 'streak') {
    return {
      type: 'streak',
      title: `🔥 Streak ${streakDays} hari mau hilang!`,
      body: `Catat satu transaksi sebelum tengah malam biar streak-mu aman, ${name}!`,
      screen: '/transactions/add-expense',
    };
  }

  // ── 14. DAILY REMINDER — jam 11-22 WIB, belum catat hari ini ─────────────
  if (hour >= 11 && hour <= 22 && todayExpense === 0
    && lastNotifType !== 'daily_reminder') {
    return {
      type: 'daily_reminder',
      title: '📝 Belum catat hari ini',
      body: `Hei ${name}, sudah ada pengeluaran hari ini? Catat sekarang biar nggak lupa!`,
      screen: '/transactions/add-expense',
    };
  }

  // ── 15. BALANCE REMINDER — Senin & Kamis jam 8-20 WIB ────────────────────
  if (balance > 0 && (dayOfWeek === 1 || dayOfWeek === 4) && hour >= 8 && hour <= 20
    && lastNotifType !== 'balance_reminder') {
    return {
      type: 'balance_reminder',
      title: '💼 Saldo bulan ini',
      body: `Saldo bersihmu bulan ini Rp ${balance.toLocaleString('id-ID')}. ${balance > 1000000 ? 'Mantap! Terus dijaga ya 🎉' : 'Semangat hemat minggu ini! 💪'}`,
      screen: '/',
    };
  }

  // ── 16. GENERAL REMINDER — fallback agar selalu ada notif ────────────────
  if (hour >= 8 && hour <= 21) {
    const tips = [
      {
        title: '💡 Tips Hemat Hari Ini',
        body: `${name}, coba review pengeluaran minggu ini. Siapa tahu ada yang bisa dihemat!`,
        screen: '/(tabs)/analytics',
      },
      {
        title: '📊 Cek Kondisi Keuangan',
        body: `${name}, yuk pantau keuanganmu hari ini. Saldo bersih bulan ini Rp ${balance.toLocaleString('id-ID')}.`,
        screen: '/',
      },
      {
        title: '🎯 Sudah Catat Hari Ini?',
        body: `${name}, jangan lupa catat transaksi hari ini biar catatan keuanganmu akurat!`,
        screen: '/transactions/add-expense',
      },
      {
        title: '💰 Yuk Cek Analitik!',
        body: `${name}, lihat kemana uangmu pergi bulan ini. Temukan pola pengeluaranmu!`,
        screen: '/(tabs)/analytics',
      },
    ];
    const tip = tips[dayOfMonth % tips.length];
    return {
      type: 'general_reminder',
      title: tip.title,
      body: tip.body,
      screen: tip.screen,
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AT RISK
// ─────────────────────────────────────────────────────────────────────────────
function getAtRiskNotif(params: {
  name: string;
  daysInactive: number;
  count: number;
  streakDays: number;
  balance: number;
  installmentsCount: number;
  goalsCount: number;
}): NotifPayload | null {
  const { name, daysInactive, count, streakDays, balance, installmentsCount, goalsCount } = params;

  if (daysInactive >= 1 && count === 0) {
    let body = `${name}, kemarin nggak ada catatan baru.`;
    if (streakDays > 0) body += ` Streak ${streakDays} hari kamu juga terancam nih!`;
    if (installmentsCount > 0) body += ` Jangan lupa cek cicilanmu ya!`;
    body += ' Yuk balik, cuma butuh semenit!';
    return {
      type: 'atrisk_1',
      title: '👀 Duwitku merindukanmu',
      body,
      screen: '/',
    };
  }

  if (daysInactive >= 2 && count === 1) {
    let body = balance > 0
      ? `${name}, masih ada Rp ${balance.toLocaleString('id-ID')} di Duwitku yang belum terpantau.`
      : `${name}, sudah 2 hari nggak ketemu! KalKu kangen nih.`;
    if (goalsCount > 0) body += ` Goals-mu juga butuh perhatian nih!`;
    body += ' Balik yuk biar keuanganmu terpantau!';
    return {
      type: 'atrisk_2',
      title: '⚠️ 2 hari tanpa catatan',
      body,
      screen: '/',
    };
  }

  if (daysInactive >= 3) {
    return {
      type: 'atrisk_2',
      title: '💙 Kami masih di sini',
      body: `${name}, keuanganmu tetap bisa terpantau kalau kamu mau balik. Satu catatan aja sudah cukup!`,
      screen: '/',
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAREWELL
// ─────────────────────────────────────────────────────────────────────────────
function getFarewellNotif(name: string): NotifPayload {
  return {
    type: 'farewell',
    title: `👋 Sampai jumpa, ${name}`,
    body: 'Duwitku nggak akan ganggu lagi. Tapi kalau kamu mau balik dan mulai catat keuangan lagi, kami selalu ada. Semoga sehat selalu! 💙',
    screen: '/',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now        = new Date();     // UTC murni — untuk gap check & timestamp DB
  const nowLocal   = nowWIB();       // WIB — untuk komponen tanggal/jam lokal
  const hour       = hourWIB();      // jam WIB (0-23)
  const dayOfWeek  = dayOfWeekWIB(); // hari WIB (0=Min … 6=Sab)
  const dayOfMonth = nowLocal.getUTCDate();
  const daysInMonth = new Date(
    nowLocal.getUTCFullYear(),
    nowLocal.getUTCMonth() + 1,
    0
  ).getDate();
  const log: any[] = [];

  console.log(`[Scheduler] UTC=${now.toISOString()} WIB=${nowLocal.toISOString().replace('T', ' ').slice(0, 19)} hour_wib=${hour} dow_wib=${dayOfWeek} day=${dayOfMonth}`);

  try {
    // ── Get FCM users ──────────────────────────────────────────────────────
    const { data: fcmUsers } = await supabaseAdmin
      .from('user_fcm_tokens')
      .select('user_id')
      .order('updated_at', { ascending: false });

    const fcmUserIds = new Set((fcmUsers ?? []).map((u: any) => u.user_id));

    if (fcmUserIds.size === 0) {
      console.log('[Scheduler] No FCM users found, exiting.');
      return new Response(
        JSON.stringify({ success: true, processed: 0, log: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Get journeys ───────────────────────────────────────────────────────
    const { data: journeys, error: jErr } = await supabaseAdmin
      .from('notification_journey')
      .select('user_id')
      .neq('stage', 'silent');

    if (jErr) throw jErr;

    const existingJourneyUserIds = new Set((journeys ?? []).map((j: any) => j.user_id));

    // Buat journey baru untuk user yang belum punya
    for (const userId of fcmUserIds) {
      if (!existingJourneyUserIds.has(userId)) {
        await supabaseAdmin.from('notification_journey').upsert({
          user_id: userId,
          stage: 'onboarding',
          registered_at: now.toISOString(),
          first_insight_sent: false,
          last_notif_type: null,
        });
        console.log(`[Scheduler] Created new journey for user ${userId}`);
      }
    }

    // ── Get all active journeys ────────────────────────────────────────────
    const { data: allJourneys } = await supabaseAdmin
      .from('notification_journey')
      .select('*')
      .neq('stage', 'silent')
      .in('user_id', [...fcmUserIds]);

    console.log(`[Scheduler] Processing ${(allJourneys ?? []).length} journeys`);

    // Hitung batas waktu filter transaksi sekali saja (WIB-aware)
    const startOfMonth    = midnightStartOfMonthWIB(); // 00:00 WIB tgl 1 bulan ini
    const todayStart      = midnightTodayWIB();         // 00:00 WIB hari ini
    const sevenDaysAgoDate = sevenDaysAgo();            // 7 hari lalu dari sekarang

    for (const journey of allJourneys ?? []) {
      try {
        const userId        = journey.user_id;
        const stage         = journey.stage as string;
        const lastNotif     = journey.last_notif_at ? new Date(journey.last_notif_at).getTime() : 0;
        const lastNotifType = journey.last_notif_type ?? 'default';

        // ── Gap check berdasarkan tipe notif terakhir ─────────────────────
        const gap = stage === 'onboarding'
          ? MIN_GAP_ONBOARDING
          : stage === 'at_risk'
          ? MIN_GAP_ATRISK
          : (TYPE_GAPS[lastNotifType] ?? TYPE_GAPS['default']);

        const timeSinceLastNotif = now.getTime() - lastNotif;

        if (timeSinceLastNotif < gap) {
          console.log(`[Scheduler] ${userId} | skip | gap not met (${Math.round(timeSinceLastNotif / HOURS(1))}h < ${gap / HOURS(1)}h)`);
          continue;
        }

        // ── Profile ───────────────────────────────────────────────────────
        const { data: profile, error: profileErr } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();

        if (profileErr) {
          console.error(`[Scheduler] ${userId} | failed to fetch profile:`, profileErr.message);
        }

        const name = profile?.full_name ?? 'Kamu';

        // ── Transactions bulan ini (batas mulai = 00:00 WIB tgl 1) ───────
        const { data: txs } = await supabaseAdmin
          .from('transactions')
          .select('id, amount, type, created_at')
          .eq('user_id', userId)
          .gte('created_at', startOfMonth.toISOString())
          .order('created_at', { ascending: false });

        const allTx      = txs ?? [];
        const hasIncome  = allTx.some((t: any) => t.type === 'INCOME');
        const hasExpense = allTx.some((t: any) => t.type === 'EXPENSE');
        const hasAnyTx   = allTx.length > 0;

        // Pengeluaran hari ini — batas mulai = 00:00 WIB hari ini
        const todayExpense = allTx
          .filter((t: any) => t.type === 'EXPENSE' && new Date(t.created_at) >= todayStart)
          .reduce((s: number, t: any) => s + t.amount, 0);

        // Pengeluaran 7 hari terakhir
        const { data: weeklyTxs } = await supabaseAdmin
          .from('transactions')
          .select('amount, type')
          .eq('user_id', userId)
          .eq('type', 'EXPENSE')
          .gte('created_at', sevenDaysAgoDate.toISOString());

        const weeklyExpense    = (weeklyTxs ?? []).reduce((s: number, t: any) => s + t.amount, 0);
        const monthExpense     = allTx.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + t.amount, 0);
        const monthIncome      = allTx.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + t.amount, 0);
        const balance          = monthIncome - monthExpense;
        const avgDaily         = dayOfMonth > 1 ? monthExpense / (dayOfMonth - 1) : monthExpense;
        const avgWeeklyExpense = avgDaily * 7;
        const daysLeft         = daysInMonth - dayOfMonth;
        const dailyAllowance   = daysLeft > 0 ? balance / daysLeft : 0;
        const txCountThisMonth = allTx.length;

        // ── Journey timing ────────────────────────────────────────────────
        const lastOpened = journey.last_opened_at
          ? new Date(journey.last_opened_at)
          : new Date(journey.registered_at);

        const hoursSinceRegister = (now.getTime() - new Date(journey.registered_at).getTime()) / HOURS(1);
        const daysInactive       = (now.getTime() - lastOpened.getTime()) / DAYS(1);

        // ── Installments ──────────────────────────────────────────────────
        const { data: installments } = await supabaseAdmin
          .from('installments')
          .select('id, name, amount, due_date')
          .eq('user_id', userId)
          .eq('is_active', true);

        const urgentInstallments = (installments ?? []).filter((i: any) => {
          const daysUntil = i.due_date - dayOfMonth; // dayOfMonth sudah WIB
          return daysUntil >= -1 && daysUntil <= 3;
        });
        const installmentsCount = (installments ?? []).length;

        // ── Goals ─────────────────────────────────────────────────────────
        const { data: goals } = await supabaseAdmin
          .from('goals')
          .select('id, name, target_amount, current_amount')
          .eq('user_id', userId)
          .eq('status', 'active');

        const nearGoal = (goals ?? []).find((g: any) => {
          const pct = (g.current_amount / g.target_amount) * 100;
          return pct >= 80 && pct < 100;
        }) ?? null;
        const goalsCount = (goals ?? []).length;

        // ── Streak ────────────────────────────────────────────────────────
        const { data: streakData } = await supabaseAdmin
          .from('streak_tracker')
          .select('streak_days')
          .eq('user_id', userId)
          .single();

        // ── Budgets ───────────────────────────────────────────────────────
        const { data: budgets } = await supabaseAdmin
          .from('budgets')
          .select('limit, spent')
          .eq('user_id', userId);

        const totalBudgetLimit   = (budgets ?? []).reduce((sum: number, b: any) => sum + b.limit, 0);
        const totalBudgetSpent   = (budgets ?? []).reduce((sum: number, b: any) => sum + b.spent, 0);
        const hasBudgetOverspend = (budgets ?? []).some((b: any) => b.spent > b.limit);

        // ── Determine stage ───────────────────────────────────────────────
        let newStage = stage;

        // Update stage ke active jika sudah punya income & expense
        if (stage === 'onboarding' && hasIncome && hasExpense) {
          newStage = 'active';
          await supabaseAdmin
            .from('notification_journey')
            .update({ stage: 'active' })
            .eq('user_id', userId);
          console.log(`[Scheduler] ${userId} | promoted onboarding → active`);
        }

        if (daysInactive >= SILENT_AFTER_DAYS && journey.farewell_sent) {
          await supabaseAdmin
            .from('notification_journey')
            .update({ stage: 'silent' })
            .eq('user_id', userId);
          console.log(`[Scheduler] ${userId} | moved to silent`);
          continue;
        }

        if (daysInactive >= 1 && newStage === 'active') {
          newStage = 'at_risk';
        }

        if (daysInactive < 1 && stage === 'at_risk') {
          newStage = 'active';
          await supabaseAdmin
            .from('notification_journey')
            .update({ stage: 'active', atrisk_notif_count: 0 })
            .eq('user_id', userId);
          console.log(`[Scheduler] ${userId} | recovered at_risk → active`);
        }

        // ── Generate payload ──────────────────────────────────────────────
        let payload: NotifPayload | null = null;
        let updates: Record<string, any> = { stage: newStage };

        if (newStage === 'onboarding') {
          payload = getOnboardingNotif({
            name,
            count: journey.onboarding_notif_count ?? 0,
            hoursSinceRegister,
            hasAnyTransaction: hasAnyTx,
            hasIncome,
            hasExpense,
          });

          // Fallback: jika onboarding return null tapi user sudah aktif
          if (!payload && hasAnyTx) {
            newStage = 'active';
            updates.stage = 'active';
            payload = getActiveNotif({
              name, hour, dayOfWeek, dayOfMonth, daysInMonth,
              todayExpense, weeklyExpense,
              avgDailyExpense: avgDaily, avgWeeklyExpense,
              balance, dailyAllowance,
              streakDays: streakData?.streak_days ?? 0,
              urgentInstallments: urgentInstallments || [],
              nearGoal, goalsCount, installmentsCount,
              hasBudgetOverspend, totalBudgetLimit, totalBudgetSpent,
              txCountThisMonth,
              isFirstInsight: false,
              lastNotifType,
            });
          } else if (payload) {
            updates.onboarding_notif_count = (journey.onboarding_notif_count ?? 0) + 1;
          }

        } else if (newStage === 'active') {
          const isFirstInsight = !journey.first_insight_sent && txCountThisMonth >= 3;

          payload = getActiveNotif({
            name, hour, dayOfWeek, dayOfMonth, daysInMonth,
            todayExpense, weeklyExpense,
            avgDailyExpense: avgDaily, avgWeeklyExpense,
            balance, dailyAllowance,
            streakDays: streakData?.streak_days ?? 0,
            urgentInstallments: urgentInstallments || [],
            nearGoal, goalsCount, installmentsCount,
            hasBudgetOverspend, totalBudgetLimit, totalBudgetSpent,
            txCountThisMonth,
            isFirstInsight,
            lastNotifType,
          });

          if (payload?.type === 'first_insight') {
            updates.first_insight_sent = true;
          }

        } else if (newStage === 'at_risk') {
          if (!journey.farewell_sent && daysInactive >= SILENT_AFTER_DAYS) {
            payload = getFarewellNotif(name);
            updates.farewell_sent = true;
            updates.stage = 'silent';
          } else {
            payload = getAtRiskNotif({
              name,
              daysInactive,
              count: journey.atrisk_notif_count ?? 0,
              streakDays: streakData?.streak_days ?? 0,
              balance,
              installmentsCount,
              goalsCount,
            });
            if (payload) {
              updates.atrisk_notif_count = (journey.atrisk_notif_count ?? 0) + 1;
            }
          }
        }

        // ── Send ──────────────────────────────────────────────────────────
        if (payload) {
          const notifyRes = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/kalku-notify`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                userId,
                title : payload.title,
                body  : payload.body,
                type  : payload.type,
                screen: payload.screen,
              }),
            }
          );

          const notifyResult = await notifyRes.json();
          const sent = notifyResult.success ?? false;

          if (sent) {
            updates.last_notif_at   = now.toISOString();
            updates.last_notif_type = payload.type;
          }

          log.push({ userId, stage: newStage, type: payload.type, sent });
          console.log(`[Scheduler] ${userId} | ${newStage} | ${payload.type} | sent=${sent}`);
        } else {
          console.log(`[Scheduler] ${userId} | ${newStage} | no payload (hour_wib=${hour}, dow_wib=${dayOfWeek})`);
        }

        // ── Update journey ────────────────────────────────────────────────
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin
            .from('notification_journey')
            .update(updates)
            .eq('user_id', userId);
        }

        await new Promise(r => setTimeout(r, 200));

      } catch (err) {
        console.error(`[Scheduler] Error for ${journey.user_id}:`, err);
        log.push({ userId: journey.user_id, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: (allJourneys ?? []).length, log }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Scheduler] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});