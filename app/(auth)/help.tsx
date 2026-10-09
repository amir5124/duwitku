// app/(auth)/help.tsx
import { router } from 'expo-router';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const faqs = [
    {
        question: 'Bagaimana cara membuat akun Finku?',
        answer: 'Tekan tombol "Buat Akun" di halaman login, lalu ikuti langkah-langkah pendaftaran.',
    },
    {
        question: 'Saya lupa password, apa yang harus saya lakukan?',
        answer: 'Tekan "Lupa password" di halaman login, masukkan email kamu, lalu ikuti tautan yang dikirim ke email.',
    },
    {
        question: 'Apakah data keuangan saya aman?',
        answer: 'Ya, data kamu dienkripsi dan hanya dapat diakses oleh akun kamu sendiri.',
    },
    {
        question: 'Bagaimana cara menghubungi tim support?',
        answer: 'Kamu bisa email kami di support@finku.app, tim kami akan merespons dalam 1x24 jam.',
    },
];

export default function HelpScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>{'‹'} Kembali</Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Pusat Bantuan</Text>
                <Text style={styles.subtitle}>
                    Pertanyaan yang sering diajukan seputar penggunaan Finku.
                </Text>

                {faqs.map((faq, index) => (
                    <View key={index} style={styles.faqItem}>
                        <Text style={styles.question}>{faq.question}</Text>
                        <Text style={styles.answer}>{faq.answer}</Text>
                    </View>
                ))}

                <View style={styles.contactBox}>
                    <Text style={styles.contactTitle}>Masih butuh bantuan?</Text>
                    <Text style={styles.contactText}>
                        Hubungi kami melalui email support@finku.app
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 28,
        lineHeight: 20,
    },
    faqItem: {
        marginBottom: 24,
    },
    question: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
    },
    answer: {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
    },
    contactBox: {
        backgroundColor: '#eff4ff',
        borderRadius: 12,
        padding: 18,
        marginTop: 12,
    },
    contactTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    contactText: {
        fontSize: 14,
        color: '#374151',
    },
});