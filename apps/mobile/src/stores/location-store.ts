import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Coordinates = { latitude: number; longitude: number };
type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';
export type LocationSource = 'device' | 'manual';

type LocationState = {
  coordinates: Coordinates | null;
  source: LocationSource | null;
  areaLabel: string | null;
  status: LocationStatus;
  error: string | null;
  locate: () => Promise<void>;
  chooseArea: (coordinates: Coordinates, label: string) => void;
  clearArea: () => void;
};

export const useLocationStore = create<LocationState>()(persist((set) => ({
  coordinates: null,
  source: null,
  areaLabel: null,
  status: 'idle',
  error: null,
  locate: async () => {
    set({ status: 'loading', error: null });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        set({ status: 'denied', error: 'Location access is off. Enable it to discover plans nearby.' });
        return;
      }

      const cached = await Location.getLastKnownPositionAsync({ maxAge: 300_000, requiredAccuracy: 1_000 });
      const result = cached ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      set({
        coordinates: { latitude: result.coords.latitude, longitude: result.coords.longitude },
        source: 'device',
        areaLabel: 'Current area',
        status: 'ready',
        error: null,
      });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Could not get your location.' });
    }
  },
  chooseArea: (coordinates, areaLabel) => set({ coordinates, source: 'manual', areaLabel, status: 'ready', error: null }),
  clearArea: () => set({ coordinates: null, source: null, areaLabel: null, status: 'idle', error: null }),
}), {
  name: 'hao-manual-area',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => state.source === 'manual'
    ? { coordinates: state.coordinates, source: state.source, areaLabel: state.areaLabel, status: 'ready' as const, error: null }
    : { coordinates: null, source: null, areaLabel: null, status: 'idle' as const, error: null },
}));
