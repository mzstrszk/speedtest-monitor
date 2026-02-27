const log = require('electron-log');
const { dialog } = require('electron');

class ErrorHandler {
  constructor() {
    this.errorTypes = {
      NETWORK_ERROR: 'NETWORK_ERROR',
      DATABASE_ERROR: 'DATABASE_ERROR',
      MEASUREMENT_ERROR: 'MEASUREMENT_ERROR',
      CONFIG_ERROR: 'CONFIG_ERROR',
      UI_ERROR: 'UI_ERROR',
      PERMISSION_ERROR: 'PERMISSION_ERROR',
      SYSTEM_ERROR: 'SYSTEM_ERROR',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR'
    };

    this.errorCounts = {};
    this.lastErrors = new Map();
    this.recoveryAttempts = new Map();
    
    this.maxRecoveryAttempts = 3;
    this.cooldownPeriod = 5 * 60 * 1000; // 5分
    
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      this.handleCriticalError('Uncaught Exception', error);
    });

    process.on('unhandledRejection', (reason, _promise) => {
      this.handleCriticalError('Unhandled Promise Rejection', new Error(reason));
    });
  }

  categorizeError(error) {
    if (!error) return this.errorTypes.UNKNOWN_ERROR;

    const message = error.message ? error.message.toLowerCase() : '';
    const stack = error.stack ? error.stack.toLowerCase() : '';
    const code = error.code || '';

    if (message.includes('network') || message.includes('connection') || 
        message.includes('timeout') || message.includes('dns') ||
        code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
      return this.errorTypes.NETWORK_ERROR;
    }

    if (message.includes('database') || message.includes('sqlite') ||
        message.includes('sql') || code.startsWith('SQLITE_')) {
      return this.errorTypes.DATABASE_ERROR;
    }

    if (message.includes('speedtest') || message.includes('measurement') ||
        message.includes('bandwidth') || message.includes('ping')) {
      return this.errorTypes.MEASUREMENT_ERROR;
    }

    if (message.includes('config') || message.includes('settings') ||
        message.includes('invalid') && message.includes('value')) {
      return this.errorTypes.CONFIG_ERROR;
    }

    if (message.includes('permission') || message.includes('access') ||
        code === 'EACCES' || code === 'EPERM') {
      return this.errorTypes.PERMISSION_ERROR;
    }

    if (message.includes('window') || message.includes('renderer') ||
        message.includes('dom') || stack.includes('renderer')) {
      return this.errorTypes.UI_ERROR;
    }

    if (code === 'ENOSPC' || code === 'EMFILE' || code === 'ENFILE') {
      return this.errorTypes.SYSTEM_ERROR;
    }

    return this.errorTypes.UNKNOWN_ERROR;
  }

  handleError(error, context = '', options = {}) {
    try {
      const errorType = this.categorizeError(error);
      const errorKey = `${errorType}:${context}`;
      
      this.incrementErrorCount(errorType);
      
      const errorData = {
        type: errorType,
        message: error.message || 'Unknown error',
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        code: error.code,
        ...options
      };

      log.error(`${errorType} in ${context}:`, error);

      if (this.shouldAttemptRecovery(errorKey, errorType)) {
        this.attemptRecovery(error, errorType, context);
      }

      if (options.showDialog && !this.isInCooldown(errorKey)) {
        this.showErrorDialog(error, errorType, context);
        this.lastErrors.set(errorKey, Date.now());
      }

      if (options.notify && this.notificationService) {
        this.notificationService.showApplicationError(error);
      }

      return errorData;
    } catch (handlerError) {
      log.error('Error in error handler:', handlerError);
    }
  }

  handleCriticalError(title, error) {
    log.error(`Critical Error - ${title}:`, error);
    
    try {
      dialog.showErrorBox(
        `Critical Error: ${title}`,
        `A critical error occurred:\n\n${error.message}\n\nThe application may become unstable. Please restart the application.`
      );
    } catch (dialogError) {
      console.error('Failed to show critical error dialog:', dialogError);
    }
  }

  shouldAttemptRecovery(errorKey, errorType) {
    const attemptCount = this.recoveryAttempts.get(errorKey) || 0;
    
    if (attemptCount >= this.maxRecoveryAttempts) {
      return false;
    }

    return [
      this.errorTypes.NETWORK_ERROR,
      this.errorTypes.DATABASE_ERROR,
      this.errorTypes.MEASUREMENT_ERROR
    ].includes(errorType);
  }

  async attemptRecovery(error, errorType, context) {
    const errorKey = `${errorType}:${context}`;
    const attemptCount = (this.recoveryAttempts.get(errorKey) || 0) + 1;
    
    this.recoveryAttempts.set(errorKey, attemptCount);
    
    log.info(`Attempting recovery for ${errorType} (attempt ${attemptCount}/${this.maxRecoveryAttempts})`);

    try {
      switch (errorType) {
      case this.errorTypes.NETWORK_ERROR:
        await this.recoverFromNetworkError(error, context);
        break;
      case this.errorTypes.DATABASE_ERROR:
        await this.recoverFromDatabaseError(error, context);
        break;
      case this.errorTypes.MEASUREMENT_ERROR:
        await this.recoverFromMeasurementError(error, context);
        break;
      default:
        log.warn(`No recovery strategy for error type: ${errorType}`);
      }
      
      log.info(`Recovery successful for ${errorType}`);
      this.recoveryAttempts.delete(errorKey);
      
    } catch (recoveryError) {
      log.error(`Recovery failed for ${errorType}:`, recoveryError);
      
      if (attemptCount >= this.maxRecoveryAttempts) {
        log.error(`Max recovery attempts reached for ${errorType}`);
        this.onMaxRecoveryAttemptsReached(errorType, context);
      }
    }
  }

  async recoverFromNetworkError(error, context) {
    log.info('Attempting network error recovery...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const { net } = require('electron');
    const isOnline = net.isOnline();
    
    if (!isOnline) {
      throw new Error('Network is still unavailable');
    }
    
    if (context.includes('speedtest') && this.speedTestService) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async recoverFromDatabaseError(_error, _context) {
    log.info('Attempting database error recovery...');
    
    if (this.databaseService) {
      try {
        if (!this.databaseService.isConnected()) {
          await this.databaseService.initialize();
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const testQuery = await this.databaseService.get('SELECT 1 as test');
        if (!testQuery) {
          throw new Error('Database test query failed');
        }
      } catch (dbError) {
        log.error('Database recovery failed:', dbError);
        throw dbError;
      }
    }
  }

  async recoverFromMeasurementError(error, _context) {
    log.info('Attempting measurement error recovery...');
    
    if (error.message.includes('server')) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  onMaxRecoveryAttemptsReached(errorType, context) {
    const message = this.getRecoveryFailureMessage(errorType);
    
    log.error(`Recovery failed permanently for ${errorType} in ${context}`);
    
    if (this.notificationService) {
      this.notificationService.show(
        'error',
        '回復失敗',
        message,
        { urgency: 'critical' }
      );
    }

    setTimeout(() => {
      this.recoveryAttempts.delete(`${errorType}:${context}`);
    }, this.cooldownPeriod);
  }

  getRecoveryFailureMessage(errorType) {
    const messages = {
      [this.errorTypes.NETWORK_ERROR]: 'ネットワーク接続の問題が継続しています。インターネット接続を確認してください。',
      [this.errorTypes.DATABASE_ERROR]: 'データベースの問題が解決できません。アプリケーションの再起動を試してください。',
      [this.errorTypes.MEASUREMENT_ERROR]: '速度測定の問題が継続しています。しばらく待ってから再試行してください。',
      [this.errorTypes.CONFIG_ERROR]: '設定に問題があります。設定を確認してください。',
      [this.errorTypes.PERMISSION_ERROR]: 'アクセス許可の問題があります。管理者として実行してください。',
      [this.errorTypes.SYSTEM_ERROR]: 'システムリソースの問題があります。システムを確認してください。'
    };
    
    return messages[errorType] || '不明な問題が発生しました。アプリケーションの再起動を試してください。';
  }

  showErrorDialog(error, errorType, context) {
    const title = this.getErrorTitle(errorType);
    const message = this.getErrorMessage(error, errorType, context);
    
    dialog.showErrorBox(title, message);
  }

  getErrorTitle(errorType) {
    const titles = {
      [this.errorTypes.NETWORK_ERROR]: 'ネットワークエラー',
      [this.errorTypes.DATABASE_ERROR]: 'データベースエラー',
      [this.errorTypes.MEASUREMENT_ERROR]: '測定エラー',
      [this.errorTypes.CONFIG_ERROR]: '設定エラー',
      [this.errorTypes.UI_ERROR]: 'UIエラー',
      [this.errorTypes.PERMISSION_ERROR]: '権限エラー',
      [this.errorTypes.SYSTEM_ERROR]: 'システムエラー'
    };
    
    return titles[errorType] || 'エラー';
  }

  getErrorMessage(error, errorType, context) {
    const baseMessage = error.message || '不明なエラーが発生しました。';
    const suggestion = this.getErrorSuggestion(errorType);
    
    return `${baseMessage}\n\nコンテキスト: ${context}\n\n${suggestion}`;
  }

  getErrorSuggestion(errorType) {
    const suggestions = {
      [this.errorTypes.NETWORK_ERROR]: '• インターネット接続を確認してください\n• ファイアウォール設定を確認してください\n• しばらく待ってから再試行してください',
      [this.errorTypes.DATABASE_ERROR]: '• アプリケーションを再起動してください\n• ディスク容量を確認してください\n• データベースファイルの権限を確認してください',
      [this.errorTypes.MEASUREMENT_ERROR]: '• しばらく待ってから再試行してください\n• 別の測定サーバーを試してください\n• ネットワーク接続を確認してください',
      [this.errorTypes.CONFIG_ERROR]: '• 設定を初期値に戻してください\n• 設定ファイルが破損していないか確認してください',
      [this.errorTypes.PERMISSION_ERROR]: '• 管理者として実行してください\n• ファイル・フォルダの権限を確認してください',
      [this.errorTypes.SYSTEM_ERROR]: '• システムリソースを確認してください\n• 不要なアプリケーションを終了してください\n• システムを再起動してください'
    };
    
    return suggestions[errorType] || 'アプリケーションを再起動してください。';
  }

  incrementErrorCount(errorType) {
    this.errorCounts[errorType] = (this.errorCounts[errorType] || 0) + 1;
  }

  isInCooldown(errorKey) {
    const lastErrorTime = this.lastErrors.get(errorKey);
    if (!lastErrorTime) return false;
    
    return (Date.now() - lastErrorTime) < this.cooldownPeriod;
  }

  getErrorStatistics() {
    return {
      totalErrors: Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0),
      errorsByType: { ...this.errorCounts },
      activeRecoveries: this.recoveryAttempts.size,
      errorsInCooldown: this.lastErrors.size
    };
  }

  resetErrorCounts() {
    this.errorCounts = {};
    this.lastErrors.clear();
    this.recoveryAttempts.clear();
    log.info('Error statistics reset');
  }

  setServices(services) {
    this.databaseService = services.database;
    this.speedTestService = services.speedtest;
    this.notificationService = services.notification;
  }

  createErrorReport() {
    const stats = this.getErrorStatistics();
    const systemInfo = process.versions;
    
    return {
      timestamp: new Date().toISOString(),
      statistics: stats,
      systemInfo,
      recentErrors: Array.from(this.lastErrors.entries()).map(([key, timestamp]) => ({
        key,
        timestamp: new Date(timestamp).toISOString()
      }))
    };
  }
}

module.exports = new ErrorHandler();