// src/store/usageStore.ts
import { create } from 'zustand';
import { checkAndUseFeature, FeatureKey, UsageResult } from '../services/featureLimits';

interface UsageState {
    isPro: boolean;
    lastResult: Record<FeatureKey, UsageResult | null>;
    checking: boolean;
    consume: (feature: FeatureKey) => Promise<UsageResult>;
}

export const useUsageStore = create<UsageState>((set, get) => ({
    isPro: false,
    lastResult: { scan: null, voice: null, kalku: null },
    checking: false,

    consume: async (feature: FeatureKey) => {
        set({ checking: true });
        const result = await checkAndUseFeature(feature);
        set((state) => ({
            isPro: result.is_pro,
            lastResult: { ...state.lastResult, [feature]: result },
            checking: false,
        }));
        return result;
    },
}));