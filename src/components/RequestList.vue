<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTrafficStore } from '@/stores/trafficStore';
import { formatTimestamp, formatBytes, formatDuration, getStatusClass, truncateUrl } from '@/utils/formatters';
import type { CapturedRequest } from '@shared/types';

const trafficStore = useTrafficStore();
const selectedRow = ref<CapturedRequest | null>(null);

watch(() => trafficStore.selectedRequest, (newVal) => {
  selectedRow.value = newVal;
});

function onRowClick(request: CapturedRequest) {
  trafficStore.setSelectedRequest(request);
}

function getRowClass(data: CapturedRequest) {
  const classes = [];
  if (selectedRow.value?.id === data.id) classes.push('selected');
  if (data.status === 0) classes.push('pending');
  if (data.status >= 400) classes.push('error');
  return classes.join(' ');
}
</script>

<template>
  <div class="request-list">
    <!-- Empty State -->
    <div v-if="trafficStore.filteredRequests.length === 0" class="empty-state">
      <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.5">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
      <h3 class="empty-state-title">No requests captured</h3>
      <p class="empty-state-text">
        Start the proxy and configure your device to capture traffic
      </p>
    </div>

    <!-- Request Table -->
    <div v-else class="table-container">
      <table class="request-table">
        <thead>
          <tr>
            <th class="col-time">Time</th>
            <th class="col-method">Method</th>
            <th class="col-host">Host</th>
            <th class="col-path">Path</th>
            <th class="col-status">Status</th>
            <th class="col-duration">Duration</th>
            <th class="col-size">Size</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in trafficStore.filteredRequests" :key="request.id" :class="getRowClass(request)"
            @click="onRowClick(request)" style="cursor: pointer;">
            <td class="col-time">{{ formatTimestamp(request.timestamp) }}</td>
            <td class="col-method">
              <span :class="['method-badge', request.method]">{{ request.method }}</span>
            </td>
            <td class="col-host" :title="request.host">{{ request.host }}</td>
            <td class="col-path" :title="request.path">{{ truncateUrl(request.path, 50) }}</td>
            <td class="col-status">
              <span v-if="request.status === 0" class="status-badge status-0">•••</span>
              <span v-else :class="['status-badge', getStatusClass(request.status)]">
                {{ request.status }}
              </span>
            </td>
            <td class="col-duration">
              {{ request.duration > 0 ? formatDuration(request.duration) : '—' }}
            </td>
            <td class="col-size">
              {{ request.size > 0 ? formatBytes(request.size) : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.request-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.empty-state-icon {
  width: 64px;
  height: 64px;
  color: var(--color-text-muted);
  opacity: 0.4;
  margin-bottom: 16px;
}

.empty-state-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.empty-state-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  max-width: 280px;
}

.table-container {
  flex: 1;
  overflow: auto;
}

.request-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.request-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
}

.request-table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}

.request-table tbody tr:hover {
  background: var(--color-bg-tertiary);
}

.request-table tbody tr.selected {
  background: var(--color-accent-muted);
}

.request-table tbody tr.pending {
  opacity: 0.6;
}

.request-table tbody tr.error td:first-child {
  box-shadow: inset 3px 0 0 var(--color-error);
}

.request-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-time {
  width: 75px;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 12px;
  color: var(--color-text-muted);
}

.col-method {
  width: 75px;
}

.col-host {
  width: 180px;
  max-width: 180px;
  color: var(--color-text-primary);
}

.col-path {
  min-width: 200px;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.col-status {
  width: 65px;
}

.col-duration,
.col-size {
  width: 70px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: right;
}
</style>
