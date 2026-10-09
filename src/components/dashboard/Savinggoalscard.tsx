// src/components/dashboard/SavingGoalsCard.tsx
// Fitur saving goals — Pure view component (tanpa modal)

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../../services/supabase/client';
import { formatCurrency } from '../../utils/formatters';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SavingGoal {
    id: string;
    user_id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    target_date?: string;
    emoji: string;
    color: string;
    created_at: string;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function daysUntil(dateStr?: string): number | null {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
}

function formatTargetDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface SavingGoalsCardProps {
    onAddPress?: () => void;
    onTopUpPress?: (goal: SavingGoal) => void;
    onDeletePress?: (goal: SavingGoal) => void;
    refreshTrigger?: number;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SavingGoalsCard({
    onAddPress,
    onTopUpPress,
    onDeletePress,
    refreshTrigger = 0
}: SavingGoalsCardProps) {
    const [goals, setGoals] = useState<SavingGoal[]>([]);
    const [loading, setLoading] = useState(false);

    const loadGoals = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }
            const { data, error } = await supabase
                .from('saving_goals')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: true });
            if (!error && data) {
                setGoals(data as SavingGoal[]);
            }
        } catch (error) {
            console.error('Error loading goals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGoals();
    }, [refreshTrigger]);

    if (loading) {
        return (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#3b6ef5" />
                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Loading goals...</Text>
            </View>
        );
    }

    return (
        <View style={{ marginHorizontal: 0, marginBottom: 20 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>🎯 Tujuan Nabung</Text>
                    {goals.length > 0 && (
                        <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
                            {goals.length} goal aktif
                        </Text>
                    )}
                </View>
                <TouchableOpacity
                    onPress={onAddPress}
                    style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        backgroundColor: '#eef2ff', borderRadius: 20,
                        paddingHorizontal: 12, paddingVertical: 6,
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="add" size={15} color="#3b6ef5" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#3b6ef5' }}>Tambah</Text>
                </TouchableOpacity>
            </View>

            {/* Empty state */}
            {goals.length === 0 && !loading && (
                <TouchableOpacity
                    onPress={onAddPress}
                    style={{
                        backgroundColor: '#fff', borderRadius: 20, padding: 24,
                        alignItems: 'center', borderWidth: 2, borderColor: '#e0e7ff',
                        borderStyle: 'dashed',
                    }}
                    activeOpacity={0.7}
                >
                    <View style={{
                        width: 52, height: 52, borderRadius: 26,
                        backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 10,
                    }}>
                        <Ionicons name="trophy-outline" size={26} color="#6366f1" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#3b6ef5' }}>
                        Buat tujuan nabung pertama
                    </Text>
                    <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                        Liburan, gadget, atau apa saja.{'\n'}KalKu bantu pantau progressnya!
                    </Text>
                </TouchableOpacity>
            )}

            {/* Goals list */}
            {goals.length > 0 && (
                <View style={{
                    backgroundColor: '#fff', borderRadius: 20,
                    borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden',
                }}>
                    {goals.map((goal, idx) => {
                        const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                        const remaining = goal.target_amount - goal.current_amount;
                        const days = daysUntil(goal.target_date);
                        const isDone = pct >= 100;

                        return (
                            <View
                                key={goal.id}
                                style={{
                                    padding: 14,
                                    borderBottomWidth: idx < goals.length - 1 ? 0.5 : 0,
                                    borderBottomColor: '#f1f5f9',
                                    backgroundColor: isDone ? '#f0fdf4' : '#fff',
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                                    {/* Emoji avatar */}
                                    <View style={{
                                        width: 42, height: 42, borderRadius: 14,
                                        backgroundColor: goal.color + '18',
                                        alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Text style={{ fontSize: 20 }}>{goal.emoji}</Text>
                                    </View>

                                    {/* Content */}
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', flex: 1 }} numberOfLines={1}>
                                                {goal.name}
                                            </Text>
                                            {isDone && (
                                                <View style={{ backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803d' }}>TERCAPAI 🎉</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Target & current */}
                                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 7 }}>
                                            <Text style={{ fontWeight: '600', color: goal.color }}>{formatCurrency(goal.current_amount)}</Text>
                                            {' '}/ {formatCurrency(goal.target_amount)}
                                        </Text>

                                        {/* Progress bar */}
                                        <View style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                                            <View style={{
                                                height: '100%', borderRadius: 3,
                                                width: `${pct}%`,
                                                backgroundColor: isDone ? '#10b981' : goal.color,
                                            }} />
                                        </View>

                                        {/* Pct + deadline */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                                                {Math.round(pct)}% {!isDone && `· Sisa ${formatCurrency(remaining)}`}
                                            </Text>
                                            {days !== null && !isDone && (
                                                <Text style={{
                                                    fontSize: 11, fontWeight: '500',
                                                    color: days < 30 ? '#ef4444' : '#9ca3af',
                                                }}>
                                                    {days > 0 ? `${days} hari lagi` : 'Sudah lewat target'}
                                                </Text>
                                            )}
                                            {goal.target_date && isDone && (
                                                <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '500' }}>
                                                    Target: {formatTargetDate(goal.target_date)}
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    {/* Action buttons */}
                                    <View style={{ gap: 6, flexShrink: 0 }}>
                                        {!isDone && (
                                            <TouchableOpacity
                                                onPress={() => onTopUpPress?.(goal)}
                                                style={{
                                                    width: 32, height: 32, borderRadius: 10,
                                                    backgroundColor: goal.color + '15',
                                                    alignItems: 'center', justifyContent: 'center',
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="add" size={16} color={goal.color} />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={() => onDeletePress?.(goal)}
                                            style={{
                                                width: 32, height: 32, borderRadius: 10,
                                                backgroundColor: '#fff1f2',
                                                alignItems: 'center', justifyContent: 'center',
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}