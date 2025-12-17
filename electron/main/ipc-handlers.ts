import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
import * as fs from 'fs';
import type { CertificateManager } from './services/CertificateManager';
import type { ProxyServer } from './services/ProxyServer';
import type { TrafficStorage } from './services/TrafficStorage';
import type { CertServer } from './services/CertServer';
import type { 
  ProxyConfig, 
  ProxyStatus, 
  FilterOptions, 
  CapturedRequest, 
  AppSettings,
  ExportFormat,
  HarLog,
  HarEntry
} from '../../shared/types';
import { IPC_CHANNELS, DEFAULT_SETTINGS } from '../../shared/types';
import { getLocalIp } from './utils/network';

interface Services {
  certificateManager: CertificateManager;
  proxyServer: ProxyServer;
  trafficStorage: TrafficStorage;
  certServer: CertServer;
  mainWindow: () => BrowserWindow | null;
}

export function setupIpcHandlers(services: Services): void {
  const { certificateManager, proxyServer, trafficStorage, certServer, mainWindow } = services;

  // ===== Proxy Control =====

  ipcMain.handle(IPC_CHANNELS.PROXY_START, async (_event, config: ProxyConfig): Promise<ProxyStatus> => {
    try {
      // Start cert server first
      if (!certServer.isRunning()) {
        await certServer.start(config.port + 1); // Cert server on proxy port + 1
      }

      // Start proxy server
      const status = await proxyServer.start(config);

      // Listen for captured requests and forward to renderer
      proxyServer.on('request:complete', (request: CapturedRequest) => {
        const win = mainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.REQUEST_CAPTURED, request);
        }
      });

      console.log('[IPC] Proxy started:', status);
      return status;
    } catch (error) {
      console.error('[IPC] Failed to start proxy:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_STOP, async (): Promise<void> => {
    try {
      await proxyServer.stop();
      await certServer.stop();
      console.log('[IPC] Proxy stopped');
    } catch (error) {
      console.error('[IPC] Failed to stop proxy:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_STATUS, async (): Promise<ProxyStatus | null> => {
    return proxyServer.getStatus();
  });

  // ===== Certificate =====

  ipcMain.handle(IPC_CHANNELS.CERT_GET_QR, async (): Promise<string> => {
    try {
      const settings = loadSettings(trafficStorage);
      const qrCode = await certServer.generateSimpleQrCode(settings.proxyPort);
      return qrCode;
    } catch (error) {
      console.error('[IPC] Failed to generate QR code:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CERT_GET_PATH, async (): Promise<string> => {
    return certificateManager.getCertPath();
  });

  // ===== Requests =====

  ipcMain.handle(IPC_CHANNELS.REQUESTS_GET_ALL, async (_event, filter?: FilterOptions): Promise<CapturedRequest[]> => {
    try {
      return trafficStorage.getRequests(filter);
    } catch (error) {
      console.error('[IPC] Failed to get requests:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_GET_BY_ID, async (_event, id: number): Promise<CapturedRequest | null> => {
    try {
      return trafficStorage.getRequestById(id);
    } catch (error) {
      console.error('[IPC] Failed to get request by ID:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_CLEAR, async (): Promise<void> => {
    try {
      trafficStorage.clearAll();
      console.log('[IPC] All requests cleared');
    } catch (error) {
      console.error('[IPC] Failed to clear requests:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_DELETE, async (_event, id: number): Promise<void> => {
    try {
      trafficStorage.deleteRequest(id);
    } catch (error) {
      console.error('[IPC] Failed to delete request:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_COUNT, async (): Promise<number> => {
    return trafficStorage.getRequestCount();
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_EXPORT, async (_event, format: ExportFormat, ids?: number[]): Promise<string> => {
    try {
      let requests: CapturedRequest[];
      
      if (ids && ids.length > 0) {
        requests = ids
          .map(id => trafficStorage.getRequestById(id))
          .filter((r): r is CapturedRequest => r !== null);
      } else {
        requests = trafficStorage.getRequests({ limit: 10000 });
      }

      let content: string;
      let defaultName: string;
      let filters: Electron.FileFilter[];

      switch (format) {
        case 'har':
          content = exportAsHar(requests);
          defaultName = 'trafexia-export.har';
          filters = [{ name: 'HAR Files', extensions: ['har'] }];
          break;
        case 'json':
          content = JSON.stringify(requests, null, 2);
          defaultName = 'trafexia-export.json';
          filters = [{ name: 'JSON Files', extensions: ['json'] }];
          break;
        case 'curl':
          content = requests.map(r => exportAsCurl(r)).join('\n\n');
          defaultName = 'trafexia-curl.txt';
          filters = [{ name: 'Text Files', extensions: ['txt'] }];
          break;
        case 'python':
          content = exportAsPython(requests);
          defaultName = 'trafexia-requests.py';
          filters = [{ name: 'Python Files', extensions: ['py'] }];
          break;
        case 'postman':
          content = exportAsPostman(requests);
          defaultName = 'trafexia-postman.json';
          filters = [{ name: 'JSON Files', extensions: ['json'] }];
          break;
        default:
          throw new Error(`Unknown export format: ${format}`);
      }

      // Show save dialog
      const result = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters,
      });

      if (result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf-8');
        shell.showItemInFolder(result.filePath);
        return result.filePath;
      }

      return '';
    } catch (error) {
      console.error('[IPC] Failed to export requests:', error);
      throw error;
    }
  });

  // ===== Settings =====

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (): Promise<AppSettings> => {
    return loadSettings(trafficStorage);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, settings: Partial<AppSettings>): Promise<void> => {
    try {
      const current = loadSettings(trafficStorage);
      const updated = { ...current, ...settings };
      trafficStorage.setSetting('app_settings', JSON.stringify(updated));
      console.log('[IPC] Settings saved');
    } catch (error) {
      console.error('[IPC] Failed to save settings:', error);
      throw error;
    }
  });

  // ===== App =====

  ipcMain.handle(IPC_CHANNELS.APP_GET_LOCAL_IP, async (): Promise<string> => {
    return getLocalIp();
  });
}

// ===== Helper Functions =====

function loadSettings(storage: TrafficStorage): AppSettings {
  const saved = storage.getSetting('app_settings');
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

function exportAsHar(requests: CapturedRequest[]): string {
  const harLog: HarLog = {
    version: '1.2',
    creator: {
      name: 'Trafexia',
      version: '1.0.0',
    },
    entries: requests.map((req): HarEntry => {
      const requestHeaders = Object.entries(req.requestHeaders).map(([name, value]) => ({ name, value }));
      const responseHeaders = Object.entries(req.responseHeaders).map(([name, value]) => ({ name, value }));

      // Parse query string
      const url = new URL(req.url);
      const queryString = Array.from(url.searchParams.entries()).map(([name, value]) => ({ name, value }));

      return {
        startedDateTime: new Date(req.timestamp).toISOString(),
        time: req.duration,
        request: {
          method: req.method,
          url: req.url,
          httpVersion: 'HTTP/1.1',
          headers: requestHeaders,
          queryString,
          postData: req.requestBody ? {
            mimeType: req.requestHeaders['content-type'] || 'text/plain',
            text: req.requestBody,
          } : undefined,
          headersSize: -1,
          bodySize: req.requestBody?.length || 0,
        },
        response: {
          status: req.status,
          statusText: getStatusText(req.status),
          httpVersion: 'HTTP/1.1',
          headers: responseHeaders,
          content: {
            size: req.size,
            mimeType: req.contentType || 'text/plain',
            text: req.responseBody || undefined,
          },
          headersSize: -1,
          bodySize: req.size,
        },
        cache: {},
        timings: {
          send: 0,
          wait: req.duration,
          receive: 0,
        },
      };
    }),
  };

  return JSON.stringify({ log: harLog }, null, 2);
}

function exportAsCurl(request: CapturedRequest): string {
  let curl = `curl -X ${request.method} '${request.url}'`;

  // Add headers
  for (const [key, value] of Object.entries(request.requestHeaders)) {
    if (key.toLowerCase() !== 'host') {
      curl += ` \\\n  -H '${key}: ${value}'`;
    }
  }

  // Add body
  if (request.requestBody) {
    const escapedBody = request.requestBody.replace(/'/g, "'\\''");
    curl += ` \\\n  -d '${escapedBody}'`;
  }

  return curl;
}

function exportAsPython(requests: CapturedRequest[]): string {
  let code = `import requests\n\n`;

  requests.forEach((req, index) => {
    const funcName = `request_${index + 1}`;
    code += `def ${funcName}():\n`;
    code += `    """${req.method} ${req.path}"""\n`;
    code += `    url = "${req.url}"\n`;

    // Headers
    const headers = { ...req.requestHeaders };
    delete headers['host'];
    delete headers['content-length'];
    code += `    headers = ${JSON.stringify(headers, null, 8).replace(/\n/g, '\n    ')}\n`;

    // Body
    if (req.requestBody) {
      try {
        const jsonBody = JSON.parse(req.requestBody);
        code += `    json_data = ${JSON.stringify(jsonBody, null, 8).replace(/\n/g, '\n    ')}\n`;
        code += `    response = requests.${req.method.toLowerCase()}(url, headers=headers, json=json_data)\n`;
      } catch {
        code += `    data = """${req.requestBody}"""\n`;
        code += `    response = requests.${req.method.toLowerCase()}(url, headers=headers, data=data)\n`;
      }
    } else {
      code += `    response = requests.${req.method.toLowerCase()}(url, headers=headers)\n`;
    }

    code += `    return response\n\n`;
  });

  return code;
}

function exportAsPostman(requests: CapturedRequest[]): string {
  const collection = {
    info: {
      name: 'Trafexia Export',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: requests.map((req) => {
      const url = new URL(req.url);
      
      return {
        name: `${req.method} ${req.path}`,
        request: {
          method: req.method,
          header: Object.entries(req.requestHeaders)
            .filter(([key]) => key.toLowerCase() !== 'host')
            .map(([key, value]) => ({ key, value, type: 'text' })),
          url: {
            raw: req.url,
            protocol: url.protocol.replace(':', ''),
            host: url.hostname.split('.'),
            port: url.port || undefined,
            path: url.pathname.split('/').filter(Boolean),
            query: Array.from(url.searchParams.entries()).map(([key, value]) => ({ key, value })),
          },
          body: req.requestBody ? {
            mode: 'raw',
            raw: req.requestBody,
            options: {
              raw: {
                language: req.requestHeaders['content-type']?.includes('json') ? 'json' : 'text',
              },
            },
          } : undefined,
        },
      };
    }),
  };

  return JSON.stringify(collection, null, 2);
}

function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[status] || 'Unknown';
}
