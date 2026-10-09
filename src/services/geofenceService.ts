// src/services/geofenceService.ts
import { useTransactionStore } from '../store/transactionStore';
import { notificationService } from './notificationService';

// Daftar merchant yang diketahui
const KNOWN_MERCHANTS = [
    { name: 'Indomaret', lat: -6.2088, lng: 106.8456, radius: 50 },
    { name: 'Alfamart', lat: -6.2000, lng: 106.8500, radius: 50 },
    { name: 'Superindo', lat: -6.2100, lng: 106.8400, radius: 70 },
    // Tambahkan lebih banyak sesuai kebutuhan
];

export class GeofenceService {
    private static instance: GeofenceService;
    private activeGeofences: Map<string, { enterTime: Date; merchant: string }> = new Map();

    static getInstance(): GeofenceService {
        if (!GeofenceService.instance) {
            GeofenceService.instance = new GeofenceService();
        }
        return GeofenceService.instance;
    }

    // Proses update lokasi dari background task
    async processLocation(latitude: number, longitude: number, userId: string) {
        // Cek apakah user berada di dalam geofence merchant
        for (const merchant of KNOWN_MERCHANTS) {
            const distance = this.calculateDistance(
                latitude,
                longitude,
                merchant.lat,
                merchant.lng
            );

            const geofenceKey = `${userId}_${merchant.name}`;

            if (distance <= merchant.radius) {
                // User memasuki geofence
                if (!this.activeGeofences.has(geofenceKey)) {
                    this.activeGeofences.set(geofenceKey, {
                        enterTime: new Date(),
                        merchant: merchant.name,
                    });
                    console.log(`User entered ${merchant.name}`);
                }
            } else {
                // User keluar dari geofence
                const entry = this.activeGeofences.get(geofenceKey);
                if (entry) {
                    const dwellTime = (new Date().getTime() - entry.enterTime.getTime()) / 1000;

                    // Jika lebih dari 3 menit, anggap belanja
                    if (dwellTime > 180) {
                        await this.handleSpendingDetection(entry.merchant, userId);
                    }

                    this.activeGeofences.delete(geofenceKey);
                }
            }
        }
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000; // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private async handleSpendingDetection(merchant: string, userId: string) {
        // Dapatkan estimasi belanja berdasarkan history user
        const store = useTransactionStore.getState();
        const estimatedAmount = this.estimateSpendingAmount(merchant, userId, store.transactions);

        // Kirim notifikasi dengan suara
        await notificationService.sendGeofenceDetection(merchant, estimatedAmount);
    }

    private estimateSpendingAmount(merchant: string, userId: string, transactions: any[]): number | undefined {
        // Cari history transaksi di merchant yang sama
        const merchantTransactions = transactions.filter(
            t => t.merchant?.toLowerCase().includes(merchant.toLowerCase())
        );

        if (merchantTransactions.length > 0) {
            const avgAmount = merchantTransactions.reduce((sum, t) => sum + t.amount, 0) / merchantTransactions.length;
            return Math.round(avgAmount / 10000) * 10000; // Bulatkan ke puluhan ribu
        }

        return undefined;
    }
}

export const geofenceService = GeofenceService.getInstance();