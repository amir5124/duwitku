// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                header: () => null,
                contentStyle: { backgroundColor: 'white' },
            }}
        >
            <Stack.Screen
                name="login"
                options={{
                    headerShown: false,
                    title: '',
                }}
            />
            <Stack.Screen
                name="register"
                options={{
                    headerShown: false,
                    title: '',
                }}
            />
        </Stack>
    );
}