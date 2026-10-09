// src/services/journeyTracker.ts
// Panggil ini setiap kali user membuka app agar scheduler tahu user masih aktif.
// ─────────────────────────────────────────────────────────────────────────────

import { AppState, AppStateStatus } from 'react-native';
import { supabase } from './supabase/client';

let lastPingAt = 0;
const PING_INTERVAL = 30 * 60 * 1000; // ping max 1x per 30 menit

// ── Update last_opened_at di notification_journey ────────────────────────────
export async function pingJourney(): Promise<void> {
  const now = Date.now();
  if (now - lastPingAt < PING_INTERVAL) return; // throttle

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notification_journey')
      .upsert(
        {
          user_id       : user.id,
          last_opened_at: new Date().toISOString(),
          // Kalau baris belum ada (user baru), set stage onboarding
          stage         : 'onboarding',
          registered_at : new Date().toISOString(),
        },
        {
          onConflict       : 'user_id',
          // Hanya update last_opened_at jika baris sudah ada
          ignoreDuplicates : false,
        }
      );

    // Jika sudah ada, hanya update last_opened_at (bukan overwrite stage)
    if (error?.code === '23505' || !error) {
      await supabase
        .from('notification_journey')
        .update({ last_opened_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }

    lastPingAt = now;
    console.log('✅ Journey ping sent');
  } catch (e) {
    console.warn('⚠️ Journey ping failed:', e);
  }
}

// ── Update last_tx_at setelah user berhasil catat transaksi ──────────────────
export async function pingTransactionRecorded(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notification_journey')
      .update({ last_tx_at: new Date().toISOString() })
      .eq('user_id', user.id);
  } catch (e) {
    console.warn('⚠️ Journey tx ping failed:', e);
  }
}

// ── Setup listener AppState (panggil sekali di App.tsx / _layout.tsx) ────────
export function setupJourneyTracker(): () => void {
  // Ping saat pertama kali app dibuka
  pingJourney();

  // Ping setiap kali app kembali ke foreground
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      pingJourney();
    }
  });

  return () => sub.remove();
}