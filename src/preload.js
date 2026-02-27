const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    showDashboard: () => ipcRenderer.invoke('app:show-dashboard'),
    showSettings: () => ipcRenderer.invoke('app:show-settings'),
    quit: () => ipcRenderer.invoke('app:quit'),
    minimizeToTray: () => ipcRenderer.invoke('app:minimize-to-tray'),
    openLogs: () => ipcRenderer.invoke('app:open-logs')
  },

  config: {
    get: (key, defaultValue) => ipcRenderer.invoke('config:get', key, defaultValue),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:get-all')
  },

  speedtest: {
    start: () => ipcRenderer.invoke('speedtest:start'),
    getHistory: (options) => ipcRenderer.invoke('speedtest:get-history', options),
    getStats: (period) => ipcRenderer.invoke('speedtest:get-stats', period),
    export: (options) => ipcRenderer.invoke('speedtest:export', options)
  },

  scheduler: {
    start: () => ipcRenderer.invoke('scheduler:start'),
    stop: () => ipcRenderer.invoke('scheduler:stop'),
    getStatus: () => ipcRenderer.invoke('scheduler:get-status')
  },

  setup: {
    complete: (settings) => ipcRenderer.invoke('setup:complete', settings)
  },

  events: {
    on: (channel, callback) => {
      const validChannels = [
        'speedtest-started',
        'speedtest-progress',
        'speedtest-completed',
        'speedtest-error',
        'scheduler-started',
        'scheduler-stopped',
        'config-changed',
        'notification'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, callback);
      }
    },
    
    off: (channel, callback) => {
      ipcRenderer.removeListener(channel, callback);
    },
    
    once: (channel, callback) => {
      const validChannels = [
        'speedtest-started',
        'speedtest-progress',
        'speedtest-completed',
        'speedtest-error',
        'scheduler-started',
        'scheduler-stopped',
        'config-changed',
        'notification'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, callback);
      }
    }
  },

  utils: {
    formatSpeed: (bps) => {
      if (typeof bps !== 'number' || bps < 0) return '0 Mbps';
      
      const mbps = bps / 1000000;
      
      if (mbps >= 1000) {
        return `${(mbps / 1000).toFixed(2)} Gbps`;
      } else if (mbps >= 1) {
        return `${mbps.toFixed(2)} Mbps`;
      } else {
        return `${(bps / 1000).toFixed(0)} Kbps`;
      }
    },
    
    formatBytes: (bytes) => {
      if (typeof bytes !== 'number' || bytes < 0) return '0 B';
      
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      if (bytes === 0) return '0 B';
      
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
    },
    
    formatDate: (dateString) => {
      if (!dateString) return '';
      
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date);
    },
    
    formatDuration: (ms) => {
      if (typeof ms !== 'number' || ms < 0) return '0秒';
      
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}時間${minutes % 60}分${seconds % 60}秒`;
      } else if (minutes > 0) {
        return `${minutes}分${seconds % 60}秒`;
      } else {
        return `${seconds}秒`;
      }
    },
    
    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },
    
    throttle: (func, limit) => {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  },

  validation: {
    isValidInterval: (minutes) => {
      return typeof minutes === 'number' && minutes >= 5 && minutes <= 1440;
    },
    
    isValidRetentionDays: (days) => {
      return typeof days === 'number' && days >= 1 && days <= 365;
    },
    
    isValidTimeFormat: (timeString) => {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      return typeof timeString === 'string' && timeRegex.test(timeString);
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});

window.addEventListener('error', (event) => {
  console.error('Renderer process error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in renderer:', event.reason);
});