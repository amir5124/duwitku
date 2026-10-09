// src/contexts/NotificationContext.tsx
import {
    FCMNotification,
    initFCM,
    refreshFCMToken,
    removeFCMToken,
} from '@/src/services/fcmService';
import { supabase } from '@/src/services/supabase/client';
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface NotificationContextType {
    fcmToken: string | null;
    isReady: boolean;
    refreshToken: () => Promise<string | null>;
    removeToken: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────
const NotificationContext = createContext<NotificationContextType>({
    fcmToken: null,
    isReady: false,
    refreshToken: async () => null,
    removeToken: async () => { },
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: ReactNode }) {
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const router = useRouter();

    const fcmCleanupRef = useRef<(() => void) | null>(null);

    // ── Navigasi ───────────────────────────────────────────────────────────────
    const navigateTo = (screen: string) => {
        try {
            if (!screen || screen === 'home' || screen === '') {
                router.push('/');
                return;
            }
            const targetPath = screen.startsWith('/') ? screen : `/${screen}`;
            if (targetPath.includes('..') || targetPath.includes('//')) {
                router.push('/');
                return;
            }
            router.push(targetPath as any);
        } catch (error) {
            console.error('[Navigation] Error:', error);
            router.push('/');
        }
    };

    // ── Handle Foreground Notification ────────────────────────────────────────
    const handleForegroundNotification = (notification: FCMNotification) => {
        const screen = notification.data?.screen || 'home';
        Alert.alert(
            notification.title || 'Duwitku',
            notification.body || '',
            [
                { text: 'Lihat', onPress: () => navigateTo(screen) },
                { text: 'Tutup', style: 'cancel' },
            ],
            { cancelable: true }
        );
    };

    // ── Init FCM ──────────────────────────────────────────────────────────────
    const runInitFCM = async (): Promise<string | null> => {
        if (fcmCleanupRef.current) {
            fcmCleanupRef.current();
            fcmCleanupRef.current = null;
        }
        const { token, cleanup } = await initFCM(handleForegroundNotification);
        fcmCleanupRef.current = cleanup;
        return token;
    };

    // ── Handle token setelah login ────────────────────────────────────────────
    const handleTokenAfterLogin = async (): Promise<string | null> => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) return null;

            const { data: existingTokens } = await supabase
                .from('user_fcm_tokens')
                .select('token, updated_at')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false })
                .limit(1);

            let token: string | null = null;
            const sevenDays = 7 * 24 * 60 * 60 * 1000;

            if (existingTokens && existingTokens.length > 0) {
                const tokenAge = Date.now() - new Date(existingTokens[0].updated_at).getTime();

                if (tokenAge > sevenDays) {
                    token = await refreshFCMToken();
                    if (token) {
                        const freshToken = await runInitFCM();
                        token = freshToken ?? token;
                    }
                } else {
                    token = await runInitFCM();
                }
            } else {
                token = await runInitFCM();
            }

            if (token) setFcmToken(token);
            return token;
        } catch (error) {
            console.error('[Auth] Token handling error:', error);
            return null;
        }
    };

    // ── Refresh Token (manual) ────────────────────────────────────────────────
    const refreshToken = async (): Promise<string | null> => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                Alert.alert('Error', 'Silakan login terlebih dahulu');
                return null;
            }
            const newToken = await refreshFCMToken();
            if (newToken) {
                setFcmToken(newToken);
                return newToken;
            }
            return null;
        } catch (error) {
            console.error('[Token] Refresh error:', error);
            return null;
        }
    };

    // ── Remove Token ──────────────────────────────────────────────────────────
    const removeToken = async (): Promise<void> => {
        try {
            await removeFCMToken();
            setFcmToken(null);
        } catch (error) {
            console.error('[Token] Remove error:', error);
        }
    };

    // ── Auth State Listener ───────────────────────────────────────────────────
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log(`[Auth] State changed: ${event} | user: ${session?.user?.id ?? 'none'}`);
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    await handleTokenAfterLogin();
                } else if (event === 'SIGNED_OUT') {
                    await removeToken();
                }
            }
        );
        return () => subscription.unsubscribe();
    }, []);

    // ── Setup FCM saat app start ──────────────────────────────────────────────
    useEffect(() => {
        const setup = async () => {
            if (Platform.OS === 'web') {
                setIsReady(true);
                return;
            }

            try {
                let user = null;
                try {
                    const { data: { user: authUser }, error } = await supabase.auth.getUser();
                    if (error) {
                        if (!error.message?.includes('Auth session missing')) {
                            console.error('[FCM] User fetch error:', error);
                        }
                    } else {
                        user = authUser;
                    }
                } catch {
                    // Belum ada sesi — expected
                }

                if (user) {
                    await handleTokenAfterLogin();
                } else {
                    const token = await runInitFCM();
                    setFcmToken(token);
                }
            } catch (error) {
                console.error('[FCM] Setup error:', error);
            } finally {
                setIsReady(true);
            }
        };

        setup();

        return () => {
            if (fcmCleanupRef.current) {
                fcmCleanupRef.current();
                fcmCleanupRef.current = null;
            }
        };
    }, []);

    return (
        <NotificationContext.Provider value={{ fcmToken, isReady, refreshToken, removeToken }}>
            {children}
        </NotificationContext.Provider>
    );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useNotification = () => useContext(NotificationContext);