// app/(auth)/register.tsx
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

type FieldName = 'name' | 'email' | 'password' | 'confirmPassword';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<FieldName | null>(null);

  // State untuk modal error
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showErrorModal = (title: string, message: string) => {
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const validateForm = () => {
    if (!name.trim()) {
      showErrorModal('Error', 'Nama lengkap tidak boleh kosong');
      return false;
    }
    if (!email.trim()) {
      showErrorModal('Error', 'Email tidak boleh kosong');
      return false;
    }
    if (!email.includes('@') || !email.includes('.')) {
      showErrorModal('Error', 'Email tidak valid');
      return false;
    }
    if (password.length < 6) {
      showErrorModal('Error', 'Password minimal 6 karakter');
      return false;
    }
    if (password !== confirmPassword) {
      showErrorModal('Error', 'Password dan konfirmasi password tidak cocok');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
        },
      });

      if (error) {
        if (error.message?.includes('rate limit')) {
          showErrorModal(
            'Terlalu Banyak Percobaan',
            'Anda terlalu sering mencoba mendaftar. Silakan tunggu beberapa menit sebelum mencoba lagi.'
          );
          setLoading(false);
          return;
        }
        throw error;
      }

      if (data.user) {
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password,
          });

          if (signInError) {
            router.replace('/(auth)/login');
          } else if (signInData?.session) {
            router.replace('/(tabs)');
          }
        } catch (loginError) {
          console.error('Auto-login error:', loginError);
          router.replace('/(auth)/login');
        }
      }
    } catch (error: any) {
      console.error('Register error:', error);

      let errorMessage = 'Gagal mendaftar. Silakan coba lagi.';

      if (error.message?.includes('already registered')) {
        errorMessage = 'Email sudah terdaftar. Silakan login.';
      } else if (error.message?.includes('password')) {
        errorMessage = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
      } else if (error.message?.includes('Database error')) {
        errorMessage = 'Terjadi kesalahan pada server. Silakan coba lagi.';
      }

      showErrorModal('Pendaftaran Gagal', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    router.back();
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
          source={require('../../assets/images/register.png')}
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
          {/* Header dengan back button */}
          <View style={[styles.header, { paddingTop: insets.top + 40 }]}>
            <TouchableOpacity
              onPress={goToLogin}
              style={styles.backButton}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.logoContainer} />
            <Text style={styles.appName} />
            <Text style={styles.tagline} />
          </View>

          {/* Card Register */}
          <View style={[styles.card, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.title}>Buat Akun</Text>
            <Text style={styles.subtitle}>Mulai kelola keuanganmu dengan lebih baik</Text>

            {/* Nama Lengkap */}
            <Text style={styles.label}>Nama Lengkap</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'name' && styles.inputWrapperFocused,
            ]}>
              <Ionicons
                name="person-outline"
                size={20}
                color={focusedField === 'name' ? '#3b6ef5' : '#9ca3af'}
              />
              <TextInput
                style={styles.input}
                placeholder="Masukkan nama lengkap"
                placeholderTextColor="#b0b8c4"
                value={name}
                onChangeText={setName}
                editable={!loading}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Email */}
            <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'email' && styles.inputWrapperFocused,
            ]}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={focusedField === 'email' ? '#3b6ef5' : '#9ca3af'}
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
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Password */}
            <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'password' && styles.inputWrapperFocused,
            ]}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={focusedField === 'password' ? '#3b6ef5' : '#9ca3af'}
              />
              <TextInput
                style={styles.input}
                placeholder="Minimal 6 karakter"
                placeholderTextColor="#b0b8c4"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
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
            <Text style={styles.passwordHint}>Gunakan minimal 6 karakter</Text>

            {/* Konfirmasi Password */}
            <Text style={[styles.label, { marginTop: 16 }]}>Konfirmasi Password</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'confirmPassword' && styles.inputWrapperFocused,
            ]}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={focusedField === 'confirmPassword' ? '#3b6ef5' : '#9ca3af'}
              />
              <TextInput
                style={styles.input}
                placeholder="Ulangi password Anda"
                placeholderTextColor="#b0b8c4"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={8}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>

            {/* Tombol Daftar - Tanpa loading indicator */}
            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.registerButtonText}>Daftar</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>atau</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Login Link */}
            <Text style={styles.haveAccountText}>Sudah punya akun?</Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={goToLogin}
            >
              <Text style={styles.loginButtonText}>Masuk</Text>
            </TouchableOpacity>

            {/* Info */}
            <View style={styles.infoWrapper}>
              <Text style={styles.infoText}>
                Dengan mendaftar, Anda menyetujui Syarat & Ketentuan dan Kebijakan Privasi kami
              </Text>
            </View>
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
    height: height * 0.8,
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
    height: height * 0.55,
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
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  logoContainer: {
    width: 80,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
    marginTop: -90,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
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
  passwordHint: {
    color: '#b0b8c4',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  registerButton: {
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
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
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
  haveAccountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  loginButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  loginButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  infoWrapper: {
    marginTop: 18,
    paddingBottom: 8,
  },
  infoText: {
    color: '#cbd5e1',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
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