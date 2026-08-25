import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStorage } from '../store/persistence';

/**
 * Adaptateur concret vers AsyncStorage. Seul ce fichier connaît la plateforme :
 * toute la logique de persistance reste pure et testable sous Node via la
 * frontière injectable `KeyValueStorage`.
 */
export const asyncStorageAdapter: KeyValueStorage = {
  async getItem(key: string) {
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};
