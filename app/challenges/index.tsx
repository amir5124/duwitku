// app/challenges/index.tsx
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { supabase } from '../../src/services/supabase/client';

interface Challenge {
    id: string;
    title: string;
    description: string;
    type: string;
    target_amount: number;
    current_amount: number;
    start_date: string;
    end_date: string;
    status: 'active' | 'completed' | 'failed';
    reward_points: number;
}

interface Progress {
    level: number;
    total_points: number;
    streak_days: number;
}

export default function ChallengesScreen() {
    const { isDark } = useTheme();
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    // State untuk modal progress
    const [progressModalVisible, setProgressModalVisible] = useState(false);
    const [progressInput, setProgressInput] = useState('');
    const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);

    const [newChallenge, setNewChallenge] = useState({
        title: '',
        description: '',
        target_amount: '',
        end_date: '',
        reward_points: '10',
    });

    const fetchChallenges = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/challenges/challenges`,
                {
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                    },
                }
            );
            const data = await response.json();
            setChallenges(data.challenges || []);
            setProgress(data.progress);
        } catch (error) {
            console.error('Error fetching challenges:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/challenges/checkin`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            const data = await response.json();
            if (data.success) {
                Alert.alert('✅ Check-in Berhasil!', `Streak: ${data.streak} hari\nPoin +${data.points_earned}`);
                fetchChallenges();
            } else {
                Alert.alert('Info', data.message || 'Sudah check-in hari ini');
            }
        } catch (error) {
            console.error('Check-in error:', error);
        }
    };

    const createChallenge = async () => {
        if (!newChallenge.title || !newChallenge.target_amount || !newChallenge.end_date) {
            Alert.alert('Info', 'Mohon isi semua field');
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/challenges/challenges`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: newChallenge.title,
                        description: newChallenge.description,
                        type: 'custom',
                        target_amount: parseFloat(newChallenge.target_amount),
                        end_date: newChallenge.end_date,
                        reward_points: parseInt(newChallenge.reward_points) || 10,
                    }),
                }
            );
            const data = await response.json();
            if (data.challenge) {
                Alert.alert('🎉 Challenge Dibuat!', 'Ayo mulai capai targetmu!');
                setModalVisible(false);
                setNewChallenge({ title: '', description: '', target_amount: '', end_date: '', reward_points: '10' });
                fetchChallenges();
            }
        } catch (error) {
            console.error('Create challenge error:', error);
        }
    };

    const updateProgress = async (challengeId: string, amount: number) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/challenges/progress`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ challenge_id: challengeId, amount }),
                }
            );
            const data = await response.json();
            if (data.challenge) {
                fetchChallenges();
                if (data.challenge.status === 'completed') {
                    Alert.alert('🎊 Challenge Selesai!', 'Kamu berhasil mencapai target!');
                }
            }
        } catch (error) {
            console.error('Update progress error:', error);
        }
    };

    // ─── Fungsi untuk membuka modal progress ──────────────────────────────────
    const openProgressModal = (challengeId: string) => {
        setSelectedChallengeId(challengeId);
        setProgressInput('');
        setProgressModalVisible(true);
    };

    // ─── Fungsi untuk submit progress ─────────────────────────────────────────
    const submitProgress = async () => {
        if (!selectedChallengeId || !progressInput) {
            Alert.alert('Info', 'Masukkan jumlah progress');
            return;
        }

        const amount = parseFloat(progressInput);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Info', 'Masukkan angka yang valid');
            return;
        }

        await updateProgress(selectedChallengeId, amount);
        setProgressModalVisible(false);
        setProgressInput('');
        setSelectedChallengeId(null);
    };

    useEffect(() => {
        fetchChallenges();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchChallenges();
        setRefreshing(false);
    };

    const getProgressPercentage = (current: number, target: number) => {
        return Math.min((current / target) * 100, 100);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#080f24' : '#f8fafc' }}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                style={{ flex: 1, paddingHorizontal: 16 }}
            >
                {/* ─── Header ──────────────────────────────────────────────────────── */}
                <View style={{ marginTop: 12, marginBottom: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: isDark ? '#fff' : '#111' }}>
                        🏆 Tantangan Keuangan
                    </Text>
                    <Text style={{ fontSize: 14, color: isDark ? '#5a6b94' : '#6b7280', marginTop: 4 }}>
                        Capai target dan tingkatkan kebiasaan keuanganmu!
                    </Text>
                </View>

                {/* ─── Progress Card ───────────────────────────────────────────────── */}
                <View style={{
                    backgroundColor: isDark ? '#0f1a3d' : '#fff',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                }}>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, fontWeight: '700', color: isDark ? '#818cf8' : '#4f46e5' }}>
                            {progress?.level || 1}
                        </Text>
                        <Text style={{ fontSize: 12, color: isDark ? '#5a6b94' : '#6b7280' }}>Level</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, fontWeight: '700', color: isDark ? '#f0f4ff' : '#111827' }}>
                            {progress?.total_points || 0}
                        </Text>
                        <Text style={{ fontSize: 12, color: isDark ? '#5a6b94' : '#6b7280' }}>Poin</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, fontWeight: '700', color: isDark ? '#34d399' : '#10b981' }}>
                            🔥 {progress?.streak_days || 0}
                        </Text>
                        <Text style={{ fontSize: 12, color: isDark ? '#5a6b94' : '#6b7280' }}>Hari Streak</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleCheckIn}
                        style={{
                            backgroundColor: isDark ? '#1a2150' : '#eef2ff',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 20,
                            alignSelf: 'center',
                        }}
                    >
                        <Text style={{ color: isDark ? '#818cf8' : '#4f46e5', fontWeight: '600' }}>
                            ✅ Check-in
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ─── Daftar Challenge ────────────────────────────────────────────── */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? '#fff' : '#111' }}>
                        Challenge Aktif
                    </Text>
                    <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={{
                            backgroundColor: isDark ? '#1a2150' : '#eef2ff',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                        }}
                    >
                        <Text style={{ color: isDark ? '#818cf8' : '#4f46e5', fontWeight: '500' }}>
                            + Buat Challenge
                        </Text>
                    </TouchableOpacity>
                </View>

                {challenges.filter(c => c.status === 'active').length === 0 ? (
                    <View style={{
                        backgroundColor: isDark ? '#0f1a3d' : '#fff',
                        borderRadius: 12,
                        padding: 24,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                    }}>
                        <Text style={{ fontSize: 40, marginBottom: 8 }}>🎯</Text>
                        <Text style={{ color: isDark ? '#c3cee6' : '#374151', textAlign: 'center' }}>
                            Belum ada challenge aktif. Buat challenge sekarang dan mulai capai targetmu!
                        </Text>
                    </View>
                ) : (
                    challenges.filter(c => c.status === 'active').map((challenge) => (
                        <TouchableOpacity
                            key={challenge.id}
                            style={{
                                backgroundColor: isDark ? '#0f1a3d' : '#fff',
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 12,
                                borderWidth: 1,
                                borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                            }}
                            onPress={() => openProgressModal(challenge.id)}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#111', flex: 1 }}>
                                    {challenge.title}
                                </Text>
                                <View style={{
                                    backgroundColor: isDark ? '#1a2150' : '#eef2ff',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 12,
                                }}>
                                    <Text style={{ fontSize: 11, color: isDark ? '#818cf8' : '#4f46e5' }}>
                                        +{challenge.reward_points} poin
                                    </Text>
                                </View>
                            </View>

                            <Text style={{ fontSize: 13, color: isDark ? '#c3cee6' : '#374151', marginTop: 4 }}>
                                {challenge.description}
                            </Text>

                            <View style={{ marginTop: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={{ fontSize: 12, color: isDark ? '#5a6b94' : '#6b7280' }}>
                                        Progress: Rp {challenge.current_amount.toLocaleString()} / Rp {challenge.target_amount.toLocaleString()}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: isDark ? '#5a6b94' : '#6b7280' }}>
                                        {getProgressPercentage(challenge.current_amount, challenge.target_amount).toFixed(0)}%
                                    </Text>
                                </View>
                                <View style={{
                                    height: 6,
                                    backgroundColor: isDark ? '#1a2a55' : '#e5e7eb',
                                    borderRadius: 3,
                                    overflow: 'hidden',
                                }}>
                                    <View style={{
                                        height: '100%',
                                        width: `${getProgressPercentage(challenge.current_amount, challenge.target_amount)}%`,
                                        backgroundColor: isDark ? '#818cf8' : '#4f46e5',
                                        borderRadius: 3,
                                    }} />
                                </View>
                            </View>

                            <Text style={{ fontSize: 11, color: isDark ? '#5a6b94' : '#9ca3af', marginTop: 8 }}>
                                📅 Sampai: {new Date(challenge.end_date).toLocaleDateString('id-ID')}
                            </Text>
                        </TouchableOpacity>
                    ))
                )}

                {/* ─── Completed Challenges ─────────────────────────────────────────── */}
                {challenges.filter(c => c.status === 'completed').length > 0 && (
                    <>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#111', marginTop: 16, marginBottom: 8 }}>
                            ✅ Selesai
                        </Text>
                        {challenges.filter(c => c.status === 'completed').map((challenge) => (
                            <View key={challenge.id} style={{
                                backgroundColor: isDark ? '#0f1a3d' : '#fff',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 8,
                                borderWidth: 1,
                                borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                                opacity: 0.7,
                            }}>
                                <Text style={{ fontSize: 14, color: isDark ? '#c3cee6' : '#374151' }}>
                                    ✅ {challenge.title}
                                </Text>
                                <Text style={{ fontSize: 11, color: isDark ? '#5a6b94' : '#9ca3af' }}>
                                    +{challenge.reward_points} poin
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* ─── Modal Buat Challenge ──────────────────────────────────────────── */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={{
                    flex: 1,
                    justifyContent: 'flex-end',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                }}>
                    <View style={{
                        backgroundColor: isDark ? '#0f1a3d' : '#fff',
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        padding: 20,
                        paddingBottom: 40,
                    }}>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: isDark ? '#fff' : '#111', marginBottom: 16 }}>
                            🎯 Buat Challenge Baru
                        </Text>

                        <TextInput
                            placeholder="Judul Challenge"
                            placeholderTextColor={isDark ? '#5a6b94' : '#9ca3af'}
                            value={newChallenge.title}
                            onChangeText={(text) => setNewChallenge({ ...newChallenge, title: text })}
                            style={{
                                backgroundColor: isDark ? '#080f24' : '#f8fafc',
                                borderRadius: 10,
                                padding: 12,
                                marginBottom: 12,
                                color: isDark ? '#fff' : '#111',
                                borderWidth: 1,
                                borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                            }}
                        />

                        <TextInput
                            placeholder="Deskripsi"
                            placeholderTextColor={isDark ? '#5a6b94' : '#9ca3af'}
                            value={newChallenge.description}
                            onChangeText={(text) => setNewChallenge({ ...newChallenge, description: text })}
                            style={{
                                backgroundColor: isDark ? '#080f24' : '#f8fafc',
                                borderRadius: 10,
                                padding: 12,
                                marginBottom: 12,
                                color: isDark ? '#fff' : '#111',
                                borderWidth: 1,
                                borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                            }}
                            multiline
                        />

                        <TextInput
                            placeholder="Target (Rp)"
                            placeholderTextColor={isDark ? '#5a6b94' : '#9ca3af'}
                            value={newChallenge.target_amount}
                            onChangeText={(text) => setNewChallenge({ ...newChallenge, target_amount: text })}
                            style={{
                                backgroundColor: isDark ? '#080f24' : '#f8fafc',
                                borderRadius: 10,
                                padding: 12,
                                marginBottom: 12,
                                color: isDark ? '#fff' : '#111',
                                borderWidth: 1,
                                borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                            }}
                            keyboardType="numeric"
                        />

                        <TextInput
                            placeholder="Tanggal Selesai (YYYY-MM-DD)"
                            placeholderTextColor={isDark ? '#5a6b94' : '#9ca3af'}
                            value={newChallenge.end_date}
                            onChangeText={(text) => setNewChallenge({ ...newChallenge, end_date: text })}
                            style={{
                                backgroundColor: isDark ? '#080f24' : '#f8fafc',
                                borderRadius: 10,
                                padding: 12,
                                marginBottom: 12,
                                color: isDark ? '#fff' : '#111',
                                borderWidth: 1,
                                borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                            }}
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={{
                                    flex: 1,
                                    backgroundColor: isDark ? '#1a2a55' : '#e5e7eb',
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: isDark ? '#c3cee6' : '#374151', fontWeight: '600' }}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={createChallenge}
                                style={{
                                    flex: 2,
                                    backgroundColor: isDark ? '#818cf8' : '#4f46e5',
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: 'white', fontWeight: '600' }}>Buat Challenge</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── Modal Input Progress ──────────────────────────────────────────── */}
            <Modal
                visible={progressModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setProgressModalVisible(false);
                    setProgressInput('');
                    setSelectedChallengeId(null);
                }}
            >
                <View style={{
                    flex: 1,
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    paddingHorizontal: 24,
                }}>
                    <View style={{
                        backgroundColor: isDark ? '#0f1a3d' : '#fff',
                        borderRadius: 16,
                        padding: 20,
                    }}>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: '600',
                            color: isDark ? '#fff' : '#111',
                            marginBottom: 8,
                        }}>
                            📈 Update Progress
                        </Text>
                        <Text style={{
                            fontSize: 14,
                            color: isDark ? '#c3cee6' : '#374151',
                            marginBottom: 16,
                        }}>
                            Berapa jumlah yang sudah kamu capai?
                        </Text>

                        <TextInput
                            value={progressInput}
                            onChangeText={setProgressInput}
                            placeholder="Masukkan nominal (Rp)"
                            placeholderTextColor={isDark ? '#5a6b94' : '#9ca3af'}
                            keyboardType="numeric"
                            style={{
                                backgroundColor: isDark ? '#080f24' : '#f8fafc',
                                borderRadius: 10,
                                padding: 12,
                                fontSize: 16,
                                color: isDark ? '#fff' : '#111',
                                borderWidth: 1,
                                borderColor: isDark ? '#1a2a55' : '#e5e7eb',
                                marginBottom: 16,
                            }}
                            autoFocus
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    setProgressModalVisible(false);
                                    setProgressInput('');
                                    setSelectedChallengeId(null);
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: isDark ? '#1a2a55' : '#e5e7eb',
                                    paddingVertical: 12,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: isDark ? '#c3cee6' : '#374151', fontWeight: '600' }}>
                                    Batal
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={submitProgress}
                                style={{
                                    flex: 2,
                                    backgroundColor: isDark ? '#818cf8' : '#4f46e5',
                                    paddingVertical: 12,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: 'white', fontWeight: '600' }}>
                                    ✅ Update
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}