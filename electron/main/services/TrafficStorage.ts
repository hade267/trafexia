import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import type { CapturedRequest, RequestDbRow, FilterOptions } from '../../../shared/types';

export class TrafficStorage {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(userDataPath: string) {
    const dataDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'traffic.db');
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);
    
    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    // Create requests table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        host TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER DEFAULT 0,
        request_headers TEXT DEFAULT '{}',
        request_body TEXT,
        response_headers TEXT DEFAULT '{}',
        response_body TEXT,
        content_type TEXT DEFAULT '',
        duration INTEGER DEFAULT 0,
        size INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_host ON requests(host);
      CREATE INDEX IF NOT EXISTS idx_method ON requests(method);
      CREATE INDEX IF NOT EXISTS idx_status ON requests(status);
      CREATE INDEX IF NOT EXISTS idx_content_type ON requests(content_type);
    `);

    // Create settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    console.log('[TrafficStorage] Database initialized at:', this.dbPath);
  }

  /**
   * Save a captured request to database
   */
  saveRequest(request: Omit<CapturedRequest, 'id'>): number {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO requests (
        timestamp, method, url, host, path, status,
        request_headers, request_body, response_headers, response_body,
        content_type, duration, size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      request.timestamp,
      request.method,
      request.url,
      request.host,
      request.path,
      request.status,
      JSON.stringify(request.requestHeaders),
      request.requestBody,
      JSON.stringify(request.responseHeaders),
      request.responseBody,
      request.contentType,
      request.duration,
      request.size
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Update response data for a request
   */
  updateResponse(id: number, data: {
    status: number;
    responseHeaders: Record<string, string>;
    responseBody: string | null;
    contentType: string;
    duration: number;
    size: number;
  }): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE requests SET
        status = ?,
        response_headers = ?,
        response_body = ?,
        content_type = ?,
        duration = ?,
        size = ?
      WHERE id = ?
    `);

    stmt.run(
      data.status,
      JSON.stringify(data.responseHeaders),
      data.responseBody,
      data.contentType,
      data.duration,
      data.size,
      id
    );
  }

  /**
   * Get all requests with optional filtering
   */
  getRequests(filter?: FilterOptions): CapturedRequest[] {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM requests WHERE 1=1';
    const params: (string | number)[] = [];

    if (filter) {
      // Search query
      if (filter.searchQuery) {
        sql += ' AND (url LIKE ? OR host LIKE ? OR path LIKE ?)';
        const query = `%${filter.searchQuery}%`;
        params.push(query, query, query);
      }

      // Methods filter
      if (filter.methods && filter.methods.length > 0) {
        sql += ` AND method IN (${filter.methods.map(() => '?').join(',')})`;
        params.push(...filter.methods);
      }

      // Status codes filter
      if (filter.statusCodes && filter.statusCodes.length > 0) {
        sql += ` AND status IN (${filter.statusCodes.map(() => '?').join(',')})`;
        params.push(...filter.statusCodes);
      }

      // Hosts filter
      if (filter.hosts && filter.hosts.length > 0) {
        sql += ` AND host IN (${filter.hosts.map(() => '?').join(',')})`;
        params.push(...filter.hosts);
      }

      // Content types filter
      if (filter.contentTypes && filter.contentTypes.length > 0) {
        const conditions = filter.contentTypes.map(() => 'content_type LIKE ?').join(' OR ');
        sql += ` AND (${conditions})`;
        params.push(...filter.contentTypes.map(ct => `%${ct}%`));
      }

      // Date range filter
      if (filter.dateRange) {
        sql += ' AND timestamp >= ? AND timestamp <= ?';
        params.push(filter.dateRange.start, filter.dateRange.end);
      }
    }

    sql += ' ORDER BY timestamp DESC';

    // Pagination
    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);

      if (filter.offset) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params) as RequestDbRow[];
    return rows.map(this.mapRowToRequest);
  }

  /**
   * Get a single request by ID
   */
  getRequestById(id: number): CapturedRequest | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as RequestDbRow | undefined;
    return row ? this.mapRowToRequest(row) : null;
  }

  /**
   * Get total request count
   */
  getRequestCount(filter?: FilterOptions): number {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT COUNT(*) as count FROM requests WHERE 1=1';
    const params: (string | number)[] = [];

    if (filter?.searchQuery) {
      sql += ' AND (url LIKE ? OR host LIKE ? OR path LIKE ?)';
      const query = `%${filter.searchQuery}%`;
      params.push(query, query, query);
    }

    const result = this.db.prepare(sql).get(...params) as { count: number };
    return result.count;
  }

  /**
   * Get unique hosts from captured requests
   */
  getUniqueHosts(): string[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT DISTINCT host FROM requests ORDER BY host').all() as { host: string }[];
    return rows.map(r => r.host);
  }

  /**
   * Get unique methods from captured requests
   */
  getUniqueMethods(): string[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT DISTINCT method FROM requests ORDER BY method').all() as { method: string }[];
    return rows.map(r => r.method);
  }

  /**
   * Get unique content types from captured requests
   */
  getUniqueContentTypes(): string[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare("SELECT DISTINCT content_type FROM requests WHERE content_type != '' ORDER BY content_type").all() as { content_type: string }[];
    return rows.map(r => r.content_type);
  }

  /**
   * Delete a request by ID
   */
  deleteRequest(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM requests WHERE id = ?').run(id);
  }

  /**
   * Clear all requests
   */
  clearAll(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('DELETE FROM requests');
    this.db.exec('VACUUM');
  }

  /**
   * Delete requests older than X hours
   */
  deleteOlderThan(hours: number): number {
    if (!this.db) throw new Error('Database not initialized');

    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const result = this.db.prepare('DELETE FROM requests WHERE timestamp < ?').run(cutoff);
    return result.changes;
  }

  /**
   * Get/Set settings
   */
  getSetting(key: string): string | null {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Map database row to CapturedRequest
   */
  private mapRowToRequest(row: RequestDbRow): CapturedRequest {
    return {
      id: row.id,
      timestamp: row.timestamp,
      method: row.method,
      url: row.url,
      host: row.host,
      path: row.path,
      status: row.status,
      requestHeaders: JSON.parse(row.request_headers || '{}'),
      requestBody: row.request_body,
      responseHeaders: JSON.parse(row.response_headers || '{}'),
      responseBody: row.response_body,
      contentType: row.content_type,
      duration: row.duration,
      size: row.size,
    };
  }
}
