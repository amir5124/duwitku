// src/store/transactionStore.ts
import { create } from 'zustand';
import { supabase } from '../services/supabase/client';
import { voiceAssistant } from '../services/voiceAssistant';
import { Transaction, TransactionCategory, TransactionType } from '../types';

interface AddTransactionData {
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
    merchant?: string;
    note?: string;
}

interface AddMultipleTransactionsData {
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
    merchant?: string;
    note?: string;
}

interface TransactionState {
    transactions: Transaction[];
    isLoading: boolean;
    totalIncome: number;
    totalExpense: number;
    balance: number;

    fetchTransactions: () => Promise<void>;
    addTransaction: (data: AddTransactionData) => Promise<{ success: boolean; message: string }>;
    addMultipleTransactions: (transactions: AddMultipleTransactionsData[]) => Promise<{ success: boolean; message: string; count?: number }>;
    deleteTransaction: (id: string) => Promise<{ success: boolean; message: string }>;
    checkAndSpeakBudget: (amount: number, category: string) => Promise<void>;
    reset: () => void; // Tambahkan method reset untuk logout
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
    transactions: [],
    isLoading: false,
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,

    fetchTransactions: async () => {
        set({ isLoading: true });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            set({ isLoading: false });
            return;
        }

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error fetching transactions:', error);
            set({ isLoading: false });
            return;
        }

        const transactions = data as Transaction[];
        const totalIncome = transactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + t.amount, 0);

        set({
            transactions,
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            isLoading: false,
        });

        return;
    },

    addTransaction: async (data) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, message: 'User tidak ditemukan' };
        }

        const { error } = await supabase.from('transactions').insert({
            user_id: user.id,
            amount: data.amount,
            type: data.type,
            category: data.category,
            merchant: data.merchant || null,
            note: data.note || null,
            timestamp: new Date().toISOString(),
        });

        if (error) {
            console.error('Error adding transaction:', error);
            return { success: false, message: 'Gagal menambah transaksi' };
        }

        // Refresh data setelah insert
        await get().fetchTransactions();

        // Hitung ulang balance setelah refresh
        const { totalIncome, totalExpense, balance } = get();

        // Trigger voice untuk pengeluaran
        if (data.type === 'EXPENSE') {
            // Hitung sisa tabungan
            const remainingSavings = balance;
            const monthlyIncome = totalIncome;
            const savingRate = monthlyIncome > 0 ? (remainingSavings / monthlyIncome) * 100 : 0;

            // Buat pesan suara
            let message = '';

            if (remainingSavings < 0) {
                message = `Perhatian! Setelah pengeluaran ${data.amount.toLocaleString()} rupiah, tabungan kamu menjadi negatif ${Math.abs(remainingSavings).toLocaleString()} rupiah. Segera evaluasi pengeluaranmu!`;
                await voiceAssistant.speak(message, { personality: 'firm' });
            } else if (remainingSavings < 100000) {
                message = `Peringatan! Sisa tabunganmu tinggal ${remainingSavings.toLocaleString()} rupiah. Coba hemat pengeluaran untuk sisa bulan ini.`;
                await voiceAssistant.speak(message, { personality: 'supportive' });
            } else if (savingRate < 20) {
                message = `Kamu baru saja belanja ${data.amount.toLocaleString()} rupiah. Sisa tabunganmu ${remainingSavings.toLocaleString()} rupiah. Coba tingkatkan tabungan menjadi 20% dari pemasukan ya!`;
                await voiceAssistant.speak(message, { personality: 'supportive' });
            } else {
                message = `Pengeluaran ${data.amount.toLocaleString()} rupiah berhasil dicatat. Sisa tabunganmu ${remainingSavings.toLocaleString()} rupiah. Pertahankan!`;
                await voiceAssistant.speak(message, { personality: 'supportive' });
            }
        } else {
            // Untuk pemasukan
            const message = `Selamat! Pemasukan ${data.amount.toLocaleString()} rupiah berhasil ditambahkan. Total tabunganmu sekarang ${get().balance.toLocaleString()} rupiah.`;
            await voiceAssistant.speak(message, { personality: 'supportive' });
        }

        const messageText = data.type === 'INCOME'
            ? `✅ Pemasukan Rp${data.amount.toLocaleString()} berhasil ditambahkan`
            : `✅ Pengeluaran Rp${data.amount.toLocaleString()} berhasil dicatat`;

        return { success: true, message: messageText };
    },

    // ─── Tambahan: Add Multiple Transactions ──────────────────────────────
    addMultipleTransactions: async (transactions) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, message: 'User tidak ditemukan' };
        }

        if (!transactions || transactions.length === 0) {
            return { success: false, message: 'Tidak ada transaksi yang akan disimpan' };
        }

        try {
            // Siapkan data untuk bulk insert
            const transactionsToInsert = transactions.map(tx => ({
                user_id: user.id,
                amount: tx.amount,
                type: tx.type,
                category: tx.category,
                merchant: tx.merchant || null,
                note: tx.note || null,
                timestamp: new Date().toISOString(),
            }));

            // Insert semua transaksi sekaligus
            const { error } = await supabase
                .from('transactions')
                .insert(transactionsToInsert);

            if (error) {
                console.error('Error adding multiple transactions:', error);
                return { success: false, message: 'Gagal menambah transaksi' };
            }

            // Refresh data setelah insert
            await get().fetchTransactions();

            // Hitung total yang berhasil disimpan
            const totalIncome = transactions
                .filter(t => t.type === 'INCOME')
                .reduce((sum, t) => sum + t.amount, 0);
            const totalExpense = transactions
                .filter(t => t.type === 'EXPENSE')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const incomeCount = transactions.filter(t => t.type === 'INCOME').length;
            const expenseCount = transactions.filter(t => t.type === 'EXPENSE').length;

            // Buat pesan suara ringkasan
            let voiceMessage = '';
            const { balance } = get();

            if (incomeCount > 0 && expenseCount > 0) {
                voiceMessage = `${incomeCount} pemasukan total ${totalIncome.toLocaleString()} rupiah dan ${expenseCount} pengeluaran total ${totalExpense.toLocaleString()} rupiah berhasil dicatat. Sisa tabungan kamu sekarang ${balance.toLocaleString()} rupiah.`;
            } else if (incomeCount > 0) {
                voiceMessage = `${incomeCount} pemasukan total ${totalIncome.toLocaleString()} rupiah berhasil ditambahkan. Total tabungan kamu sekarang ${balance.toLocaleString()} rupiah.`;
            } else {
                voiceMessage = `${expenseCount} pengeluaran total ${totalExpense.toLocaleString()} rupiah berhasil dicatat. Sisa tabungan kamu sekarang ${balance.toLocaleString()} rupiah.`;
                
                // Cek risiko keuangan untuk pengeluaran massal
                if (balance < 0) {
                    voiceMessage += ` Perhatian! Tabungan kamu negatif ${Math.abs(balance).toLocaleString()} rupiah. Evaluasi pengeluaranmu!`;
                } else if (balance < 100000) {
                    voiceMessage += ` Peringatan! Sisa tabunganmu tinggal sedikit. Coba hemat!`;
                }
            }

            // Speak voice summary (opsional, jika voice assistant tersedia)
            try {
                await voiceAssistant.speak(voiceMessage, { personality: 'supportive' });
            } catch (e) {
                console.log('Voice not available for summary');
            }

            const messageText = `✅ ${transactions.length} transaksi berhasil dicatat (${incomeCount} pemasukan, ${expenseCount} pengeluaran)`;

            return { 
                success: true, 
                message: messageText,
                count: transactions.length 
            };

        } catch (error: any) {
            console.error('Error in addMultipleTransactions:', error);
            return { success: false, message: error.message || 'Gagal menambah transaksi' };
        }
    },

    deleteTransaction: async (id) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);

        if (error) {
            return { success: false, message: 'Gagal menghapus transaksi' };
        }

        await get().fetchTransactions();
        return { success: true, message: 'Transaksi berhasil dihapus' };
    },

    checkAndSpeakBudget: async (amount, category) => {
        // Fungsi ini bisa dipanggil terpisah jika perlu
        const { balance } = get();
        const remaining = balance;

        if (remaining < 0) {
            await voiceAssistant.speak(
                `Perhatian! Tabungan kamu sudah habis dan minus ${Math.abs(remaining).toLocaleString()} rupiah. Hentikan pengeluaran yang tidak perlu!`,
                { personality: 'firm' }
            );
        } else if (remaining < 100000) {
            await voiceAssistant.speak(
                `Sisa tabunganmu tinggal ${remaining.toLocaleString()} rupiah. Awas jangan sampai habis sebelum akhir bulan!`,
                { personality: 'supportive' }
            );
        }
    },

    // Reset store (dipanggil saat logout)
    reset: () => {
        set({
            transactions: [],
            isLoading: false,
            totalIncome: 0,
            totalExpense: 0,
            balance: 0,
        });
    },
}));