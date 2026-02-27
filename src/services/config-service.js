const Store = require('electron-store');
const { app } = require('electron');
const log = require('electron-log');
const EventEmitter = require('events');

class ConfigService extends EventEmitter {
  constructor() {
    super();
    
    this.store = null;
    this.isInitialized = false;
    
    this.schema = {
      measurementInterval: {
        type: 'number',
        default: 60,
        minimum: 5,
        maximum: 1440
      },
      autoStartMeasurement: {
        type: 'boolean',
        default: true
      },
      dataRetentionDays: {
        type: 'number',
        default: 30,
        minimum: 1,
        maximum: 365
      },
      notifyOnCompletion: {
        type: 'boolean',
        default: true
      },
      notifyOnError: {
        type: 'boolean',
        default: true
      },
      minimizeOnClose: {
        type: 'boolean',
        default: true
      },
      showDashboardOnStartup: {
        type: 'boolean',
        default: false
      },
      startWithWindows: {
        type: 'boolean',
        default: false
      },
      enableDebugLogging: {
        type: 'boolean',
        default: false
      },
      firstRun: {
        type: 'boolean',
        default: true
      },
      windowBounds: {
        type: 'object',
        default: {
          width: 1000,
          height: 700,
          x: null,
          y: null
        }
      },
      theme: {
        type: 'string',
        default: 'light',
        enum: ['light', 'dark', 'system']
      },
      language: {
        type: 'string',
        default: 'ja',
        enum: ['ja', 'en']
      },
      speedTestServer: {
        type: 'object',
        default: {
          auto: true,
          serverId: null,
          serverHost: null
        }
      },
      exportSettings: {
        type: 'object',
        default: {
          includeErrorRecords: false,
          dateFormat: 'YYYY-MM-DD HH:mm:ss',
          csvSeparator: ','
        }
      },
      alertThresholds: {
        type: 'object',
        default: {
          enabled: false,
          minDownloadSpeed: 50, // Mbps
          minUploadSpeed: 10,   // Mbps
          maxPing: 100         // ms
        }
      },
      schedulerSettings: {
        type: 'object',
        default: {
          enabled: true,
          intervalMinutes: 60,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00'
        }
      }
    };

    this.defaultConfig = this.extractDefaults(this.schema);
  }

  async initialize() {
    try {
      this.store = new Store({
        name: 'speedtest-monitor-config',
        cwd: app.getPath('userData'),
        schema: this.schema,
        defaults: this.defaultConfig,
        clearInvalidConfig: true,
        serialize: this.serialize.bind(this),
        deserialize: this.deserialize.bind(this)
      });

      await this.validateConfiguration();
      this.isInitialized = true;
      await this.performMigrations();
      
      this.setupConfigWatcher();
      
      log.info('ConfigService initialized successfully');
    } catch (error) {
      log.error('Failed to initialize ConfigService:', error);
      throw new Error(`設定サービスの初期化に失敗しました: ${error.message}`);
    }
  }

  extractDefaults(schema) {
    const defaults = {};
    for (const [key, config] of Object.entries(schema)) {
      defaults[key] = config.default;
    }
    return defaults;
  }

  setupConfigWatcher() {
    this.store.onDidChange('measurementInterval', (newValue, oldValue) => {
      log.info(`Measurement interval changed: ${oldValue} -> ${newValue}`);
      this.emit('configChanged', 'measurementInterval', newValue, oldValue);
    });

    this.store.onDidChange('autoStartMeasurement', (newValue, oldValue) => {
      log.info(`Auto start measurement changed: ${oldValue} -> ${newValue}`);
      this.emit('configChanged', 'autoStartMeasurement', newValue, oldValue);
    });

    this.store.onDidChange('dataRetentionDays', (newValue, oldValue) => {
      log.info(`Data retention days changed: ${oldValue} -> ${newValue}`);
      this.emit('configChanged', 'dataRetentionDays', newValue, oldValue);
    });

    this.store.onDidChange('enableDebugLogging', (newValue, oldValue) => {
      log.info(`Debug logging changed: ${oldValue} -> ${newValue}`);
      this.emit('configChanged', 'enableDebugLogging', newValue, oldValue);
      this.updateLoggingLevel(newValue);
    });

    this.store.onDidChange('schedulerSettings', (newValue, oldValue) => {
      log.info('Scheduler settings changed');
      this.emit('configChanged', 'schedulerSettings', newValue, oldValue);
    });
  }

