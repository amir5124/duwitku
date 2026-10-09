// src/components/finance/TransactionItem.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface Transaction {
    id: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    merchant?: string;
    note?: string;
    timestamp: string;
    is_auto_detected: boolean;
}

interface TransactionItemProps {
    transaction: Transaction;
    onPress?: (transaction: Transaction) => void;
    onLongPress?: (transaction: Transaction) => void;
}

// Label kategori dalam bahasa Indonesia
const categoryLabels: Record<string, string> = {
    // Pemasukan
    GAJI: 'Gaji',
    BONUS: 'Bonus',
    INVESTASI: 'Investasi',
    HADIAH: 'Hadiah',
    FREELANCE: 'Freelance',
    BISNIS: 'Bisnis',
    // Pengeluaran
    MAKANAN: 'Makanan',
    TRANSPORTASI: 'Transportasi',
    BELANJA: 'Belanja',
    TAGIHAN: 'Tagihan',
    KESEHATAN: 'Kesehatan',
    PENDIDIKAN: 'Pendidikan',
    HIBURAN: 'Hiburan',
    TABUNGAN: 'Tabungan',
    KUOTA: 'Kuota/Pulsa',
    KOS: 'Kos/Sewa',
    HUTANG: 'Bayar Hutang',
    ZAKAT: 'Zakat/Sedekah',
    LAINNYA: 'Lainnya',
    // Legacy (untuk kompatibilitas)
    INCOME: 'Pemasukan',
    FOOD: 'Makanan',
    TRANSPORT: 'Transportasi',
    SHOPPING: 'Belanja',
    BILLS: 'Tagihan',
    HEALTH: 'Kesehatan',
    EDUCATION: 'Pendidikan',
    ENTERTAINMENT: 'Hiburan',
    SAVINGS: 'Tabungan',
    OTHER: 'Lainnya',
    INVESTMENT: 'Investasi',
    GIFT: 'Hadiah',
};

// Icon untuk setiap kategori
const categoryIcons: Record<string, string> = {
    // Pemasukan
    GAJI: 'briefcase-outline',
    BONUS: 'gift-outline',
    INVESTASI: 'trending-up-outline',
    HADIAH: 'gift-outline',
    FREELANCE: 'laptop-outline',
    BISNIS: 'storefront-outline',
    // Pengeluaran
    MAKANAN: 'restaurant-outline',
    TRANSPORTASI: 'car-outline',
    BELANJA: 'cart-outline',
    TAGIHAN: 'document-text-outline',
    KESEHATAN: 'medkit-outline',
    PENDIDIKAN: 'school-outline',
    HIBURAN: 'tv-outline',
    TABUNGAN: 'wallet-outline',
    KUOTA: 'wifi-outline',
    KOS: 'home-outline',
    HUTANG: 'cash-outline',
    ZAKAT: 'heart-outline',
    LAINNYA: 'ellipsis-horizontal-outline',
    // Legacy
    INCOME: 'trending-up-outline',
    FOOD: 'restaurant-outline',
    TRANSPORT: 'car-outline',
    SHOPPING: 'cart-outline',
    BILLS: 'document-text-outline',
    HEALTH: 'medkit-outline',
    EDUCATION: 'school-outline',
    ENTERTAINMENT: 'tv-outline',
    SAVINGS: 'wallet-outline',
    OTHER: 'ellipsis-horizontal-outline',
    INVESTMENT: 'trending-up-outline',
    GIFT: 'gift-outline',
};

