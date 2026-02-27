const { Notification } = require('electron');
const path = require('path');
const log = require('electron-log');

class NotificationService {
  constructor() {
    this.isSupported = false;
    this.notificationQueue = [];
    this.isProcessingQueue = false;
    
    this.init();
  }

  init() {
    this.isSupported = Notification.isSupported();
    
    if (!this.isSupported) {
      log.warn('Notifications are not supported on this system');
      return;
    }

    log.info('NotificationService initialized successfully');
  }

  show(type, title, body = '', options = {}) {
    if (!this.isSupported) {
      log.warn('Cannot show notification - not supported');
      return false;
    }

    try {
      const notificationData = {
        type,
        title,
        body,
        options: {
          ...this.getDefaultOptions(type),
          ...options
        }
      };

      this.notificationQueue.push(notificationData);
      this.processQueue();
      
      return true;
    } catch (error) {
      log.error('Failed to queue notification:', error);
      return false;
    }
  }

  getDefaultOptions(type) {
    const baseOptions = {
      silent: false,
      urgency: 'normal',
      timeoutType: 'default'
    };

    switch (type) {
    case 'success':
      return {
        ...baseOptions,
        icon: this.getIconPath('success'),
        urgency: 'low'
      };
        
    case 'error':
      return {
        ...baseOptions,
        icon: this.getIconPath('error'),
        urgency: 'critical'
      };
        
    case 'warning':
      return {
        ...baseOptions,
        icon: this.getIconPath('warning'),
        urgency: 'normal'
      };
        
    case 'info':
    default:
      return {
        ...baseOptions,
        icon: this.getIconPath('info'),
        urgency: 'low'
      };
    }
  }

