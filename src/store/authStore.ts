// src/store/authStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { supabase } from '../services/supabase/client';

interface User {
    id: string;
    email: string;
    name: string;
    monthlyIncome: number;
}

interface AuthState {
    user: User | null;
    session: any | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signOut: () => Promise<void>;
    updateUser: (data: Partial<User>) => Promise<void>;
    reset: () => void; // Tambahkan method reset
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            session: null,
            isLoading: false,

            signIn: async (email, password) => {
                set({ isLoading: true });
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });
                    if (error) throw error;

                    set({
                        user: data.user as any,
                        session: data.session,
                        isLoading: false,
                    });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            signUp: async (email, password, name) => {
                set({ isLoading: true });
                try {
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: { name },
                        },
                    });
                    if (error) throw error;

                    set({
                        user: data.user as any,
                        session: data.session,
                        isLoading: false,
                    });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            signOut: async () => {
                set({ isLoading: true });
                try {
                    await supabase.auth.signOut();
                    set({ user: null, session: null, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            updateUser: async (data) => {
                set((state) => ({
                    user: state.user ? { ...state.user, ...data } : null,
                }));
            },

            // Tambahkan method reset untuk clear state
            reset: () => {
                set({ user: null, session: null, isLoading: false });
            },
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);