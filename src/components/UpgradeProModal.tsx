// src/components/UpgradeProModal.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { FEATURE_LABELS, FeatureKey } from '../services/featureLimits';

const LIGHT = {
    overlay: 'rgba(0,0,0,0.55)',
    sheet: '#ffffff',
    text: '#111827',
    textSub: '#6b7280',
    border: '#f1f5f9',
    chipBg: '#f8fafc',
    accent: '#3b6ef5',
};
const DARK = {
    overlay: 'rgba(0,0,0,0.75)',
    sheet: '#0f1a3d',
    text: '#f0f4ff',
    textSub: '#8899bb',
    border: '#1a2a55',
    chipBg: '#0a1530',
    accent: '#818cf8',
};

const PRO_BENEFITS = [
    { icon: 'infinite-outline', text: 'Scan struk tanpa batas' },
    { icon: 'mic-outline', text: 'Catat dengan suara tanpa batas' },
    { icon: 'sparkles-outline', text: 'Kalku AI tanpa batas' },
    { icon: 'bar-chart-outline', text: 'Analitik & proyeksi keuangan lanjutan' },
    { icon: 'cloud-upload-outline', text: 'Backup otomatis & export data' },

];

interface Props {
    visible: boolean;
    feature: FeatureKey | null | string;  // ← Ubah tipe
    onClose: () => void;
    onUpgrade: () => void;
}

// ─── Helper: get feature label ──────────────────────────────────────────────
function getFeatureLabel(feature: FeatureKey | null | string): string {
    if (!feature) return '';
    // Jika feature adalah string dan ada di FEATURE_LABELS, gunakan label
    if (typeof feature === 'string' && feature in FEATURE_LABELS) {
        return FEATURE_LABELS[feature as FeatureKey];
    }
    // Fallback: tampilkan feature name yang dikirim
    return typeof feature === 'string' ? feature : '';
}

export default function UpgradeProModal({ visible, feature, onClose, onUpgrade }: Props) {
    const { isDark } = useTheme();
    const T = isDark ? DARK : LIGHT;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: T.overlay, justifyContent: 'center', padding: 24 }}>
                <View style={{ backgroundColor: T.sheet, borderRadius: 24, padding: 24 }}>
                    {/* Close button */}
                    <TouchableOpacity
                        onPress={onClose}
                        style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
                        hitSlop={8}
                    >
                        <Ionicons name="close" size={22} color={T.textSub} />
                    </TouchableOpacity>

                    {/* Icon badge */}
                    <View style={{
                        width: 64, height: 64, borderRadius: 32, backgroundColor: T.accent,
                        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                    }}>
                        <Ionicons name="diamond" size={30} color="#ffffff" />
                    </View>

                    <Text style={{ fontSize: 20, fontWeight: '700', color: T.text, marginBottom: 6 }}>
                        Kuota harian habis
                    </Text>
                    <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
                        {feature
                            ? `Kamu sudah memakai kuota gratis ${getFeatureLabel(feature)} hari ini. Upgrade ke Pro untuk akses tanpa batas.`
                            : 'Upgrade ke Pro untuk akses tanpa batas ke semua fitur AI.'}
                    </Text>

                    {/* Benefit list */}
                    <View style={{ backgroundColor: T.chipBg, borderRadius: 16, padding: 16, marginBottom: 20, gap: 12 }}>
                        {PRO_BENEFITS.map((b, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Ionicons name={b.icon as any} size={18} color={T.accent} />
                                <Text style={{ color: T.text, fontSize: 13, flex: 1 }}>{b.text}</Text>
                            </View>
                        ))}
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                        onPress={onUpgrade}
                        style={{
                            backgroundColor: T.accent, borderRadius: 14, paddingVertical: 15,
                            alignItems: 'center', marginBottom: 10,
                        }}
                        activeOpacity={0.85}
                    >
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                            Upgrade ke Pro
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: 6 }}>
                        <Text style={{ color: T.textSub, fontSize: 13 }}>Nanti saja</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}