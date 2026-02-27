const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');
const log = require('electron-log');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'speedtest-monitor.db');
      
      log.info(`Initializing database at: ${this.dbPath}`);
      
      await this.ensureDirectoryExists(path.dirname(this.dbPath));
      await this.connect();
      await this.createTables();
      await this.performMigrations();
      
      this.isInitialized = true;
      log.info('Database initialized successfully');
    } catch (error) {
      log.error('Failed to initialize database:', error);
      throw new Error(`データベースの初期化に失敗しました: ${error.message}`);
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (error) => {
        if (error) {
          log.error('Failed to connect to database:', error);
          reject(new Error(`データベースへの接続に失敗しました: ${error.message}`));
        } else {
          log.info('Connected to SQLite database');
          
          this.db.configure('busyTimeout', 30000);
          this.db.run('PRAGMA foreign_keys = ON');
          this.db.run('PRAGMA journal_mode = WAL');
          this.db.run('PRAGMA synchronous = NORMAL');
          this.db.run('PRAGMA cache_size = 10000');
          
          resolve();
        }
      });
    });
  }

  async createTables() {
    const createSpeedTestsTable = `
      CREATE TABLE IF NOT EXISTS speed_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        download_speed REAL NOT NULL,
        upload_speed REAL NOT NULL,
        ping REAL NOT NULL,
        jitter REAL,
        server_id INTEGER,
        server_name TEXT,
        server_host TEXT,
        server_country TEXT,
        server_cc TEXT,
        server_sponsor TEXT,
        server_distance REAL,
        bytes_sent INTEGER,
        bytes_received INTEGER,
        share_url TEXT,
        result_url TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        error_message TEXT,
        test_duration INTEGER,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createSettingsTable = `
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'string',
        description TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createApplicationLogsTable = `
      CREATE TABLE IF NOT EXISTS application_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        level TEXT NOT NULL,
        category TEXT,
        message TEXT NOT NULL,
        details TEXT,
        stack_trace TEXT,
        user_agent TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      await this.run(createSpeedTestsTable);
      await this.run(createSettingsTable);
      await this.run(createApplicationLogsTable);
      
      await this.createIndexes();
      await this.insertDefaultSettings();
      
      log.info('Database tables created successfully');
    } catch (error) {
      log.error('Failed to create database tables:', error);
      throw error;
    }
  }

  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_speed_tests_timestamp ON speed_tests(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_speed_tests_status ON speed_tests(status)',
      'CREATE INDEX IF NOT EXISTS idx_speed_tests_created_at ON speed_tests(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)',
      'CREATE INDEX IF NOT EXISTS idx_application_logs_timestamp ON application_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level)'
    ];

    for (const indexQuery of indexes) {
      await this.run(indexQuery);
    }
  }

  async insertDefaultSettings() {
    const defaultSettings = [
      { key: 'measurementInterval', value: '60', type: 'number', description: '測定間隔（分）' },
      { key: 'autoStartMeasurement', value: 'true', type: 'boolean', description: '自動測定開始' },
      { key: 'dataRetentionDays', value: '30', type: 'number', description: 'データ保持期間（日）' },
      { key: 'notifyOnCompletion', value: 'true', type: 'boolean', description: '測定完了時の通知' },
      { key: 'notifyOnError', value: 'true', type: 'boolean', description: 'エラー時の通知' },
      { key: 'minimizeOnClose', value: 'true', type: 'boolean', description: 'クローズ時にトレイに最小化' },
      { key: 'startWithWindows', value: 'false', type: 'boolean', description: 'Windows起動時に開始' },
      { key: 'enableDebugLogging', value: 'false', type: 'boolean', description: 'デバッグログ有効' },
      { key: 'firstRun', value: 'true', type: 'boolean', description: '初回起動フラグ' }
    ];

    for (const setting of defaultSettings) {
      try {
        await this.run(
          'INSERT OR IGNORE INTO settings (key, value, type, description) VALUES (?, ?, ?, ?)',
          [setting.key, setting.value, setting.type, setting.description]
        );
      } catch (error) {
        log.warn(`Failed to insert default setting ${setting.key}:`, error);
      }
    }
  }

  async performMigrations() {
    try {
      const version = await this.getDatabaseVersion();
      log.info(`Current database version: ${version}`);
      
      if (version < 1) {
        await this.migrateToVersion1();
      }
      
    } catch (error) {
      log.error('Database migration failed:', error);
      throw error;
    }
  }

  async getDatabaseVersion() {
    try {
      const result = await this.get('SELECT value FROM settings WHERE key = \'db_version\'');
      return result ? parseInt(result.value) : 0;
    } catch {
      // Database version not found, return default
      return 0;
    }
  }

  async setDatabaseVersion(version) {
    await this.run(
      'INSERT OR REPLACE INTO settings (key, value, type) VALUES (\'db_version\', ?, \'number\')',
      [version.toString()]
    );
  }

  async migrateToVersion1() {
    log.info('Migrating database to version 1');
    
    await this.setDatabaseVersion(1);
    log.info('Database migrated to version 1');
  }

  async insertSpeedTestResult(result) {
    const sql = `
      INSERT INTO speed_tests (
        timestamp, download_speed, upload_speed, ping, jitter,
        server_id, server_name, server_host, server_country, server_cc, server_sponsor, server_distance,
        bytes_sent, bytes_received, share_url, result_url, status, test_duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      new Date().toISOString(),
      result.download.bandwidth,
      result.upload.bandwidth,
      result.ping.latency,
      result.ping.jitter || null,
      result.server.id,
      result.server.name,
      result.server.host,
      result.server.country,
      result.server.cc,
      result.server.sponsor,
      result.server.distance || null,
      result.upload.bytes,
      result.download.bytes,
      result.result?.url || null,
      result.result?.url || null,
      'completed',
      result.testDuration || null
    ];

    try {
      const insertResult = await this.run(sql, params);
      log.info(`Speed test result inserted with ID: ${insertResult.lastID}`);
      return insertResult.lastID;
    } catch (error) {
      log.error('Failed to insert speed test result:', error);
      throw error;
    }
  }

  async insertSpeedTestError(error, _details = {}) {
    const sql = `
      INSERT INTO speed_tests (
        timestamp, download_speed, upload_speed, ping, 
        status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [
      new Date().toISOString(),
      0, 0, 0,
      'error',
      error.message
    ];

    try {
      const result = await this.run(sql, params);
      log.info(`Speed test error recorded with ID: ${result.lastID}`);
      return result.lastID;
    } catch (insertError) {
      log.error('Failed to insert speed test error:', insertError);
      throw insertError;
    }
  }

  async getSpeedTestHistory(options = {}) {
    const {
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      status = 'completed'
    } = options;

    let sql = `
      SELECT 
        id, timestamp, download_speed, upload_speed, ping, jitter,
        server_name, server_country, server_sponsor,
        status, error_message, test_duration
      FROM speed_tests 
      WHERE status = ?
    `;

    const params = [status];

    if (startDate) {
      sql += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND timestamp <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
      return await this.all(sql, params);
    } catch (error) {
      log.error('Failed to get speed test history:', error);
      throw error;
    }
  }

  async getSpeedTestStats(period = '24h') {
    const periodMap = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days'
    };

    const sql = `
      SELECT 
        COUNT(*) as total_tests,
        AVG(download_speed) as avg_download,
        AVG(upload_speed) as avg_upload,
        AVG(ping) as avg_ping,
        MIN(download_speed) as min_download,
        MAX(download_speed) as max_download,
        MIN(upload_speed) as min_upload,
        MAX(upload_speed) as max_upload,
        MIN(ping) as min_ping,
        MAX(ping) as max_ping
      FROM speed_tests 
      WHERE status = 'completed' 
        AND timestamp >= datetime('now', '-${periodMap[period]}')
    `;

    try {
      return await this.get(sql);
    } catch (error) {
      log.error('Failed to get speed test stats:', error);
      throw error;
    }
  }

  async exportToCSV(filePath, options = {}) {
    const { startDate, endDate } = options;
    
    let sql = `
      SELECT 
        timestamp, download_speed, upload_speed, ping, jitter,
        server_name, server_country, server_sponsor, status, error_message
      FROM speed_tests
    `;

    const params = [];

    if (startDate || endDate) {
      const conditions = [];
      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(endDate);
      }
      sql += ` WHERE ${  conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY timestamp DESC';

    try {
      const results = await this.all(sql, params);
      
      const csvHeader = 'Timestamp,Download Speed (bps),Upload Speed (bps),Ping (ms),Jitter (ms),Server Name,Server Country,Server Sponsor,Status,Error Message\n';
      
      const csvRows = results.map(row => {
        return [
          row.timestamp,
          row.download_speed,
          row.upload_speed,
          row.ping,
          row.jitter || '',
          `"${row.server_name || ''}"`,
          `"${row.server_country || ''}"`,
          `"${row.server_sponsor || ''}"`,
          row.status,
          `"${row.error_message || ''}"`
        ].join(',');
      }).join('\n');

      const csvContent = csvHeader + csvRows;
      await fs.writeFile(filePath, csvContent, 'utf8');
      
      log.info(`Data exported to CSV: ${filePath}`);
      return { success: true, recordCount: results.length };
    } catch (error) {
      log.error('Failed to export data to CSV:', error);
      throw error;
    }
  }

  async cleanupOldData(retentionDays = 30) {
    const sql = `
      DELETE FROM speed_tests 
      WHERE timestamp < datetime('now', '-${retentionDays} days')
    `;

    try {
      const result = await this.run(sql);
      log.info(`Cleaned up ${result.changes} old speed test records`);
      return result.changes;
    } catch (error) {
      log.error('Failed to cleanup old data:', error);
      throw error;
    }
  }

  async insertApplicationLog(level, category, message, details = null) {
    const sql = `
      INSERT INTO application_logs (level, category, message, details)
      VALUES (?, ?, ?, ?)
    `;

    try {
      await this.run(sql, [level, category, message, details]);
    } catch (error) {
      console.error('Failed to insert application log:', error);
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(error) {
        if (error) {
          reject(error);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) => {
        if (error) {
          reject(error);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((error) => {
          if (error) {
            log.error('Error closing database:', error);
            reject(error);
          } else {
            log.info('Database connection closed');
            this.db = null;
            this.isInitialized = false;
            resolve();
          }
        });
      });
    }
  }

  isConnected() {
    return this.db !== null && this.isInitialized;
  }
}

module.exports = DatabaseService;