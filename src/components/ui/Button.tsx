// src/components/ui/Button.tsx
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    className?: string;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    className = '',
}) => {
    const variantStyles = {
        primary: 'bg-indigo-600 active:bg-indigo-700',
        secondary: 'bg-gray-500 active:bg-gray-600',
        danger: 'bg-red-500 active:bg-red-600',
        outline: 'bg-transparent border border-indigo-600 active:bg-indigo-50',
    };

    const sizeStyles = {
        sm: 'px-3 py-2',
        md: 'px-4 py-3',
        lg: 'px-6 py-4',
    };

    const textStyles = {
        primary: 'text-white',
        secondary: 'text-white',
        danger: 'text-white',
        outline: 'text-indigo-600',
    };

    const textSizeStyles = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            className={`rounded-xl ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? 'opacity-50' : ''} ${className}`}
            activeOpacity={0.8}
        >
            <View className="flex-row items-center justify-center">
                {loading && <ActivityIndicator color="white" size="small" className="mr-2" />}
                {icon && !loading && <View className="mr-2">{icon}</View>}
                <Text className={`font-semibold ${textStyles[variant]} ${textSizeStyles[size]}`}>
                    {title}
                </Text>
            </View>
        </TouchableOpacity>
    );
};