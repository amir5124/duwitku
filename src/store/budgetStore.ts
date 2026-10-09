// src/store/budgetStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';


interface Budget {
    category: string;
    limit: number;
    spent: number;
    percentage: number;
}

interface BudgetState {
    budgets: Budget[];
    isLoading: boolean;
    setBudget: (category: string, limit: number) => Promise<void>;
    updateSpending: (category: string, amount: number) => Promise<void>;
    fetchBudgets: () => Promise<void>;
}

export const useBudgetStore = create<BudgetState>()(
    persist(
        (set, get) => ({
            budgets: [],
            isLoading: false,

            setBudget: async (category, limit) => {
                const { budgets } = get();
                const existing = budgets.find(b => b.category === category);

                let newBudgets;
                if (existing) {
                    newBudgets = budgets.map(b =>
                        b.category === category ? { ...b, limit, percentage: (b.spent / limit) * 100 } : b
                    );
                } else {
                    newBudgets = [...budgets, { category, limit, spent: 0, percentage: 0 }];
                }

                set({ budgets: newBudgets });
            },

            updateSpending: async (category, amount) => {
                const { budgets } = get();
                const budget = budgets.find(b => b.category === category);

                if (budget) {
                    const newSpent = budget.spent + amount;
                    const newPercentage = (newSpent / budget.limit) * 100;

                    const newBudgets = budgets.map(b =>
                        b.category === category
                            ? { ...b, spent: newSpent, percentage: newPercentage }
                            : b
                    );

                    set({ budgets: newBudgets });

                    // Kirim notifikasi jika melebihi batas
                    if (newSpent > budget.limit) {
                        const overspent = newSpent - budget.limit;

                    } else if (newPercentage > 80) {
                        const remaining = budget.limit - newSpent;

                    }
                }
            },

            fetchBudgets: async () => {
                // Load from AsyncStorage or API
                set({ isLoading: false });
            },
        }),
        {
            name: 'budget-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);