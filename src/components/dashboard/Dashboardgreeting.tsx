// src/components/dashboard/DashboardGreeting.tsx
// Komponen greeting personal: nama user + waktu + tanggal + cuaca mood

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../../services/supabase/client';

interface Props {
    hasRisk?: boolean;
}

function getGreeting(): { text: string; icon: keyof typeof Ionicons.glyphMap } {
    const h = new Date().getHours();
    if (h < 5) return { text: 'Selamat malam', icon: 'moon-outline' };
    if (h < 11) return { text: 'Selamat pagi', icon: 'sunny-outline' };
    if (h < 15) return { text: 'Selamat siang', icon: 'partly-sunny-outline' };
    if (h < 19) return { text: 'Selamat sore', icon: 'cloudy-outline' };
    return { text: 'Selamat malam', icon: 'moon-outline' };
}

function getTodayString(): string {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    // Kapitalisasi huruf pertama
    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
}

export function DashboardGreeting({ hasRisk }: Props) {
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const greeting = getGreeting();
    const todayString = getTodayString();

    useEffect(() => {
        const loadUserName = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Cek dari tabel users terlebih dahulu
                    const { data: userData } = await supabase
                        .from('users')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    if (userData?.full_name) {
                        // Ambil nama depan saja
                        setName(userData.full_name.split(' ')[0]);
                    } else {
                        // Fallback ke metadata atau email
                        const fullName = user.user_metadata?.full_name
                            || user.user_metadata?.name
                            || user.email?.split('@')[0]
                            || 'Pengguna';
                        setName(fullName.split(' ')[0]);
                    }
                } else {
                    setName('Pengguna');
                }
            } catch (error) {
                console.error('Error loading user name:', error);
                setName('Pengguna');
            } finally {
                setIsLoading(false);
            }
        };

        loadUserName();
    }, []);

    if (isLoading) {
        return (
            <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <Ionicons name={greeting.icon} size={16} color="#f59e0b" />
                            <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '500' }}>
                                {greeting.text}
                            </Text>
                        </View>
                        <View style={{ width: 120, height: 28, backgroundColor: '#e5e7eb', borderRadius: 8, marginBottom: 4 }} />
                        <View style={{ width: 180, height: 14, backgroundColor: '#e5e7eb', borderRadius: 6, marginTop: 3 }} />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                    {/* Waktu greeting */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <Ionicons name={greeting.icon} size={16} color="#f59e0b" />
                        <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '500' }}>
                            {greeting.text}
                        </Text>
                    </View>

                    {/* Nama user */}
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>
                        {name} 👋
                    </Text>

                    {/* Tanggal */}
                    <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
                        {todayString}
                    </Text>
                </View>

                {/* Indikator kondisi keuangan kecil */}
                {hasRisk !== undefined && (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: hasRisk ? '#fffbeb' : '#f0fdf4',
                        borderWidth: 1,
                        borderColor: hasRisk ? '#fde68a' : '#bbf7d0',
                        borderRadius: 20,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        marginTop: 4,
                    }}>
                        <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: hasRisk ? '#f59e0b' : '#10b981',
                        }} />
                        <Text style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: hasRisk ? '#a16207' : '#15803d',
                        }}>
                            {hasRisk ? 'Perlu perhatian' : 'Keuangan aman'}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}