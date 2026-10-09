// src/types/transaction.ts
export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionCategory =
    | 'FOOD' | 'TRANSPORT' | 'SHOPPING' | 'BILLS' | 'HEALTH'
    | 'EDUCATION' | 'ENTERTAINMENT' | 'SAVINGS' | 'OTHER';

export interface Transaction {
    id: string;
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
    merchant?: string;
    note?: string;
    timestamp: Date;
    isAutoDetected: boolean;
    location?: {
        lat: number;
        lng: number;
    };
}

export interface Budget {
    category: TransactionCategory;
    limit: number;
    spent: number;
    remaining: number;
    percentage: number;
}

export interface Installment {
    id: string;
    title: string;
    amount: number;
    totalRemaining: number;
    remainingMonths: number;
    dueDate: number; // day of month (1-31)
}

// Tambahkan field current_balance ke MonthlyProjection di src/types/index.ts (atau types.ts)

export interface MonthlyProjection {
    total_income       : number;
    total_expense      : number;
    total_installments : number;
    projected_savings  : number;
    current_balance    : number;   // ← BARU: saldo real sekarang (income - expense), tanpa proyeksi
    is_safe            : boolean;
    warning_level      : 'safe' | 'warning' | 'danger';
    recommendations    : string[];
}