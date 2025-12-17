<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Dialog from 'primevue/dialog';
import {
  Network,
  Settings,
  QrCode,
  Trash2,
  Filter,
  X
} from 'lucide-vue-next';

import { useTrafficStore } from '@/stores/trafficStore';
import { useProxyStore } from '@/stores/proxyStore';
import { useSettingsStore } from '@/stores/settingsStore';

import ProxyControl from '@/components/ProxyControl.vue';
import RequestList from '@/components/RequestList.vue';
import FilterPanel from '@/components/FilterPanel.vue';
import RequestDetail from '@/components/RequestDetail.vue';
import SettingsDialog from '@/components/SettingsDialog.vue';

const trafficStore = useTrafficStore();
const proxyStore = useProxyStore();
const settingsStore = useSettingsStore();

// State
const showFilters = ref(false);
const showSettings = ref(false);
const showQrCode = ref(false);

// Computed
const hasSelectedRequest = computed(() => !!trafficStore.selectedRequest);
const requestCount = computed(() => trafficStore.filteredRequests.length);

// Event handlers
function handleRequestCaptured(request: any) {
  trafficStore.addRequest(request);
}

function handleProxyError(error: string) {
  console.error('[App] Proxy error:', error);
}

// Lifecycle
onMounted(async () => {
  await settingsStore.loadSettings();
  await trafficStore.loadRequests();

  window.electronAPI.onRequestCaptured(handleRequestCaptured);
  window.electronAPI.onProxyError(handleProxyError);
});

onUnmounted(() => {
  // Cleanup listeners
});

async function openQrCode() {
  if (proxyStore.isRunning) {
    await proxyStore.refreshQrCode();
    showQrCode.value = true;
  }
}

const mainContainer = ref<HTMLElement | null>(null);
const leftPanelWidth = ref(40); // Initial %, used when split
const isResizing = ref(false);

const listPanelStyle = computed(() => {
  if (!hasSelectedRequest.value) {
    return { flex: '1', minWidth: '300px', overflow: 'hidden' };
  }
  return { width: `${leftPanelWidth.value}%`, minWidth: '200px', maxWidth: '80%', overflow: 'hidden', flexShrink: 0 }; // Use width, not flex
});

function startResize() {
  isResizing.value = true;
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
}

function handleResize(e: MouseEvent) {
  if (!mainContainer.value) return;
  const containerRect = mainContainer.value.getBoundingClientRect();
  const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

  if (newWidth > 15 && newWidth < 85) {
    leftPanelWidth.value = newWidth;
  }
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
}

function clearRequests() {
  trafficStore.clearAll();
}
</script>

