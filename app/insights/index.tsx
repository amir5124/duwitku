// app/insights/index.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { supabase } from '../../src/services/supabase/client';

interface InsightData {
    prediction: string;
    recommendations: string[];
    motivation: string;
    challenge_suggestion: string;
}

export default function InsightsScreen() {
    const { isDark } = useTheme();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [insights, setInsights] = useState<InsightData | null>(null);
    const [meta, setMeta] = useState<any>(null);

    const fetchInsights = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/insights/insights`,
                {
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                    },
                }
            );
            const data = await response.json();
            setInsights(data.insights);
            setMeta(data.meta);
        } catch (error) {
            console.error('Error fetching insights:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchInsights();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#080f24' : '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={isDark ? '#818cf8' : '#4f46e5'} />
                <Text style={{ color: isDark ? '#c3cee6' : '#374151', marginTop: 12 }}>
                    🔮 Menganalisis data keuanganmu...
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#080f24' : '#f8fafc' }}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                style={{ flex: 1, paddingHorizontal: 16 }}
            >
                {/* ─── Header ──────────────────────────────────────────────────────── */}
                <View style={{ marginTop: 12, marginBottom: 16 }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: isDark ? '#fff' : '#111' }}>
                        🔮 Insight Finansial
                    </Text>
                    <Text style={{ fontSize: 14, color: isDark ? '#5a6b94' : '#6b7280', marginTop: 4 }}>
                        Analisis AI untuk masa depan keuanganmu
                    </Text>
                </View>

                {insights ? (
                    <>
                        {/* ─── Prediksi ────────────────────────────────────────────────── */}
                        <View style={{
                            backgroundColor: isDark ? '#0f1a3d' : '#fff',
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Ionicons name="trending-up" size={24} color={isDark ? '#818cf8' : '#4f46e5'} />
                                <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#111' }}>
                                    Prediksi 3 Bulan Ke Depan
                                </Text>
                            </View>
                            <Text style={{ fontSize: 14, lineHeight: 22, color: isDark ? '#c3cee6' : '#374151' }}>
                                {insights.prediction}
                            </Text>
                        </View>

                        {/* ─── Rekomendasi ────────────────────────────────────────────── */}
                        <View style={{
                            backgroundColor: isDark ? '#0f1a3d' : '#fff',
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Ionicons name="bulb" size={24} color={isDark ? '#f59e0b' : '#f59e0b'} />
                                <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#111' }}>
                                    Rekomendasi Hemat
                                </Text>
                            </View>
                            {insights.recommendations?.map((rec, idx) => (
                                <View key={idx} style={{
                                    flexDirection: 'row',
                                    alignItems: 'flex-start',
                                    gap: 8,
                                    marginBottom: 8,
                                }}>
                                    <Text style={{ color: isDark ? '#818cf8' : '#4f46e5', fontWeight: '600' }}>
                                        {idx + 1}.
                                    </Text>
                                    <Text style={{ fontSize: 14, color: isDark ? '#c3cee6' : '#374151', flex: 1 }}>
                                        {rec}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* ─── Motivasi ────────────────────────────────────────────────── */}
                        <View style={{
                            backgroundColor: isDark ? '#1a2150' : '#eef2ff',
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 16,
                            alignItems: 'center',
                        }}>
                            <Text style={{ fontSize: 18, marginBottom: 4 }}>💪</Text>
                            <Text style={{
                                fontSize: 15,
                                fontWeight: '500',
                                textAlign: 'center',
                                color: isDark ? '#c7d2fe' : '#3730a3',
                            }}>
                                {insights.motivation}
                            </Text>
                        </View>

                        {/* ─── Challenge Suggestion ────────────────────────────────────── */}
                        <View style={{
                            backgroundColor: isDark ? '#0f1a3d' : '#fff',
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Ionicons name="flag" size={24} color={isDark ? '#34d399' : '#10b981'} />
                                <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#111' }}>
                                    Challenge Rekomendasi
                                </Text>
                            </View>
                            <Text style={{ fontSize: 14, color: isDark ? '#c3cee6' : '#374151' }}>
                                {insights.challenge_suggestion}
                            </Text>
                        </View>

                        {/* ─── Meta Info ────────────────────────────────────────────────── */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 }}>
                            <Text style={{ fontSize: 12, color: isDark ? '#5a6b94' : '#9ca3af' }}>
                                📊 {meta?.total_transactions || 0} transaksi
                            </Text>
                            <Text style={{ fontSize: 12, color: isDark ? '#5a6b94' : '#9ca3af' }}>
                                🎯 {meta?.active_challenges || 0} challenge aktif
                            </Text>
                            <Text style={{ fontSize: 12, color: isDark ? '#5a6b94' : '#9ca3af' }}>
                                🔥 {meta?.streak_days || 0} hari streak
                            </Text>
                        </View>
                    </>
                ) : (
                    <View style={{
                        backgroundColor: isDark ? '#0f1a3d' : '#fff',
                        borderRadius: 16,
                        padding: 24,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                    }}>
                        <Text style={{ fontSize: 48, marginBottom: 12 }}>📊</Text>
                        <Text style={{ fontSize: 16, color: isDark ? '#c3cee6' : '#374151', textAlign: 'center' }}>
                            Belum ada cukup data untuk analisis
                        </Text>
                        <Text style={{ fontSize: 13, color: isDark ? '#5a6b94' : '#9ca3af', textAlign: 'center', marginTop: 4 }}>
                            Catat transaksi secara rutin agar AI bisa memberikan insight yang akurat
                        </Text>
                    </View>
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}