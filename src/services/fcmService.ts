// src/services/fcmService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from './supabase/client';

const FCM_TOKEN_KEY = 'fcm_device_token';
const FCM_LAST_SAVED_KEY = 'fcm_last_saved_token';
const MAX_SAVE_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface FCMNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface FCMInitResult {
  token: string | null;
  cleanup: () => void;
}

// ── Setup handler notif saat app foreground ───────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }) as any,
});

// ── Navigasi ──────────────────────────────────────────────────────────────────
function navigateFromNotificationData(data: any, delayMs = 0): void {
  const screen = data?.screen;
  if (!screen) return;
  const targetPath = screen.startsWith('/') ? screen : `/${screen}`;
  if (targetPath.includes('..') || targetPath.includes('//')) return;

  const doNavigate = () => {
    try { router.push(targetPath as any); } 
    catch (e) { console.error('[FCM] Nav error:', e); }
  };

  delayMs > 0 ? setTimeout(doNavigate, delayMs) : doNavigate();
}

// ── Minta permission & ambil FCM token ───────────────────────────────────────
export async function getFCMToken(): Promise<string | null> {
  try {
    // Minta permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[FCM] Permission denied');
      return null;
    }

    // Ambil FCM token — ini tetap FCM token, bukan Expo token
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;

    if (token) {
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      console.log('[FCM] Got token:', token.slice(0, 20) + '...');
    }

    return token ?? null;
  } catch (error) {
    console.error('[FCM] Error getting token:', error);
    const cached = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    return cached ?? null;
  }
}

// ── Simpan token ke Supabase ──────────────────────────────────────────────────
export async function saveFCMTokenToSupabase(
  token: string,
  force = false
): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: 'Token is empty' };

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { success: false, error: 'No user logged in' };

    const { data: existingToken } = await supabase
      .from('user_fcm_tokens')
      .select('token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!force && existingToken?.token === token) {
      await AsyncStorage.setItem(FCM_LAST_SAVED_KEY, token);
      return { success: true };
    }

    // Hapus orphan token
    await supabase
      .from('user_fcm_tokens')
      .delete()
      .eq('token', token)
      .neq('user_id', user.id);

    const payload = {
      user_id: user.id,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_fcm_tokens')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) return { success: false, error: error.message };

    await AsyncStorage.setItem(FCM_LAST_SAVED_KEY, token);
    console.log('[FCM] Token saved ✅');
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────
export async function saveFCMTokenWithRetry(
  token: string,
  force = false,
  maxRetries = MAX_SAVE_RETRIES
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await saveFCMTokenToSupabase(token, force);
    if (result.success) return true;
    if (i < maxRetries - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  return false;
}

// ── Init FCM — entry point utama ──────────────────────────────────────────────
export async function initFCM(
  onForegroundMessage?: (notification: FCMNotification) => void
): Promise<FCMInitResult> {
  const subscriptions: Notifications.Subscription[] = [];

  const cleanup = () => {
    subscriptions.forEach(s => s.remove());
    console.log('[FCM] Cleanup complete');
  };

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('kalku_proactive_v3', {
        name: 'Duwitku Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'notification',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b6ef5',
      });
    }

    const token = await getFCMToken();

    if (token) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await saveFCMTokenWithRetry(token, true);
      }
    }

    // Foreground listener
    const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
      console.log('[FCM] Foreground notification:', notification.request.content.title);
      if (onForegroundMessage) {
        onForegroundMessage({
          title: notification.request.content.title ?? 'Duwitku',
          body: notification.request.content.body ?? '',
          data: notification.request.content.data,
        });
      }
    });
    subscriptions.push(foregroundSub);

    // Tap notif listener (background → open app)
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[FCM] Notification tapped');
      navigateFromNotificationData(response.notification.request.content.data);
    });
    subscriptions.push(responseSub);

    // Cek notif yang dibuka dari quit state
    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      navigateFromNotificationData(lastResponse.notification.request.content.data, 1000);
    }

    console.log('[FCM] Init complete ✅');
    return { token, cleanup };
  } catch (e) {
    console.error('[FCM] Init error:', e);
    return { token: null, cleanup };
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
export async function removeFCMToken(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_fcm_tokens').delete().eq('user_id', user.id);
    }
    await AsyncStorage.multiRemove([FCM_TOKEN_KEY, FCM_LAST_SAVED_KEY]);
    console.log('[FCM] Token removed ✅');
  } catch (e) {
    console.error('[FCM] Remove token error:', e);
  }
}

export async function refreshFCMToken(): Promise<string | null> {
  await AsyncStorage.multiRemove([FCM_TOKEN_KEY, FCM_LAST_SAVED_KEY]);
  const token = await getFCMToken();
  if (token) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_fcm_tokens').delete().eq('user_id', user.id);
      await saveFCMTokenWithRetry(token, true);
    }
  }
  return token;
}