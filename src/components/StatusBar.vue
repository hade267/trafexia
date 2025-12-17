<script setup lang="ts">
import { computed } from 'vue';
import { Activity, Database, Filter } from 'lucide-vue-next';

import { useTrafficStore } from '@/stores/trafficStore';
import { useProxyStore } from '@/stores/proxyStore';

const trafficStore = useTrafficStore();
const proxyStore = useProxyStore();

const filteredCount = computed(() => trafficStore.filteredRequests.length);
const totalCount = computed(() => trafficStore.totalCount);
const selectedHost = computed(() => trafficStore.selectedRequest?.host || null);
</script>

<template>
  <div class="status-bar">
    <!-- Left side -->
    <div class="custom-flex-group">
      <!-- Total Requests -->
      <div class="custom-flex-group">
        <Database class="w-3.5 h-3.5" />
        <span>Total: <strong class="text-[#c9d1d9]">{{ totalCount }}</strong></span>
      </div>

      <!-- Filtered Requests -->
      <div v-if="filteredCount !== totalCount" class="custom-flex-group">
        <Filter class="w-3.5 h-3.5" />
        <span>Filtered: <strong class="text-[#c9d1d9]">{{ filteredCount }}</strong></span>
      </div>

      <!-- Selected Host -->
      <div v-if="selectedHost" class="custom-flex-group">
        <Activity class="w-3.5 h-3.5" />
        <span>Selected: <strong class="text-[#79c0ff]">{{ selectedHost }}</strong></span>
      </div>
    </div>

    <!-- Right side -->
    <div class="custom-flex-group">
      <!-- Proxy Status -->
      <div class="custom-flex-group">
        <span :class="[
          'status-dot',
          proxyStore.isRunning ? 'running' : 'stopped'
        ]"></span>
        <span v-if="proxyStore.isRunning">
          Proxy: <strong class="text-[#3fb950]">{{ proxyStore.proxyAddress }}</strong>
        </span>
        <span v-else>Proxy: <strong>Stopped</strong></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #8b949e;
  background: #161b22;
  border-top: 1px solid #30363d;
}

.custom-flex-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.custom-flex-group .custom-flex-group {
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.running {
  background: #3fb950;
  box-shadow: 0 0 0 2px rgba(63, 185, 80, 0.2);
}

.status-dot.stopped {
  background: #8b949e;
}
</style>
