// src/components/voice/VoiceAssistantButton.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View } from 'react-native';
import { onVoiceStateChange } from '../../services/voiceAssistant';

interface VoiceAssistantButtonProps {
    size?: number;
    onPress?: () => void;
    isActive?: boolean;
}

export const VoiceAssistantButton: React.FC<VoiceAssistantButtonProps> = ({
    size = 56,
    onPress,
    isActive = false,
}) => {
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Animasi untuk pulse (membesar mengecil)
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Animasi untuk gelombang 1, 2, 3
    const wave1Anim = useRef(new Animated.Value(0)).current;
    const wave2Anim = useRef(new Animated.Value(0)).current;
    const wave3Anim = useRef(new Animated.Value(0)).current;

    // Animasi rotasi untuk icon mic
    const rotateAnim = useRef(new Animated.Value(0)).current;

    // Listen untuk status speaking dari voiceAssistant
    useEffect(() => {
        const unsubscribe = onVoiceStateChange((speaking) => {
            setIsSpeaking(speaking);
        });

        return () => unsubscribe();
    }, []);

    // Efek saat speaking berubah
    useEffect(() => {
        if (isSpeaking) {
            startSpeakingAnimations();
        } else {
            stopSpeakingAnimations();
        }
    }, [isSpeaking]);

    const startSpeakingAnimations = () => {
        // Animasi pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Animasi gelombang 1
        Animated.loop(
            Animated.sequence([
                Animated.timing(wave1Anim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(wave1Anim, {
                    toValue: 0,
                    duration: 800,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Animasi gelombang 2 (delay)
        setTimeout(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(wave2Anim, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(wave2Anim, {
                        toValue: 0,
                        duration: 800,
                        easing: Easing.in(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }, 200);

        // Animasi gelombang 3 (delay lebih)
        setTimeout(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(wave3Anim, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(wave3Anim, {
                        toValue: 0,
                        duration: 800,
                        easing: Easing.in(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }, 400);

        // Animasi rotasi icon mic
        Animated.loop(
            Animated.sequence([
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                    toValue: -1,
                    duration: 200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                    toValue: 0,
                    duration: 200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const stopSpeakingAnimations = () => {
        pulseAnim.stopAnimation();
        wave1Anim.stopAnimation();
        wave2Anim.stopAnimation();
        wave3Anim.stopAnimation();
        rotateAnim.stopAnimation();

        // Reset nilai
        pulseAnim.setValue(1);
        wave1Anim.setValue(0);
        wave2Anim.setValue(0);
        wave3Anim.setValue(0);
        rotateAnim.setValue(0);
    };

    const handlePress = async () => {
        if (onPress) {
            onPress();
        }
    };

    // Interpolasi untuk gelombang (scale dan opacity)
    const wave1Scale = wave1Anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.8],
    });

    const wave1Opacity = wave1Anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.6, 0.3, 0],
    });

    const wave2Scale = wave2Anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2.2],
    });

    const wave2Opacity = wave2Anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.5, 0.2, 0],
    });

    const wave3Scale = wave3Anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2.6],
    });

    const wave3Opacity = wave3Anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.4, 0.15, 0],
    });

    // Interpolasi rotasi
    const rotate = rotateAnim.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-8deg', '0deg', '8deg'],
    });

    return (
        <View style={styles.container}>
            {/* Gelombang 3 (paling luar) */}
            <Animated.View
                style={[
                    styles.wave,
                    {
                        width: size + 24,
                        height: size + 24,
                        borderRadius: (size + 24) / 2,
                        transform: [{ scale: wave3Scale }],
                        opacity: wave3Opacity,
                        borderWidth: 2,
                        borderColor: '#a5b4fc',
                    },
                ]}
            />

            {/* Gelombang 2 */}
            <Animated.View
                style={[
                    styles.wave,
                    {
                        width: size + 12,
                        height: size + 12,
                        borderRadius: (size + 12) / 2,
                        transform: [{ scale: wave2Scale }],
                        opacity: wave2Opacity,
                        borderWidth: 2,
                        borderColor: '#c7d2fe',
                    },
                ]}
            />

            {/* Gelombang 1 (paling dalam) */}
            <Animated.View
                style={[
                    styles.wave,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        transform: [{ scale: wave1Scale }],
                        opacity: wave1Opacity,
                        borderWidth: 2.5,
                        borderColor: '#e0e7ff',
                    },
                ]}
            />

            {/* Tombol Utama */}
            <Animated.View
                style={{
                    transform: [
                        { scale: pulseAnim },
                        { rotate: rotate },
                    ],
                }}
            >
                <TouchableOpacity
                    onPress={handlePress}
                    activeOpacity={0.8}
                    style={[
                        styles.button,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            backgroundColor: isSpeaking ? '#3b6ef5' : '#6366F1',
                        },
                    ]}
                >
                    <Ionicons
                        name={isSpeaking ? "mic" : "mic-outline"}
                        size={size * 0.5}
                        color="white"
                    />

                    {/* Indikator speaking dot */}
                    {isSpeaking && (
                        <View style={styles.speakingDot}>
                            <Animated.View
                                style={[
                                    styles.speakingDotInner,
                                    {
                                        opacity: pulseAnim.interpolate({
                                            inputRange: [1, 1.15],
                                            outputRange: [1, 0.5],
                                        }),
                                    },
                                ]}
                            />
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    wave: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3b6ef5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    speakingDot: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    speakingDotInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ffffff',
    },
});