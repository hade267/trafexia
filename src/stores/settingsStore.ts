import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { AppSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS });
  const isLoading = ref(false);
  const isSaving = ref(false);

  // Actions
  async function loadSettings() {
    isLoading.value = true;
    try {
      const loaded = await window.electronAPI.getSettings();
      settings.value = { ...DEFAULT_SETTINGS, ...loaded };
      applyTheme();
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveSettings(newSettings: Partial<AppSettings>) {
    isSaving.value = true;
    try {
      settings.value = { ...settings.value, ...newSettings };
      await window.electronAPI.saveSettings(newSettings);
      applyTheme();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      isSaving.value = false;
    }
  }

  function toggleDarkMode() {
    saveSettings({ darkMode: !settings.value.darkMode });
  }

  function applyTheme() {
    if (settings.value.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // Watch for darkMode changes
  watch(() => settings.value.darkMode, (newValue) => {
    if (newValue) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  return {
    settings,
    isLoading,
    isSaving,
    loadSettings,
    saveSettings,
    toggleDarkMode,
  };
});
