// app/context/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type ThemeContextType = {
    isDark: boolean;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [isDark, setIsDark] = useState(false);

    // Load theme dari AsyncStorage saat mount
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const stored = await AsyncStorage.getItem('duwitku_theme');
                if (stored !== null) {
                    setIsDark(stored === 'dark');
                }
            } catch (error) {
                console.warn('Gagal load theme:', error);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        const newValue = !isDark;
        setIsDark(newValue);
        try {
            await AsyncStorage.setItem('duwitku_theme', newValue ? 'dark' : 'light');
        } catch (error) {
            console.warn('Gagal simpan theme:', error);
        }
    };

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeProvider;