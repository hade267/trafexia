import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CapturedRequest, FilterOptions } from '@shared/types';

export const useTrafficStore = defineStore('traffic', () => {
  // State
  const requests = ref<CapturedRequest[]>([]);
  const selectedRequest = ref<CapturedRequest | null>(null);
  const isLoading = ref(false);
  const totalCount = ref(0);
  
  const filter = ref<FilterOptions>({
    searchQuery: '',
    methods: [],
    statusCodes: [],
    hosts: [],
    contentTypes: [],
    limit: 500,
    offset: 0,
  });

  // Getters
  const requestCount = computed(() => requests.value.length);
  
  const uniqueHosts = computed(() => {
    const hosts = new Set(requests.value.map(r => r.host));
    return Array.from(hosts).sort();
  });
  
  const uniqueMethods = computed(() => {
    const methods = new Set(requests.value.map(r => r.method));
    return Array.from(methods).sort();
  });
  
  const uniqueContentTypes = computed(() => {
    const types = new Set(
      requests.value
        .map(r => r.contentType)
        .filter(Boolean)
        .map(ct => ct.split(';')[0].trim())
    );
    return Array.from(types).sort();
  });

  const filteredRequests = computed(() => {
    let result = [...requests.value];
    
    // Search query
    if (filter.value.searchQuery) {
      const query = filter.value.searchQuery.toLowerCase();
      result = result.filter(r => 
        r.url.toLowerCase().includes(query) ||
        r.host.toLowerCase().includes(query) ||
        r.path.toLowerCase().includes(query)
      );
    }
    
    // Methods
    if (filter.value.methods && filter.value.methods.length > 0) {
      result = result.filter(r => filter.value.methods!.includes(r.method));
    }
    
    // Status codes
    if (filter.value.statusCodes && filter.value.statusCodes.length > 0) {
      result = result.filter(r => filter.value.statusCodes!.includes(r.status));
    }
    
    // Hosts
    if (filter.value.hosts && filter.value.hosts.length > 0) {
      result = result.filter(r => filter.value.hosts!.includes(r.host));
    }
    
    // Content types
    if (filter.value.contentTypes && filter.value.contentTypes.length > 0) {
      result = result.filter(r => {
        const ct = r.contentType.split(';')[0].trim();
        return filter.value.contentTypes!.includes(ct);
      });
    }
    
    // Date range
    if (filter.value.dateRange) {
      result = result.filter(r => 
        r.timestamp >= filter.value.dateRange!.start &&
        r.timestamp <= filter.value.dateRange!.end
      );
    }
    
    return result;
  });

  // Actions
  async function loadRequests(filterOptions?: FilterOptions) {
    isLoading.value = true;
    try {
      const result = await window.electronAPI.getRequests(filterOptions || filter.value);
      requests.value = result;
      totalCount.value = await window.electronAPI.getRequestCount();
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      isLoading.value = false;
    }
  }

  function addRequest(request: CapturedRequest) {
    // Add to beginning of array
    requests.value.unshift(request);
    totalCount.value++;
    
    // Limit array size for performance
    if (requests.value.length > 5000) {
      requests.value = requests.value.slice(0, 5000);
    }
  }

  function updateRequest(request: CapturedRequest) {
    const index = requests.value.findIndex(r => r.id === request.id);
    if (index !== -1) {
      requests.value[index] = request;
      
      // Update selected if it's the same
      if (selectedRequest.value?.id === request.id) {
        selectedRequest.value = request;
      }
    } else {
      addRequest(request);
    }
  }

  function setSelectedRequest(request: CapturedRequest | null) {
    selectedRequest.value = request;
  }

  function updateFilter(newFilter: Partial<FilterOptions>) {
    filter.value = { ...filter.value, ...newFilter };
  }

  function clearFilter() {
    filter.value = {
      searchQuery: '',
      methods: [],
      statusCodes: [],
      hosts: [],
      contentTypes: [],
      limit: 500,
      offset: 0,
    };
  }

  async function clearAll() {
    try {
      await window.electronAPI.clearRequests();
      requests.value = [];
      selectedRequest.value = null;
      totalCount.value = 0;
    } catch (error) {
      console.error('Failed to clear requests:', error);
    }
  }

  async function deleteRequest(id: number) {
    try {
      await window.electronAPI.deleteRequest(id);
      requests.value = requests.value.filter(r => r.id !== id);
      if (selectedRequest.value?.id === id) {
        selectedRequest.value = null;
      }
      totalCount.value--;
    } catch (error) {
      console.error('Failed to delete request:', error);
    }
  }

  async function refreshRequestById(id: number) {
    try {
      const request = await window.electronAPI.getRequestById(id);
      if (request) {
        updateRequest(request);
        return request;
      }
    } catch (error) {
      console.error('Failed to refresh request:', error);
    }
    return null;
  }

  return {
    // State
    requests,
    selectedRequest,
    isLoading,
    totalCount,
    filter,
    
    // Getters
    requestCount,
    uniqueHosts,
    uniqueMethods,
    uniqueContentTypes,
    filteredRequests,
    
    // Actions
    loadRequests,
    addRequest,
    updateRequest,
    setSelectedRequest,
    updateFilter,
    clearFilter,
    clearAll,
    deleteRequest,
    refreshRequestById,
  };
});
