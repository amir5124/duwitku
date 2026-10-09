// src/components/voice/VoiceTransactionButton.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Modal,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../../services/supabase/client';
import { voiceAssistant } from '../../services/voiceAssistant';
import { parseVoiceText } from '../../services/voiceParser';
import { useTransactionStore } from '../../store/transactionStore';

// ── Interface untuk ref ──
export interface VoiceTransactionButtonRef {
    trigger: () => void;
}

interface Props {
    onSuccess?: () => void;
    size?: number;
    type?: 'income' | 'expense' | 'both';
    variant?: 'floating' | 'inline';
}

export const VoiceTransactionButton = forwardRef<VoiceTransactionButtonRef, Props>(({
    onSuccess,
    size = 48,
    type = 'both',
    variant = 'inline',
}, ref) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [manualInput, setManualInput] = useState('');
    const [parsedData, setParsedData] = useState<any>(null);
    const [showPreview, setShowPreview] = useState(false);
    const { addTransaction, fetchTransactions } = useTransactionStore();

    // Animasi pulse
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    // ── Expose trigger method via ref ──
    useImperativeHandle(ref, () => ({
        trigger: () => {
            startRecording();
        },
    }));

    // ── Mulai rekaman ──
    const startRecording = () => {
        setIsRecording(true);
        setTranscript('');
        setParsedData(null);
        setShowPreview(false);
        setManualInput('');

        // Start pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Buka modal
        setModalVisible(true);
    };

    // ── Proses voice input ──
    const processVoiceInput = async (text: string) => {
        if (!text || text.trim().length < 3) {
            Alert.alert('Info', 'Masukkan transaksi yang lebih jelas ya!');
            return;
        }

        setIsProcessing(true);
        setTranscript(text);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Coba panggil Edge Function
            const { data, error } = await supabase.functions.invoke('voice-transaction', {
                body: { text, userId: user?.id },
            });

            // Jika error (misal API key habis), fallback ke parser lokal
            if (error) {
                console.log('Claude API error, using fallback parser');
                const parsed = parseVoiceText(text);

                if (parsed.amount > 0) {
                    setParsedData(parsed);
                    setShowPreview(true);
                    await voiceAssistant.speak(
                        `Oke! Aku catat ${parsed.type === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'} ${parsed.amount.toLocaleString()} untuk ${parsed.category}.`,
                        { personality: 'supportive' }
                    );
                } else {
                    Alert.alert(
                        'KalKu Butuh Bantuan',
                        'Aku belum bisa memahami transaksimu. Coba sebutkan nominal dan kategorinya ya.\n\nContoh: "beli makan siang 25 ribu di warteg"',
                        [{ text: 'OK' }]
                    );
                }
                setIsProcessing(false);
                return;
            }

            // Proses hasil dari Claude
            if (data?.parsed) {
                if (type !== 'both' && data.parsed.type !== type.toUpperCase()) {
                    const typeName = type === 'income' ? 'Pemasukan' : 'Pengeluaran';
                    Alert.alert(
                        `Hanya ${typeName}`,
                        `Kamu sedang di halaman ${typeName.toLowerCase()}. Apakah ini ${typeName}?`,
                        [
                            { text: 'Batal', style: 'cancel' },
                            {
                                text: 'Ya, Simpan',
                                onPress: () => {
                                    data.parsed.type = type.toUpperCase();
                                    setParsedData(data.parsed);
                                    setShowPreview(true);
                                    voiceAssistant.speak(
                                        data.response || `Oke! Aku catat ${data.parsed.type === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'} ${data.parsed.amount.toLocaleString()} untuk ${data.parsed.category}.`,
                                        { personality: 'supportive' }
                                    );
                                }
                            }
                        ]
                    );
                    setIsProcessing(false);
                    return;
                }

                setParsedData(data.parsed);
                setShowPreview(true);
                await voiceAssistant.speak(
                    data.response || `Oke! Aku catat ${data.parsed.type === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'} ${data.parsed.amount.toLocaleString()} untuk ${data.parsed.category}.`,
                    { personality: 'supportive' }
                );
            } else if (data?.question) {
                Alert.alert('KalKu Butuh Konfirmasi', data.question, [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Coba Lagi', onPress: () => setManualInput('') },
                ]);
            } else {
                Alert.alert('Info', 'KalKu tidak bisa memahami. Coba dengan format yang lebih jelas.');
            }
        } catch (error) {
            console.error('Voice processing error:', error);

            // Fallback terakhir: parser lokal
            const parsed = parseVoiceText(text);
            if (parsed.amount > 0) {
                setParsedData(parsed);
                setShowPreview(true);
                await voiceAssistant.speak(
                    `Oke! Aku catat ${parsed.type === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'} ${parsed.amount.toLocaleString()} untuk ${parsed.category}.`,
                    { personality: 'supportive' }
                );
            } else {
                Alert.alert('Error', 'Gagal memproses suara. Coba lagi.');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Hentikan rekaman ──
    const stopRecording = () => {
        setIsRecording(false);
        pulseAnim.stopAnimation();
        pulseAnim.setValue(1);
        setModalVisible(false);
    };

    // ── Konfirmasi dan simpan ──
    const confirmAndSave = async () => {
        if (!parsedData) return;

        setIsProcessing(true);
        try {
            const result = await addTransaction({
                amount: parsedData.amount,
                type: parsedData.type,
                category: parsedData.category,
                merchant: parsedData.merchant || undefined,
                note: parsedData.note || undefined,
            });

            if (result.success) {
                await fetchTransactions();
                Alert.alert('✅ Berhasil!', `Transaksi berhasil dicatat.`, [
                    {
                        text: 'OK', onPress: () => {
                            setModalVisible(false);
                            setShowPreview(false);
                            setParsedData(null);
                            setTranscript('');
                            setManualInput('');
                            if (onSuccess) onSuccess();
                        }
                    },
                ]);
            } else {
                Alert.alert('Error', result.message);
            }
        } catch (error) {
            Alert.alert('Error', 'Gagal menyimpan transaksi.');
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Batal dan ulangi ──
    const cancelAndRetry = () => {
        setShowPreview(false);
        setParsedData(null);
        setManualInput('');
        setTranscript('');
    };

    const isFloating = variant === 'floating';

    return (
        <>
            {/* Tombol Mic */}
            <Animated.View
                style={{
                    transform: [{ scale: pulseAnim }],
                    shadowColor: '#3b6ef5',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isFloating ? 0.35 : 0,
                    shadowRadius: isFloating ? 16 : 0,
                    elevation: isFloating ? 8 : 0,
                }}
            >
                <TouchableOpacity
                    onPress={startRecording}
                    activeOpacity={0.8}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: isRecording ? '#ef4444' : '#3b6ef5',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Ionicons
                            name={isRecording ? 'stop-circle-outline' : 'mic-outline'}
                            size={size * 0.5}
                            color="white"
                        />
                    )}
                </TouchableOpacity>
            </Animated.View>

            {/* ── Modal Input Voice ── */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={stopRecording}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 min-h-[45%]">
                        <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-5" />

                        <View className="flex-row items-center gap-3 mb-4">
                            <View className="w-10 h-10 bg-indigo-100 rounded-full items-center justify-center">
                                <Ionicons name="mic-outline" size={20} color="#3b6ef5" />
                            </View>
                            <Text className="text-lg font-bold text-gray-900">🎤 Catat dengan Suara</Text>
                        </View>

                        <View className="mb-4">
                            <Text className="text-gray-500 text-xs mb-2">
                                Katakan transaksi, atau ketik manual:
                            </Text>
                            <View className="flex-row items-center bg-slate-50 rounded-xl px-4 border border-gray-200">
                                <TextInput
                                    className="flex-1 py-3 text-gray-800"
                                    placeholder="Contoh: beli makan siang 25 ribu di warteg"
                                    value={manualInput}
                                    onChangeText={setManualInput}
                                    onSubmitEditing={() => processVoiceInput(manualInput)}
                                    editable={!isProcessing}
                                />
                                <TouchableOpacity
                                    onPress={() => processVoiceInput(manualInput)}
                                    disabled={isProcessing || !manualInput.trim()}
                                >
                                    <Ionicons
                                        name="send-outline"
                                        size={20}
                                        color={manualInput.trim() ? '#3b6ef5' : '#d1d5db'}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {transcript && (
                            <View className="bg-indigo-50 rounded-xl p-4 mb-4 border border-indigo-100">
                                <Text className="text-gray-500 text-xs mb-1">Kamu bilang:</Text>
                                <Text className="text-gray-800 text-base italic">"{transcript}"</Text>
                            </View>
                        )}

                        {showPreview && parsedData && (
                            <View className="bg-green-50 rounded-xl p-4 mb-4 border border-green-100">
                                <Text className="text-green-600 text-xs font-semibold mb-2">📝 KalKu memahami:</Text>
                                <View className="flex-row justify-between py-1 border-b border-green-100">
                                    <Text className="text-gray-600">Tipe</Text>
                                    <Text className="font-semibold">
                                        {parsedData.type === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan'}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between py-1 border-b border-green-100">
                                    <Text className="text-gray-600">Nominal</Text>
                                    <Text className="font-semibold text-green-600">
                                        Rp{parsedData.amount?.toLocaleString()}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between py-1 border-b border-green-100">
                                    <Text className="text-gray-600">Kategori</Text>
                                    <Text className="font-semibold">{parsedData.category}</Text>
                                </View>
                                {parsedData.merchant && (
                                    <View className="flex-row justify-between py-1 border-b border-green-100">
                                        <Text className="text-gray-600">Tempat</Text>
                                        <Text className="font-semibold">{parsedData.merchant}</Text>
                                    </View>
                                )}
                                {parsedData.note && (
                                    <View className="flex-row justify-between py-1">
                                        <Text className="text-gray-600">Catatan</Text>
                                        <Text className="font-semibold">{parsedData.note}</Text>
                                    </View>
                                )}
                                <Text className="text-gray-400 text-xs mt-2">
                                    Confidence: {Math.round((parsedData.confidence || 0.9) * 100)}%
                                </Text>
                            </View>
                        )}

                        {isProcessing && (
                            <View className="items-center py-4">
                                <ActivityIndicator size="large" color="#3b6ef5" />
                                <Text className="text-gray-500 mt-2">KalKu sedang memproses...</Text>
                            </View>
                        )}

                        {!isProcessing && showPreview && parsedData && (
                            <View className="flex-row gap-3 mt-2">
                                <TouchableOpacity
                                    onPress={cancelAndRetry}
                                    className="flex-1 bg-gray-200 py-3.5 rounded-xl"
                                >
                                    <Text className="text-gray-700 text-center font-semibold">Ulangi</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={confirmAndSave}
                                    className="flex-2 bg-indigo-600 py-3.5 rounded-xl"
                                >
                                    <Text className="text-white text-center font-semibold">✅ Simpan</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!isProcessing && !showPreview && !transcript && (
                            <View className="flex-row justify-center items-center gap-2 py-2">
                                <Ionicons name="mic" size={16} color="#9ca3af" />
                                <Text className="text-gray-400 text-sm">
                                    Tekan tombol mic atau ketik transaksi
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={stopRecording}
                            className="mt-3 py-2"
                        >
                            <Text className="text-gray-400 text-center text-sm">Batal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
});

// ── Set display name untuk debugging ──
VoiceTransactionButton.displayName = 'VoiceTransactionButton';