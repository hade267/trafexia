<script setup lang="ts">
import { ref, computed } from 'vue';
import { Search, X, Trash2 } from 'lucide-vue-next';
import { useTrafficStore } from '@/stores/trafficStore';
import { useConfirm } from 'primevue/useconfirm';
import { HTTP_METHODS } from '@shared/types';

const trafficStore = useTrafficStore();
const confirm = useConfirm();

const searchQuery = ref('');
const selectedMethods = ref<string[]>([]);
const selectedStatuses = ref<string[]>([]);

const STATUS_OPTIONS = ['2xx', '3xx', '4xx', '5xx'];

const uniqueHosts = computed(() => trafficStore.uniqueHosts);

function applyFilters() {
  trafficStore.updateFilter({
    searchQuery: searchQuery.value,
    methods: selectedMethods.value,
  });
}

function toggleMethod(method: string) {
  const idx = selectedMethods.value.indexOf(method);
  if (idx > -1) {
    selectedMethods.value.splice(idx, 1);
  } else {
    selectedMethods.value.push(method);
  }
  applyFilters();
}

function toggleStatus(status: string) {
  const idx = selectedStatuses.value.indexOf(status);
  if (idx > -1) {
    selectedStatuses.value.splice(idx, 1);
  } else {
    selectedStatuses.value.push(status);
  }
  applyFilters();
}

function clearFilters() {
  searchQuery.value = '';
  selectedMethods.value = [];
  selectedStatuses.value = [];
  trafficStore.clearFilter();
}

function confirmClearAll() {
  confirm.require({
    message: 'Clear all captured requests?',
    header: 'Confirm',
    icon: 'pi pi-exclamation-triangle',
    accept: () => trafficStore.clearAll(),
  });
}
</script>

<template>
  <div class="filter-panel">
    <!-- Search -->
    <div class="filter-section">
      <label class="filter-label">Search</label>
      <div class="search-input-wrapper">
        <Search class="search-icon" />
        <input 
          v-model="searchQuery"
          @input="applyFilters"
          type="text"
          class="filter-input"
          placeholder="URL, host, path..."
        />
        <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''; applyFilters()">
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Methods -->
    <div class="filter-section">
      <label class="filter-label">Methods</label>
      <div class="filter-chips">
        <button 
          v-for="method in HTTP_METHODS" 
          :key="method"
          class="filter-chip"
          :class="{ active: selectedMethods.includes(method) }"
          @click="toggleMethod(method)"
        >
          {{ method }}
        </button>
      </div>
    </div>

    <!-- Status Codes -->
    <div class="filter-section">
      <label class="filter-label">Status</label>
      <div class="filter-chips">
        <button 
          v-for="status in STATUS_OPTIONS" 
          :key="status"
          class="filter-chip"
          :class="{ active: selectedStatuses.includes(status) }"
          @click="toggleStatus(status)"
        >
          {{ status }}
        </button>
      </div>
    </div>

    <!-- Hosts -->
    <div v-if="uniqueHosts.length > 0" class="filter-section">
      <label class="filter-label">Top Hosts</label>
      <div class="host-list">
        <div v-for="host in uniqueHosts.slice(0, 10)" :key="host" class="host-item">
          {{ host }}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="filter-actions">
      <button class="btn btn-secondary" @click="clearFilters">
        Clear Filters
      </button>
      <button class="btn btn-danger" @click="confirmClearAll">
        <Trash2 class="w-4 h-4" />
        Clear All
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
}

.filter-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.filter-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.search-input-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
}

.filter-input {
  width: 100%;
  padding: 8px 32px 8px 34px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 13px;
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.filter-input::placeholder {
  color: var(--color-text-muted);
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
}

.clear-btn:hover {
  color: var(--color-text-primary);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chip {
  padding: 4px 10px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.filter-chip:hover {
  background: var(--color-bg-elevated);
}

.filter-chip.active {
  background: var(--color-accent-muted);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.host-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.host-item {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-actions {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.btn-secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-bg-elevated);
}

.btn-danger {
  background: rgba(248, 81, 73, 0.15);
  color: var(--color-error);
}

.btn-danger:hover {
  background: rgba(248, 81, 73, 0.25);
}
</style>
