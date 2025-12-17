import { contextBridge, ipcRenderer } from 'electron';
import type { 
  IpcApi, 
  ProxyConfig, 
  ProxyStatus, 
  FilterOptions, 
  CapturedRequest, 
  AppSettings,
  ExportFormat 
} from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: IpcApi = {
  // Proxy
  startProxy: (config: ProxyConfig): Promise<ProxyStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROXY_START, config);
  },
  stopProxy: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROXY_STOP);
  },
  getProxyStatus: (): Promise<ProxyStatus | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROXY_STATUS);
  },

  // Certificate
  getQrCode: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CERT_GET_QR);
  },
  getCertPath: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CERT_GET_PATH);
  },

  // Requests
  getRequests: (filter?: FilterOptions): Promise<CapturedRequest[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUESTS_GET_ALL, filter);
  },
  getRequestById: (id: number): Promise<CapturedRequest | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUESTS_GET_BY_ID, id);
  },
  clearRequests: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUESTS_CLEAR);
  },
  deleteRequest: (id: number): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUESTS_DELETE, id);
  },
  exportRequests: (format: ExportFormat, ids?: number[]): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUESTS_EXPORT, format, ids);
  },
  getRequestCount: (): Promise<number> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUESTS_COUNT);
  },

  // Settings
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET);
  },
  saveSettings: (settings: Partial<AppSettings>): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings);
  },

  // App
  getLocalIp: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_LOCAL_IP);
  },

  // Events
  onRequestCaptured: (callback: (request: CapturedRequest) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, request: CapturedRequest) => {
      callback(request);
    };
    ipcRenderer.on(IPC_CHANNELS.REQUEST_CAPTURED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.REQUEST_CAPTURED, handler);
    };
  },

  onProxyError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => {
      callback(error);
    };
    ipcRenderer.on(IPC_CHANNELS.PROXY_ERROR, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PROXY_ERROR, handler);
    };
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', api);

// Type declaration for renderer process
declare global {
  interface Window {
    electronAPI: IpcApi;
  }
}
