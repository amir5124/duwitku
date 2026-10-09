// src/components/dashboard/BudgetProgressCard.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { formatCurrency } from '../../utils/formatters';

interface BudgetItem {
  category: string;
  limit: number;
  spent: number;
  percentage: number;
}

interface Props {
  budgets: BudgetItem[];
}

const CATEGORY_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  MAKANAN: { label: 'Makan & Minum', icon: 'restaurant-outline', color: '#f97316' },
  TRANSPORTASI: { label: 'Transportasi', icon: 'car-outline', color: '#3b82f6' },
  BELANJA: { label: 'Belanja', icon: 'bag-outline', color: '#8b5cf6' },
  TAGIHAN: { label: 'Tagihan', icon: 'receipt-outline', color: '#ef4444' },
  KESEHATAN: { label: 'Kesehatan', icon: 'medkit-outline', color: '#10b981' },
  PENDIDIKAN: { label: 'Pendidikan', icon: 'school-outline', color: '#06b6d4' },
  HIBURAN: { label: 'Hiburan', icon: 'game-controller-outline', color: '#ec4899' },
  TABUNGAN: { label: 'Tabungan', icon: 'save-outline', color: '#22c55e' },
  KUOTA: { label: 'Kuota/Pulsa', icon: 'wifi-outline', color: '#06b6d4' },
  KOS: { label: 'Kos/Sewa', icon: 'home-outline', color: '#14b8a6' },
  HUTANG: { label: 'Bayar Hutang', icon: 'cash-outline', color: '#ef4444' },
  ZAKAT: { label: 'Zakat/Sedekah', icon: 'heart-outline', color: '#10b981' },
  LAINNYA: { label: 'Lainnya', icon: 'ellipsis-horizontal-outline', color: '#94a3b8' },
};

const getBarColor = (pct: number): string => {
  if (pct >= 100) return '#ef4444';
  if (pct >= 80) return '#f59e0b';
  return '#10b981';
};

const getStatusLabel = (pct: number): { text: string; color: string; bg: string } => {
  if (pct >= 100) return { text: 'Melebihi batas', color: '#be123c', bg: '#fff1f2' };
  if (pct >= 80) return { text: 'Hampir habis', color: '#a16207', bg: '#fffbeb' };
  return { text: 'Aman', color: '#15803d', bg: '#f0fdf4' };
};

export function BudgetProgressCard({ budgets }: Props) {
  if (!budgets || budgets.length === 0) return null;

  // Urutkan berdasarkan persentase terpakai tertinggi, ambil 3 teratas
  const topBudgets = [...budgets]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3);

  return (
    <View style={{ marginHorizontal: 20, marginVertical: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>Anggaran Bulan Ini</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, color: '#6366f1' }}>Lihat semua</Text>
        </TouchableOpacity>
      </View>

      {/* Budget cards */}
      <View style={{
        backgroundColor: '#fff', borderRadius: 20,
        borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden',
      }}>
        {topBudgets.map((budget, idx) => {
          const pct = Math.min(budget.percentage, 100);
          const remaining = budget.limit - budget.spent;
          const meta = CATEGORY_META[budget.category] ?? CATEGORY_META.LAINNYA;
          const barColor = getBarColor(pct);
          const status = getStatusLabel(pct);

          return (
            <View
              key={budget.category + idx}
              style={{
                padding: 14,
                borderBottomWidth: idx < topBudgets.length - 1 ? 0.5 : 0,
                borderBottomColor: '#f1f5f9',
              }}
            >
              {/* Row atas: ikon + nama + status badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 10,
                  backgroundColor: meta.color + '18',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 10,
                }}>
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#1f2937' }}>
                  {meta.label}
                </Text>
                <View style={{
                  backgroundColor: status.bg, borderRadius: 20,
                  paddingHorizontal: 8, paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: status.color }}>
                    {status.text}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={{
                height: 6, backgroundColor: '#f1f5f9', borderRadius: 3,
                overflow: 'hidden', marginBottom: 6,
              }}>
                <View style={{
                  height: '100%', borderRadius: 3,
                  width: `${pct}%`,
                  backgroundColor: barColor,
                }} />
              </View>

              {/* Angka: terpakai / limit */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>
                  <Text style={{ fontWeight: '600', color: '#374151' }}>{formatCurrency(budget.spent)}</Text>
                  {' '}dari {formatCurrency(budget.limit)}
                </Text>
                <Text style={{
                  fontSize: 11, fontWeight: '500',
                  color: remaining >= 0 ? '#6b7280' : '#ef4444',
                }}>
                  {remaining >= 0
                    ? `Sisa ${formatCurrency(remaining)}`
                    : `Lebih ${formatCurrency(Math.abs(remaining))}`
                  }
                </Text>
              </View>
            </View>
          );
        })}

        {/* Footer jika semua budget aman */}
        {budgets.every(b => b.spent <= b.limit) && budgets.length > 0 && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, paddingVertical: 10,
            backgroundColor: '#f0fdf4', borderTopWidth: 0.5, borderTopColor: '#bbf7d0',
          }}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '500' }}>
              Semua anggaran masih dalam batas
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}