// src/services/voiceAssistant.ts
import * as Speech from 'expo-speech';

export type VoicePersonality = 'supportive' | 'firm' | 'casual' | 'professional';

interface SpeechOptions {
    personality?: VoicePersonality;
    rate?: number;
    pitch?: number;
    language?: string;
}

// ============ EVENT LISTENER UNTUK ANIMASI ============
type VoiceStateListener = (isSpeaking: boolean) => void;
let listeners: VoiceStateListener[] = [];

export const onVoiceStateChange = (listener: VoiceStateListener): (() => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
};

const notifyVoiceStateChange = (isSpeaking: boolean) => {
    listeners.forEach(listener => listener(isSpeaking));
};

class VoiceAssistantService {
    private static instance: VoiceAssistantService;
    private isSpeaking = false;
    private queue: string[] = [];

    // Pilihan suara berdasarkan personality
    private voiceOptions: Record<VoicePersonality, SpeechOptions> = {
        supportive: {
            rate: 0.92,
            pitch: 1.1,
            language: 'id-ID',
        },
        firm: {
            rate: 0.85,
            pitch: 0.9,
            language: 'id-ID',
        },
        casual: {
            rate: 1.0,
            pitch: 1.0,
            language: 'id-ID',
        },
        professional: {
            rate: 0.88,
            pitch: 1.0,
            language: 'id-ID',
        },
    };

    static getInstance(): VoiceAssistantService {
        if (!VoiceAssistantService.instance) {
            VoiceAssistantService.instance = new VoiceAssistantService();
        }
        return VoiceAssistantService.instance;
    }

    async speak(
        message: string,
        options: { personality?: VoicePersonality; immediate?: boolean } = {}
    ) {
        const { personality = 'supportive', immediate = false } = options;

        if (immediate) {
            // Hentikan suara yang sedang berlangsung
            await Speech.stop();
            this.queue = [];
        }

        const speechOptions = this.voiceOptions[personality];

        // Notifikasi mulai berbicara
        this.isSpeaking = true;
        notifyVoiceStateChange(true);

        // Eksekusi speech
        Speech.speak(message, {
            ...speechOptions,
            onStart: () => {
                this.isSpeaking = true;
                notifyVoiceStateChange(true);
            },
            onDone: () => {
                this.isSpeaking = false;
                notifyVoiceStateChange(false);

                // Proses antrian berikutnya
                if (this.queue.length > 0) {
                    const next = this.queue.shift();
                    if (next) this.speak(next);
                }
            },
            onError: (error) => {
                console.error('Speech error:', error);
                this.isSpeaking = false;
                notifyVoiceStateChange(false);
            },
        });
    }

    async stop() {
        await Speech.stop();
        this.isSpeaking = false;
        notifyVoiceStateChange(false);
        this.queue = [];
    }

    // Cek apakah sedang berbicara
    isCurrentlySpeaking(): boolean {
        return this.isSpeaking;
    }

    // ============ PESAN-PESAN REKOMENDASI ============
    // Menggunakan nama "KalKu" sebagai asisten

    getSpendingWarningMessage(amount: number, category: string, remainingBudget: number): string {
        if (remainingBudget < 0) {
            return `Wah, kamu sudah melebihi batas anggaran ${category} sebesar ${Math.abs(remainingBudget).toLocaleString()} rupiah. KalKu saranin lebih hemat ya, bulan depan kita perbaiki lagi!`;
        } else if (remainingBudget < 50000) {
            return `Perhatian! Sisa anggaran ${category}mu tinggal ${remainingBudget.toLocaleString()} rupiah. Sebaiknya kamu kurangi belanja di ${category} untuk sisa bulan ini, kata KalKu.`;
        }
        return `Kamu baru saja belanja ${amount.toLocaleString()} rupiah untuk ${category}. Sisa anggaranmu ${remainingBudget.toLocaleString()} rupiah. KalKu ingetin tetap jaga keuangan ya!`;
    }

    getInstallmentWarningMessage(installmentTitle: string, shortage: number): string {
        return `Peringatan! Setelah pengeluaran ini, dana untuk angsuran ${installmentTitle} kurang ${shortage.toLocaleString()} rupiah. KalKu saranin jangan melakukan pembelian besar dulu ya.`;
    }

    getMonthlySummaryMessage(totalIncome: number, totalExpense: number, savings: number): string {
        if (totalIncome === 0) {
            return "Kamu belum mencatat pemasukan bulan ini. Yuk catat pemasukanmu terlebih dahulu! KalKu siap membantu.";
        }

        const savingRate = (savings / totalIncome) * 100;

        if (savingRate >= 20) {
            return `Bagus sekali! Bulan ini kamu bisa menabung ${savings.toLocaleString()} rupiah atau ${Math.round(savingRate)} persen dari pemasukan. KalKu bangga sama kamu! Pertahankan ya!`;
        } else if (savingRate >= 10) {
            return `Cukup baik. Kamu menabung ${savings.toLocaleString()} rupiah bulan ini. KalKu saranin tingkatkan lagi dengan mengurangi pengeluaran yang tidak perlu.`;
        }
        return `Mohon maaf, bulan ini tabunganmu hanya ${savings.toLocaleString()} rupiah. KalKu ajak evaluasi pengeluaran dan buat rencana keuangan yang lebih baik!`;
    }

