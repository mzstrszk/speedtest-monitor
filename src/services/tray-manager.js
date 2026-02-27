const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');

class TrayManager {
  constructor(windowManager, services) {
    this.windowManager = windowManager;
    this.services = services;
    
    this.tray = null;
    this.contextMenu = null;
    
    this.isTestRunning = false;
    this.schedulerRunning = false;
    
    this.trayIcons = {
      idle: this.createTrayIcon('idle'),
      active: this.createTrayIcon('active'),
      error: this.createTrayIcon('error')
    };
  }

  async initialize() {
    try {
      await this.createTray();
      await this.setupEventListeners();
      
      log.info('TrayManager initialized successfully');
    } catch (error) {
      log.error('Failed to initialize TrayManager:', error);
      throw error;
    }
  }

  createTrayIcon(state) {
    try {
      let iconPath;
      
      switch (state) {
      case 'active':
        iconPath = path.join(__dirname, '../../assets/icons/tray-active.png');
        break;
      case 'error':
        iconPath = path.join(__dirname, '../../assets/icons/tray-error.png');
        break;
      case 'idle':
      default:
        iconPath = path.join(__dirname, '../../assets/icons/tray-idle.png');
        break;
      }

      if (require('fs').existsSync(iconPath)) {
        return nativeImage.createFromPath(iconPath);
      } else {
        return nativeImage.createEmpty();
      }
    } catch (error) {
      log.warn(`Failed to load tray icon for state ${state}:`, error);
      return nativeImage.createEmpty();
    }
  }

  async createTray() {
    try {
      this.tray = new Tray(this.trayIcons.idle);
      
      this.tray.setToolTip('SpeedTest Monitor');
      
      this.updateContextMenu();
      
      this.tray.on('click', () => {
        this.onTrayClick();
      });

      this.tray.on('right-click', () => {
        this.onTrayRightClick();
      });

      this.tray.on('double-click', () => {
        this.onTrayDoubleClick();
      });

      log.info('System tray created');
    } catch (error) {
      log.error('Failed to create system tray:', error);
      throw error;
    }
  }

  async setupEventListeners() {
    if (this.services.speedtest) {
      this.services.speedtest.onTestStarted(() => {
        this.isTestRunning = true;
        this.updateTrayIcon();
        this.updateContextMenu();
      });

      this.services.speedtest.onTestCompleted((result) => {
        this.isTestRunning = false;
        this.updateTrayIcon();
        this.updateContextMenu();
        this.showTestCompletedBalloon(result);
      });

      this.services.speedtest.onTestError((error) => {
        this.isTestRunning = false;
        this.updateTrayIcon('error');
        this.updateContextMenu();
        this.showTestErrorBalloon(error);
      });
    }

    if (this.services.scheduler) {
      this.services.scheduler.onStarted(() => {
        this.schedulerRunning = true;
        this.updateTrayIcon();
        this.updateContextMenu();
        this.updateTooltip();
      });

      this.services.scheduler.onStopped(() => {
        this.schedulerRunning = false;
        this.updateTrayIcon();
        this.updateContextMenu();
        this.updateTooltip();
      });
    }

    if (this.services.config) {
      this.services.config.onConfigChange((key, _newValue, _oldValue) => {
        if (key === 'notifyOnCompletion' || key === 'notifyOnError') {
          this.updateContextMenu();
        }
      });
    }
  }

  onTrayClick() {
    if (this.windowManager.isWindowVisible('dashboard')) {
      this.windowManager.hideAllWindows();
    } else {
      this.windowManager.showDashboardWindow();
    }
  }

  onTrayRightClick() {
    if (this.tray && this.contextMenu) {
      this.tray.popUpContextMenu(this.contextMenu);
    }
  }

  onTrayDoubleClick() {
    this.windowManager.showDashboardWindow();
  }

  updateTrayIcon(forceState = null) {
    if (!this.tray) return;

    let iconState = 'idle';
    
    if (forceState) {
      iconState = forceState;
    } else if (this.isTestRunning) {
      iconState = 'active';
    } else if (this.schedulerRunning) {
      iconState = 'idle';
    }

    try {
      this.tray.setImage(this.trayIcons[iconState]);
    } catch (error) {
      log.warn('Failed to update tray icon:', error);
    }
  }