  getIconPath(type) {
    try {
      const iconFileName = `notification-${type}.png`;
      const iconPath = path.join(__dirname, '../../assets/icons', iconFileName);
      
      const fs = require('fs');
      if (fs.existsSync(iconPath)) {
        return iconPath;
      }
      
      const fallbackPath = path.join(__dirname, '../../assets/icons/app-icon.png');
      if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
      }
      
      return null;
    } catch (error) {
      log.warn(`Failed to get icon path for type ${type}:`, error);
      return null;
    }
  }

  async processQueue() {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.notificationQueue.length > 0) {
        const notificationData = this.notificationQueue.shift();
        await this.displayNotification(notificationData);
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      log.error('Error processing notification queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  displayNotification(notificationData) {
    return new Promise((resolve) => {
      try {
        const notification = new Notification({
          title: notificationData.title,
          body: notificationData.body,
          ...notificationData.options
        });

        notification.on('click', () => {
          log.info(`Notification clicked: ${notificationData.title}`);
          
          if (notificationData.options.onClick) {
            notificationData.options.onClick();
          } else {
            this.handleDefaultClick(notificationData.type);
          }
        });

        notification.on('close', () => {
          log.debug(`Notification closed: ${notificationData.title}`);
          resolve();
        });

        notification.on('show', () => {
          log.debug(`Notification shown: ${notificationData.title}`);
        });

        notification.on('failed', (error) => {
          log.error(`Notification failed: ${notificationData.title}`, error);
          resolve();
        });

        notification.show();
        
        setTimeout(() => {
          resolve();
        }, 5000);
        
      } catch (error) {
        log.error('Failed to display notification:', error);
        resolve();
      }
    });
  }

  handleDefaultClick(_type) {
    try {
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();

      if (windows.length > 0) {
        const mainWindow = windows.find(win => !win.isDestroyed());
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();
          mainWindow.show();
        }
      }
    } catch (error) {
      log.error('Failed to handle default notification click:', error);
    }
  }

  showSpeedTestStarted() {
    return this.show(
      'info',
      'SpeedTest Monitor',
      '速度測定を開始しました',
      {
        onClick: () => this.handleDefaultClick('info')
      }
    );
  }

  showSpeedTestCompleted(result) {
    try {
      const downloadMbps = Math.round(result.download.bandwidth / 1000000 * 100) / 100;
      const uploadMbps = Math.round(result.upload.bandwidth / 1000000 * 100) / 100;
      const ping = result.ping.latency.toFixed(1);
      
      const body = `ダウンロード: ${downloadMbps} Mbps\nアップロード: ${uploadMbps} Mbps\nPing: ${ping} ms`;
      
      return this.show(
        'success',
        '速度測定完了',
        body,
        {
          onClick: () => this.handleDefaultClick('success')
        }
      );
    } catch (error) {
      log.error('Failed to show speed test completed notification:', error);
      return this.show(
        'success',
        '速度測定完了',
        '測定が正常に完了しました'
      );
    }
  }

  showSpeedTestError(error) {
    const errorMessage = error.message || '不明なエラーが発生しました';
    
    return this.show(
      'error',
      '速度測定エラー',
      `測定に失敗しました: ${errorMessage}`,
      {
        onClick: () => this.handleDefaultClick('error')
      }
    );
  }

  showSchedulerStarted() {
    return this.show(
      'info',
      'SpeedTest Monitor',
      '自動測定を開始しました',
      {
        urgency: 'low'
      }
    );
  }

  showSchedulerStopped() {
    return this.show(
      'info',
      'SpeedTest Monitor',
      '自動測定を停止しました',
      {
        urgency: 'low'
      }
    );
  }

  showApplicationStarted() {
    return this.show(
      'info',
      'SpeedTest Monitor',
      'アプリケーションが開始されました',
      {
        urgency: 'low',
        silent: true
      }
    );
  }

  showApplicationError(error) {
    const errorMessage = error.message || '不明なエラーが発生しました';
    
    return this.show(
      'error',
      'アプリケーションエラー',
      errorMessage,
      {
        urgency: 'critical'
      }
    );
  }

  showDatabaseError(_error) {
    return this.show(
      'warning',
      'データベースエラー',
      'データベース操作でエラーが発生しました',
      {
        urgency: 'normal'
      }
    );
  }

  showConfigurationSaved() {
    return this.show(
      'success',
      '設定保存',
      '設定が正常に保存されました',
      {
        urgency: 'low',
        silent: true
      }
    );
  }

  showExportCompleted(filePath) {
    return this.show(
      'success',
      'エクスポート完了',
      `データを正常にエクスポートしました\n${filePath}`,
      {
        onClick: () => {
          try {
            const { shell } = require('electron');
            shell.showItemInFolder(filePath);
          } catch (error) {
            log.error('Failed to open export file location:', error);
          }
        }
      }
    );
  }

  showLowDiskSpace(availableSpace) {
    return this.show(
      'warning',
      'ディスク容量警告',
      `ディスク容量が不足しています (残り: ${availableSpace}MB)`,
      {
        urgency: 'normal'
      }
    );
  }

  showNetworkConnectivityIssue() {
    return this.show(
      'warning',
      'ネットワーク接続',
      'ネットワーク接続に問題がある可能性があります',
      {
        urgency: 'normal'
      }
    );
  }

  showMaintenanceMode() {
    return this.show(
      'info',
      'メンテナンスモード',
      'アプリケーションメンテナンスを実行中です',
      {
        urgency: 'low'
      }
    );
  }

  showDataRetentionCleanup(removedCount) {
    return this.show(
      'info',
      'データクリーンアップ',
      `${removedCount}件の古い測定データを削除しました`,
      {
        urgency: 'low',
        silent: true
      }
    );
  }

  showCustomNotification(title, body, type = 'info', customOptions = {}) {
    return this.show(type, title, body, customOptions);
  }

  async showInteractiveNotification(title, body, buttons = []) {
    if (!this.isSupported) {
      log.warn('Interactive notifications not supported');
      return null;
    }

    try {
      const notification = new Notification({
        title,
        body,
        actions: buttons.map(button => ({
          type: 'button',
          text: button.text
        })),
        ...this.getDefaultOptions('info')
      });

      return new Promise((resolve) => {
        notification.on('action', (event, index) => {
          const selectedButton = buttons[index];
          if (selectedButton && selectedButton.callback) {
            selectedButton.callback();
          }
          resolve(selectedButton);
        });

        notification.on('close', () => {
          resolve(null);
        });

        notification.show();
      });
    } catch (error) {
      log.error('Failed to show interactive notification:', error);
      return null;
    }
  }

  clearQueue() {
    this.notificationQueue = [];
    log.info('Notification queue cleared');
  }

  getQueueLength() {
    return this.notificationQueue.length;
  }

  isNotificationSupported() {
    return this.isSupported;
  }

  setQuietMode(enabled) {
    this.quietMode = enabled;
    log.info(`Quiet mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  isQuietMode() {
    return this.quietMode || false;
  }
}

module.exports = NotificationService;