import * as os from 'os';

/**
 * Get local IP address (IPv4, non-internal)
 */
export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    if (!netInterface) continue;
    
    for (const info of netInterface) {
      // Skip over non-IPv4 and internal addresses
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  
  return '127.0.0.1';
}

/**
 * Get all local IP addresses
 */
export function getAllLocalIps(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    if (!netInterface) continue;
    
    for (const info of netInterface) {
      if (info.family === 'IPv4' && !info.internal) {
        ips.push(info.address);
      }
    }
  }
  
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '0.0.0.0');
  });
}