  updateTooltip() {
    if (!this.tray) return;

    let tooltip = 'SpeedTest Monitor';
    
    if (this.isTestRunning) {
      tooltip += ' - 測定中';
    } else if (this.schedulerRunning) {
      tooltip += ' - 自動測定実行中';
    } else {
      tooltip += ' - 待機中';
    }

    this.tray.setToolTip(tooltip);
  }

  async updateContextMenu() {
    try {
      const template = await this.buildContextMenuTemplate();
      this.contextMenu = Menu.buildFromTemplate(template);
      
      if (this.tray) {
        this.tray.setContextMenu(this.contextMenu);
      }
    } catch (error) {
      log.error('Failed to update context menu:', error);
    }
  }

  async buildContextMenuTemplate() {
    const _schedulerStatus = this.services.scheduler ? 
      await this.services.scheduler.getStatus().catch(() => ({ isRunning: false })) : 
      { isRunning: false };

    return [
      {
        label: 'SpeedTest Monitor',
        icon: this.trayIcons.idle.resize({ width: 16, height: 16 }),
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'ダッシュボードを表示',
        click: () => {
          this.windowManager.showDashboardWindow();
        }
      },
      {
        label: '設定',
        click: () => {
          this.windowManager.showSettingsWindow();
        }
      },
      { type: 'separator' },
      {
        label: '手動測定実行',
        enabled: !this.isTestRunning,
        click: async () => {
          await this.runManualTest();
        }
      },
      {
        label: this.schedulerRunning ? '自動測定を停止' : '自動測定を開始',
        click: async () => {
          await this.toggleScheduler();
        }
      },
      { type: 'separator' },
      {
        label: '最新の測定結果',
        submenu: await this.buildRecentResultsSubmenu()
      },
      { type: 'separator' },
      {
        label: 'データエクスポート',
        click: async () => {
          await this.exportData();
        }
      },
      {
        label: 'ログを開く',
        click: () => {
          const { shell } = require('electron');
          const logPath = log.transports.file.getFile().path;
          shell.showItemInFolder(logPath);
        }
      },
      { type: 'separator' },
      {
        label: 'SpeedTest Monitor について',
        click: () => {
          this.showAboutDialog();
        }
      },
      {
        label: '終了',
        click: () => {
          this.quitApplication();
        }
      }
    ];
  }

  async buildRecentResultsSubmenu() {
    try {
      if (!this.services.database || !this.services.database.isConnected()) {
        return [
          {
            label: 'データベースに接続されていません',
            enabled: false
          }
        ];
      }

      const recentResults = await this.services.database.getSpeedTestHistory({ limit: 5 });
      
      if (!recentResults || recentResults.length === 0) {
        return [
          {
            label: '測定データがありません',
            enabled: false
          }
        ];
      }

      return recentResults.map(result => {
        const time = new Date(result.timestamp).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const downloadMbps = Math.round(result.download_speed / 1000000 * 100) / 100;
        const uploadMbps = Math.round(result.upload_speed / 1000000 * 100) / 100;
        
        return {
          label: `${time} - ↓${downloadMbps}Mbps ↑${uploadMbps}Mbps`,
          enabled: false
        };
      });
    } catch (error) {
      log.error('Failed to build recent results submenu:', error);
      return [
        {
          label: 'データの取得に失敗しました',
          enabled: false
        }
      ];
    }
  }

  async runManualTest() {
    if (this.isTestRunning) {
      this.showBalloon('測定中', '測定が既に実行中です。', 'info');
      return;
    }

    try {
      this.showBalloon('測定開始', '速度測定を開始しました。', 'info');
      
      if (this.services.speedtest) {
        await this.services.speedtest.runTest();
      }
    } catch (error) {
      log.error('Manual test from tray failed:', error);
      this.showBalloon('測定エラー', `測定に失敗しました: ${error.message}`, 'error');
    }
  }

  async toggleScheduler() {
    try {
      if (this.schedulerRunning) {
        await this.services.scheduler.stop();
        this.showBalloon('自動測定停止', '自動測定を停止しました。', 'info');
      } else {
        await this.services.scheduler.start();
        this.showBalloon('自動測定開始', '自動測定を開始しました。', 'info');
      }
    } catch (error) {
      log.error('Failed to toggle scheduler from tray:', error);
      this.showBalloon('エラー', `操作に失敗しました: ${error.message}`, 'error');
    }
  }

