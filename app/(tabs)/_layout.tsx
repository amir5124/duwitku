// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function TabsLayout() {
  const { isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#0f1a3d' : '#ffffff',
          borderTopColor: isDark ? '#1a2a55' : '#e5e7eb',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: isDark ? '#818cf8' : '#4f46e5',
        tabBarInactiveTintColor: isDark ? '#4b5a7a' : '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={size}
                color={color}
              />
              {focused && (
                <View style={{
                  position: 'absolute',
                  bottom: -6,
                  left: '50%',
                  transform: [{ translateX: -8 }],
                  width: 16,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: color,
                }} />
              )}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analitik',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={focused ? 'stats-chart' : 'stats-chart-outline'}
                size={size}
                color={color}
              />
              {focused && (
                <View style={{
                  position: 'absolute',
                  bottom: -6,
                  left: '50%',
                  transform: [{ translateX: -8 }],
                  width: 16,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: color,
                }} />
              )}
            </View>
          ),
        }}
      />

// Di _layout.tsx, tambahkan di options
      <Tabs.Screen
        name="challenges"
        options={{
          title: 'Challenge',
          tabBarIcon: ({ color, size, focused }) => {
            const hasActiveChallenge = true; // Ganti dengan logic sebenarnya
            return (
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name={focused ? 'trophy' : 'trophy-outline'}
                  size={size}
                  color={color}
                />
                {hasActiveChallenge && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#ef4444',
                    borderWidth: 2,
                    borderColor: isDark ? '#0f1a3d' : '#ffffff',
                  }} />
                )}
                {focused && (
                  <View style={{
                    position: 'absolute',
                    bottom: -6,
                    left: '50%',
                    transform: [{ translateX: -8 }],
                    width: 16,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: color,
                  }} />
                )}
              </View>
            );
          },
        }}
      />

      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={focused ? 'list' : 'list-outline'}
                size={size}
                color={color}
              />
              {focused && (
                <View style={{
                  position: 'absolute',
                  bottom: -6,
                  left: '50%',
                  transform: [{ translateX: -8 }],
                  width: 16,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: color,
                }} />
              )}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={size}
                color={color}
              />
              {focused && (
                <View style={{
                  position: 'absolute',
                  bottom: -6,
                  left: '50%',
                  transform: [{ translateX: -8 }],
                  width: 16,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: color,
                }} />
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}