  updateLoggingLevel(enableDebug) {
    if (enableDebug) {
      log.transports.file.level = 'debug';
      log.transports.console.level = 'debug';
    } else {
      log.transports.file.level = 'info';
      log.transports.console.level = 'info';
    }
  }

  async validateConfiguration() {
    try {
      const currentConfig = this.store.store;
      
      for (const [key, value] of Object.entries(currentConfig)) {
        if (this.schema[key]) {
          const isValid = this.validateValue(key, value);
          if (!isValid) {
            log.warn(`Invalid configuration value for ${key}: ${value}, resetting to default`);
            this.store.set(key, this.schema[key].default);
          }
        }
      }
      
      log.info('Configuration validation completed');
    } catch (error) {
      log.error('Configuration validation failed:', error);
      throw error;
    }
  }

  validateValue(key, value) {
    const schemaConfig = this.schema[key];
    if (!schemaConfig) return false;

    switch (schemaConfig.type) {
    case 'number':
      if (typeof value !== 'number') return false;
      if (schemaConfig.minimum !== undefined && value < schemaConfig.minimum) return false;
      if (schemaConfig.maximum !== undefined && value > schemaConfig.maximum) return false;
      break;
        
    case 'boolean':
      if (typeof value !== 'boolean') return false;
      break;
        
    case 'string':
      if (typeof value !== 'string') return false;
      if (schemaConfig.enum && !schemaConfig.enum.includes(value)) return false;
      break;
        
    case 'object':
      if (typeof value !== 'object' || value === null) return false;
      break;
        
    default:
      return false;
    }

    return true;
  }

  async performMigrations() {
    try {
      const configVersion = this.get('configVersion', 1);
      
      if (configVersion < 2) {
        await this.migrateToVersion2();
      }
      
      log.info(`Configuration migrations completed, version: ${configVersion}`);
    } catch (error) {
      log.error('Configuration migration failed:', error);
      throw error;
    }
  }

  async migrateToVersion2() {
    log.info('Migrating configuration to version 2');
    
    const oldIntervalSetting = this.get('interval', null);
    if (oldIntervalSetting !== null) {
      this.set('measurementInterval', oldIntervalSetting);
      this.delete('interval');
    }
    
    this.set('configVersion', 2);
    log.info('Configuration migrated to version 2');
  }

  get(key, defaultValue = undefined) {
    try {
      if (!this.isInitialized) {
        log.warn('ConfigService not initialized, returning default value');
        return defaultValue !== undefined ? defaultValue : this.defaultConfig[key];
      }

      const value = this.store.get(key, defaultValue);
      
      if (value === undefined && defaultValue === undefined && this.schema[key]) {
        return this.schema[key].default;
      }
      
      return value;
    } catch (error) {
      log.error(`Failed to get config value for ${key}:`, error);
      return defaultValue !== undefined ? defaultValue : this.defaultConfig[key];
    }
  }

