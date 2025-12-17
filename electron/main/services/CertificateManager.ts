import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';

export class CertificateManager {
  private certsDir: string;
  private caKeyPath: string;
  private caCertPath: string;
  private caKey: forge.pki.PrivateKey | null = null;
  private caCert: forge.pki.Certificate | null = null;

  constructor(userDataPath: string) {
    this.certsDir = path.join(userDataPath, 'certificates');
    this.caKeyPath = path.join(this.certsDir, 'rootCA.key');
    this.caCertPath = path.join(this.certsDir, 'rootCA.crt');
  }

  /**
   * Initialize certificate manager - generate CA if not exists
   */
  async initialize(): Promise<void> {
    // Create certs directory if not exists
    if (!fs.existsSync(this.certsDir)) {
      fs.mkdirSync(this.certsDir, { recursive: true });
    }

    // Check if CA exists
    if (this.caExists()) {
      await this.loadCA();
      console.log('[CertificateManager] Loaded existing CA certificate');
    } else {
      await this.generateCA();
      console.log('[CertificateManager] Generated new CA certificate');
    }
  }

  /**
   * Check if CA certificate exists
   */
  private caExists(): boolean {
    return fs.existsSync(this.caKeyPath) && fs.existsSync(this.caCertPath);
  }

  /**
   * Load existing CA certificate
   */
  private async loadCA(): Promise<void> {
    const keyPem = fs.readFileSync(this.caKeyPath, 'utf8');
    const certPem = fs.readFileSync(this.caCertPath, 'utf8');

    this.caKey = forge.pki.privateKeyFromPem(keyPem);
    this.caCert = forge.pki.certificateFromPem(certPem);
  }

  /**
   * Generate new CA certificate
   */
  private async generateCA(): Promise<void> {
    console.log('[CertificateManager] Generating CA certificate...');

    // Generate key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    this.caKey = keys.privateKey;

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = this.generateSerialNumber();

    // Valid for 10 years
    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());

    // Set subject and issuer
    const attrs = [
      { name: 'commonName', value: 'Trafexia Root CA' },
      { name: 'countryName', value: 'VN' },
      { name: 'organizationName', value: 'Trafexia' },
      { name: 'organizationalUnitName', value: 'Development' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Set extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true,
        critical: true,
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        cRLSign: true,
        critical: true,
      },
      {
        name: 'subjectKeyIdentifier',
      },
    ]);

    // Self-sign the certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());
    this.caCert = cert;

    // Save to files
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certPem = forge.pki.certificateToPem(cert);

    fs.writeFileSync(this.caKeyPath, keyPem);
    fs.writeFileSync(this.caCertPath, certPem);

    console.log('[CertificateManager] CA certificate saved to:', this.caCertPath);
  }

  /**
   * Generate a random serial number
   */
  private generateSerialNumber(): string {
    return Date.now().toString(16) + Math.random().toString(16).substring(2);
  }

  /**
   * Generate certificate for a specific domain
   */
  generateServerCert(domain: string): { key: string; cert: string } {
    if (!this.caKey || !this.caCert) {
      throw new Error('CA not initialized');
    }

    // Generate key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = this.generateSerialNumber();

    // Valid for 1 year
    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    // Set subject
    cert.setSubject([
      { name: 'commonName', value: domain },
      { name: 'organizationName', value: 'Trafexia' },
    ]);

    // Set issuer from CA
    cert.setIssuer(this.caCert.subject.attributes);

    // Set extensions
    const altNames: Array<{ type: number; value?: string; ip?: string }> = [
      { type: 2, value: domain }, // DNS
      { type: 2, value: '*.' + domain }, // Wildcard
    ];

    // Check if domain is an IP address
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(domain);
    if (isIp) {
      altNames.push({ type: 7, ip: domain }); // IP Type = 7
    }

    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false,
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
      },
      {
        name: 'subjectAltName',
        altNames: altNames,
      },
    ]);

    // Sign with CA key
    cert.sign(this.caKey as forge.pki.rsa.PrivateKey, forge.md.sha256.create());

    return {
      key: forge.pki.privateKeyToPem(keys.privateKey),
      cert: forge.pki.certificateToPem(cert),
    };
  }

  /**
   * Get CA certificate path
   */
  getCertPath(): string {
    return this.caCertPath;
  }

  /**
   * Get CA key path
   */
  getKeyPath(): string {
    return this.caKeyPath;
  }

  /**
   * Get CA certificate as PEM string
   */
  getCertPem(): string {
    if (!this.caCert) {
      throw new Error('CA not initialized');
    }
    return forge.pki.certificateToPem(this.caCert);
  }

  /**
   * Get CA key as PEM string
   */
  getKeyPem(): string {
    if (!this.caKey) {
      throw new Error('CA not initialized');
    }
    return forge.pki.privateKeyToPem(this.caKey);
  }

  /**
   * Get CA certificate as DER (for mobile apps)
   */
  getCertDer(): Buffer {
    if (!this.caCert) {
      throw new Error('CA not initialized');
    }
    const asn1 = forge.pki.certificateToAsn1(this.caCert);
    const der = forge.asn1.toDer(asn1);
    return Buffer.from(der.getBytes(), 'binary');
  }
}
