// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
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
import UpgradeProModal from '../../src/components/UpgradeProModal';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ClaudeParseError, parseTransactionsWithClaude } from '../../src/services/claudeParser';
import { checkAndUseFeature, checkProStatus } from '../../src/services/featureLimits';
import { financeAnalytics } from '../../src/services/financeAnalytics';
import { supabase } from '../../src/services/supabase/client';
import { voiceAssistant } from '../../src/services/voiceAssistant';
import { useBudgetStore } from '../../src/store/budgetStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { Installment } from '../../src/types';
import { formatCurrency } from '../../src/utils/formatters';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Speech recognition ────────────────────────────────────────────────────────
let ExpoSpeechRecognitionModule: any = null;
try {
  const module = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = module.ExpoSpeechRecognitionModule;
} catch { /* not available */ }

const AUTO_VOICE_KEY = 'duwitku_auto_voice_enabled';

// ── Theme tokens ──────────────────────────────────────────────────────────────
const LIGHT = {
  heroBg: '#3b6ef5',
  heroBg2: '#2d5ce0',
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
  shadow: 'rgba(59,110,245,0.10)',
  modalOverlay: 'rgba(0,0,0,0.5)',
  modalBg: '#ffffff',
};
const DARK = {
  heroBg: '#1a3a9e',
  heroBg2: '#0f1a3d',
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
  shadow: 'rgba(0,0,0,0.5)',
  modalOverlay: 'rgba(0,0,0,0.7)',
  modalBg: '#162235',
};

// ── Quick menu items ──────────────────────────────────────────────────────────
// Di dalam QUICK_MENU array
const QUICK_MENU = [
  { label: 'KalKu AI', icon: require('../../assets/icon/KalKu_AI.png'), action: (nav: any) => nav.push('/kalku') },
  { label: 'Pemasukan', icon: require('../../assets/icon/Pemasukan.png'), action: (nav: any) => nav.push('/transactions/add-income') },
  { label: 'Pengeluaran', icon: require('../../assets/icon/Pengeluaran.png'), action: (nav: any) => nav.push('/transactions/add-expense') },
  { label: 'Analitik', icon: require('../../assets/icon/Analitik.png'), action: (nav: any) => nav.push('/(tabs)/analytics') },
  { label: 'Simulator', icon: require('../../assets/icon/Simulator.png'), action: (nav: any) => nav.push('/simulator') },
  { label: 'Goals', icon: require('../../assets/icon/Goals.png'), action: (nav: any) => nav.push('/goals') },
  { label: 'Cicilan', icon: require('../../assets/icon/Angsuran.png'), action: (nav: any) => nav.push('/installments') },
  // ─── Tambahkan Challenge ───────────────────────────────────────────
  { label: 'Challenge', icon: require('../../assets/icon/Goals.png'), action: (nav: any) => nav.push('/(tabs)/challenges') },
];

// ── Category icons ────────────────────────────────────────────────────────────
const CAT_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  FOOD: { icon: 'restaurant-outline', color: '#f97316' },
  TRANSPORT: { icon: 'car-outline', color: '#3b82f6' },
  SHOPPING: { icon: 'bag-outline', color: '#8b5cf6' },
  BILLS: { icon: 'receipt-outline', color: '#ef4444' },
  HEALTH: { icon: 'medkit-outline', color: '#10b981' },
  EDUCATION: { icon: 'school-outline', color: '#06b6d4' },
  ENTERTAINMENT: { icon: 'game-controller-outline', color: '#ec4899' },
  SAVINGS: { icon: 'save-outline', color: '#22c55e' },
  OTHER: { icon: 'ellipsis-horizontal-outline', color: '#94a3b8' },
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

// ════════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════════

function TxRow({ tx, T }: { tx: any; T: typeof LIGHT }) {
  const isIncome = tx.type === 'INCOME';
  const meta = isIncome
    ? { icon: 'arrow-up-circle-outline' as const, color: '#10b981' }
    : (CAT_ICONS[tx.category] ?? CAT_ICONS.OTHER);
  const dateObj = new Date(tx.created_at);
  const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: T.borderLight }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: meta.color + '15', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: T.text }} numberOfLines={1}>
          {tx.description || tx.merchant || tx.category || 'Transaksi'}
        </Text>
        <Text style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{dateStr}, {timeStr}</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: '700', color: isIncome ? '#10b981' : '#ef4444' }}>
        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
      </Text>
    </View>
  );
}

