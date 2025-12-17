<script setup lang="ts">
import { computed } from 'vue';
import { Play, Square, Loader2 } from 'lucide-vue-next';
import { useProxyStore } from '@/stores/proxyStore';

const proxyStore = useProxyStore();

const statusText = computed(() => {
  if (proxyStore.isStarting) return 'Starting...';
  if (proxyStore.isStopping) return 'Stopping...';
  if (proxyStore.isRunning) return 'Running';
  return 'Stopped';
});

const proxyAddress = computed(() => {
  if (proxyStore.status?.localIp && proxyStore.status?.port) {
    return `${proxyStore.status.localIp}:${proxyStore.status.port}`;
  }
  return null;
});

async function toggleProxy() {
  if (proxyStore.isRunning) {
    await proxyStore.stopProxy();
  } else {
    await proxyStore.startProxy();
  }
}
</script>

<template>
  <div class="proxy-control">
    <!-- Toggle Button -->
    <button class="proxy-toggle"
      :class="{ 'running': proxyStore.isRunning, 'loading': proxyStore.isStarting || proxyStore.isStopping }"
      @click="toggleProxy" :disabled="proxyStore.isStarting || proxyStore.isStopping">
      <Loader2 v-if="proxyStore.isStarting || proxyStore.isStopping" class="w-4 h-4 animate-spin" />
      <Play v-else-if="!proxyStore.isRunning" class="w-4 h-4" />
      <Square v-else class="w-4 h-4" />
      <span>{{ proxyStore.isRunning ? 'Stop' : 'Start' }}</span>
    </button>

    <!-- Status -->
    <div class="proxy-status" v-if="proxyStore.isRunning">
      <span class="status-indicator"></span>
      <span class="status-text">{{ statusText }}</span>
      <code class="proxy-address" v-if="proxyAddress">{{ proxyAddress }}</code>
    </div>
  </div>
</template>

<style scoped>
.proxy-control {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.proxy-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  height: 32px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.3, 0, 0.5, 1);
  border: 1px solid rgba(240, 246, 252, 0.1);
  background: #238636;
  color: white;
  box-shadow: 0 1px 0 rgba(27, 31, 36, 0.1);
}

.proxy-toggle:hover:not(:disabled) {
  background: #2ea043;
}

.proxy-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #238636;
}

.proxy-toggle.running {
  background: #21262d;
  color: #f85149;
  border-color: rgba(240, 246, 252, 0.1);
}

.proxy-toggle.running:hover {
  background: #30363d;
  color: #ff7b72;
}

.proxy-toggle.loading {
  background: #21262d;
  color: #8b949e;
}

.proxy-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px;
  background: rgba(33, 38, 45, 0.5);
  border: 1px solid rgba(48, 54, 61, 0.5);
  border-radius: 6px;
  height: 32px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3fb950;
  box-shadow: 0 0 0 2px rgba(63, 185, 80, 0.2);
}

.status-text {
  font-size: 13px;
  color: #c9d1d9;
  font-weight: 500;
}

.proxy-address {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  padding: 2px 6px;
  background: rgba(110, 118, 129, 0.1);
  border-radius: 4px;
  color: #79c0ff;
}
</style>