// Warna icon untuk setiap kategori
const categoryColors: Record<string, string> = {
    // Pemasukan
    GAJI: 'text-emerald-600',
    BONUS: 'text-amber-600',
    INVESTASI: 'text-violet-600',
    HADIAH: 'text-pink-600',
    FREELANCE: 'text-cyan-600',
    BISNIS: 'text-blue-600',
    // Pengeluaran
    MAKANAN: 'text-orange-500',
    TRANSPORTASI: 'text-blue-500',
    BELANJA: 'text-purple-500',
    TAGIHAN: 'text-red-500',
    KESEHATAN: 'text-green-500',
    PENDIDIKAN: 'text-indigo-500',
    HIBURAN: 'text-pink-500',
    TABUNGAN: 'text-amber-500',
    KUOTA: 'text-cyan-500',
    KOS: 'text-teal-500',
    HUTANG: 'text-red-500',
    ZAKAT: 'text-emerald-500',
    LAINNYA: 'text-gray-500',
    // Legacy
    INCOME: 'text-emerald-600',
    FOOD: 'text-orange-500',
    TRANSPORT: 'text-blue-500',
    SHOPPING: 'text-purple-500',
    BILLS: 'text-red-500',
    HEALTH: 'text-green-500',
    EDUCATION: 'text-indigo-500',
    ENTERTAINMENT: 'text-pink-500',
    SAVINGS: 'text-amber-500',
    OTHER: 'text-gray-500',
    INVESTMENT: 'text-violet-600',
    GIFT: 'text-pink-600',
};

// Warna background untuk setiap kategori
const categoryBgColors: Record<string, string> = {
    // Pemasukan
    GAJI: 'bg-emerald-50',
    BONUS: 'bg-amber-50',
    INVESTASI: 'bg-violet-50',
    HADIAH: 'bg-pink-50',
    FREELANCE: 'bg-cyan-50',
    BISNIS: 'bg-blue-50',
    // Pengeluaran
    MAKANAN: 'bg-orange-50',
    TRANSPORTASI: 'bg-blue-50',
    BELANJA: 'bg-purple-50',
    TAGIHAN: 'bg-red-50',
    KESEHATAN: 'bg-green-50',
    PENDIDIKAN: 'bg-indigo-50',
    HIBURAN: 'bg-pink-50',
    TABUNGAN: 'bg-amber-50',
    KUOTA: 'bg-cyan-50',
    KOS: 'bg-teal-50',
    HUTANG: 'bg-red-50',
    ZAKAT: 'bg-emerald-50',
    LAINNYA: 'bg-gray-50',
    // Legacy
    INCOME: 'bg-emerald-50',
    FOOD: 'bg-orange-50',
    TRANSPORT: 'bg-blue-50',
    SHOPPING: 'bg-purple-50',
    BILLS: 'bg-red-50',
    HEALTH: 'bg-green-50',
    EDUCATION: 'bg-indigo-50',
    ENTERTAINMENT: 'bg-pink-50',
    SAVINGS: 'bg-amber-50',
    OTHER: 'bg-gray-50',
    INVESTMENT: 'bg-violet-50',
    GIFT: 'bg-pink-50',
};

// Fungsi untuk mendapatkan label kategori
const getCategoryLabel = (category: string): string => {
    return categoryLabels[category] || category;
};

export const TransactionItem: React.FC<TransactionItemProps> = ({
    transaction,
    onPress,
    onLongPress
}) => {
    const isIncome = transaction.type === 'INCOME';
    const iconName = categoryIcons[transaction.category] || (isIncome ? 'trending-up-outline' : 'cash-outline');
    const colorClass = categoryColors[transaction.category] || (isIncome ? 'text-emerald-600' : 'text-gray-500');
    const bgClass = categoryBgColors[transaction.category] || (isIncome ? 'bg-emerald-50' : 'bg-gray-50');

    // Tampilkan merchant jika ada,否则 tampilkan kategori
    const displayName = transaction.merchant || getCategoryLabel(transaction.category) || (isIncome ? 'Pemasukan' : 'Pengeluaran');

    return (
        <TouchableOpacity
            onPress={() => onPress?.(transaction)}
            onLongPress={() => onLongPress?.(transaction)}
            className="flex-row items-center justify-between bg-white px-4 py-3 rounded-xl mb-2 shadow-sm"
            activeOpacity={0.7}
        >
            <View className="flex-row items-center flex-1">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${bgClass}`}>
                    <Ionicons name={iconName as any} size={20} color={colorClass.replace('text-', '').replace('-600', '').replace('-500', '') || '#6b7280'} />
                </View>
                <View className="flex-1">
                    <Text className="font-semibold text-gray-800">
                        {displayName}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                        {formatDate(transaction.timestamp)}
                    </Text>
                </View>
            </View>
            <Text className={`font-semibold ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
            </Text>
        </TouchableOpacity>
    );
};