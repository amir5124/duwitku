// app/installments.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/contexts/ThemeContext';
import { supabase } from '../src/services/supabase/client';
import { useTransactionStore } from '../src/store/transactionStore';
import { Installment } from '../src/types';
import { formatCurrency } from '../src/utils/formatters';

const LIGHT = {
  bg: '#f4f6fb',
  card: '#ffffff',
  cardAlt: '#f8faff',
  text: '#0b1437',
  textSub: '#64748b',
  textMuted: '#94a3b8',
  border: '#e8edf5',
  borderLight: '#f1f5f9',
  accent: '#3b6ef5',
  accentLight: '#eef2ff',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  modalOverlay: 'rgba(0,0,0,0.5)',
  modalBg: '#ffffff',
};

const DARK = {
  bg: '#080f24',
  card: '#0f1a3d',
  cardAlt: '#111f47',
  text: '#f0f4ff',
  textSub: '#8899bb',
  textMuted: '#4b5a7a',
  border: '#1a2a55',
  borderLight: '#111f47',
  accent: '#3b6ef5',
  accentLight: '#1a2a55',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  modalOverlay: 'rgba(0,0,0,0.7)',
  modalBg: '#162235',
};

interface DynamicModalConfig {
  visible: boolean;
  title: string;
  description: string;
  cancelText: string;
  confirmText: string;
  isDestructive: boolean;
  onConfirm: () => void;
}

// ── Helper: Format angka dengan pemisah ribuan ──────────────────────────────
const formatNumber = (value: string): string => {
  // Hapus semua karakter non-digit
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  // Konversi ke number dan format dengan pemisah ribuan
  const num = parseInt(cleaned, 10);
  return num.toLocaleString('id-ID');
};

const parseFormattedNumber = (value: string): number => {
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
};

