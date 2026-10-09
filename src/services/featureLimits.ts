// src/services/featureLimits.ts
import { supabase } from './supabase/client';

export const FREE_LIMITS = {
    scan: 3,
    voice: 5,
    kalku: 3,
} as const;

export const FEATURE_LABELS: Record<FeatureKey, string> = {
    scan: 'Scan Struk',
    voice: 'Catat dengan Suara',
    kalku: 'Kalku AI',
};

export type FeatureKey = keyof typeof FREE_LIMITS;

export interface UsageResult {
    allowed: boolean;
    is_pro: boolean;
    remaining: number | null;
    feature?: string;
}

export interface PaymentResponse {
    success: boolean;
    order_id?: string;
    plan?: string;
    amount?: number;
    payment_method?: string;
    va_number?: string;
    qris_url?: string;
    expired_at?: string;
    instructions?: string;
    error?: string;
}

export interface PaymentStatusResponse {
    order_id: string;
    payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
    is_pro: boolean;
    pro_expires_at: string | null;
    plan: string;
    amount: number;
    va_number?: string;
    qris_url?: string;
    expired_at?: string;
}

// ─── CHECK & USE FEATURE ──────────────────────────────────────────────────────
export const checkAndUseFeature = async (feature: FeatureKey): Promise<UsageResult> => {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            console.error('❌ [Usage] User not authenticated:', userError);
            return { 
                allowed: false, 
                is_pro: false, 
                remaining: 0 
            };
        }

        const { data, error } = await supabase.rpc('check_and_use_feature', {
            p_user_id: user.id,
            p_feature: feature,
            p_free_limit: FREE_LIMITS[feature],
        });

        if (error) {
            console.error('❌ [Usage] RPC error:', error);
            return { allowed: true, is_pro: false, remaining: null };
        }

        return data as UsageResult;
    } catch (error) {
        console.error('❌ [Usage] Unexpected error:', error);
        return { allowed: true, is_pro: false, remaining: null };
    }
};

// ─── GET USAGE REMAINING ──────────────────────────────────────────────────────
export const getUsageRemaining = async (feature: FeatureKey): Promise<{ is_pro: boolean; used: number; remaining: number | null }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { is_pro: false, used: 0, remaining: FREE_LIMITS[feature] };
        }

        const { data, error } = await supabase.rpc('get_usage_remaining', {
            p_user_id: user.id,
        });

        if (error) {
            console.error('❌ [Usage] RPC error:', error);
            return { is_pro: false, used: 0, remaining: FREE_LIMITS[feature] };
        }

        const result = data as any;
        if (result.is_pro) {
            return { is_pro: true, used: 0, remaining: null };
        }

        const featureData = result[feature];
        return {
            is_pro: false,
            used: featureData?.used || 0,
            remaining: featureData?.remaining || 0,
        };
    } catch (error) {
        console.error('❌ [Usage] Unexpected error:', error);
        return { is_pro: false, used: 0, remaining: FREE_LIMITS[feature] };
    }
};

// ─── CHECK PRO STATUS ─────────────────────────────────────────────────────────
export const checkProStatus = async (): Promise<{
    is_pro: boolean;
    pro_expires_at: string | null;
    days_remaining: number | null;
    is_expired: boolean;
}> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            return { is_pro: false, pro_expires_at: null, days_remaining: null, is_expired: false };
        }

        const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-pro-status`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Check pro status error:', error);
        return { is_pro: false, pro_expires_at: null, days_remaining: null, is_expired: false };
    }
};

// ─── CREATE PAYMENT ORDER ────────────────────────────────────────────────────
export const createPaymentOrder = async (
    plan: 'monthly' | 'yearly',
    paymentMethod: 'VA' | 'QRIS' = 'VA',
    bankCode: string = '014'
): Promise<PaymentResponse> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            return { success: false, error: 'User not logged in' };
        }

        const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    plan,
                    paymentMethod,
                    bankCode,
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Payment creation failed' };
        }

        return data;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

// ─── CHECK PAYMENT STATUS ────────────────────────────────────────────────────
export const checkPaymentStatus = async (orderId: string): Promise<PaymentStatusResponse> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error('User not logged in');
        }

        const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-payment-status`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ order_id: orderId }),
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        throw new Error(error.message);
    }
};

// ─── RESET FEATURE USAGE ─────────────────────────────────────────────────────
export const resetFeatureUsage = async (userId: string, feature: FeatureKey): Promise<boolean> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase
            .from('feature_usage')
            .delete()
            .eq('user_id', userId)
            .eq('feature', feature)
            .eq('usage_date', today);

        if (error) {
            console.error('❌ [Usage] Error resetting:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('❌ [Usage] Unexpected error:', error);
        return false;
    }
};