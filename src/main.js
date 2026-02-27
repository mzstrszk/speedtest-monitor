const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const isDev = process.env.NODE_ENV === 'development';

const WindowManager = require('./services/window-manager');
const TrayManager = require('./services/tray-manager');
const DatabaseService = require('./services/database-service');
const ConfigService = require('./services/config-service');
const SpeedTestService = require('./services/speedtest-service');
const SchedulerService = require('./services/scheduler-service');
const NotificationService = require('./services/notification-service');
const log = require('electron-log');

class SpeedTestMonitorApp {
  constructor() {
    this.isQuitting = false;
    this.services = {};
    
    this.windowManager = null;
    this.trayManager = null;
    
    this.setupLogging();
  }

  setupLogging() {
    log.transports.file.level = 'info';
    log.transports.file.maxSize = 5 * 1024 * 1024;
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
    
    if (isDev) {
      log.transports.console.level = 'debug';
    }
    
    process.on('uncaughtException', (error) => {
      log.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason) => {
      log.error('Unhandled Promise Rejection:', reason);
    });
  }

  async initialize() {
    try {
      log.info('SpeedTest Monitor starting up...');
      
      await this.initializeServices();
      await this.setupElectronEvents();
      await this.setupIPC();
      
      log.info('SpeedTest Monitor initialized successfully');
    } catch (error) {
      log.error('Failed to initialize application:', error);
      throw error;
    }
  }

  async initializeServices() {
    try {
      this.services.config = new ConfigService();
      this.services.database = new DatabaseService();
      this.services.speedtest = new SpeedTestService(this.services.database);
      this.services.scheduler = new SchedulerService(this.services.speedtest, this.services.config);
      this.services.notification = new NotificationService();
      
      await this.services.database.initialize();
      await this.services.config.initialize();
      
      this.windowManager = new WindowManager();
      this.trayManager = new TrayManager(this.windowManager, this.services);
      
      await this.trayManager.initialize();
      
      log.info('All services initialized successfully');
    } catch (error) {
      log.error('Failed to initialize services:', error);
      throw error;
    }
  }

  async setupElectronEvents() {
    app.whenReady().then(async () => {
      await this.onReady();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.windowManager.showSetupWindow();
      }
    });

    app.on('before-quit', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.quit();
      }
    });

    app.on('will-quit', async (event) => {
      event.preventDefault();
      await this.cleanup();
      app.exit(0);
    });
  }

  async onReady() {
    try {
      const isFirstRun = await this.services.config.get('firstRun', true);

      if (isFirstRun) {
        this.windowManager.showSetupWindow();
      } else {
        const autoStart = await this.services.config.get('autoStartMeasurement', true);
        if (autoStart) {
          await this.services.scheduler.start();
        }

        const showDashboard = await this.services.config.get('showDashboardOnStartup', false);
        if (showDashboard || isDev) {
          this.windowManager.showDashboardWindow();
        }
      }

      this.services.notification.show('info', 'SpeedTest Monitor が開始されました');
      log.info('Application ready and running');
    } catch (error) {
      log.error('Error during app ready:', error);
    }
  }

  async setupIPC() {
    ipcMain.handle('app:get-version', () => {
      return app.getVersion();
    });

    ipcMain.handle('config:get', async (event, key, defaultValue) => {
      return await this.services.config.get(key, defaultValue);
    });

    ipcMain.handle('config:set', async (event, key, value) => {
      return await this.services.config.set(key, value);
    });

    ipcMain.handle('config:get-all', async () => {
      return await this.services.config.getAll();
    });

    ipcMain.handle('speedtest:start', async () => {
      try {
        return await this.services.speedtest.runTest();
      } catch (error) {
        log.error('Manual speedtest failed:', error);
        throw error;
      }
    });

    ipcMain.handle('speedtest:get-history', async (event, options = {}) => {
      return await this.services.database.getSpeedTestHistory(options);
    });

    ipcMain.handle('speedtest:get-stats', async (event, period = '24h') => {
      return await this.services.database.getSpeedTestStats(period);
    });

    ipcMain.handle('speedtest:export', async (event, options) => {
      try {
        const result = await dialog.showSaveDialog(null, {
          title: 'データエクスポート',
          defaultPath: `speedtest-data-${new Date().toISOString().split('T')[0]}.csv`,
          filters: [
            { name: 'CSV files', extensions: ['csv'] },
            { name: 'All files', extensions: ['*'] }
          ]
        });

        if (!result.canceled) {
          await this.services.database.exportToCSV(result.filePath, options);
          return { success: true, path: result.filePath };
        }
        return { success: false, canceled: true };
      } catch (error) {
        log.error('Export failed:', error);
        throw error;
      }
    });

    ipcMain.handle('scheduler:start', async () => {
      return await this.services.scheduler.start();
    });

    ipcMain.handle('scheduler:stop', async () => {
      return await this.services.scheduler.stop();
    });

    ipcMain.handle('scheduler:get-status', async () => {
      return this.services.scheduler.getStatus();
    });

    ipcMain.handle('app:show-dashboard', () => {
      this.windowManager.showDashboardWindow();
    });

    ipcMain.handle('app:show-settings', () => {
      this.windowManager.showSettingsWindow();
    });

    ipcMain.handle('app:quit', () => {
      this.quit();
    });

    ipcMain.handle('app:minimize-to-tray', () => {
      this.windowManager.hideAllWindows();
    });

    ipcMain.handle('app:open-logs', () => {
      const logsPath = log.transports.file.getFile().path;
      shell.showItemInFolder(logsPath);
    });

    ipcMain.handle('setup:complete', async (event, settings) => {
      try {
        await this.services.config.set('firstRun', false);
        
        for (const [key, value] of Object.entries(settings)) {
          await this.services.config.set(key, value);
        }
        
        if (settings.autoStartMeasurement) {
          await this.services.scheduler.start();
        }
        
        this.windowManager.closeSetupWindow();
        
        log.info('Setup completed successfully');
        return { success: true };
      } catch (error) {
        log.error('Setup completion failed:', error);
        throw error;
      }
    });
  }

  async quit() {
    try {
      this.isQuitting = true;
      log.info('Application quitting...');
      
      await this.cleanup();
      app.quit();
    } catch (error) {
      log.error('Error during quit:', error);
      app.quit();
    }
  }

  async cleanup() {
    try {
      if (this.services.scheduler) {
        await this.services.scheduler.stop();
      }
      
      if (this.services.database) {
        await this.services.database.close();
      }
      
      if (this.trayManager) {
        this.trayManager.destroy();
      }
      
      log.info('Application cleanup completed');
    } catch (error) {
      log.error('Error during cleanup:', error);
    }
  }
}

const speedTestMonitorApp = new SpeedTestMonitorApp();

app.whenReady().then(async () => {
  try {
    await speedTestMonitorApp.initialize();
  } catch (error) {
    log.error('Failed to start application:', error);
    
    dialog.showErrorBox(
      'アプリケーション起動エラー',
      `SpeedTest Monitorの起動に失敗しました。\n\nエラー: ${  error.message}`
    );
    
    app.quit();
  }
});

if (isDev) {
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch('log-level', '0');
}

module.exports = SpeedTestMonitorApp;