// ── Component: Loading Modal dengan Progress Bar ─────────────────────────────
function LoadingModal({ visible, message = 'Memproses...', progress = 0 }: {
  visible: boolean;
  message?: string;
  progress?: number;
}) {
  const [progressAnim] = useState(new Animated.Value(0));
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    if (visible) {
      setCurrentProgress(progress);
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [visible, progress]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 24,
          padding: 32,
          width: '100%',
          maxWidth: 320,
          alignItems: 'center',
        }}>
          <ActivityIndicator size="large" color="#3b6ef5" style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b1437', marginBottom: 8 }}>
            {message}
          </Text>

          {/* Progress Bar */}
          <View style={{
            width: '100%',
            height: 6,
            backgroundColor: '#e8edf5',
            borderRadius: 3,
            overflow: 'hidden',
            marginTop: 8,
          }}>
            <Animated.View style={{
              height: '100%',
              backgroundColor: '#3b6ef5',
              borderRadius: 3,
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            }} />
          </View>
          <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            {Math.round(progress)}%
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default function InstallmentsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const T = isDark ? DARK : LIGHT;

  const [installments, setInstallments] = useState<Installment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Installment | null>(null);

  // ── Form State ─────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    due_date: '',
    remaining_months: '',
    total_remaining: '',
  });

  // ── Loading State ──────────────────────────────────────────────────────────
  const [loadingModalVisible, setLoadingModalVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Memproses...');
  const [loadingProgress, setLoadingProgress] = useState(0);

  // ── Modal Sheet State ─────────────────────────────────────────────────────
  const [sheetConfig, setSheetConfig] = useState<DynamicModalConfig>({
    visible: false,
    title: '',
    description: '',
    cancelText: '',
    confirmText: '',
    isDestructive: false,
    onConfirm: () => { },
  });

  const { addTransaction, fetchTransactions } = useTransactionStore();

  // ── Modal Helpers ──────────────────────────────────────────────────────────
  const showSheet = (config: Omit<DynamicModalConfig, 'visible'>) => {
    setSheetConfig({ ...config, visible: true });
  };

  const closeSheet = () => {
    setSheetConfig(prev => ({ ...prev, visible: false }));
  };

  const showLoading = (message: string, progress: number = 0) => {
    setLoadingMessage(message);
    setLoadingProgress(progress);
    setLoadingModalVisible(true);
  };

  const updateLoadingProgress = (progress: number) => {
    setLoadingProgress(progress);
  };

  const hideLoading = () => {
    setLoadingModalVisible(false);
  };

  // ── Format Input Helper ────────────────────────────────────────────────────
  const handleAmountChange = (text: string, field: keyof typeof formData) => {
    const formatted = formatNumber(text);
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  // ── Load Data ──────────────────────────────────────────────────────────────
  const loadInstallments = useCallback(async () => {
    try {
      showLoading('Memuat data angsuran...', 10);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        hideLoading();
        return;
      }

      updateLoadingProgress(30);

      const { data, error } = await supabase
        .from('installments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('due_date', { ascending: true });

      updateLoadingProgress(80);

      if (error) throw error;
      setInstallments(data as Installment[]);

      updateLoadingProgress(100);
      setTimeout(hideLoading, 300);
    } catch (error) {
      console.error('Load installments error:', error);
      hideLoading();
      showSheet({
        title: '⚠️ Gagal Muat',
        description: 'Ada masalah saat mengambil data angsuran. Coba tarik ke bawah untuk refresh!',
        cancelText: 'Oke, coba lagi',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInstallments();
    setRefreshing(false);
  };

  useEffect(() => {
    loadInstallments();
  }, [loadInstallments]);

  // ── CRUD Operations ──────────────────────────────────────────────────────
  const handleAddInstallment = async () => {
    if (!formData.name || !formData.amount || !formData.due_date) {
      showSheet({
        title: '😅 Eh, kurang!',
        description: 'Isi semua field yang wajib ya, biar angsuranmu ke-track!',
        cancelText: 'Oke, isi dulu',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      return;
    }

    showLoading(editingItem ? 'Mengupdate angsuran...' : 'Menyimpan angsuran...', 0);

    try {
      updateLoadingProgress(20);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const payload = {
        user_id: user.id,
        name: formData.name,
        amount: parseFormattedNumber(formData.amount),
        due_date: parseInt(formData.due_date),
        remaining_months: parseInt(formData.remaining_months) || 0,
        total_remaining: parseFormattedNumber(formData.total_remaining) || 0,
        is_active: true,
      };

      updateLoadingProgress(40);

      if (editingItem) {
        // Update
        const { error } = await supabase
          .from('installments')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;

        updateLoadingProgress(80);
        await loadInstallments();
        updateLoadingProgress(100);

        setTimeout(() => {
          hideLoading();
          showSheet({
            title: '✨ Berhasil diupdate!',
            description: `Angsuran ${formData.name} udah diperbarui!`,
            cancelText: 'Mantap!',
            confirmText: '',
            isDestructive: false,
            onConfirm: closeSheet,
          });
        }, 500);
      } else {
        // Insert
        const { error } = await supabase
          .from('installments')
          .insert(payload);

        if (error) throw error;

        updateLoadingProgress(80);
        await loadInstallments();
        updateLoadingProgress(100);

        setTimeout(() => {
          hideLoading();
          showSheet({
            title: '🎉 Mantap!',
            description: `Angsuran ${formData.name} berhasil ditambah!`,
            cancelText: 'Keren!',
            confirmText: '',
            isDestructive: false,
            onConfirm: closeSheet,
          });
        }, 500);
      }

      setModalVisible(false);
      setEditingItem(null);
      setFormData({ name: '', amount: '', due_date: '', remaining_months: '', total_remaining: '' });
    } catch (error: any) {
      hideLoading();
      showSheet({
        title: '😱 Gagal!',
        description: error.message || 'Ada masalah saat nyimpan angsuran. Coba lagi ya!',
        cancelText: 'Coba lagi',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
    }
  };

  const handleDeleteInstallment = (id: string, name: string) => {
    showSheet({
      title: '🗑️ Hapus angsuran?',
      description: `Yakin mau hapus "${name}"? Data bakal ilang permanen!`,
      cancelText: 'Gak jadi',
      confirmText: 'Hapus!',
      isDestructive: true,
      onConfirm: async () => {
        closeSheet();
        showLoading('Menghapus angsuran...', 0);

        try {
          updateLoadingProgress(30);

          const { error } = await supabase
            .from('installments')
            .update({ is_active: false })
            .eq('id', id);

          if (error) throw error;

          updateLoadingProgress(70);
          await loadInstallments();
          updateLoadingProgress(100);

          setTimeout(() => {
            hideLoading();
            showSheet({
              title: '🗑️ Berhasil dihapus!',
              description: `Angsuran ${name} udah ilang.`,
              cancelText: 'Oke',
              confirmText: '',
              isDestructive: false,
              onConfirm: closeSheet,
            });
          }, 500);
        } catch (error: any) {
          hideLoading();
          showSheet({
            title: '😱 Gagal!',
            description: error.message || 'Ada masalah saat hapus angsuran. Coba lagi ya!',
            cancelText: 'Coba lagi',
            confirmText: '',
            isDestructive: false,
            onConfirm: closeSheet,
          });
        }
      },
    });
  };

  const handlePayInstallment = (item: Installment) => {
    // Cek apakah sudah lunas
    if (item.remaining_months === 0 && item.total_remaining === 0) {
      showSheet({
        title: '🎉 Sudah Lunas!',
        description: `Angsuran ${item.name} sudah lunas!`,
        cancelText: 'Mantap!',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      return;
    }

    showSheet({
      title: '💸 Bayar angsuran?',
      description: `Yakin mau bayar ${item.name} sebesar ${formatCurrency(item.amount)}?`,
      cancelText: 'Gak jadi',
      confirmText: 'Bayar!',
      isDestructive: false,
      onConfirm: async () => {
        closeSheet();
        showLoading('Memproses pembayaran...', 0);

        try {
          updateLoadingProgress(20);

          const result = await addTransaction({
            amount: item.amount,
            type: 'EXPENSE',
            category: 'HUTANG',
            merchant: item.name,
            note: `Bayar angsuran ${item.name}`,
          });

          updateLoadingProgress(50);

          if (result.success) {
            await fetchTransactions();
            updateLoadingProgress(70);

            // Hitung sisa
            const newRemaining = Math.max(0, (item.remaining_months || 1) - 1);
            const newTotalRemaining = Math.max(0, (item.total_remaining || item.amount) - item.amount);
            const isLunas = newRemaining === 0 && newTotalRemaining === 0;

            // Update di database
            const updateData: any = {
              remaining_months: newRemaining,
              total_remaining: newTotalRemaining,
            };

            if (isLunas) {
              updateData.is_active = false;
            }

            const { error } = await supabase
              .from('installments')
              .update(updateData)
              .eq('id', item.id);

            if (error) throw error;

            updateLoadingProgress(90);
            await loadInstallments();
            updateLoadingProgress(100);

            setTimeout(() => {
              hideLoading();
              if (isLunas) {
                showSheet({
                  title: '🎉 Lunas!',
                  description: `Angsuran ${item.name} sudah lunas! 🥳`,
                  cancelText: 'Mantap!',
                  confirmText: '',
                  isDestructive: false,
                  onConfirm: closeSheet,
                });
              } else {
                showSheet({
                  title: '✅ Berhasil!',
                  description: `Angsuran ${item.name} berhasil dibayar! 💰\nSisa ${newRemaining}x bayar lagi · ${formatCurrency(newTotalRemaining)} tersisa`,
                  cancelText: 'Keren!',
                  confirmText: '',
                  isDestructive: false,
                  onConfirm: closeSheet,
                });
              }
            }, 500);
          } else {
            hideLoading();
            showSheet({
              title: '😱 Gagal!',
              description: 'Gagal mencatat pembayaran angsuran. Coba lagi ya!',
              cancelText: 'Coba lagi',
              confirmText: '',
              isDestructive: false,
              onConfirm: closeSheet,
            });
          }
        } catch (error: any) {
          hideLoading();
          showSheet({
            title: '😱 Gagal!',
            description: error.message || 'Ada masalah saat bayar angsuran. Coba lagi ya!',
            cancelText: 'Coba lagi',
            confirmText: '',
            isDestructive: false,
            onConfirm: closeSheet,
          });
        }
      },
    });
  };

  const handleEdit = (item: Installment) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      amount: formatNumber(item.amount.toString()),
      due_date: item.due_date.toString(),
      remaining_months: item.remaining_months?.toString() || '',
      total_remaining: formatNumber((item.total_remaining || 0).toString()),
    });
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', amount: '', due_date: '', remaining_months: '', total_remaining: '' });
    setModalVisible(true);
  };

  // ── Statistik ──────────────────────────────────────────────────────────────
  const totalMonthlyPayment = installments.reduce((sum, i) => sum + i.amount, 0);
  const totalRemaining = installments.reduce((sum, i) => sum + (i.total_remaining || i.amount), 0);
  const upcomingCount = installments.filter(i => {
    const today = new Date().getDate();
    return i.due_date >= today && i.due_date <= today + 7;
  }).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderEmptyState = () => (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 24
    }}>
      <View style={{
        width: 120,
        height: 120,
        backgroundColor: T.cardAlt,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: T.border
      }}>
        <Ionicons name="document-text-outline" size={56} color={T.textMuted} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, marginBottom: 8 }}>
        Belum Ada Angsuran
      </Text>
      <Text style={{ fontSize: 14, color: T.textSub, textAlign: 'center', lineHeight: 20 }}>
        Tambahkan angsuranmu sekarang agar{'\n'}terpantau dengan baik!
      </Text>
    </View>
  );

  const renderInstallmentItem = (item: Installment) => {
    const today = new Date().getDate();
    const daysUntil = item.due_date - today;
    const isUrgent = daysUntil >= 0 && daysUntil <= 3;
    const isOverdue = daysUntil < 0;

    // Cek apakah sudah lunas
    const isLunas = item.remaining_months === 0 && (item.total_remaining === 0 || !item.total_remaining);

    let statusColor = T.textSub;
    let statusText = `${daysUntil} hari lagi`;
    if (isLunas) {
      statusColor = T.success;
      statusText = '✅ Lunas!';
    } else if (isOverdue) {
      statusColor = T.danger;
      statusText = '⚠️ Terlewat';
    } else if (isUrgent) {
      statusColor = T.warning;
      statusText = `🔴 ${daysUntil} hari lagi`;
    } else if (daysUntil <= 7) {
      statusColor = T.warning;
      statusText = `${daysUntil} hari lagi`;
    }

    // Progress untuk badge
    const totalOriginal = item.total_remaining ? item.total_remaining + (item.amount * (item.remaining_months || 0)) : item.amount * (item.remaining_months || 0);
    const paidProgress = isLunas ? 100 : Math.round(((totalOriginal - (item.total_remaining || 0)) / totalOriginal) * 100);

    return (
      <View
        key={item.id}
        style={{
          backgroundColor: T.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: isLunas ? '#10b98140' : (isOverdue ? '#ef444430' : (isUrgent ? '#f59e0b30' : T.border)),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: isLunas ? '#10b98115' : (isOverdue ? '#ef444415' : (isUrgent ? '#f59e0b15' : T.accentLight)),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons
              name={isLunas ? 'checkmark-circle' : (isOverdue ? 'alert-circle' : (isUrgent ? 'time-outline' : 'calendar-outline'))}
              size={22}
              color={isLunas ? T.success : (isOverdue ? T.danger : (isUrgent ? T.warning : T.accent))}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.text }}>
                  {item.name}
                </Text>
                {isLunas && (
                  <View style={{
                    backgroundColor: '#10b981',
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                      LUNAS
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: isLunas ? T.success : T.text }}>
                {formatCurrency(item.amount)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: T.textSub }}>
                Tgl {item.due_date}
              </Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: T.textMuted }} />
              <Text style={{ fontSize: 12, color: statusColor, fontWeight: '600' }}>
                {statusText}
              </Text>
            </View>

            {!isLunas && item.remaining_months > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: T.textSub }}>
                  Sisa {item.remaining_months}x bayar lagi
                  {item.total_remaining > 0 && ` · ${formatCurrency(item.total_remaining)} tersisa`}
                </Text>
                {/* Progress bar mini */}
                {item.total_remaining > 0 && (
                  <View style={{
                    width: '100%',
                    height: 4,
                    backgroundColor: T.border,
                    borderRadius: 2,
                    marginTop: 4,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      width: `${Math.min(paidProgress, 100)}%`,
                      height: '100%',
                      backgroundColor: paidProgress > 80 ? T.success : T.accent,
                      borderRadius: 2,
                    }} />
                  </View>
                )}
              </View>
            )}

            {!isLunas && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => handlePayInstallment(item)}
                  style={{
                    flex: 1,
                    backgroundColor: T.success,
                    borderRadius: 10,
                    paddingVertical: 8,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    Bayar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleEdit(item)}
                  style={{
                    backgroundColor: T.accentLight,
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: T.border,
                  }}
                >
                  <Ionicons name="pencil-outline" size={18} color={T.accent} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeleteInstallment(item.id, item.name)}
                  style={{
                    backgroundColor: '#ef444415',
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#ef444430',
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={T.danger} />
                </TouchableOpacity>
              </View>
            )}

            {isLunas && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => handleDeleteInstallment(item.id, item.name)}
                  style={{
                    flex: 1,
                    backgroundColor: '#ef444415',
                    borderRadius: 10,
                    paddingVertical: 8,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: '#ef444430',
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={T.danger} />
                  <Text style={{ color: T.danger, fontWeight: '600', fontSize: 13 }}>
                    Hapus
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Loading Modal dengan Progress Bar */}
      <LoadingModal
        visible={loadingModalVisible}
        message={loadingMessage}
        progress={loadingProgress}
      />

      {/* Header */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: insets.top > 0 ? 8 : 16,
        paddingBottom: 16,
        backgroundColor: T.card,
        borderBottomWidth: 0.5,
        borderBottomColor: T.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: T.text }}>
          Cicilan
        </Text>
        <TouchableOpacity onPress={openAddModal}>
          <Ionicons name="add-circle-outline" size={26} color={T.accent} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={{
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: T.bg,
      }}>
        <View style={{
          flex: 1,
          backgroundColor: T.card,
          borderRadius: 14,
          padding: 14,
          borderWidth: 0.5,
          borderColor: T.border,
        }}>
          <Text style={{ fontSize: 11, color: T.textMuted, fontWeight: '500' }}>
            Total / Bulan
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: T.text, marginTop: 4 }}>
            {formatCurrency(totalMonthlyPayment)}
          </Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: T.card,
          borderRadius: 14,
          padding: 14,
          borderWidth: 0.5,
          borderColor: T.border,
        }}>
          <Text style={{ fontSize: 11, color: T.textMuted, fontWeight: '500' }}>
            Sisa Total
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: T.text, marginTop: 4 }}>
            {formatCurrency(totalRemaining)}
          </Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: T.card,
          borderRadius: 14,
          padding: 14,
          borderWidth: 0.5,
          borderColor: T.border,
        }}>
          <Text style={{ fontSize: 11, color: T.textMuted, fontWeight: '500' }}>
            Akan Datang
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: T.warning, marginTop: 4 }}>
            {upcomingCount}
          </Text>
        </View>
      </View>

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : installments.length === 0 ? (
          renderEmptyState()
        ) : (
          installments.map(renderInstallmentItem)
        )}
      </ScrollView>

      {/* Modal: Add/Edit */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={() => { }}>
            <View style={{
              flex: 1,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}>
              <View style={{
                backgroundColor: T.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 24,
                paddingBottom: Math.max(insets.bottom, 24),
              }}>
                <View style={{
                  width: 40,
                  height: 4,
                  backgroundColor: T.border,
                  borderRadius: 2,
                  alignSelf: 'center',
                  marginBottom: 20,
                }} />

                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: T.text }}>
                    {editingItem ? 'Edit Angsuran' : 'Tambah Angsuran'}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    setModalVisible(false);
                    setEditingItem(null);
                    setFormData({ name: '', amount: '', due_date: '', remaining_months: '', total_remaining: '' });
                  }}>
                    <Ionicons name="close-outline" size={24} color={T.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {[
                    { label: 'Nama angsuran *', key: 'name', placeholder: 'KPR, Cicilan Motor...', keyboard: 'default' },
                    { label: 'Jumlah per bulan *', key: 'amount', placeholder: '1.500.000', keyboard: 'numeric' },
                    { label: 'Tanggal jatuh tempo *', key: 'due_date', placeholder: '1–31', keyboard: 'numeric' },
                    { label: 'Sisa bulan', key: 'remaining_months', placeholder: '12', keyboard: 'numeric' },
                    { label: 'Sisa total hutang', key: 'total_remaining', placeholder: '15.000.000', keyboard: 'numeric' },
                  ].map(f => (
                    <View key={f.key} style={{ marginBottom: 14 }}>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: T.textMuted,
                        marginBottom: 6,
                      }}>
                        {f.label}
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: T.bg,
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          fontSize: 14,
                          color: T.text,
                          borderWidth: 1,
                          borderColor: T.border,
                        }}
                        placeholder={f.placeholder}
                        placeholderTextColor={T.textMuted}
                        keyboardType={f.key === 'amount' || f.key === 'total_remaining' ? 'numeric' : f.keyboard as any}
                        value={formData[f.key as keyof typeof formData]}
                        onChangeText={(text) => {
                          if (f.key === 'amount' || f.key === 'total_remaining') {
                            handleAmountChange(text, f.key as keyof typeof formData);
                          } else {
                            setFormData(prev => ({ ...prev, [f.key]: text }));
                          }
                        }}
                        returnKeyType="next"
                      />
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={handleAddInstallment}
                    style={{
                      backgroundColor: T.accent,
                      borderRadius: 16,
                      padding: 16,
                      alignItems: 'center',
                      marginTop: 4,
                      marginBottom: 24,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      {editingItem ? 'Update Angsuran' : 'Simpan Angsuran'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── UNIVERSAL GOPAY STYLE BOTTOM SHEET MODAL ─── */}
      <Modal
        visible={sheetConfig.visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={{
          flex: 1,
          backgroundColor: T.modalOverlay,
          justifyContent: 'flex-end',
        }}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <View style={{
            backgroundColor: T.modalBg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 50,
            width: '100%',
            position: 'relative'
          }}>
            <TouchableOpacity
              onPress={closeSheet}
              style={{
                position: 'absolute',
                right: 24,
                top: -64,
                backgroundColor: '#fff',
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.18,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <Ionicons name="close" size={24} color="#1c1c1c" />
            </TouchableOpacity>

            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: T.text,
              marginBottom: 10,
            }}>
              {sheetConfig.title}
            </Text>

            <Text style={{
              fontSize: 15,
              color: isDark ? T.textSub : '#555555',
              lineHeight: 22,
              marginBottom: 32,
            }}>
              {sheetConfig.description}
            </Text>

            <View style={{ flexDirection: 'row', gap: 14, width: '100%' }}>
              <TouchableOpacity
                onPress={closeSheet}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  borderRadius: 100,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: sheetConfig.isDestructive ? T.danger : T.accent,
                }}
              >
                <Text style={{ color: sheetConfig.isDestructive ? T.danger : T.accent, fontWeight: '700', fontSize: 16 }}>
                  {sheetConfig.cancelText}
                </Text>
              </TouchableOpacity>

              {sheetConfig.confirmText !== '' && (
                <TouchableOpacity
                  onPress={sheetConfig.onConfirm}
                  style={{
                    flex: 1,
                    backgroundColor: sheetConfig.isDestructive ? T.danger : T.accent,
                    borderRadius: 100,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                    {sheetConfig.confirmText}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}