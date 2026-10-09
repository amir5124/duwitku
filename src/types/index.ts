// src/types/index.ts
export type TransactionType = 'INCOME' | 'EXPENSE';

export type TransactionCategory = 
  // Kategori Pemasukan
  | 'GAJI' | 'BONUS' | 'INVESTASI' | 'HADIAH' | 'FREELANCE' | 'BISNIS'
  // Kategori Pengeluaran
  | 'MAKANAN' | 'TRANSPORTASI' | 'BELANJA' | 'TAGIHAN' | 'KESEHATAN' 
  | 'PENDIDIKAN' | 'HIBURAN' | 'TABUNGAN' | 'KUOTA' | 'KOS' | 'HUTANG' | 'ZAKAT' | 'LAINNYA';

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  merchant?: string;
  note?: string;
  timestamp: string;
  is_auto_detected: boolean;
  location_lat?: number;
  location_lng?: number;
  created_at: string;
}

export interface Budget {
  id?: string;
  user_id?: string;
  category: string;
  limit: number;
  spent: number;
  percentage: number;
  month?: number;
  year?: number;
  created_at?: string;
}

export interface Installment {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_date: number;
  remaining_months: number;
  total_remaining: number;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  fcm_token?: string;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

// ── TAMBAHKAN INTERFACE SPENDING HABIT ──
export interface SpendingHabit {
  merchant: string;
  category: string;
  average_amount: number;
  frequency_per_month: number;
  last_transaction: string;
  typical_days: number[];
  typical_hours: number[];
}

// ── GABUNGKAN MONTHLY PROJECTION (HANYA SATU) ──
export interface MonthlyProjection {
  total_income: number;
  total_expense: number;
  total_installments: number;
  projected_savings: number;
  current_balance: number;   // saldo real sekarang (income - expense)
  is_safe: boolean;
  warning_level: 'safe' | 'warning' | 'danger';
  recommendations: string[];
}