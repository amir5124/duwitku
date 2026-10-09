// src/types/expo-router.d.ts
import 'expo-router';

declare module 'expo-router' {
  export function useRouter(): {
    push: (path: string) => void;
    replace: (path: string) => void;
    back: () => void;
    canGoBack: () => boolean;
    setParams?: (params: Record<string, any>) => void;
  };
  
  export function useSegments(): string[];
  export function usePathname(): string;
  export function useLocalSearchParams<T = Record<string, string>>(): T;
  export function useGlobalSearchParams<T = Record<string, string>>(): T;
}