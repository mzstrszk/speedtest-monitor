class Dashboard {
  constructor() {
    this.currentSection = 'overview';
    this.charts = {};
    this.refreshIntervals = {};
    this.testInProgress = false;
        
    this.init();
  }

  async init() {
    await this.setupUI();
    await this.setupEventListeners();
    await this.loadInitialData();
    await this.startAutoRefresh();
        
    console.log('Dashboard initialized');
  }

  async setupUI() {
    await this.loadAppVersion();
    this.setupNavigation();
    this.setupCharts();
  }

  async loadAppVersion() {
    try {
      const version = await window.electronAPI.app.getVersion();
      document.getElementById('app-version').textContent = version;
    } catch (error) {
      console.error('Failed to load app version:', error);
    }
  }

  setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
        
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        this.switchSection(section);
      });
    });
  }

  switchSection(section) {
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.remove('active');
    });
        
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      link.classList.remove('active');
    });

    document.getElementById(`${section}Section`).classList.add('active');
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
    const titleMap = {
      overview: '概要',
      history: '履歴',
      statistics: '統計',
      settings: '設定'
    };
        
    document.getElementById('sectionTitle').textContent = titleMap[section] || section;
    this.currentSection = section;
        
    this.onSectionChange(section);
  }

  async onSectionChange(section) {
    switch (section) {
    case 'overview':
      await this.refreshOverview();
      break;
    case 'history':
      await this.refreshHistory();
      break;
    case 'statistics':
      await this.refreshStatistics();
      break;
    case 'settings':
      await this.loadSettings();
      break;
    }
  }

  setupCharts() {
    const speedChartCtx = document.getElementById('speedChart').getContext('2d');
    this.charts.speed = new Chart(speedChartCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'ダウンロード (Mbps)',
            data: [],
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            tension: 0.4
          },
          {
            label: 'アップロード (Mbps)',
            data: [],
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: '速度 (Mbps)'
            }
          },
          x: {
            title: {
              display: true,
              text: '時刻'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: '速度推移'
          }
        }
      }
    });

    const statsChartCtx = document.getElementById('statsChart').getContext('2d');
    this.charts.stats = new Chart(statsChartCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: '平均ダウンロード速度',
            data: [],
            backgroundColor: 'rgba(0, 123, 255, 0.8)'
          },
          {
            label: '平均アップロード速度',
            data: [],
            backgroundColor: 'rgba(40, 167, 69, 0.8)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: '速度 (Mbps)'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  }

  async setupEventListeners() {
    document.getElementById('runTestBtn').addEventListener('click', () => {
      this.runSpeedTest();
    });

    document.getElementById('startSchedulerBtn').addEventListener('click', () => {
      this.startScheduler();
    });

    document.getElementById('stopSchedulerBtn').addEventListener('click', () => {
      this.stopScheduler();
    });

    document.getElementById('minimizeBtn').addEventListener('click', () => {
      window.electronAPI.app.minimizeToTray();
    });

    document.getElementById('exportDataBtn').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('openLogsBtn').addEventListener('click', () => {
      window.electronAPI.app.openLogs();
    });

    document.getElementById('quitAppBtn').addEventListener('click', () => {
      this.confirmQuitApp();
    });

    document.getElementById('cancelTestBtn').addEventListener('click', () => {
      this.cancelTest();
    });

    document.getElementById('filterBtn').addEventListener('click', () => {
      this.filterHistory();
    });

    document.getElementById('refreshHistoryBtn').addEventListener('click', () => {
      this.refreshHistory();
    });

    document.getElementById('statsPeriod').addEventListener('change', () => {
      this.refreshStatistics();
    });

    document.getElementById('settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    window.electronAPI.events.on('speedtest-started', () => {
      this.onSpeedTestStarted();
    });

    window.electronAPI.events.on('speedtest-progress', (event, progress) => {
      this.onSpeedTestProgress(progress);
    });

    window.electronAPI.events.on('speedtest-completed', (event, result) => {
      this.onSpeedTestCompleted(result);
    });

    window.electronAPI.events.on('speedtest-error', (event, error) => {
      this.onSpeedTestError(error);
    });

    window.electronAPI.events.on('scheduler-started', () => {
      this.updateSchedulerStatus();
    });

    window.electronAPI.events.on('scheduler-stopped', () => {
      this.updateSchedulerStatus();
    });
  }

  async loadInitialData() {
    await this.refreshOverview();
    await this.updateSchedulerStatus();
  }

  startAutoRefresh() {
    this.refreshIntervals.overview = setInterval(() => {
      if (this.currentSection === 'overview') {
        this.refreshOverview();
      }
    }, 30000);

    this.refreshIntervals.scheduler = setInterval(() => {
      this.updateSchedulerStatus();
    }, 10000);
  }

  stopAutoRefresh() {
    Object.values(this.refreshIntervals).forEach(interval => {
      clearInterval(interval);
    });
  }

  async refreshOverview() {
    try {
      await this.loadLatestResults();
      await this.loadSpeedChart();
      await this.loadRecentTests();
    } catch (error) {
      console.error('Failed to refresh overview:', error);
    }
  }

  async loadLatestResults() {
    try {
      const history = await window.electronAPI.speedtest.getHistory({ limit: 1 });
            
      if (history && history.length > 0) {
        const latest = history[0];
                
        document.getElementById('downloadSpeed').textContent = 
                    window.electronAPI.utils.formatSpeed(latest.download_speed);
        document.getElementById('uploadSpeed').textContent = 
                    window.electronAPI.utils.formatSpeed(latest.upload_speed);
        document.getElementById('pingTime').textContent = 
                    `${latest.ping.toFixed(1)} ms`;
                
        const timeText = window.electronAPI.utils.formatDate(latest.timestamp);
        document.getElementById('downloadSpeedTime').textContent = timeText;
        document.getElementById('uploadSpeedTime').textContent = timeText;
        document.getElementById('pingTimeTime').textContent = timeText;
      } else {
        document.getElementById('downloadSpeed').textContent = '--';
        document.getElementById('uploadSpeed').textContent = '--';
        document.getElementById('pingTime').textContent = '--';
                
        document.getElementById('downloadSpeedTime').textContent = '測定データなし';
        document.getElementById('uploadSpeedTime').textContent = '測定データなし';
        document.getElementById('pingTimeTime').textContent = '測定データなし';
      }
    } catch (error) {
      console.error('Failed to load latest results:', error);
    }
  }

  async loadSpeedChart() {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
            
      const history = await window.electronAPI.speedtest.getHistory({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100
      });

      const labels = [];
      const downloadData = [];
      const uploadData = [];

      history.reverse().forEach(test => {
        const time = new Date(test.timestamp);
        labels.push(time.toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }));
        downloadData.push(Math.round(test.download_speed / 1000000 * 100) / 100);
        uploadData.push(Math.round(test.upload_speed / 1000000 * 100) / 100);
      });

      this.charts.speed.data.labels = labels;
      this.charts.speed.data.datasets[0].data = downloadData;
      this.charts.speed.data.datasets[1].data = uploadData;
      this.charts.speed.update();
    } catch (error) {
      console.error('Failed to load speed chart:', error);
    }
  }

  async loadRecentTests() {
    try {
      const history = await window.electronAPI.speedtest.getHistory({ limit: 10 });
      const tbody = document.querySelector('#recentTestsTable tbody');
            
      if (history && history.length > 0) {
        tbody.innerHTML = history.map(test => `
                    <tr>
                        <td>${window.electronAPI.utils.formatDate(test.timestamp)}</td>
                        <td>${window.electronAPI.utils.formatSpeed(test.download_speed)}</td>
                        <td>${window.electronAPI.utils.formatSpeed(test.upload_speed)}</td>
                        <td>${test.ping.toFixed(1)} ms</td>
                        <td>${test.server_name || 'Unknown'}</td>
                        <td>
                            <span class="badge ${test.status === 'completed' ? 'bg-success' : 'bg-danger'}">
                                ${test.status === 'completed' ? '完了' : 'エラー'}
                            </span>
                        </td>
                    </tr>
                `).join('');
      } else {
        tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted">
                            測定データがありません
                        </td>
                    </tr>
                `;
      }
    } catch (error) {
      console.error('Failed to load recent tests:', error);
      const tbody = document.querySelector('#recentTestsTable tbody');
      tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">
                        データの読み込みに失敗しました
                    </td>
                </tr>
            `;
    }
  }

  async updateSchedulerStatus() {
    try {
      const status = await window.electronAPI.scheduler.getStatus();
      const statusBadge = document.getElementById('schedulerStatusBadge');
      const statusText = document.getElementById('schedulerStatusText');
      const startBtn = document.getElementById('startSchedulerBtn');
      const stopBtn = document.getElementById('stopSchedulerBtn');
      const nextRunInfo = document.getElementById('nextRunInfo');
      const nextRunTime = document.getElementById('nextRunTime');

      if (status.isRunning) {
        statusBadge.textContent = '実行中';
        statusBadge.className = 'status-badge running';
        statusText.textContent = `自動測定が実行中です (間隔: ${status.intervalMinutes}分)`;
                
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
                
        if (status.nextRunTime) {
          nextRunInfo.style.display = 'block';
          nextRunTime.textContent = window.electronAPI.utils.formatDate(status.nextRunTime);
        } else {
          nextRunInfo.style.display = 'none';
        }
      } else {
        statusBadge.textContent = '停止中';
        statusBadge.className = 'status-badge stopped';
        statusText.textContent = '自動測定は停止しています';
                
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        nextRunInfo.style.display = 'none';
      }

      const connectionStatus = document.getElementById('connectionStatus');
      const statusTextEl = document.getElementById('statusText');
            
      if (status.isRunning) {
        connectionStatus.classList.remove('disconnected');
        statusTextEl.textContent = '測定中';
      } else {
        connectionStatus.classList.add('disconnected');
        statusTextEl.textContent = '待機中';
      }
    } catch (error) {
      console.error('Failed to update scheduler status:', error);
    }
  }

  async runSpeedTest() {
    if (this.testInProgress) return;

    try {
      this.testInProgress = true;
      const modal = new bootstrap.Modal(document.getElementById('testProgressModal'));
      modal.show();

      const _result = await window.electronAPI.speedtest.start();
            
      modal.hide();
      this.testInProgress = false;
            
      await this.refreshOverview();
      this.showSuccessMessage('速度測定が完了しました。');
    } catch (error) {
      const modal = bootstrap.Modal.getInstance(document.getElementById('testProgressModal'));
      if (modal) modal.hide();
            
      this.testInProgress = false;
      console.error('Speed test failed:', error);
      this.showErrorMessage(`速度測定に失敗しました: ${error.message}`);
    }
  }

  async startScheduler() {
    try {
      await window.electronAPI.scheduler.start();
      await this.updateSchedulerStatus();
      this.showSuccessMessage('自動測定を開始しました。');
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      this.showErrorMessage(`自動測定の開始に失敗しました: ${error.message}`);
    }
  }

  async stopScheduler() {
    try {
      await window.electronAPI.scheduler.stop();
      await this.updateSchedulerStatus();
      this.showSuccessMessage('自動測定を停止しました。');
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
      this.showErrorMessage(`自動測定の停止に失敗しました: ${error.message}`);
    }
  }

  onSpeedTestStarted() {
    document.getElementById('testProgressText').textContent = '測定を開始しています...';
    const progressBar = document.querySelector('#testProgressModal .progress-bar');
    progressBar.style.width = '10%';
  }

  onSpeedTestProgress(progress) {
    const progressBar = document.querySelector('#testProgressModal .progress-bar');
    const progressText = document.getElementById('testProgressText');
        
    if (progress.type === 'download') {
      progressText.textContent = 'ダウンロード速度を測定中...';
      progressBar.style.width = '30%';
    } else if (progress.type === 'upload') {
      progressText.textContent = 'アップロード速度を測定中...';
      progressBar.style.width = '70%';
    }
  }

  onSpeedTestCompleted(_result) {
    const progressBar = document.querySelector('#testProgressModal .progress-bar');
    const progressText = document.getElementById('testProgressText');

    progressText.textContent = '測定完了！';
    progressBar.style.width = '100%';
        
    setTimeout(() => {
      const modal = bootstrap.Modal.getInstance(document.getElementById('testProgressModal'));
      if (modal) modal.hide();
    }, 1000);
  }

  onSpeedTestError(error) {
    const modal = bootstrap.Modal.getInstance(document.getElementById('testProgressModal'));
    if (modal) modal.hide();
        
    this.showErrorMessage(`測定エラー: ${error.message}`);
  }

  async cancelTest() {
    try {
      const modal = bootstrap.Modal.getInstance(document.getElementById('testProgressModal'));
      if (modal) modal.hide();
            
      this.testInProgress = false;
    } catch (error) {
      console.error('Failed to cancel test:', error);
    }
  }

  async exportData() {
    try {
      const result = await window.electronAPI.speedtest.export({});
            
      if (result.success) {
        this.showSuccessMessage(`データを ${result.path} にエクスポートしました。`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.showErrorMessage(`エクスポートに失敗しました: ${error.message}`);
    }
  }

  confirmQuitApp() {
    this.showConfirmModal(
      'アプリケーション終了',
      'SpeedTest Monitor を終了しますか？',
      () => {
        window.electronAPI.app.quit();
      }
    );
  }

  async refreshHistory() {
    try {
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
            
      const options = {};
      if (startDate) options.startDate = new Date(startDate).toISOString();
      if (endDate) options.endDate = new Date(`${endDate  }T23:59:59`).toISOString();
            
      const history = await window.electronAPI.speedtest.getHistory(options);
      this.displayHistoryTable(history);
    } catch (error) {
      console.error('Failed to refresh history:', error);
      this.showErrorMessage('履歴の取得に失敗しました。');
    }
  }

  displayHistoryTable(history) {
    const tbody = document.querySelector('#historyTable tbody');
        
    if (history && history.length > 0) {
      tbody.innerHTML = history.map(test => `
                <tr>
                    <td>${window.electronAPI.utils.formatDate(test.timestamp)}</td>
                    <td>${window.electronAPI.utils.formatSpeed(test.download_speed)}</td>
                    <td>${window.electronAPI.utils.formatSpeed(test.upload_speed)}</td>
                    <td>${test.ping.toFixed(1)} ms</td>
                    <td>${test.jitter ? `${test.jitter.toFixed(1)  } ms` : '--'}</td>
                    <td>${test.server_name || 'Unknown'}</td>
                    <td>
                        <span class="badge ${test.status === 'completed' ? 'bg-success' : 'bg-danger'}">
                            ${test.status === 'completed' ? '完了' : 'エラー'}
                        </span>
                    </td>
                </tr>
            `).join('');
    } else {
      tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        該当するデータがありません
                    </td>
                </tr>
            `;
    }
  }

  filterHistory() {
    this.refreshHistory();
  }

  async refreshStatistics() {
    try {
      const period = document.getElementById('statsPeriod').value;
      const stats = await window.electronAPI.speedtest.getStats(period);
            
      this.displayStatsCards(stats);
      this.updateStatsChart(stats, period);
    } catch (error) {
      console.error('Failed to refresh statistics:', error);
      this.showErrorMessage('統計情報の取得に失敗しました。');
    }
  }

  displayStatsCards(stats) {
    const container = document.getElementById('statsCards');
        
    if (!stats || stats.total_tests === 0) {
      container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">
                        選択された期間内に測定データがありません。
                    </div>
                </div>
            `;
      return;
    }

    container.innerHTML = `
            <div class="col-md-3">
                <div class="card metric-card">
                    <div class="card-body">
                        <div class="metric-icon">
                            <i class="bi bi-graph-up text-info"></i>
                        </div>
                        <h6 class="card-subtitle mb-2">総測定回数</h6>
                        <h3 class="card-title mb-0">${stats.total_tests}</h3>
                        <small class="text-muted">回</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card metric-card">
                    <div class="card-body">
                        <div class="metric-icon">
                            <i class="bi bi-arrow-down text-primary"></i>
                        </div>
                        <h6 class="card-subtitle mb-2">平均ダウンロード</h6>
                        <h3 class="card-title mb-0">${window.electronAPI.utils.formatSpeed(stats.avg_download)}</h3>
                        <small class="text-muted">最高: ${window.electronAPI.utils.formatSpeed(stats.max_download)}</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card metric-card">
                    <div class="card-body">
                        <div class="metric-icon">
                            <i class="bi bi-arrow-up text-success"></i>
                        </div>
                        <h6 class="card-subtitle mb-2">平均アップロード</h6>
                        <h3 class="card-title mb-0">${window.electronAPI.utils.formatSpeed(stats.avg_upload)}</h3>
                        <small class="text-muted">最高: ${window.electronAPI.utils.formatSpeed(stats.max_upload)}</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card metric-card">
                    <div class="card-body">
                        <div class="metric-icon">
                            <i class="bi bi-stopwatch text-warning"></i>
                        </div>
                        <h6 class="card-subtitle mb-2">平均レイテンシ</h6>
                        <h3 class="card-title mb-0">${stats.avg_ping.toFixed(1)} ms</h3>
                        <small class="text-muted">最低: ${stats.min_ping.toFixed(1)} ms</small>
                    </div>
                </div>
            </div>
        `;
  }

  updateStatsChart(stats, _period) {
    const labels = ['ダウンロード', 'アップロード'];
    const avgData = [
      Math.round(stats.avg_download / 1000000 * 100) / 100,
      Math.round(stats.avg_upload / 1000000 * 100) / 100
    ];
    const maxData = [
      Math.round(stats.max_download / 1000000 * 100) / 100,
      Math.round(stats.max_upload / 1000000 * 100) / 100
    ];

    this.charts.stats.data.labels = labels;
    this.charts.stats.data.datasets[0] = {
      label: '平均速度',
      data: avgData,
      backgroundColor: 'rgba(0, 123, 255, 0.8)'
    };
    this.charts.stats.data.datasets[1] = {
      label: '最高速度',
      data: maxData,
      backgroundColor: 'rgba(40, 167, 69, 0.8)'
    };
        
    this.charts.stats.update();
  }

  async loadSettings() {
    try {
      const config = await window.electronAPI.config.getAll();
            
      document.getElementById('measurementIntervalSetting').value = config.measurementInterval || 60;
      document.getElementById('dataRetentionDaysSetting').value = config.dataRetentionDays || 30;
      document.getElementById('notifyOnCompletionSetting').checked = config.notifyOnCompletion !== false;
      document.getElementById('notifyOnErrorSetting').checked = config.notifyOnError !== false;
      document.getElementById('minimizeOnCloseSetting').checked = config.minimizeOnClose !== false;
      document.getElementById('startWithWindowsSetting').checked = config.startWithWindows === true;
      document.getElementById('enableDebugLoggingSetting').checked = config.enableDebugLogging === true;
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showErrorMessage('設定の読み込みに失敗しました。');
    }
  }

  async saveSettings() {
    try {
      const settings = {
        measurementInterval: parseInt(document.getElementById('measurementIntervalSetting').value),
        dataRetentionDays: parseInt(document.getElementById('dataRetentionDaysSetting').value),
        notifyOnCompletion: document.getElementById('notifyOnCompletionSetting').checked,
        notifyOnError: document.getElementById('notifyOnErrorSetting').checked,
        minimizeOnClose: document.getElementById('minimizeOnCloseSetting').checked,
        startWithWindows: document.getElementById('startWithWindowsSetting').checked,
        enableDebugLogging: document.getElementById('enableDebugLoggingSetting').checked
      };

      for (const [key, value] of Object.entries(settings)) {
        await window.electronAPI.config.set(key, value);
      }

      this.showSuccessMessage('設定を保存しました。');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showErrorMessage('設定の保存に失敗しました。');
    }
  }

  showSuccessMessage(message) {
    this.showToast(message, 'success');
  }

  showErrorMessage(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
    document.body.appendChild(toast);
        
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
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

  destroy() {
    this.stopAutoRefresh();
        
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
        
    console.log('Dashboard destroyed');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
    
  window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
      window.dashboard.destroy();
    }
  });
});