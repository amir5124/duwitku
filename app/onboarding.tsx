import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from '../src/contexts/OnboardingContext';

const { width } = Dimensions.get('window');
const { height } = Dimensions.get('screen'); // ← screen untuk tinggi penuh
const ONBOARDING_KEY = 'hasSeenOnboarding';

const slides = [
    {
        id: '1',
        image: require('../assets/images/onboarding-1.png'),
        title: 'Uangku habis kemana?',
        subtitle: 'Tanpa catatan, keuanganmu sulit terkontrol. Yuk mulai pantau dari sekarang!',
    },
    {
        id: '2',
        image: require('../assets/images/onboarding-2.png'),
        title: 'Catat & Pantau Keuangan',
        subtitle: 'Catat pemasukan dan pengeluaran dengan mudah. Lihat kemana uangmu pergi.',
    },
    {
        id: '3',
        image: require('../assets/images/onboarding-3.png'),

        subtitle: 'Bersama KalKu, asisten AI-mu, kelola keuangan jadi lebih cerdas dan terarah.',
    },
];

export default function OnboardingScreen() {
    const { setShowOnboarding } = useOnboarding();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isNavigating, setIsNavigating] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    const finishOnboarding = async () => {
        if (isNavigating) return;
        setIsNavigating(true);
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            setShowOnboarding(false);
            router.replace('/(auth)/login');
        } catch (e) {
            setShowOnboarding(false);
            router.replace('/(auth)/login');
        }
    };

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
            setCurrentIndex(currentIndex + 1);
        } else {
            finishOnboarding();
        }
    };

    const isLastSlide = currentIndex === slides.length - 1;

    const renderItem = ({ item }: { item: typeof slides[0] }) => (
        <View style={{ width, height }}>
            <Image
                source={item.image}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width,
                    height,
                    resizeMode: 'cover',
                }}
            />
        </View>
    );

    // Hitung bottom overlay agar pas di area bottom sheet gambar
    // Sesuaikan BOTTOM_SHEET_HEIGHT dengan tinggi area kosong di gambarmu
    const BOTTOM_SHEET_HEIGHT = height * 0.35; // 35% tinggi layar

    return (
        <>
            <StatusBar
                translucent
                backgroundColor="transparent"
                barStyle="light-content"
            />
            <View style={{ flex: 1, backgroundColor: '#3b6ef5' }}>
                <FlatList
                    ref={flatListRef}
                    data={slides}
                    renderItem={renderItem}
                    horizontal
                    pagingEnabled
                    scrollEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    onMomentumScrollEnd={(event) => {
                        const index = Math.round(
                            event.nativeEvent.contentOffset.x / width
                        );
                        setCurrentIndex(index);
                    }}
                />

                {/* Overlay — tingginya mengikuti area bottom sheet gambar */}
                <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: BOTTOM_SHEET_HEIGHT,
                    paddingHorizontal: 28,
                    paddingBottom: insets.bottom + 20,
                    justifyContent: 'flex-end', // konten di bawah dalam area bottom sheet
                }}>
                    {/* Judul */}
                    <Text style={{
                        fontSize: 24,
                        fontWeight: '800',
                        color: '#ffffff',
                        textAlign: 'center',
                        marginBottom: 5,
                        letterSpacing: 0.2,
                    }}>
                        {slides[currentIndex].title}
                    </Text>

                    {/* Subtitle */}
                    <Text style={{
                        fontSize: 14,
                        fontWeight: '800',
                        color: '#ffffff',
                        textAlign: 'center',
                        lineHeight: 22,
                        marginBottom: 13,
                    }}>
                        {slides[currentIndex].subtitle}
                    </Text>

                    {/* Dot indicator */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        marginBottom: 20,
                    }}>
                        {slides.map((_, i) => (
                            <View
                                key={i}
                                style={{
                                    width: i === currentIndex ? 28 : 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: i === currentIndex
                                        ? '#ffffff'
                                        : 'rgba(255,255,255,0.35)',
                                    marginHorizontal: 4,
                                }}
                            />
                        ))}
                    </View>

                    {/* Tombol */}
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleNext}
                        disabled={isNavigating}
                        style={{
                            backgroundColor: '#ffffff',
                            paddingVertical: 16,
                            borderRadius: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 8,
                            elevation: 6,
                        }}
                    >
                        <Text style={{
                            color: '#3b6ef5',
                            fontSize: 16,
                            fontWeight: '700',
                            letterSpacing: 0.5,
                        }}>
                            {isLastSlide ? 'Mulai pakai Duwitku 🚀' : 'Lanjut'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </>
    );
}