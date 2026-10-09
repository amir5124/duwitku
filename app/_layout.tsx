// app/_layout.tsx
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { OnboardingProvider } from '../src/contexts/OnboardingContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { supabase } from '../src/services/supabase/client';

import '../global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

SplashScreen.preventAutoHideAsync();

export const ONBOARDING_KEY = 'hasSeenOnboarding';

const PUBLIC_SEGMENTS = ['onboarding', '(auth)'];

// ─── Helper: Update user activity & reactivate silent user ────────────────
const updateUserActivity = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Cek status user di notification_journey
    const { data: journey, error } = await supabase
      .from('notification_journey')
      .select('stage, farewell_sent')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // Jika belum ada journey, buat baru
      if (error.code === 'PGRST116') {
        await supabase
          .from('notification_journey')
          .insert({
            user_id: user.id,
            stage: 'onboarding',
            registered_at: new Date().toISOString(),
            last_opened_at: new Date().toISOString()
          });
        console.log('✅ Journey created for user:', user.id);
      }
      return;
    }

    // ── Jika user silent, reactivate ──
    if (journey?.stage === 'silent') {
      console.log('🔄 Reactivating silent user:', user.id);

      await supabase
        .from('notification_journey')
        .update({
          stage: 'active',
          farewell_sent: false,
          last_notif_at: null,
          last_opened_at: new Date().toISOString(),
          atrisk_notif_count: 0
        })
        .eq('user_id', user.id);

      console.log('✅ User reactivated from silent');
    } else {
      // ── Update last_opened_at ──
      await supabase
        .from('notification_journey')
        .update({
          last_opened_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    }
  } catch (error) {
    console.error('Error updating user activity:', error);
  }
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function InnerLayout() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  const hasRedirected = useRef(false);

  // ── Deep Link ──────────────────────────────────────────────────────
  const handleDeepLink = (url: string) => {
    if (!url) return;
    try {
      const parsed = Linking.parse(url);
      let path = parsed.path?.replace(/^\/+|\/+$/g, '') || '';
      if (!path || path === 'home') path = '';
      router.replace(path ? `/${path}` : '/');
    } catch (error) {
      console.error('❌ [DeepLink] Error:', error);
      router.replace('/');
    }
  };

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      setTimeout(() => handleDeepLink(url), 100);
    });
    Linking.getInitialURL().then(url => {
      if (url) setTimeout(() => handleDeepLink(url), 1500);
    });
    return () => subscription.remove();
  }, []);

  // ─── Cek Session ────────────────────────────────────────────────────
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.error('❌ [Auth] Session error:', error);
        setSession(session);
      } catch (error) {
        console.error('❌ [Auth] Session check error:', error);
        setSession(null);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      hasRedirected.current = false;
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── Cek Flag Onboarding ────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading) return;

    if (session) {
      setShowOnboarding(false);
      return;
    }

    let isMounted = true;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(seen => {
        if (isMounted) {
          setShowOnboarding(seen !== 'true');
        }
      })
      .catch(() => {
        if (isMounted) setShowOnboarding(true);
      });

    return () => { isMounted = false; };
  }, [session, isAuthLoading]);

  // ─── Auto-reactivate User & Update Activity ──────────────────────
  useEffect(() => {
    // Jalankan saat app dibuka
    if (session) {
      updateUserActivity();
    }

    // Listener untuk app state (foreground/background)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && session) {
        updateUserActivity();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [session]);

  // ─── Redirect Logic ─────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading || showOnboarding === null) return;

    const currentSegment = segments[0] as string | undefined;
    const isOnPublicRoute = PUBLIC_SEGMENTS.includes(currentSegment ?? '');

    if (session) {
      if (isOnPublicRoute) {
        router.replace('/(tabs)');
      }
      return;
    }

    if (showOnboarding) {
      if (currentSegment !== 'onboarding') {
        router.replace('/onboarding');
      }
    } else {
      if (!isOnPublicRoute) {
        router.replace('/(auth)/login');
      }
    }
  }, [session, isAuthLoading, showOnboarding, segments]);

  const isLoading = isAuthLoading || (session === null && showOnboarding === null);
  if (isLoading) return null;

  const FULLSCREEN_SEGMENTS = ['(tabs)', '(auth)', 'onboarding'];
  const isFullscreen = FULLSCREEN_SEGMENTS.includes((segments[0] as string) ?? '');

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OnboardingProvider value={{ showOnboarding, setShowOnboarding }}>
        <View
          style={[
            styles.root,
            !isFullscreen && {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <NotificationProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="transactions/add-income" options={{ presentation: 'card' }} />
              <Stack.Screen name="transactions/add-expense" options={{ presentation: 'card' }} />
              <Stack.Screen name="kalku" />
              <Stack.Screen name="upgrade-pro" />
            </Stack>
          </NotificationProvider>
        </View>
      </OnboardingProvider>
    </NavThemeProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <InnerLayout />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});