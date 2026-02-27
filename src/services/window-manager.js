const { BrowserWindow, screen, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const log = require('electron-log');

class WindowManager {
  constructor() {
    this.windows = {
      setup: null,
      dashboard: null,
      settings: null
    };
    
    this.windowBounds = {
      setup: { width: 600, height: 800 },
      dashboard: { width: 1000, height: 850 },
      settings: { width: 600, height: 500 }
    };
  }

  createBaseWindow(options = {}) {
    const defaultOptions = {
      show: false,
      autoHideMenuBar: true,
      icon: path.join(__dirname, '../../assets/icons/app-icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../preload.js'),
        webSecurity: !isDev
      }
    };

    return { ...defaultOptions, ...options };
  }

  showSetupWindow() {
    if (this.windows.setup && !this.windows.setup.isDestroyed()) {
      this.windows.setup.focus();
      this.windows.setup.show();
      return this.windows.setup;
    }

    const bounds = this.windowBounds.setup;
    const centerBounds = this.getCenterBounds(bounds.width, bounds.height);

    this.windows.setup = new BrowserWindow(this.createBaseWindow({
      width: bounds.width,
      height: bounds.height,
      x: centerBounds.x,
      y: centerBounds.y,
      resizable: false,
      maximizable: false,
      minimizable: false,
      alwaysOnTop: true,
      skipTaskbar: false,
      title: 'SpeedTest Monitor - セットアップ'
    }));

    this.windows.setup.loadFile('src/renderer/pages/setup.html');

    this.windows.setup.once('ready-to-show', () => {
      this.windows.setup.show();
      
      if (isDev) {
        this.windows.setup.webContents.openDevTools();
      }
    });

    this.windows.setup.on('closed', () => {
      this.windows.setup = null;
      log.info('Setup window closed');
    });

    this.windows.setup.webContents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    });

    log.info('Setup window created');
    return this.windows.setup;
  }

  showDashboardWindow() {
    if (this.windows.dashboard && !this.windows.dashboard.isDestroyed()) {
      this.windows.dashboard.focus();
      this.windows.dashboard.show();
      return this.windows.dashboard;
    }

    const bounds = this.windowBounds.dashboard;
    const centerBounds = this.getCenterBounds(bounds.width, bounds.height);

    this.windows.dashboard = new BrowserWindow(this.createBaseWindow({
      width: bounds.width,
      height: bounds.height,
      x: centerBounds.x,
      y: centerBounds.y,
      minWidth: 800,
      minHeight: 600,
      title: 'SpeedTest Monitor - ダッシュボード'
    }));

    this.windows.dashboard.loadFile('src/renderer/pages/dashboard.html');

    this.windows.dashboard.once('ready-to-show', () => {
      this.windows.dashboard.show();
      
      if (isDev) {
        this.windows.dashboard.webContents.openDevTools();
      }
    });

    this.windows.dashboard.on('close', (event) => {
      event.preventDefault();
      this.windows.dashboard.hide();
      log.info('Dashboard window hidden to tray');
    });

    this.windows.dashboard.on('closed', () => {
      this.windows.dashboard = null;
      log.info('Dashboard window closed');
    });

    this.windows.dashboard.on('resize', () => {
      this.saveDashboardBounds();
    });

    this.windows.dashboard.on('move', () => {
      this.saveDashboardBounds();
    });

    this.windows.dashboard.webContents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    });

    log.info('Dashboard window created');
    return this.windows.dashboard;
  }

  showSettingsWindow() {
    if (this.windows.settings && !this.windows.settings.isDestroyed()) {
      this.windows.settings.focus();
      this.windows.settings.show();
      return this.windows.settings;
    }

    const bounds = this.windowBounds.settings;
    const centerBounds = this.getCenterBounds(bounds.width, bounds.height);

    this.windows.settings = new BrowserWindow(this.createBaseWindow({
      width: bounds.width,
      height: bounds.height,
      x: centerBounds.x,
      y: centerBounds.y,
      resizable: true,
      minimizable: true,
      maximizable: false,
      minWidth: 500,
      minHeight: 400,
      parent: this.windows.dashboard,
      modal: false,
      title: 'SpeedTest Monitor - 設定'
    }));

    this.windows.settings.loadFile('src/renderer/pages/settings.html');

    this.windows.settings.once('ready-to-show', () => {
      this.windows.settings.show();
      
      if (isDev) {
        this.windows.settings.webContents.openDevTools();
      }
    });

    this.windows.settings.on('closed', () => {
      this.windows.settings = null;
      log.info('Settings window closed');
    });

    this.windows.settings.webContents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    });

    log.info('Settings window created');
    return this.windows.settings;
  }

  getCenterBounds(width, height) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    return {
      x: Math.round((screenWidth - width) / 2),
      y: Math.round((screenHeight - height) / 2)
    };
  }

  saveDashboardBounds() {
    if (this.windows.dashboard && !this.windows.dashboard.isDestroyed()) {
      const bounds = this.windows.dashboard.getBounds();
      this.windowBounds.dashboard = bounds;
    }
  }

  restoreDashboardBounds(savedBounds) {
    if (savedBounds && typeof savedBounds === 'object') {
      this.windowBounds.dashboard = {
        ...this.windowBounds.dashboard,
        ...savedBounds
      };
    }
  }

  closeSetupWindow() {
    if (this.windows.setup && !this.windows.setup.isDestroyed()) {
      this.windows.setup.close();
      this.windows.setup = null;
      log.info('Setup window forcefully closed');
    }
  }

  closeDashboardWindow() {
    if (this.windows.dashboard && !this.windows.dashboard.isDestroyed()) {
      this.windows.dashboard.destroy();
      this.windows.dashboard = null;
      log.info('Dashboard window forcefully closed');
    }
  }

  closeSettingsWindow() {
    if (this.windows.settings && !this.windows.settings.isDestroyed()) {
      this.windows.settings.close();
      this.windows.settings = null;
      log.info('Settings window closed');
    }
  }

  hideAllWindows() {
    Object.keys(this.windows).forEach(windowName => {
      const window = this.windows[windowName];
      if (window && !window.isDestroyed() && window.isVisible()) {
        window.hide();
      }
    });
    log.info('All windows hidden');
  }

  showAllWindows() {
    Object.keys(this.windows).forEach(windowName => {
      const window = this.windows[windowName];
      if (window && !window.isDestroyed()) {
        window.show();
      }
    });
    log.info('All windows shown');
  }

  closeAllWindows() {
    Object.keys(this.windows).forEach(windowName => {
      const window = this.windows[windowName];
      if (window && !window.isDestroyed()) {
        window.destroy();
        this.windows[windowName] = null;
      }
    });
    log.info('All windows closed');
  }

  getWindow(windowName) {
    return this.windows[windowName];
  }

  isWindowOpen(windowName) {
    const window = this.windows[windowName];
    return window && !window.isDestroyed();
  }

  isWindowVisible(windowName) {
    const window = this.windows[windowName];
    return window && !window.isDestroyed() && window.isVisible();
  }

  focusWindow(windowName) {
    const window = this.windows[windowName];
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
      window.show();
      log.info(`${windowName} window focused`);
      return true;
    }
    return false;
  }

  getWindowBounds(windowName) {
    return this.windowBounds[windowName] || null;
  }

  setWindowBounds(windowName, bounds) {
    if (this.windowBounds[windowName]) {
      this.windowBounds[windowName] = { ...this.windowBounds[windowName], ...bounds };
    }
  }

  getAllWindowStates() {
    const states = {};
    
    Object.keys(this.windows).forEach(windowName => {
      const window = this.windows[windowName];
      states[windowName] = {
        exists: window !== null,
        isDestroyed: window ? window.isDestroyed() : true,
        isVisible: window && !window.isDestroyed() ? window.isVisible() : false,
        isMinimized: window && !window.isDestroyed() ? window.isMinimized() : false,
        bounds: window && !window.isDestroyed() ? window.getBounds() : null
      };
    });
    
    return states;
  }

  sendToWindow(windowName, channel, ...args) {
    const window = this.windows[windowName];
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, ...args);
      return true;
    }
    return false;
  }

  sendToAllWindows(channel, ...args) {
    let sentCount = 0;
    
    Object.keys(this.windows).forEach(windowName => {
      if (this.sendToWindow(windowName, channel, ...args)) {
        sentCount++;
      }
    });
    
    return sentCount;
  }

  reloadWindow(windowName) {
    const window = this.windows[windowName];
    if (window && !window.isDestroyed()) {
      window.reload();
      log.info(`${windowName} window reloaded`);
      return true;
    }
    return false;
  }

  toggleDevTools(windowName) {
    const window = this.windows[windowName];
    if (window && !window.isDestroyed()) {
      window.webContents.toggleDevTools();
      log.info(`${windowName} window dev tools toggled`);
      return true;
    }
    return false;
  }
}

module.exports = WindowManager;
