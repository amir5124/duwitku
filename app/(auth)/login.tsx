// app/(auth)/login.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/services/supabase/client';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    // State untuk modal error
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const showErrorModal = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        setErrorModalVisible(true);
    };

    const handleLogin = async () => {
        if (!email.trim()) {
            showErrorModal('Error', 'Email tidak boleh kosong');
            return;
        }
        if (!password) {
            showErrorModal('Error', 'Password tidak boleh kosong');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) throw error;

            if (data.session) {
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            console.error('❌ [Login] Error:', error);
            let errorMessage = 'Gagal login. Silakan coba lagi.';
            if (error.message === 'Invalid login credentials') {
                errorMessage = 'Email atau password salah.';
            } else if (error.message?.includes('Email not confirmed')) {
                errorMessage = 'Email belum dikonfirmasi. Cek inbox kamu.';
            }
            showErrorModal('Login Gagal', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar
                translucent
                backgroundColor="transparent"
                barStyle="light-content"
            />

            {/* Background */}
            <View style={StyleSheet.absoluteFillObject}>
                <ImageBackground
                    source={require('../../assets/images/login.png')}
                    style={styles.backgroundImage}
                    resizeMode="cover"
                >
                    <View style={styles.overlay} />
                </ImageBackground>

                <View style={styles.bottomSheet} />
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={[styles.header, { paddingTop: insets.top + 40 }]}>
                        <View style={styles.logoContainer} />
                        <Text style={styles.appName} />
                        <Text style={styles.tagline} />
                    </View>

                    {/* Card Login */}
                    <View style={[styles.card, { paddingBottom: insets.bottom + 20 }]}>
                        <Text style={styles.title}>Login ke akunmu</Text>

                        {/* Email */}
                        <Text style={styles.label}>Email</Text>
                        <View style={[
                            styles.inputWrapper,
                            emailFocused && styles.inputWrapperFocused,
                        ]}>
                            <Ionicons
                                name="mail-outline"
                                size={20}
                                color={emailFocused ? '#3b6ef5' : '#9ca3af'}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="nama@email.com"
                                placeholderTextColor="#b0b8c4"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                editable={!loading}
                                onFocus={() => setEmailFocused(true)}
                                onBlur={() => setEmailFocused(false)}
                            />
                        </View>

                        {/* Password */}
                        <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
                        <View style={[
                            styles.inputWrapper,
                            passwordFocused && styles.inputWrapperFocused,
                        ]}>
                            <Ionicons
                                name="lock-closed-outline"
                                size={20}
                                color={passwordFocused ? '#3b6ef5' : '#9ca3af'}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="xxxxxxxxxxxx"
                                placeholderTextColor="#b0b8c4"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                editable={!loading}
                                onFocus={() => setPasswordFocused(true)}
                                onBlur={() => setPasswordFocused(false)}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                hitSlop={8}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color="#9ca3af"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Lupa Password */}
                        <TouchableOpacity
                            style={styles.forgotWrapper}
                            onPress={() => router.push('/(auth)/forgot-password')}
                            hitSlop={8}
                        >
                            <Text style={styles.forgotText}>Lupa password</Text>
                        </TouchableOpacity>

                        {/* Tombol Login - Tanpa loading indicator */}
                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.loginButtonText}>Login</Text>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>atau</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Register */}
                        <Text style={styles.newHereText}>Baru di Duwitku?</Text>
                        <TouchableOpacity
                            style={styles.registerButton}
                            onPress={() => router.push('/(auth)/register')}
                        >
                            <Text style={styles.registerButtonText}>Buat Akun</Text>
                        </TouchableOpacity>

                        {/* Help */}
                        <TouchableOpacity
                            style={styles.helpWrapper}
                            onPress={() => router.push('/(auth)/help')}
                        >
                            <Text style={styles.helpText}>Pusat Bantuan</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── MODAL LOADING ── */}
            <Modal
                animationType="fade"
                transparent
                visible={loading}
                onRequestClose={() => { }}
            >
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#3b6ef5" />
                    </View>
                </View>
            </Modal>

            {/* ── MODAL ERROR ── */}
            <Modal
                animationType="fade"
                transparent
                visible={errorModalVisible}
                onRequestClose={() => setErrorModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setErrorModalVisible(false)}>
                    <View style={styles.errorOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.errorContainer}>
                                {/* Icon Error */}
                                <View style={styles.errorIconContainer}>
                                    <View style={styles.errorIconCircle}>
                                        <Ionicons name="alert-circle" size={40} color="#ef4444" />
                                    </View>
                                </View>

                                {/* Title */}
                                <Text style={styles.errorTitle}>{errorTitle}</Text>

                                {/* Message */}
                                <Text style={styles.errorMessage}>{errorMessage}</Text>

                                {/* Tombol OK */}
                                <TouchableOpacity
                                    style={styles.errorButton}
                                    onPress={() => setErrorModalVisible(false)}
                                >
                                    <Text style={styles.errorButtonText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    backgroundImage: {
        width: '100%',
        height: height * 1.0,
        top: 0,
        left: 0,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height * 0.5,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    header: {
        alignItems: 'center',
        paddingBottom: 30,
        paddingHorizontal: 20,
    },
    logoContainer: {
        width: 80,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logo: {
        width: 50,
        height: 50,
        borderRadius: 12,
    },
    appName: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 4,
    },
    tagline: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 28,
        marginTop: -70,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 52,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
    },
    inputWrapperFocused: {
        borderColor: '#3b6ef5',
    },
    input: {
        flex: 1,
        marginLeft: 10,
        color: '#111827',
        fontSize: 15,
    },
    forgotWrapper: {
        alignItems: 'flex-end',
        marginTop: 10,
    },
    forgotText: {
        color: '#3b6ef5',
        fontSize: 13,
        fontWeight: '500',
    },
    loginButton: {
        backgroundColor: '#3b6ef5',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#3b6ef5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#f1f5f9',
    },
    dividerText: {
        color: '#9ca3af',
        fontSize: 12,
        marginHorizontal: 12,
    },
    newHereText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    registerButton: {
        backgroundColor: '#f3f4f6',
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    registerButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    helpWrapper: {
        alignItems: 'center',
        marginTop: 18,
        paddingBottom: 8,
    },
    helpText: {
        fontSize: 13,
        color: '#9ca3af',
    },

    // ── Style Loading Modal ──
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    // ── Style Error Modal ──
    errorOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    errorContainer: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    errorIconContainer: {
        marginBottom: 16,
    },
    errorIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#fee2e2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    errorButton: {
        backgroundColor: '#3b6ef5',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 40,
        minWidth: 120,
        alignItems: 'center',
    },
    errorButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});