function BudgetBar({ budget, T }: { budget: any; T: typeof LIGHT }) {
  const pct = Math.min((budget.spent / budget.limit) * 100, 100);
  const color = pct >= 100 ? T.danger : pct >= 80 ? T.warning : T.success;
  const labels: Record<string, string> = {
    FOOD: 'Makan', TRANSPORT: 'Transport', SHOPPING: 'Belanja',
    BILLS: 'Tagihan', HEALTH: 'Kesehatan', ENTERTAINMENT: 'Hiburan',
    EDUCATION: 'Pendidikan', SAVINGS: 'Tabungan', OTHER: 'Lainnya',
  };
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ fontSize: 13, color: T.textSub, fontWeight: '500' }}>{labels[budget.category] ?? budget.category}</Text>
        <Text style={{ fontSize: 12, color, fontWeight: '700' }}>{formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: T.border, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function ToastModal({ visible, onClose, title, message, icon, iconColor = '#10b981', T }: {
  visible: boolean; onClose: () => void; title: string; message: string;
  icon: keyof typeof Ionicons.glyphMap; iconColor?: string; T: typeof LIGHT;
}) {
  useEffect(() => { if (visible) { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); } }, [visible]);
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 24, paddingBottom: 90 }}>
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: iconColor + '15', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={24} color={iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.text }}>{title}</Text>
                <Text style={{ fontSize: 13, color: T.textSub, marginTop: 2 }}>{message}</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ════════════════════════════════════════════════════════════════════════════════
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme } = useTheme();
  const T = isDark ? DARK : LIGHT;

  // ── State ─────────────────────────────────────────────────────────────────
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [formData, setFormData] = useState({ name: '', amount: '', due_date: '', remaining_months: '', total_remaining: '' });
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [isPro, setIsPro] = useState(false);

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

  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData] = useState({ title: '', message: '', icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap, iconColor: '#10b981' });

  const { transactions, totalIncome, totalExpense, balance, fetchTransactions, reset: resetTransactions, addMultipleTransactions, addTransaction } = useTransactionStore();
  const { budgets, fetchBudgets } = useBudgetStore();

  const savings = totalIncome - totalExpense;
  const savingRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;
  const today = new Date().getDate();
  const exceededBudgets = budgets.filter(b => b.spent > b.limit);
  const upcomingInstallments = installments.filter(i => i.due_date >= today && i.due_date <= today + 5);
  const hasRisk = exceededBudgets.length > 0 || savingRate < 10 || upcomingInstallments.length > 0;
  const recentTx = transactions.slice(0, 5);
  const topBudgets = [...budgets].sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit)).slice(0, 3);
  const totalInstallmentsPerMonth = installments.reduce((s, i) => s + i.amount, 0);

  // ── Modal Helpers ──────────────────────────────────────────────────────────
  const showSheet = (config: Omit<DynamicModalConfig, 'visible'>) => {
    setSheetConfig({ ...config, visible: true });
  };

  const closeSheet = () => {
    setSheetConfig(prev => ({ ...prev, visible: false }));
  };

  const showToast = (title: string, message: string, icon: keyof typeof Ionicons.glyphMap = 'checkmark-circle', iconColor = '#10b981') => {
    setToastData({ title, message, icon, iconColor });
    setToastVisible(true);
  };

  // ── Voice state ────────────────────────────────────────────────────────────
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [voiceInputText, setVoiceInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceStarted, setIsVoiceStarted] = useState(false);
  const [isWaitingForSpeech, setIsWaitingForSpeech] = useState(false);
  const [isProcessingSubmit, setIsProcessingSubmit] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isParsingAI, setIsParsingAI] = useState(false);

  const voiceModalVisibleRef = useRef(voiceModalVisible);
  const isVoiceStartedRef = useRef(isVoiceStarted);
  const isListeningRef = useRef(isListening);
  const isIntentionalStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  useEffect(() => { voiceModalVisibleRef.current = voiceModalVisible; }, [voiceModalVisible]);
  useEffect(() => { isVoiceStartedRef.current = isVoiceStarted; }, [isVoiceStarted]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(true);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAll();
    // Cek status Pro
    checkProStatus().then(status => setIsPro(status.is_pro)).catch(() => { });
    setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const n = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
        setUserName(n.split(' ')[0]);
        try {
          const stored = await AsyncStorage.getItem(AUTO_VOICE_KEY);
          if (stored === 'true') {
            const advice = await financeAnalytics.getDailyAdvice(user.id);
            await voiceAssistant.speak(advice, { personality: 'supportive' });
          }
        } catch { /* ignore */ }
      }
    }, 1200);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(AUTO_VOICE_KEY).then(v => setAutoVoiceEnabled(v === 'true')).catch(() => { });
  }, []);

  const loadAll = async () => {
    await Promise.all([fetchTransactions(), fetchBudgets(), loadInstallments()]);
  };
  const loadInstallments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase.from('installments').select('*').eq('user_id', user.id).eq('is_active', true);
      if (!error && data) setInstallments(data as Installment[]);
    }
  };
  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const toggleAutoVoice = async () => {
    const v = !autoVoiceEnabled; setAutoVoiceEnabled(v);
    await AsyncStorage.setItem(AUTO_VOICE_KEY, v ? 'true' : 'false').catch(() => { });
    if (!v) { try { await voiceAssistant.stop(); } catch { /* ignore */ } }
  };

  // ── Installment CRUD ───────────────────────────────────────────────────────
  const handleDeleteInstallment = (id: string, name: string) => {
    showSheet({
      title: '🗑️ Hapus Angsuran?',
      description: `Yakin mau hapus "${name}"? Data bakal ilang permanen!`,
      cancelText: 'Gak jadi',
      confirmText: 'Hapus!',
      isDestructive: true,
      onConfirm: async () => {
        closeSheet();
        await supabase.from('installments').update({ is_active: false }).eq('id', id);
        await loadInstallments();
        showToast('Berhasil dihapus!', `Angsuran ${name} udah ilang.`, 'trash-outline', '#ef4444');
      },
    });
  };

  const handleAddInstallment = async () => {
    if (!formData.name || !formData.amount || !formData.due_date) {
      showSheet({
        title: '😅 Eh, kurang!',
        description: 'Isi semua field yang wajib ya!',
        cancelText: 'Oke, isi dulu',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showSheet({
        title: '😱 Error!',
        description: 'Kamu belum login. Coba login lagi!',
        cancelText: 'Oke',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      return;
    }
    try {
      await supabase.from('installments').insert({
        user_id: user.id,
        name: formData.name,
        amount: parseFloat(formData.amount),
        due_date: parseInt(formData.due_date),
        remaining_months: parseInt(formData.remaining_months) || 0,
        total_remaining: parseFloat(formData.total_remaining) || 0,
        is_active: true,
      });
      setModalVisible(false);
      setFormData({ name: '', amount: '', due_date: '', remaining_months: '', total_remaining: '' });
      await loadInstallments();
      showSheet({
        title: '🎉 Mantap!',
        description: `Angsuran ${formData.name} berhasil ditambah!`,
        cancelText: 'Keren!',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
    } catch (error) {
      showSheet({
        title: '😱 Gagal!',
        description: 'Gagal menyimpan angsuran. Coba lagi!',
        cancelText: 'Coba lagi',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
    }
  };

  const handlePayInstallment = (item: Installment) => {
    showSheet({
      title: '💸 Bayar Angsuran?',
      description: `Yakin mau bayar ${item.name} sebesar ${formatCurrency(item.amount)}?`,
      cancelText: 'Gak jadi',
      confirmText: 'Bayar!',
      isDestructive: false,
      onConfirm: async () => {
        closeSheet();
        const result = await addTransaction({
          amount: item.amount,
          type: 'EXPENSE',
          category: 'HUTANG',
          merchant: item.name,
          note: `Bayar angsuran ${item.name}`,
        });

        if (result.success) {
          await fetchTransactions();

          if (item.remaining_months > 0) {
            const newRemaining = item.remaining_months - 1;
            if (newRemaining === 0) {
              await supabase.from('installments').update({
                is_active: false,
                remaining_months: 0
              }).eq('id', item.id);
              await loadInstallments();
              showSheet({
                title: '🎉 Lunas!',
                description: `Angsuran ${item.name} sudah lunas!`,
                cancelText: 'Mantap!',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
              });
            } else {
              await supabase.from('installments').update({
                remaining_months: newRemaining
              }).eq('id', item.id);
              await loadInstallments();
              showSheet({
                title: '✅ Berhasil!',
                description: `Angsuran ${item.name} berhasil dibayar! 💰`,
                cancelText: 'Keren!',
                confirmText: '',
                isDestructive: false,
                onConfirm: closeSheet,
              });
            }
          } else {
            await loadInstallments();
            showSheet({
              title: '✅ Berhasil!',
              description: `Angsuran ${item.name} berhasil dibayar! 💰`,
              cancelText: 'Keren!',
              confirmText: '',
              isDestructive: false,
              onConfirm: closeSheet,
            });
          }
        } else {
          showSheet({
            title: '😱 Gagal!',
            description: 'Gagal mencatat pembayaran angsuran.',
            cancelText: 'Coba lagi',
            confirmText: '',
            isDestructive: false,
            onConfirm: closeSheet,
          });
        }
      },
    });
  };

  const handleResetData = async () => {
    if (!resetPassword) {
      showSheet({
        title: '😅 Eh, kurang!',
        description: 'Masukin password dulu dong!',
        cancelText: 'Oke',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      return;
    }
    setResetLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      const { error } = await supabase.auth.signInWithPassword({ email: user.email!, password: resetPassword });
      if (error) {
        showSheet({
          title: '😅 Password Salah!',
          description: 'Coba ingat-ingat lagi passwordnya ya!',
          cancelText: 'Coba lagi',
          confirmText: '',
          isDestructive: false,
          onConfirm: closeSheet,
        });
        return;
      }
      await Promise.all([
        supabase.from('transactions').delete().eq('user_id', user.id),
        supabase.from('installments').delete().eq('user_id', user.id),
        supabase.from('budgets').delete().eq('user_id', user.id),
      ]);
      resetTransactions(); await loadAll();
      setResetModalVisible(false); setResetPassword('');
      showSheet({
        title: '🧹 Beres!',
        description: 'Semua data udah direset bersih!',
        cancelText: 'Mantap!',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
    } catch (e: any) {
      showSheet({
        title: '😱 Error!',
        description: e.message || 'Ada masalah nih!',
        cancelText: 'Oke',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
    } finally { setResetLoading(false); }
  };

  // ─── VERSI LENGKAP DENGAN TYPE ASSERTION ────────────────────────────────
  const submitVoiceTransaction = async (transcript: string) => {
    if (isProcessingSubmit) return;
    if (!transcript.trim()) return;

    const usageResult = await checkAndUseFeature('voice');
    if (!usageResult.allowed) {
      setUpgradeModalVisible(true);
      return;
    }

    setIsProcessingSubmit(true);
    setIsParsingAI(true);

    try {
      console.log('🤖 Parsing with Claude AI:', transcript);

      const parsed = await parseTransactionsWithClaude(transcript);

      setIsParsingAI(false);

      if (parsed.length === 0) {
        showSheet({
          title: '🤔 Gak nemu transaksinya!',
          description: 'Coba sebutkan nominal + deskripsi. Contoh: "beli makan 25rb"',
          cancelText: 'Oke',
          confirmText: '',
          isDestructive: false,
          onConfirm: closeSheet,
        });
        setIsProcessingSubmit(false);
        return;
      }

      // ─── Explicit type casting ──────────────────────────────────────
      const toInsert = parsed.map((tx) => ({
        amount: tx.amount,
        type: tx.type,
        category: tx.category || 'LAINNYA',
        merchant: tx.merchant || undefined,
        note: tx.description || tx.merchant || 'Transaksi',
      })) as any;

      console.log('📦 Insert data:', JSON.stringify(toInsert, null, 2));

      const result = await addMultipleTransactions(toInsert);

      if (result.success) {
        await fetchTransactions();

        const incList = parsed.filter((t) => t.type === 'INCOME');
        const expList = parsed.filter((t) => t.type === 'EXPENSE');
        const tInc = incList.reduce((s, t) => s + t.amount, 0);
        const tExp = expList.reduce((s, t) => s + t.amount, 0);

        let msg = '';
        if (incList.length > 0 && expList.length > 0) {
          msg = `${incList.length} pemasukan (${formatCurrency(tInc)}) & ${expList.length} pengeluaran (${formatCurrency(tExp)}) dicatat!`;
        } else if (incList.length > 0) {
          msg = `${incList.length} pemasukan ${formatCurrency(tInc)} berhasil dicatat!`;
        } else {
          msg = `${expList.length} pengeluaran ${formatCurrency(tExp)} berhasil dicatat!`;
        }

        let remainingMsg = '';
        if (usageResult.remaining !== null && usageResult.remaining > 0) {
          remainingMsg = ` (${usageResult.remaining} tersisa hari ini)`;
        } else if (usageResult.is_pro) {
          remainingMsg = ' (Pro unlimited) ✨';
        }

        const lowConfidence = parsed.some(t => t.confidence < 0.6);
        const confidenceMsg = lowConfidence ? ' ⚠️ Cek ulang ya, ada yang kurang yakin!' : '';

        showSheet({
          title: `${parsed.length} Transaksi ✦ AI Berhasil!`,
          description: msg + remainingMsg + confidenceMsg,
          cancelText: 'Mantap!',
          confirmText: '',
          isDestructive: false,
          onConfirm: closeSheet,
        });

        if (autoVoiceEnabled) {
          try {
            await voiceAssistant.speak(`Berhasil! ${msg}`, { personality: 'supportive' });
          } catch { /* ignore */ }
        }
      } else {
        showSheet({
          title: '😱 Gagal!',
          description: result.message || 'Gagal mencatat transaksi, coba lagi!',
          cancelText: 'Coba lagi',
          confirmText: '',
          isDestructive: false,
          onConfirm: closeSheet,
        });
      }

    } catch (error) {
      setIsParsingAI(false);
      console.error('submitVoiceTransaction error:', error);

      if (error instanceof ClaudeParseError) {
        const isBukanTransaksi =
          error.message.includes('Bukan transaksi') ||
          error.message.includes('Tidak ada transaksi');

        showSheet({
          title: isBukanTransaksi ? '🤔 Belum ada nominalnya!' : 'AI Error',
          description: isBukanTransaksi
            ? 'Sebutkan nominal + keterangan. Contoh: "makan siang 25rb"'
            : error.message,
          cancelText: 'Oke',
          confirmText: '',
          isDestructive: false,
          onConfirm: closeSheet,
        });
      } else {
        showSheet({
          title: '😱 Error!',
          description: error instanceof Error ? error.message : 'Ada masalah saat memproses transaksi.',
          cancelText: 'Oke',
          confirmText: '',
          isDestructive: false,
          onConfirm: closeSheet,
        });
      }
    }

    setVoiceModalVisible(false);
    setVoiceInputText('');
    setIsProcessingSubmit(false);
    loadAll();
  };

  // ── Voice controls ─────────────────────────────────────────────────────────
  const checkVoicePermission = useCallback(async (): Promise<boolean> => {
    if (!ExpoSpeechRecognitionModule) {
      showSheet({
        title: '😅 Gak Tersedia!',
        description: 'Voice input butuh module tambahan!',
        cancelText: 'Oke',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      return false;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!perm.granted) {
        const r = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!r.granted) {
          showSheet({
            title: '😅 Izin Ditolak!',
            description: 'Aktifin mikrofon di setting ya!',
            cancelText: 'Oke',
            confirmText: '',
            isDestructive: false,
            onConfirm: closeSheet,
          });
          return false;
        }
      }
      return true;
    } catch {
      showSheet({
        title: '😱 Error!',
        description: 'Gagal cek izin mikrofon!',
        cancelText: 'Oke',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      return false;
    }
  }, []);

  const startVoiceListeningInternal = useCallback(async (skipPermission = false) => {
    if (!ExpoSpeechRecognitionModule) return;
    if (!skipPermission) {
      const ok = await checkVoicePermission();
      if (!ok) return;
    }
    try {
      setVoiceInputText('');
      setIsProcessingVoice(true);
      setIsRetrying(false);
      isIntentionalStopRef.current = false;
      await ExpoSpeechRecognitionModule.start({
        lang: 'id-ID',
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        addsPunctuation: true
      });
    } catch {
      showSheet({
        title: '😱 Error!',
        description: 'Gagal mulai voice recognition!',
        cancelText: 'Oke',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      setIsProcessingVoice(false);
    }
  }, [checkVoicePermission]);

  const startVoiceListening = useCallback(async () => {
    retryCountRef.current = 0;
    isIntentionalStopRef.current = false;
    await startVoiceListeningInternal(false);
  }, [startVoiceListeningInternal]);

  const stopVoiceListening = useCallback(async () => {
    isIntentionalStopRef.current = true;
    if (ExpoSpeechRecognitionModule && isVoiceStartedRef.current) {
      try { await ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
    }
    if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
    setIsListening(false);
    setIsRecording(false);
    setIsVoiceStarted(false);
    setIsWaitingForSpeech(false);
    setIsRetrying(false);
  }, []);

  const restartVoiceListening = useCallback(async () => {
    if (!isFocusedRef.current || !voiceModalVisibleRef.current) return;
    if (retryCountRef.current >= MAX_RETRIES) {
      showSheet({
        title: '🤔 Terlalu Lama!',
        description: 'Tidak ada suara, coba ketik manual.',
        cancelText: 'Oke',
        confirmText: '',
        isDestructive: false,
        onConfirm: closeSheet,
      });
      setIsRetrying(false);
      return;
    }
    retryCountRef.current++;
    setIsRetrying(true);
    setTimeout(async () => {
      if (!isFocusedRef.current || !voiceModalVisibleRef.current || isIntentionalStopRef.current) {
        setIsRetrying(false);
        return;
      }
      isIntentionalStopRef.current = false;
      await startVoiceListeningInternal(true);
      setIsRetrying(false);
    }, 1000);
  }, [startVoiceListeningInternal]);

  const openVoiceModal = useCallback(async () => {
    setVoiceInputText('');
    setVoiceModalVisible(true);
    setTimeout(() => { startVoiceListening(); }, 500);
  }, [startVoiceListening]);

  const closeVoiceModal = useCallback(async () => {
    isIntentionalStopRef.current = true;
    await stopVoiceListening();
    setVoiceModalVisible(false);
    setVoiceInputText('');
    setIsRecording(false);
    setIsListening(false);
    setIsVoiceStarted(false);
    setIsWaitingForSpeech(false);
    setIsProcessingVoice(false);
    setIsRetrying(false);
    setIsParsingAI(false);
    retryCountRef.current = 0;
  }, [stopVoiceListening]);

  // ── Speech event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    if (!ExpoSpeechRecognitionModule) return;

    const startL = ExpoSpeechRecognitionModule.addListener('start', () => {
      if (!isFocusedRef.current) return;
      setIsListening(true);
      setIsRecording(true);
      setIsProcessingVoice(false);
      setIsVoiceStarted(true);
      setIsWaitingForSpeech(true);
      if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
    });

    const endL = ExpoSpeechRecognitionModule.addListener('end', () => {
      if (!isFocusedRef.current) return;
      setIsListening(false);
      setIsRecording(false);
      setIsVoiceStarted(false);
      setIsWaitingForSpeech(false);
      if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
      if (!isIntentionalStopRef.current && voiceInputText.trim() && !isProcessingSubmit) {
        setTimeout(() => { submitVoiceTransaction(voiceInputText); }, 500);
      }
    });

    const resultL = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
      if (!isFocusedRef.current) return;
      const t = event.results?.[0]?.transcript;
      if (t) {
        setVoiceInputText(t);
        setIsWaitingForSpeech(false);
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
      }
    });

    const errorL = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
      if (!isFocusedRef.current) return;
      if (event.error === 'aborted') {
        setIsListening(false);
        setIsRecording(false);
        setIsVoiceStarted(false);
        setIsWaitingForSpeech(false);
        if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        return;
      }
      if (event.error === 'no-speech') {
        if (!isIntentionalStopRef.current && voiceModalVisibleRef.current) {
          restartVoiceListening();
        } else {
          setIsListening(false);
          setIsRecording(false);
          setIsVoiceStarted(false);
          setIsWaitingForSpeech(false);
        }
        return;
      }
      setIsListening(false);
      setIsRecording(false);
      setIsVoiceStarted(false);
      setIsWaitingForSpeech(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        showSheet({
          title: '😱 Voice Error!',
          description: `Error: ${event.error}`,
          cancelText: 'Oke',
          confirmText: '',
          isDestructive: false,
          onConfirm: closeSheet,
        });
      }
    });

    return () => {
      startL.remove();
      endL.remove();
      resultL.remove();
      errorL.remove();
    };
  }, [restartVoiceListening, voiceInputText, isProcessingSubmit]);

  useFocusEffect(useCallback(() => {
    return () => {
      if (voiceModalVisibleRef.current || isVoiceStartedRef.current || isListeningRef.current) {
        closeVoiceModal();
      }
    };
  }, [closeVoiceModal]));

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.heroBg }}>
      <StatusBar style="light" />

      <ToastModal visible={toastVisible} onClose={() => setToastVisible(false)} title={toastData.title} message={toastData.message} icon={toastData.icon} iconColor={toastData.iconColor} T={T} />

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        style={{ flex: 1 }}
        stickyHeaderIndices={[]}
      >
        {/* HERO SECTION */}
        <View style={{ backgroundColor: T.heroBg, paddingHorizontal: 20, paddingTop: insets.top > 0 ? 8 : 16, paddingBottom: 60, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <View style={{ position: 'absolute', top: 20, right: 60, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '400' }}>
                👋 {getGreeting()}!
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 20, color: '#fff', fontWeight: '800', letterSpacing: -0.3 }}>
                  Hai {userName || 'Duwitku'}!
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity onPress={toggleAutoVoice} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: autoVoiceEnabled ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={autoVoiceEnabled ? 'mic' : 'mic-off-outline'} size={16} color={autoVoiceEnabled ? '#a5b4fc' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/upgrade-pro')}
                style={{
                  backgroundColor: isPro ? '#10b981' : 'rgba(255,255,255,0.15)',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {isPro ? '⭐ Pro' : 'Premium'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 1, marginBottom: 8 }}>SISA KEUANGAN</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 }}>
                  {balanceHidden ? 'Rp ••••••' : formatCurrency(balance)}
                </Text>
                <TouchableOpacity onPress={() => setBalanceHidden(v => !v)}>
                  <Ionicons name={balanceHidden ? 'eye-off-outline' : 'eye-outline'} size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
                  <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              {hasRisk && (
                <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#ef444430', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#ef444460' }}>
                  <Text style={{ fontSize: 11, color: '#fca5a5', fontWeight: '600' }}>⚠ Perlu perhatian</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => router.push('/upgrade-pro')}
              activeOpacity={0.8}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={{ backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Premium</Text>
                  <Text style={{ fontSize: 12 }}>⭐</Text>
                </View>
                <Image
                  source={require('../../assets/icon/Mascot.png')}
                  style={{ width: 90, height: 90 }}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/transactions/add-income')}
              activeOpacity={0.85}
              style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-down" size={16} color="#fff" />
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '500' }}>Pemasukan</Text>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                    {balanceHidden ? 'Rp •••' : formatCurrency(totalIncome)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/transactions/add-expense')}
              activeOpacity={0.85}
              style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-up" size={16} color="#fff" />
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '500' }}>Pengeluaran</Text>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                    {balanceHidden ? 'Rp •••' : formatCurrency(totalExpense)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 10 }}>
            <View style={{ width: 20, height: 5, borderRadius: 3, backgroundColor: '#fff' }} />
            <View style={{ width: 8, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          </View>
        </View>

        {/* WHITE CARD SECTION */}
        <View style={{ backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -50, paddingTop: 20, minHeight: 600 }}>
          {/* Quick Menu */}
          <View style={{ backgroundColor: T.card, marginHorizontal: 16, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 8, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 0.5, borderColor: T.border }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, gap: 4 }}>
              {QUICK_MENU.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => item.action(router)}
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, minWidth: 68 }}
                >
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: T.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden' }}>
                    <Image source={item.icon} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: T.textSub, textAlign: 'center' }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* HOME SECTION */}
          <>
            <TouchableOpacity onPress={openVoiceModal} activeOpacity={0.9} style={{ marginHorizontal: 16, marginBottom: 16 }}>
              <View style={{ backgroundColor: T.card, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 0.5, borderColor: T.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.accent + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>✦</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>Catat transaksi pakai AI</Text>
                    <View style={{ backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Baru</Text>
                    </View>
                  </View>
                  <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>Ngomong aja, KalKu AI yang catetin</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: T.card, borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: T.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.text }}>
                  {recentTx.length === 0 ? 'Belum Ada Transaksi' : 'Transaksi Terkini'}
                </Text>
                <TouchableOpacity onPress={() => router.push('/transactions')}>
                  <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
                </TouchableOpacity>
              </View>

              {recentTx.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 }}>
                  <Image
                    source={require('../../assets/images/riwayatfix.png')}
                    style={{
                      width: 160,
                      height: 160,
                      resizeMode: 'contain',
                      marginBottom: 12,
                    }}
                  />
                  <Text style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                    Belum ada transaksi.{'\n'}Mulai catat keuanganmu!
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: T.textMuted, paddingHorizontal: 16, paddingBottom: 6, letterSpacing: 0.5 }}>HARI INI</Text>
                  {recentTx.map((tx, i) => <TxRow key={tx.id ?? i} tx={tx} T={T} />)}
                  <TouchableOpacity onPress={() => router.push('/transactions')} style={{ padding: 14, alignItems: 'center' }}>
                    <Text style={{ color: T.accent, fontSize: 13, fontWeight: '600' }}>Lihat semua transaksi →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {topBudgets.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: T.card, borderRadius: 20, padding: 16, borderWidth: 0.5, borderColor: T.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>Anggaran Bulan Ini</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
                    <Text style={{ fontSize: 13, color: T.accent }}>Lihat semua</Text>
                  </TouchableOpacity>
                </View>
                {topBudgets.map((b, i) => <BudgetBar key={i} budget={b} T={T} />)}
              </View>
            )}

            {upcomingInstallments.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: T.card, borderRadius: 20, padding: 16, borderWidth: 0.5, borderColor: T.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>Upcoming Payment</Text>
                  <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Text style={{ fontSize: 13, color: T.accent }}>+ Tambah</Text>
                  </TouchableOpacity>
                </View>
                {upcomingInstallments.slice(0, 2).map(item => (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.cardAlt, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: T.border }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: T.accent + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="calendar-outline" size={18} color={T.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }}>{item.name}</Text>
                      <Text style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        Tgl {item.due_date} · {formatCurrency(item.amount)}/bln
                        {item.remaining_months > 0 && ` · ${item.remaining_months}x lagi`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: '#ef4444', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 }}
                      onPress={() => handleDeleteInstallment(item.id, item.name)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: '#10b981', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 }}
                      onPress={() => handlePayInstallment(item)}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Bayar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')} activeOpacity={0.8}
              style={{ marginHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: hasRisk ? (isDark ? '#2d1a0a' : '#fffbeb') : (isDark ? '#0a2218' : '#f0fdf4'), borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: hasRisk ? '#fde68a' : '#bbf7d0' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: hasRisk ? '#f59e0b20' : '#10b98120', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={hasRisk ? 'warning-outline' : 'shield-checkmark-outline'} size={20} color={hasRisk ? '#f59e0b' : '#10b981'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: hasRisk ? '#a16207' : '#15803d' }}>{hasRisk ? 'Perlu Perhatian' : 'Keuangan Sehat'}</Text>
                <Text style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Tabungan {Math.round(savingRate)}% · Tap untuk analisis lengkap</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
            </TouchableOpacity>

            <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: T.card, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 0.5, borderColor: T.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? '#1e3a5f' : '#fffbeb', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={18} color={isDark ? '#60a5fa' : '#f59e0b'} />
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }}>Tema</Text>
                  <Text style={{ fontSize: 11, color: T.textMuted }}>{isDark ? 'Mode gelap' : 'Mode terang'}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={toggleTheme} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: isDark ? '#1e3a5f' : '#fde68a', justifyContent: 'center', paddingHorizontal: 3 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: isDark ? '#3b82f6' : '#f59e0b', alignSelf: isDark ? 'flex-end' : 'flex-start', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={12} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
          </>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ─── MODAL: VOICE INPUT ─── */}
      <Modal animationType="slide" transparent visible={voiceModalVisible} onRequestClose={closeVoiceModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 40 : 24) }}>
                <View style={{ width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 24,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isParsingAI ? '#7c3aed20' : (isWaitingForSpeech ? '#ef444415' : '#eef2ff'),
                  }}>
                    <Ionicons
                      name={isParsingAI ? 'sparkles' : (isWaitingForSpeech ? 'mic' : 'mic-outline')}
                      size={24}
                      color={isParsingAI ? '#7c3aed' : (isWaitingForSpeech ? '#ef4444' : '#3b6ef5')}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>
                      {isParsingAI ? '✦ KalKu AI menganalisa...' : (isWaitingForSpeech ? '🎤 Mendengarkan...' : '🎙️ Catat dengan Suara')}
                    </Text>
                    <Text style={{ fontSize: 13, color: isParsingAI ? '#7c3aed' : '#6b7280' }}>
                      {isParsingAI ? 'Memisahkan & mengkategorikan transaksi...' : (isWaitingForSpeech ? 'Bicaralah sekarang...' : 'Tap tombol mic untuk mulai bicara')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closeVoiceModal}
                    disabled={isParsingAI}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View style={{
                  minHeight: 100,
                  marginBottom: 20,
                  backgroundColor: isParsingAI ? '#f5f3ff' : (voiceInputText.trim() ? '#f0fdf4' : '#f8fafc'),
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isParsingAI ? 1 : (voiceInputText.trim() ? 1 : 0),
                  borderColor: isParsingAI ? '#7c3aed30' : (voiceInputText.trim() ? '#bbf7d0' : 'transparent'),
                }}>
                  {isParsingAI ? (
                    <View style={{ alignItems: 'center', gap: 10 }}>
                      <ActivityIndicator color="#7c3aed" size="large" />
                      <Text style={{ color: '#7c3aed', fontSize: 14, fontWeight: '600' }}>KalKu AI sedang memproses...</Text>
                      <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', fontStyle: 'italic' }}>
                        "{voiceInputText.substring(0, 60)}{voiceInputText.length > 60 ? '...' : ''}"
                      </Text>
                    </View>
                  ) : voiceInputText.trim() ? (
                    <Text style={{ fontSize: 16, color: '#1f2937', textAlign: 'center', lineHeight: 24 }}>
                      "{voiceInputText}"
                    </Text>
                  ) : (
                    <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                      {isWaitingForSpeech ? '🎙️ Dengarkan dan bicara...' : 'Belum ada transkrip'}
                    </Text>
                  )}
                </View>

                {!isParsingAI && !voiceInputText.trim() && (
                  <View style={{ marginBottom: 16, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#bbf7d0' }}>
                    <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '600', marginBottom: 4 }}>💡 Contoh bicara:</Text>
                    <Text style={{ fontSize: 11, color: '#166534', lineHeight: 18 }}>
                      • "beli makan 25rb dan kopi 15rb"{'\n'}
                      • "gaji masuk 5jt, bayar listrik 200rb"{'\n'}
                      • "terima bonus 500rb trus belanja shopee 300rb"
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={closeVoiceModal}
                    disabled={isParsingAI}
                    style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: isParsingAI ? 0.5 : 1 }}
                  >
                    <Text style={{ color: '#6b7280', fontWeight: '600' }}>Tutup</Text>
                  </TouchableOpacity>

                  {isParsingAI ? (
                    <View style={{ flex: 2, backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Memproses...</Text>
                    </View>
                  ) : voiceInputText.trim() ? (
                    <TouchableOpacity
                      onPress={() => submitVoiceTransaction(voiceInputText)}
                      disabled={isProcessingSubmit}
                      style={{ flex: 2, backgroundColor: isProcessingSubmit ? '#e5e7eb' : '#10b981', borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                      <Ionicons name={isProcessingSubmit ? 'hourglass-outline' : 'checkmark'} size={18} color={isProcessingSubmit ? '#9ca3af' : '#fff'} />
                      <Text style={{ color: isProcessingSubmit ? '#9ca3af' : '#fff', fontWeight: '600' }}>
                        {isProcessingSubmit ? 'Menyimpan...' : '✦ Simpan'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={isWaitingForSpeech ? stopVoiceListening : startVoiceListening}
                      disabled={isListening || isRecording || isParsingAI}
                      style={{ flex: 2, backgroundColor: (isListening || isRecording) ? '#ef4444' : '#3b6ef5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                      <Ionicons name={isListening || isRecording ? 'stop' : 'mic'} size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '600' }}>
                        {isListening || isRecording ? 'Berhenti' : 'Mulai Bicara'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: TAMBAH ANGSURAN */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <View style={{ backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Math.max(insets.bottom, 24) }}>
                <View style={{ width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: T.text }}>Tambah Angsuran</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close-outline" size={22} color={T.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {[
                    { label: 'Nama angsuran *', key: 'name', placeholder: 'KPR, Cicilan Motor...', keyboard: 'default' },
                    { label: 'Jumlah per bulan *', key: 'amount', placeholder: '1500000', keyboard: 'numeric' },
                    { label: 'Tanggal jatuh tempo *', key: 'due_date', placeholder: '1–31', keyboard: 'numeric' },
                    { label: 'Sisa bulan', key: 'remaining_months', placeholder: '12', keyboard: 'numeric' },
                    { label: 'Sisa total hutang', key: 'total_remaining', placeholder: '15000000', keyboard: 'numeric' },
                  ].map(f => (
                    <View key={f.key} style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: T.textMuted, marginBottom: 6 }}>{f.label}</Text>
                      <TextInput
                        style={{ backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.text, borderWidth: 1, borderColor: T.border }}
                        placeholder={f.placeholder}
                        placeholderTextColor={T.textMuted}
                        keyboardType={f.keyboard as any}
                        value={formData[f.key as keyof typeof formData]}
                        onChangeText={v => setFormData(d => ({ ...d, [f.key]: v }))}
                        returnKeyType="next"
                      />
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={handleAddInstallment}
                    style={{ backgroundColor: T.accent, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4, marginBottom: 24, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Simpan Angsuran</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL: RESET DATA (GAYA GOPAY) ─── */}
      <Modal
        animationType="slide"
        transparent
        visible={resetModalVisible}
        onRequestClose={() => { setResetModalVisible(false); setResetPassword(''); }}
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
                {/* Handle */}
                <View style={{
                  width: 40,
                  height: 4,
                  backgroundColor: T.border,
                  borderRadius: 2,
                  alignSelf: 'center',
                  marginBottom: 20,
                }} />

                {/* Header */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#fee2e2',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: T.text }}>
                      Reset Semua Data
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setResetModalVisible(false); setResetPassword(''); }}>
                    <Ionicons name="close-outline" size={24} color={T.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Warning */}
                <View style={{
                  backgroundColor: '#fef2f2',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#fecaca',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="warning-outline" size={18} color="#dc2626" />
                    <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '600', flex: 1 }}>
                      Peringatan!
                    </Text>
                  </View>
                  <Text style={{ color: '#991b1b', fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                    Semua data transaksi, anggaran, cicilan, dan goals akan hilang permanen!
                  </Text>
                  <Text style={{ color: '#991b1b', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                    Gak bisa dibalikin!
                  </Text>
                </View>

                {/* Password Input */}
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: T.textMuted,
                  marginBottom: 6,
                }}>
                  Masukkan Password untuk Konfirmasi
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: T.bg,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: T.border,
                  marginBottom: 20,
                }}>
                  <Ionicons name="lock-closed-outline" size={20} color={T.textMuted} />
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      fontSize: 14,
                      color: T.text,
                    }}
                    placeholder="Password Anda"
                    placeholderTextColor={T.textMuted}
                    secureTextEntry
                    value={resetPassword}
                    onChangeText={setResetPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleResetData}
                  />
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => { setResetModalVisible(false); setResetPassword(''); }}
                    style={{
                      flex: 1,
                      backgroundColor: T.bg,
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: T.border,
                    }}
                  >
                    <Text style={{ color: T.textSub, fontWeight: '600' }}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleResetData}
                    disabled={resetLoading}
                    style={{
                      flex: 1,
                      backgroundColor: '#ef4444',
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Reset</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: UPGRADE PRO */}
      <UpgradeProModal
        visible={upgradeModalVisible}
        feature="voice"
        onClose={() => setUpgradeModalVisible(false)}
        onUpgrade={() => {
          setUpgradeModalVisible(false);
          router.push('/upgrade-pro');
        }}
      />
    </SafeAreaView>
  );
}