  set(key, value) {
    try {
      if (!this.isInitialized) {
        throw new Error('ConfigService not initialized');
      }

      if (this.schema[key] && !this.validateValue(key, value)) {
        throw new Error(`Invalid value for configuration key ${key}: ${value}`);
      }

      const oldValue = this.get(key);
      this.store.set(key, value);
      
      log.info(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
      this.emit('configChanged', key, value, oldValue);
      
      return true;
    } catch (error) {
      log.error(`Failed to set config value for ${key}:`, error);
      throw error;
    }
  }

  has(key) {
    try {
      return this.isInitialized && this.store.has(key);
    } catch (error) {
      log.error(`Failed to check config key ${key}:`, error);
      return false;
    }
  }

  delete(key) {
    try {
      if (!this.isInitialized) {
        throw new Error('ConfigService not initialized');
      }

      this.store.delete(key);
      log.info(`Configuration deleted: ${key}`);
      
      return true;
    } catch (error) {
      log.error(`Failed to delete config key ${key}:`, error);
      throw error;
    }
  }

  getAll() {
    try {
      if (!this.isInitialized) {
        return this.defaultConfig;
      }

      return { ...this.store.store };
    } catch (error) {
      log.error('Failed to get all configuration:', error);
      return this.defaultConfig;
    }
  }

  setMultiple(configObject) {
    try {
      if (!this.isInitialized) {
        throw new Error('ConfigService not initialized');
      }

      const validatedConfig = {};
      const errors = [];

      for (const [key, value] of Object.entries(configObject)) {
        if (this.schema[key]) {
          if (this.validateValue(key, value)) {
            validatedConfig[key] = value;
          } else {
            errors.push(`Invalid value for ${key}: ${value}`);
          }
        } else {
          log.warn(`Unknown configuration key: ${key}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Configuration validation errors: ${errors.join(', ')}`);
      }

      for (const [key, value] of Object.entries(validatedConfig)) {
        this.store.set(key, value);
      }

      log.info(`Multiple configuration values updated: ${Object.keys(validatedConfig).join(', ')}`);
      this.emit('multipleConfigChanged', validatedConfig);
      
      return true;
    } catch (error) {
      log.error('Failed to set multiple config values:', error);
      throw error;
    }
  }

  reset(key = null) {
    try {
      if (!this.isInitialized) {
        throw new Error('ConfigService not initialized');
      }

      if (key) {
        if (this.schema[key]) {
          this.set(key, this.schema[key].default);
          log.info(`Configuration reset to default: ${key}`);
        } else {
          throw new Error(`Unknown configuration key: ${key}`);
        }
      } else {
        this.store.clear();
        for (const [configKey, config] of Object.entries(this.schema)) {
          this.store.set(configKey, config.default);
        }
        log.info('All configuration reset to defaults');
        this.emit('configReset');
      }
      
      return true;
    } catch (error) {
      log.error(`Failed to reset configuration${key ? ` for ${  key}` : ''}:`, error);
      throw error;
    }
  }

  exportConfig() {
    try {
      const config = this.getAll();
      const exportData = {
        version: this.get('configVersion', 1),
        timestamp: new Date().toISOString(),
        config
      };
      
      log.info('Configuration exported');
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      log.error('Failed to export configuration:', error);
      throw error;
    }
  }

  importConfig(configJson) {
    try {
      if (!this.isInitialized) {
        throw new Error('ConfigService not initialized');
      }

      const importData = JSON.parse(configJson);
      
      if (!importData.config) {
        throw new Error('Invalid configuration format');
      }

      const validatedConfig = {};
      const errors = [];

      for (const [key, value] of Object.entries(importData.config)) {
        if (this.schema[key]) {
          if (this.validateValue(key, value)) {
            validatedConfig[key] = value;
          } else {
            errors.push(`Invalid value for ${key}`);
          }
        }
      }

      if (errors.length > 0) {
        log.warn(`Configuration import warnings: ${errors.join(', ')}`);
      }

      this.setMultiple(validatedConfig);
      
      log.info('Configuration imported successfully');
      return { success: true, imported: Object.keys(validatedConfig).length, errors };
    } catch (error) {
      log.error('Failed to import configuration:', error);
      throw error;
    }
  }

  getConfigPath() {
    return this.store ? this.store.path : null;
  }

  serialize(object) {
    return JSON.stringify(object, null, 2);
  }

  deserialize(string) {
    return JSON.parse(string);
  }

  onConfigChange(callback) {
    this.on('configChanged', callback);
  }

  offConfigChange(callback) {
    this.off('configChanged', callback);
  }

  isReady() {
    return this.isInitialized;
  }
}

module.exports = ConfigService;