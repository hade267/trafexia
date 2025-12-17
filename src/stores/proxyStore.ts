import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ProxyConfig, ProxyStatus } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

export const useProxyStore = defineStore('proxy', () => {
  // State
  const status = ref<ProxyStatus | null>(null);
  const qrCode = ref<string>('');
  const qrCodeData = ref<{ qrCode: string; proxyHost: string; proxyPort: number; setupUrl: string } | null>(null);
  const error = ref<string | null>(null);
  const isStarting = ref(false);
  const isStopping = ref(false);

  // Getters
  const isRunning = computed(() => status.value?.running ?? false);
  const proxyAddress = computed(() => {
    if (!status.value) return '';
    return `${status.value.localIp}:${status.value.port}`;
  });

  // Actions
  async function startProxy(config?: Partial<ProxyConfig>) {
    if (isStarting.value || isRunning.value) return;
    
    isStarting.value = true;
    error.value = null;
    
    try {
      const proxyConfig: ProxyConfig = {
        port: config?.port ?? DEFAULT_SETTINGS.proxyPort,
        host: config?.host ?? '0.0.0.0',
        enableHttps: config?.enableHttps ?? DEFAULT_SETTINGS.enableHttps,
      };
      
      status.value = await window.electronAPI.startProxy(proxyConfig);
      await generateQr();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start proxy';
      console.error('Failed to start proxy:', err);
    } finally {
      isStarting.value = false;
    }
  }

  async function stopProxy() {
    if (isStopping.value || !isRunning.value) return;
    
    isStopping.value = true;
    error.value = null;
    
    try {
      await window.electronAPI.stopProxy();
      status.value = null;
      qrCode.value = '';
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop proxy';
      console.error('Failed to stop proxy:', err);
    } finally {
      isStopping.value = false;
    }
  }

  async function refreshStatus() {
    try {
      status.value = await window.electronAPI.getProxyStatus();
    } catch (err) {
      console.error('Failed to get proxy status:', err);
    }
  }

  async function generateQr() {
    try {
      const qr = await window.electronAPI.getQrCode();
      qrCode.value = qr;
      qrCodeData.value = {
        qrCode: qr,
        proxyHost: status.value?.localIp || '',
        proxyPort: status.value?.port || 8888,
        setupUrl: status.value?.certDownloadUrl?.replace('/cert', '/setup') || '',
      };
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  }

  async function refreshQrCode() {
    await generateQr();
  }

  function clearError() {
    error.value = null;
  }

  return {
    // State
    status,
    qrCode,
    qrCodeData,
    error,
    isStarting,
    isStopping,
    
    // Getters
    isRunning,
    proxyAddress,
    
    // Actions
    startProxy,
    stopProxy,
    refreshStatus,
    generateQr,
    refreshQrCode,
    clearError,
  };
});
