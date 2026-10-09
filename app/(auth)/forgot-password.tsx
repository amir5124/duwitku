// app/(auth)/forgot-password.tsx
import { router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const isFormValid = email.trim().length > 0;

    const handleSendReset = async () => {
        if (!isFormValid) return;
        setIsLoading(true);
        try {
            // TODO: ganti dengan logic reset password Supabase, contoh:
            // const { error } = await supabase.auth.resetPasswordForEmail(email);
            // if (error) throw error;
            setIsSent(true);
        } catch (err) {
            console.error('❌ [ForgotPassword] Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>{'‹'} Kembali</Text>
                </TouchableOpacity>

                <View style={styles.content}>
                    <Text style={styles.title}>Lupa Password</Text>
                    <Text style={styles.subtitle}>
                        Masukkan email akunmu, kami akan kirim tautan untuk reset password.
                    </Text>

                    {isSent ? (
                        <View style={styles.successBox}>
                            <Text style={styles.successText}>
                                Tautan reset password sudah dikirim ke {email}. Cek inbox atau folder spam kamu.
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Cth: nama@email.com"
                                placeholderTextColor="#9ca3af"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />

                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    !isFormValid && styles.buttonDisabled,
                                ]}
                                onPress={handleSendReset}
                                disabled={!isFormValid || isLoading}
                            >
                                <Text style={styles.buttonText}>
                                    {isLoading ? 'Mengirim...' : 'Kirim Tautan Reset'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    <TouchableOpacity
                        style={styles.backToLoginWrapper}
                        onPress={() => router.replace('/(auth)/login')}
                    >
                        <Text style={styles.backToLoginText}>Kembali ke Login</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    flex: {
        flex: 1,
    },
    backButton: {
        paddingHorizontal: 24,
        paddingTop: 12,
    },
    backButtonText: {
        fontSize: 16,
        color: '#5b8def',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 32,
        lineHeight: 20,
    },
    label: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f3f4f6',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#111827',
    },
    button: {
        backgroundColor: '#5b8def',
        borderRadius: 10,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 28,
    },
    buttonDisabled: {
        backgroundColor: '#a9c5f5',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    successBox: {
        backgroundColor: '#ecfdf5',
        borderRadius: 10,
        padding: 16,
        marginBottom: 8,
    },
    successText: {
        fontSize: 14,
        color: '#065f46',
        lineHeight: 20,
    },
    backToLoginWrapper: {
        alignItems: 'center',
        marginTop: 24,
    },
    backToLoginText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#5b8def',
        textDecorationLine: 'underline',
    },
});