<template>
  <div class="app-container">
    <!-- Global Components -->
    <Toast position="bottom-right" />
    <ConfirmDialog />

    <!-- Header -->
    <header class="app-header"
      style="height: 50px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: #161b22; border-bottom: 1px solid #30363d; z-index: 50;">
      <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
        <div
          style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #238636 0%, #2ea043 100%); border-radius: 8px; box-shadow: 0 2px 8px rgba(35, 134, 54, 0.4);">
          <img src="@/public/logo.png" alt="Trafexia" style="width: 20px; height: 20px; object-fit: contain;" />
        </div>
        <div class="app-title">
          <h1
            style="font-size: 18px; font-weight: 700; background: linear-gradient(90deg, #fff 0%, #e6edf3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; margin: 0;">
            Trafexia</h1>
          <span
            style="font-size: 10px; color: #8b949e; font-weight: 500; letter-spacing: 0.5px; background: rgba(110, 118, 129, 0.1); padding: 2px 6px; border-radius: 12px; border: 1px solid rgba(110, 118, 129, 0.2);">BETA</span>
        </div>
      </div>
      <!-- Proxy Control -->
      <ProxyControl />

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Actions -->
      <div class="header-actions">
        <!-- Request Counter -->
        <div class="request-counter">
          <span class="counter-value">{{ requestCount }}</span>
          <span class="counter-label">requests</span>
        </div>

        <!-- Filter Toggle -->
        <button class="btn btn-ghost btn-icon" :class="{ 'active': showFilters }" @click="showFilters = !showFilters"
          title="Toggle Filters">
          <Filter class="w-5 h-5" />
        </button>

        <!-- QR Code -->
        <button class="btn btn-ghost btn-icon" @click="openQrCode" :disabled="!proxyStore.isRunning"
          title="Show QR Code">
          <QrCode class="w-5 h-5" />
        </button>

        <!-- Clear -->
        <button class="btn btn-ghost btn-icon" @click="clearRequests" title="Clear All Requests">
          <Trash2 class="w-5 h-5" />
        </button>

        <!-- Settings -->
        <button class="btn btn-ghost btn-icon" @click="showSettings = true" title="Settings">
          <Settings class="w-5 h-5" />
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="app-content">
      <!-- Filter Sidebar -->
      <aside v-if="showFilters"
        style="width: 280px; background: #161b22; border-right: 1px solid rgba(48, 54, 61, 0.8); display: flex; flex-direction: column; flex-shrink: 0;">
        <div
          style="padding: 12px 16px; border-bottom: 1px solid rgba(48, 54, 61, 0.8); display: flex; align-items: center; justify-content: space-between; font-weight: 600; font-size: 13px; color: #e6edf3;">
          <span>Filters</span>
          <button style="background: none; border: none; color: #8b949e; cursor: pointer; padding: 4px;"
            @click="showFilters = false">
            <X style="width: 16px; height: 16px;" />
          </button>
        </div>
        <FilterPanel />
      </aside>

      <!-- Main Content Area -->
      <div style="flex: 1; display: flex; overflow: hidden;" ref="mainContainer">
        <!-- Request List Panel -->
        <div :style="listPanelStyle">
          <RequestList />
        </div>

        <!-- Resizable Divider -->
        <div v-if="hasSelectedRequest" @mousedown="startResize"
          style="width: 4px; background: rgba(48, 54, 61, 0.8); cursor: col-resize; flex-shrink: 0; z-index: 10; transition: background 0.2s;"
          class="resize-handle"></div>

        <!-- Detail Panel -->
        <div v-if="hasSelectedRequest" style="flex: 1; min-width: 0; overflow: hidden;">
          <RequestDetail />
        </div>
      </div>
    </main>

    <!-- Settings Dialog -->
    <SettingsDialog v-model:visible="showSettings" />

    <!-- QR Code Dialog -->
    <Dialog v-model:visible="showQrCode" header="Connect Mobile Device" :modal="true" :style="{ width: '400px' }">
      <div class="qr-dialog-content" v-if="proxyStore.qrCodeData">
        <div class="qr-code-wrapper">
          <img :src="proxyStore.qrCodeData.qrCode" alt="QR Code" class="qr-code-image" />
        </div>
        <div class="qr-info">
          <p class="qr-instruction">Scan this QR code to open the setup page</p>
          <div class="proxy-details">
            <div class="detail-item">
              <span class="detail-label">Proxy Address</span>
              <code
                class="detail-value">{{ proxyStore.qrCodeData.proxyHost }}:{{ proxyStore.qrCodeData.proxyPort }}</code>
            </div>
            <div class="detail-item">
              <span class="detail-label">Setup URL</span>
              <code class="detail-value">{{ proxyStore.qrCodeData.setupUrl }}</code>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.app-header {
  height: 56px;
  min-height: 56px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  -webkit-app-region: drag;
}

.app-header>* {
  -webkit-app-region: no-drag;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding-right: 8px;
}

.app-title {
  font-weight: 600;
  font-size: 17px;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.w-4 {
  width: 16px;
  height: 16px;
}

.w-5 {
  width: 20px;
  height: 20px;
}

.w-6 {
  width: 24px;
  height: 24px;
}

.h-4 {
  height: 16px;
}

.h-5 {
  height: 20px;
}

.h-6 {
  height: 24px;
}

.text-accent {
  color: var(--color-accent);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.request-counter {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 0 12px;
  color: var(--color-text-secondary);
}

.counter-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.counter-label {
  font-size: 12px;
}

.btn-icon.active {
  background: var(--color-accent-muted);
  color: var(--color-accent);
}

.app-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-primary);
}

/* QR Dialog */
.qr-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.qr-code-wrapper {
  padding: 16px;
  background: white;
  border-radius: 12px;
}

.qr-code-image {
  width: 200px;
  height: 200px;
}

.qr-info {
  text-align: center;
}

.qr-instruction {
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.proxy-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 13px;
  padding: 6px 10px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
  color: var(--color-text-primary);
}

:deep(.p-splitter) {
  background: transparent;
  border: none;
}

:deep(.p-splitter-gutter) {
  background: var(--color-border);
}

:deep(.p-splitter-gutter:hover) {
  background: var(--color-accent);
}

.resize-handle:hover {
  background: #58a6ff !important;
}
</style>
