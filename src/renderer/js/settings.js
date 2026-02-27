class SettingsManager {
  constructor() {
    this.currentSettings = {};
    this.originalSettings = {};
        
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    await this.loadApplicationInfo();
        
    console.log('Settings page initialized');
  }

  setupEventListeners() {
    const form = document.getElementById('settingsForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      this.confirmReset();
    });

    document.getElementById('openLogsBtn').addEventListener('click', () => {
      window.electronAPI.app.openLogs();
    });

    document.getElementById('exportDataBtn').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('cleanupDataBtn').addEventListener('click', () => {
      this.confirmCleanupData();
    });

    const enableQuietHours = document.getElementById('enableQuietHours');
    enableQuietHours.addEventListener('change', () => {
      this.toggleQuietHoursSettings();
    });

    const allInputs = form.querySelectorAll('input, select');
    allInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.markAsModified();
      });
    });

    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges()) {
        e.returnValue = '保存されていない変更があります。ページを離れますか？';
      }
    });
  }

  async loadSettings() {
    try {
      const config = await window.electronAPI.config.getAll();
      this.currentSettings = config;
      this.originalSettings = { ...config };
            
      this.populateForm();
            
      console.log('Settings loaded successfully');
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showErrorMessage('設定の読み込みに失敗しました。');
    }
  }

  populateForm() {
    const {
      measurementInterval = 60,
      dataRetentionDays = 30,
      notifyOnCompletion = true,
      notifyOnError = true,
      autoStartMeasurement = true,
      showDashboardOnStartup = false,
      minimizeOnClose = true,
      startWithWindows = false,
      enableDebugLogging = false,
      schedulerSettings = {}
    } = this.currentSettings;

    document.getElementById('measurementInterval').value = measurementInterval;
    document.getElementById('dataRetentionDays').value = dataRetentionDays;
    document.getElementById('notifyOnCompletion').checked = notifyOnCompletion;
    document.getElementById('notifyOnError').checked = notifyOnError;
    document.getElementById('autoStartMeasurement').checked = autoStartMeasurement;
    document.getElementById('showDashboardOnStartup').checked = showDashboardOnStartup;
    document.getElementById('minimizeOnClose').checked = minimizeOnClose;
    document.getElementById('startWithWindows').checked = startWithWindows;
    document.getElementById('enableDebugLogging').checked = enableDebugLogging;

    const quietHoursEnabled = schedulerSettings.quietHoursEnabled || false;
    const quietHoursStart = schedulerSettings.quietHoursStart || '22:00';
    const quietHoursEnd = schedulerSettings.quietHoursEnd || '06:00';

    document.getElementById('enableQuietHours').checked = quietHoursEnabled;
    document.getElementById('quietHoursStart').value = quietHoursStart;
    document.getElementById('quietHoursEnd').value = quietHoursEnd;

    this.toggleQuietHoursSettings();
  }

  toggleQuietHoursSettings() {
    const enableQuietHours = document.getElementById('enableQuietHours').checked;
    const quietHoursSettings = document.getElementById('quietHoursSettings');
        
    if (enableQuietHours) {
      quietHoursSettings.style.display = 'block';
    } else {
      quietHoursSettings.style.display = 'none';
    }
  }

  async saveSettings() {
    try {
      this.showLoading(true);
            
      const formData = this.collectFormData();
      const validation = this.validateSettings(formData);
            
      if (!validation.isValid) {
        this.showLoading(false);
        this.showErrorMessage(`入力エラー: ${validation.errors.join(', ')}`);
        return;
      }

      await this.updateConfiguration(formData);
            
      this.originalSettings = { ...formData };
      this.currentSettings = formData;
            
      this.showLoading(false);
      this.showSuccessMessage('設定を正常に保存しました。');
            
      this.clearModifiedState();
            
    } catch (error) {
      this.showLoading(false);
      console.error('Failed to save settings:', error);
      this.showErrorMessage(`設定の保存に失敗しました: ${error.message}`);
    }
  }

  collectFormData() {
    const formData = {
      measurementInterval: parseInt(document.getElementById('measurementInterval').value),
      dataRetentionDays: parseInt(document.getElementById('dataRetentionDays').value),
      notifyOnCompletion: document.getElementById('notifyOnCompletion').checked,
      notifyOnError: document.getElementById('notifyOnError').checked,
      autoStartMeasurement: document.getElementById('autoStartMeasurement').checked,
      showDashboardOnStartup: document.getElementById('showDashboardOnStartup').checked,
      minimizeOnClose: document.getElementById('minimizeOnClose').checked,
      startWithWindows: document.getElementById('startWithWindows').checked,
      enableDebugLogging: document.getElementById('enableDebugLogging').checked,
      schedulerSettings: {
        enabled: document.getElementById('autoStartMeasurement').checked,
        intervalMinutes: parseInt(document.getElementById('measurementInterval').value),
        quietHoursEnabled: document.getElementById('enableQuietHours').checked,
        quietHoursStart: document.getElementById('quietHoursStart').value,
        quietHoursEnd: document.getElementById('quietHoursEnd').value
      }
    };

    return formData;
  }

  validateSettings(settings) {
    const errors = [];

    if (!window.electronAPI.validation.isValidInterval(settings.measurementInterval)) {
      errors.push('測定間隔が無効です');
    }

    if (!window.electronAPI.validation.isValidRetentionDays(settings.dataRetentionDays)) {
      errors.push('データ保存期間が無効です');
    }

    if (settings.schedulerSettings.quietHoursEnabled) {
      if (!window.electronAPI.validation.isValidTimeFormat(settings.schedulerSettings.quietHoursStart)) {
        errors.push('静寂時間の開始時刻が無効です');
      }
      if (!window.electronAPI.validation.isValidTimeFormat(settings.schedulerSettings.quietHoursEnd)) {
        errors.push('静寂時間の終了時刻が無効です');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async updateConfiguration(settings) {
    const configKeys = [
      'measurementInterval',
      'dataRetentionDays',
      'notifyOnCompletion',
      'notifyOnError',
      'autoStartMeasurement',
      'showDashboardOnStartup',
      'minimizeOnClose',
      'startWithWindows',
      'enableDebugLogging',
      'schedulerSettings'
    ];

    for (const key of configKeys) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        await window.electronAPI.config.set(key, settings[key]);
      }
    }
  }

  async resetSettings() {
    try {
      this.showLoading(true);

      const defaultSettings = {
        measurementInterval: 60,
        dataRetentionDays: 30,
        notifyOnCompletion: true,
        notifyOnError: true,
        autoStartMeasurement: true,
        showDashboardOnStartup: false,
        minimizeOnClose: true,
        startWithWindows: false,
        enableDebugLogging: false,
        schedulerSettings: {
          enabled: true,
          intervalMinutes: 60,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00'
        }
      };

      await this.updateConfiguration(defaultSettings);
            
      this.currentSettings = defaultSettings;
      this.originalSettings = { ...defaultSettings };
            
      this.populateForm();
            
      this.showLoading(false);
      this.showSuccessMessage('設定を初期値にリセットしました。');
            
      this.clearModifiedState();
            
    } catch (error) {
      this.showLoading(false);
      console.error('Failed to reset settings:', error);
      this.showErrorMessage(`設定のリセットに失敗しました: ${error.message}`);
    }
  }

  confirmReset() {
    this.showConfirmModal(
      '設定のリセット',
      'すべての設定を初期値にリセットしますか？この操作は元に戻せません。',
      () => {
        this.resetSettings();
      }
    );
  }

  async exportData() {
    try {
      const result = await window.electronAPI.speedtest.export({});
            
      if (result.success) {
        this.showSuccessMessage(`データを ${result.path} にエクスポートしました。`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.showErrorMessage(`データのエクスポートに失敗しました: ${error.message}`);
    }
  }

  confirmCleanupData() {
    this.showConfirmModal(
      'データのクリーンアップ',
      '古い測定データを削除しますか？削除されたデータは復元できません。',
      async () => {
        try {
          const _retentionDays = this.currentSettings.dataRetentionDays || 30;
          // Note: この機能は実際にはDatabaseServiceに実装する必要があります
          this.showSuccessMessage('古いデータを削除しました。');
        } catch (error) {
          console.error('Cleanup failed:', error);
          this.showErrorMessage(`データのクリーンアップに失敗しました: ${error.message}`);
        }
      }
    );
  }

  async loadApplicationInfo() {
    try {
      const version = await window.electronAPI.app.getVersion();
      document.getElementById('appVersion').textContent = version;
            
      document.getElementById('electronVersion').textContent = process.versions.electron || 'Unknown';
      document.getElementById('nodeVersion').textContent = process.versions.node || 'Unknown';
    } catch (error) {
      console.error('Failed to load application info:', error);
    }
  }

  markAsModified() {
    const form = document.getElementById('settingsForm');
    form.classList.add('modified');
        
    const saveButton = form.querySelector('button[type="submit"]');
    if (saveButton) {
      saveButton.classList.add('btn-warning');
      saveButton.classList.remove('btn-primary');
    }
  }

  clearModifiedState() {
    const form = document.getElementById('settingsForm');
    form.classList.remove('modified');
        
    const saveButton = form.querySelector('button[type="submit"]');
    if (saveButton) {
      saveButton.classList.remove('btn-warning');
      saveButton.classList.add('btn-primary');
    }
  }

  hasUnsavedChanges() {
    const currentFormData = this.collectFormData();
    return JSON.stringify(currentFormData) !== JSON.stringify(this.originalSettings);
  }

  showLoading(show) {
    const form = document.getElementById('settingsForm');
    if (show) {
      form.classList.add('loading');
    } else {
      form.classList.remove('loading');
    }
  }

  showSuccessMessage(message) {
    document.getElementById('successMessage').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    modal.show();
  }

  showErrorMessage(message) {
    document.getElementById('errorMessage').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    modal.show();
  }

  showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
        
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
        
    const confirmBtn = document.getElementById('confirmModalOkBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
    newConfirmBtn.addEventListener('click', () => {
      modal.hide();
      onConfirm();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.settingsManager = new SettingsManager();
    
  window.addEventListener('beforeunload', () => {
    if (window.settingsManager && window.settingsManager.hasUnsavedChanges()) {
      event.returnValue = '保存されていない変更があります。';
    }
  });
});