    getMotivationalMessage(): string {
        const messages = [
            "KalKu ingetin, setiap rupiah yang kamu hemat adalah langkah menuju kebebasan finansial!",
            "Kamu hebat! KalKu saranin terus pantau keuanganmu dengan baik.",
            "Ingat kata KalKu, belanja sesuai kebutuhan, bukan keinginan ya!",
            "Sedikit demi sedikit, lama-lama jadi bukit. KalKu dukung kamu terus menabung!",
            "Financial freedom bukan mimpi, asal kamu disiplin! Itu pesan KalKu untukmu.",
            "Kontrol keuangan sekarang, nikmati masa depan nanti! - KalKu",
            "Jangan biarkan uang mengendalikanmu, kendalikan uangmu! Kata KalKu nih.",
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    getGeofenceDetectionMessage(merchantName: string, estimatedAmount?: number): string {
        if (estimatedAmount) {
            return `Halo, KalKu mendeteksi kamu baru saja berada di ${merchantName}. Apakah kamu belanja sekitar ${estimatedAmount.toLocaleString()} rupiah? Jangan lupa dicatat ya!`;
        }
        return `Halo, KalKu lihat kamu baru saja dari ${merchantName}. Ada belanjaan hari ini? Catat pengeluaranmu agar keuangan tetap terkendali!`;
    }

    getDailyReminderMessage(): string {
        const hour = new Date().getHours();
        if (hour < 12) {
            return "Selamat pagi! KalKu ingetin jangan lupa catat rencana keuangan hari ini ya!";
        } else if (hour < 18) {
            return "Selamat siang! Gimana keuanganmu hari ini? Masih sesuai anggaran kata KalKu?";
        }
        return "Selamat malam! Saatnya evaluasi pengeluaran hari ini. Yuk catat semuanya, KalKu tunggu!";
    }

    getBudgetExceedMessage(category: string, overspent: number): string {
        return `Maaf, kamu sudah melebihi anggaran ${category} sebesar ${overspent.toLocaleString()} rupiah. KalKu saranin, tunda dulu pembelian untuk ${category} sampai bulan depan ya!`;
    }

    getSavingSuggestionMessage(potentialSaving: number, fromMerchant: string): string {
        return `Tahu tidak kata KalKu? Kamu sering belanja di ${fromMerchant}. Coba bandingkan harga atau cari promo, kamu bisa hemat hingga ${potentialSaving.toLocaleString()} rupiah per bulan!`;
    }

    getWelcomeMessage(name: string): string {
        return `Halo ${name}! Kenalin, aku KalKu, asisten keuangan pribadimu. Aku siap bantu kamu kelola uang biar lebih baik. Ayo mulai catat pemasukan dan pengeluaranmu!`;
    }

    getResetSuccessMessage(): string {
        return "Semua data keuangan berhasil direset. Kamu bisa memulai lagi dari awal! KalKu tetap semangat dukung kamu mengatur keuangan ya!";
    }

    getAddIncomeMessage(amount: number, newBalance: number): string {
        return `Selamat! Pemasukan ${amount.toLocaleString()} rupiah berhasil ditambahkan. Total tabunganmu sekarang ${newBalance.toLocaleString()} rupiah kata KalKu.`;
    }

    getAddExpenseMessage(amount: number, remainingBalance: number, isOverBudget: boolean): string {
        if (isOverBudget) {
            return `Perhatian! Setelah pengeluaran ${amount.toLocaleString()} rupiah, sisa tabunganmu ${remainingBalance.toLocaleString()} rupiah. KalKu saranin lebih hemat lagi ya!`;
        }
        return `Pengeluaran ${amount.toLocaleString()} rupiah berhasil dicatat. Sisa tabunganmu ${remainingBalance.toLocaleString()} rupiah. KalKu bangga, pertahankan!`;
    }

    getInstallmentReminder(installmentName: string, amount: number, daysLeft: number): string {
        if (daysLeft === 0) {
            return `Pengingat penting dari KalKu! Angsuran ${installmentName} sebesar ${amount.toLocaleString()} rupiah jatuh tempo hari ini. Segera bayar agar tidak terlambat!`;
        } else if (daysLeft === 1) {
            return `Pengingat KalKu! Angsuran ${installmentName} sebesar ${amount.toLocaleString()} rupiah akan jatuh tempo besok. Pastikan dana tersedia!`;
        }
        return `Info angsuran dari KalKu: ${installmentName} sebesar ${amount.toLocaleString()} rupiah akan jatuh tempo ${daysLeft} hari lagi. Siapkan dananya ya!`;
    }

    getLowBalanceWarning(currentBalance: number): string {
        if (currentBalance < 0) {
            return `Peringatan darurat! Saldo kamu negatif ${Math.abs(currentBalance).toLocaleString()} rupiah. KalKu saranin segera evaluasi pengeluaran dan cari solusi!`;
        } else if (currentBalance < 50000) {
            return `Peringatan! Saldo kamu tinggal ${currentBalance.toLocaleString()} rupiah. KalKu ingetin hati-hati dengan pengeluaran berikutnya ya!`;
        } else if (currentBalance < 200000) {
            return `Perhatian! Sisa saldo kamu ${currentBalance.toLocaleString()} rupiah. KalKu saranin mulai hemat dari sekarang!`;
        }
        return `Saldo kamu aman: ${currentBalance.toLocaleString()} rupiah. KalKu pesan tetap jaga keuangan dengan baik!`;
    }
}

export const voiceAssistant = VoiceAssistantService.getInstance();