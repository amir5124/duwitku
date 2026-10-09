// src/hooks/useLocation.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

const LOCATION_TASK_NAME = 'spending-detection';

export const useLocation = () => {
    const [isTracking, setIsTracking] = useState(false);
    const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
    const { user } = useAuthStore();

    const requestPermissions = async () => {
        const { status: foreground } = await Location.requestForegroundPermissionsAsync();
        if (foreground !== 'granted') return false;

        const { status: background } = await Location.requestBackgroundPermissionsAsync();
        setPermission(background);

        return background === 'granted';
    };

    const startTracking = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.High,
            timeInterval: 30000, // 30 seconds
            distanceInterval: 50, // 50 meters
            showsBackgroundLocationIndicator: true,
            foregroundService: {
                notificationTitle: 'Deteksi Belanja Aktif',
                notificationBody: 'Aplikasi mendeteksi lokasi untuk mencatat pengeluaran',
                notificationColor: '#3b6ef5',
            },
        });

        setIsTracking(true);
    };

    const stopTracking = async () => {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        setIsTracking(false);
    };

    // Register background task
    useEffect(() => {
        TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
            if (error) return;

            const { locations } = data as { locations: Location.LocationObject[] };
            const lastLocation = locations[locations.length - 1];

            // Send to backend for geofence detection
            if (user) {
                // await sendLocationToBackend(user.id, lastLocation);
            }
        });
    }, [user]);

    return {
        isTracking,
        permission,
        requestPermissions,
        startTracking,
        stopTracking,
    };
};