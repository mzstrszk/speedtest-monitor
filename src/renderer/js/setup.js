class SetupWizard {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 3;
    this.settings = {};
        
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateStepDisplay();
  }

  setupEventListeners() {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const completeBtn = document.getElementById('completeBtn');

    backBtn.addEventListener('click', () => this.previousStep());
    nextBtn.addEventListener('click', () => this.nextStep());
    completeBtn.addEventListener('click', () => this.completeSetup());

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', this.validateCurrentStep.bind(this));
    });

    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
      select.addEventListener('change', this.validateCurrentStep.bind(this));
    });
  }

  updateStepDisplay() {
    this.updateProgressBar();
    this.updateStepContent();
    this.updateButtons();
    this.updateStepCounter();
  }

  updateProgressBar() {
    const progressBar = document.querySelector('.progress-bar');
    const progressPercentage = (this.currentStep / this.totalSteps) * 100;
    progressBar.style.width = `${progressPercentage}%`;
    progressBar.setAttribute('aria-valuenow', progressPercentage);

    const stepIndicators = document.querySelectorAll('.step-indicators .step');
    stepIndicators.forEach((step, index) => {
      step.classList.remove('active', 'completed');
            
      if (index + 1 < this.currentStep) {
        step.classList.add('completed');
      } else if (index + 1 === this.currentStep) {
        step.classList.add('active');
      }
    });
  }

  updateStepContent() {
    const stepContents = document.querySelectorAll('.step-content');
    stepContents.forEach((content, index) => {
      content.classList.remove('active');
            
      if (index + 1 === this.currentStep) {
        content.classList.add('active');
      }
    });
  }

  updateButtons() {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const completeBtn = document.getElementById('completeBtn');

    backBtn.disabled = this.currentStep === 1;

    if (this.currentStep === this.totalSteps) {
      nextBtn.style.display = 'none';
      completeBtn.style.display = 'inline-block';
    } else {
      nextBtn.style.display = 'inline-block';
      completeBtn.style.display = 'none';
    }
  }

  updateStepCounter() {
    const stepCounter = document.getElementById('stepCounter');
    stepCounter.textContent = `${this.currentStep} / ${this.totalSteps}`;
  }

  validateCurrentStep() {
    switch (this.currentStep) {
    case 1:
      return this.validateStep1();
    case 2:
      return this.validateStep2();
    case 3:
      return true;
    default:
      return true;
    }
  }

  validateStep1() {
    return true;
  }

  validateStep2() {
    const measurementInterval = document.getElementById('measurementInterval').value;
    const dataRetentionDays = document.getElementById('dataRetentionDays').value;

    if (!measurementInterval || !dataRetentionDays) {
      return false;
    }

    const intervalNum = parseInt(measurementInterval);
    const retentionNum = parseInt(dataRetentionDays);

    return window.electronAPI.validation.isValidInterval(intervalNum) && 
               window.electronAPI.validation.isValidRetentionDays(retentionNum);
  }

  collectCurrentStepData() {
    switch (this.currentStep) {
    case 1:
      return this.collectStep1Data();
    case 2:
      return this.collectStep2Data();
    default:
      return {};
    }
  }

  collectStep1Data() {
    return {
      autoStartMeasurement: document.getElementById('autoStartMeasurement').checked,
      showDashboardOnStartup: document.getElementById('showDashboardOnStartup').checked,
      minimizeOnClose: document.getElementById('minimizeOnClose').checked,
      startWithWindows: document.getElementById('startWithWindows').checked,
      notifyOnCompletion: document.getElementById('notifyOnCompletion').checked
    };
  }

  collectStep2Data() {
    return {
      measurementInterval: parseInt(document.getElementById('measurementInterval').value),
      dataRetentionDays: parseInt(document.getElementById('dataRetentionDays').value),
      notifyOnError: document.getElementById('notifyOnError').checked
    };
  }

  nextStep() {
    if (!this.validateCurrentStep()) {
      this.showError('入力内容を確認してください。');
      return;
    }

    const stepData = this.collectCurrentStepData();
    this.settings = { ...this.settings, ...stepData };

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
            
      if (this.currentStep === this.totalSteps) {
        this.displaySettingsSummary();
      }
            
      this.updateStepDisplay();
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepDisplay();
    }
  }

  displaySettingsSummary() {
    const summaryContainer = document.getElementById('settingsSummary');
    summaryContainer.innerHTML = '';

    const settingsToDisplay = [
      {
        label: '自動測定開始',
        value: this.settings.autoStartMeasurement ? '有効' : '無効',
        enabled: this.settings.autoStartMeasurement
      },
      {
        label: '起動時にダッシュボード表示',
        value: this.settings.showDashboardOnStartup ? '有効' : '無効',
        enabled: this.settings.showDashboardOnStartup
      },
      {
        label: 'トレイに最小化',
        value: this.settings.minimizeOnClose ? '有効' : '無効',
        enabled: this.settings.minimizeOnClose
      },
      {
        label: 'Windows起動時開始',
        value: this.settings.startWithWindows ? '有効' : '無効',
        enabled: this.settings.startWithWindows
      },
      {
        label: '測定完了通知',
        value: this.settings.notifyOnCompletion ? '有効' : '無効',
        enabled: this.settings.notifyOnCompletion
      },
      {
        label: '測定間隔',
        value: this.formatInterval(this.settings.measurementInterval),
        enabled: true
      },
      {
        label: 'データ保存期間',
        value: `${this.settings.dataRetentionDays}日間`,
        enabled: true
      },
      {
        label: 'エラー通知',
        value: this.settings.notifyOnError ? '有効' : '無効',
        enabled: this.settings.notifyOnError
      }
    ];

    settingsToDisplay.forEach(setting => {
      const summaryItem = document.createElement('div');
      summaryItem.className = 'col-12';
            
      const valueClass = setting.enabled ? 'enabled' : 'disabled';
      summaryItem.innerHTML = `
                <div class="summary-item">
                    <span class="summary-label">${setting.label}</span>
                    <span class="summary-value ${valueClass}">${setting.value}</span>
                </div>
            `;
            
      summaryContainer.appendChild(summaryItem);
    });
  }

  formatInterval(minutes) {
    if (minutes < 60) {
      return `${minutes}分`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
            
      if (remainingMinutes === 0) {
        return `${hours}時間`;
      } else {
        return `${hours}時間${remainingMinutes}分`;
      }
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days}日`;
    }
  }

  async completeSetup() {
    try {
      this.showLoading(true);

      const finalSettings = { ...this.settings };
            
      finalSettings.schedulerSettings = {
        enabled: finalSettings.autoStartMeasurement,
        intervalMinutes: finalSettings.measurementInterval,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00'
      };

      const result = await window.electronAPI.setup.complete(finalSettings);
            
      if (result.success) {
        this.showLoading(false);
                
        setTimeout(() => {
          this.showCompletionMessage();
        }, 500);
      } else {
        throw new Error('設定の保存に失敗しました。');
      }
            
    } catch (error) {
      this.showLoading(false);
      console.error('Setup completion failed:', error);
      this.showError(`セットアップに失敗しました: ${error.message}`);
    }
  }

  showCompletionMessage() {
    const completeBtn = document.getElementById('completeBtn');

    completeBtn.textContent = '完了しました！';
    completeBtn.disabled = true;
    completeBtn.classList.remove('btn-success');
    completeBtn.classList.add('btn-outline-success');

    setTimeout(() => {
      window.close();
    }, 2000);
  }

  showLoading(show) {
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'), {
      keyboard: false,
      backdrop: 'static'
    });

    if (show) {
      loadingModal.show();
    } else {
      loadingModal.hide();
    }
  }

  showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
        
    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    errorModal.show();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const setupWizard = new SetupWizard();
    
  window.addEventListener('beforeunload', (event) => {
    if (setupWizard.currentStep < setupWizard.totalSteps) {
      event.returnValue = 'セットアップが完了していません。ページを離れますか？';
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
      const activeElement = document.activeElement;
            
      if (activeElement && activeElement.tagName === 'BUTTON') {
        return;
      }
            
      if (setupWizard.currentStep < setupWizard.totalSteps) {
        event.preventDefault();
        setupWizard.nextStep();
      } else {
        event.preventDefault();
        setupWizard.completeSetup();
      }
    }
  });
});