  async exportData() {
    try {
      const { dialog } = require('electron');
      
      const result = await dialog.showSaveDialog(null, {
        title: 'データエクスポート',
        defaultPath: `speedtest-data-${new Date().toISOString().split('T')[0]}.csv`,
        filters: [
          { name: 'CSV files', extensions: ['csv'] },
          { name: 'All files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && this.services.database) {
        await this.services.database.exportToCSV(result.filePath, {});
        this.showBalloon('エクスポート完了', 'データを正常にエクスポートしました。', 'info');
      }
    } catch (error) {
      log.error('Export from tray failed:', error);
      this.showBalloon('エクスポートエラー', `エクスポートに失敗しました: ${error.message}`, 'error');
    }
  }

  showAboutDialog() {
    const { dialog, app } = require('electron');
    
    dialog.showMessageBox(null, {
      type: 'info',
      title: 'SpeedTest Monitor について',
      message: 'SpeedTest Monitor',
      detail: `バージョン: ${app.getVersion()}\n\nインターネット速度測定とモニタリングアプリケーション\n\n© 2024 SpeedTest Monitor Team`,
      buttons: ['OK']
    });
  }

  quitApplication() {
    const { dialog } = require('electron');
    
    const response = dialog.showMessageBoxSync(null, {
      type: 'question',
      title: 'アプリケーション終了',
      message: 'SpeedTest Monitor を終了しますか？',
      detail: '自動測定も停止されます。',
      buttons: ['終了', 'キャンセル'],
      defaultId: 1,
      cancelId: 1
    });

    if (response === 0) {
      const { app } = require('electron');
      app.quit();
    }
  }

  showTestCompletedBalloon(result) {
    try {
      const shouldNotify = this.services.config ? 
        this.services.config.get('notifyOnCompletion', true) : true;
      
      if (!shouldNotify) return;

      const downloadMbps = Math.round(result.download.bandwidth / 1000000 * 100) / 100;
      const uploadMbps = Math.round(result.upload.bandwidth / 1000000 * 100) / 100;
      
      this.showBalloon(
        '測定完了',
        `ダウンロード: ${downloadMbps} Mbps\nアップロード: ${uploadMbps} Mbps\nPing: ${result.ping.latency.toFixed(1)} ms`,
        'info'
      );
    } catch (error) {
      log.error('Failed to show test completed balloon:', error);
    }
  }

  showTestErrorBalloon(error) {
    try {
      const shouldNotify = this.services.config ? 
        this.services.config.get('notifyOnError', true) : true;
      
      if (!shouldNotify) return;

      this.showBalloon(
        '測定エラー',
        `測定に失敗しました: ${error.message}`,
        'error'
      );
    } catch (balloonError) {
      log.error('Failed to show test error balloon:', balloonError);
    }
  }

  showBalloon(title, content, type = 'info') {
    if (!this.tray) return;

    try {
      this.tray.displayBalloon({
        title,
        content,
        icon: type === 'error' ? this.trayIcons.error : this.trayIcons.idle,
        respectQuietTime: true,
        wait: false
      });
    } catch (error) {
      log.warn('Failed to show balloon notification:', error);
    }
  }

  updateSchedulerRunning(isRunning) {
    this.schedulerRunning = isRunning;
    this.updateTrayIcon();
    this.updateTooltip();
    this.updateContextMenu();
  }

  updateTestRunning(isRunning) {
    this.isTestRunning = isRunning;
    this.updateTrayIcon();
    this.updateTooltip();
    this.updateContextMenu();
  }

  destroy() {
    try {
      if (this.tray) {
        this.tray.destroy();
        this.tray = null;
      }
      
      this.contextMenu = null;
      
      log.info('TrayManager destroyed');
    } catch (error) {
      log.error('Failed to destroy TrayManager:', error);
    }
  }

  isTraySupported() {
    return Tray.isSupported();
  }

  getTray() {
    return this.tray;
  }

  isDestroyed() {
    return this.tray === null || (this.tray && this.tray.isDestroyed());
  }
}

module.exports = TrayManager;