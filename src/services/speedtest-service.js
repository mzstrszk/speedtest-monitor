const { UniversalSpeedTest, SpeedUnits } = require('universal-speedtest');
const EventEmitter = require('events');
const log = require('electron-log');

class SpeedTestService extends EventEmitter {
  constructor(databaseService) {
    super();

    this.databaseService = databaseService;
    this.isRunning = false;
    this.currentTest = null;
    this.testTimeout = null;

    this.config = {
      maxTime: 120000,
      serverId: null,
      measureDownload: true,
      measureUpload: true
    };

    this.speedtest = new UniversalSpeedTest({
      debug: false,
      tests: {
        measureDownload: this.config.measureDownload,
        measureUpload: this.config.measureUpload
      },
      units: {
        downloadUnit: SpeedUnits.Mbps,
        uploadUnit: SpeedUnits.Mbps
      }
    });
  }

  async runTest(options = {}) {
    if (this.isRunning) {
      throw new Error('測定が既に実行中です。完了をお待ちください。');
    }

    try {
      this.isRunning = true;
      this.emit('testStarted');

      log.info('Speed test started');

      const testConfig = {
        ...this.config,
        ...options
      };

      const startTime = Date.now();

      const testPromise = this.performSpeedTest(testConfig);

      this.testTimeout = setTimeout(() => {
        if (this.isRunning) {
          log.warn('Speed test timeout reached');
          this.emit('testTimeout');
          this.cancel();
        }
      }, testConfig.maxTime);

      const result = await testPromise;

      clearTimeout(this.testTimeout);
      this.testTimeout = null;

      const endTime = Date.now();
      const testDuration = endTime - startTime;

      const processedResult = this.processTestResult(result, testDuration);

      if (this.databaseService && this.databaseService.isConnected()) {
        await this.databaseService.insertSpeedTestResult(processedResult);
      }

      this.isRunning = false;
      this.currentTest = null;

      log.info(`Speed test completed successfully in ${testDuration}ms`);
      this.emit('testCompleted', processedResult);

      return processedResult;

    } catch (error) {
      clearTimeout(this.testTimeout);
      this.testTimeout = null;

      this.isRunning = false;
      this.currentTest = null;

      log.error('Speed test failed:', error);

      const errorResult = {
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          type: this.categorizeError(error)
        },
        status: 'error'
      };

      if (this.databaseService && this.databaseService.isConnected()) {
        try {
          await this.databaseService.insertSpeedTestError(error);
        } catch (dbError) {
          log.error('Failed to save error to database:', dbError);
        }
      }

      this.emit('testError', errorResult);
      throw error;
    }
  }

  async performSpeedTest(config) {
    try {
      log.debug('Starting speedtest with universal-speedtest');

      let server = null;

      if (config.serverId) {
        const servers = await this.speedtest.listOoklaServers(50);
        server = servers.find(s => s.id === config.serverId);

        if (!server) {
          log.warn(`Server ID ${config.serverId} not found, using auto-select`);
        }
      }

      this.emit('testProgress', { phase: 'start', message: 'テスト開始' });

      this.currentTest = this.speedtest.performOoklaTest(server);

      const result = await this.currentTest;

      log.debug('universal-speedtest result:', result);
      return result;

    } catch (error) {
      log.error('universal-speedtest library error:', error);
      throw new Error(`測定ライブラリエラー: ${error.message}`);
    }
  }

  processTestResult(rawResult, testDuration) {
    try {
      const result = {
        timestamp: new Date().toISOString(),
        testDuration,
        download: {
          bandwidth: rawResult.downloadResult ? this.convertMbpsToBps(rawResult.downloadResult.speed) : 0,
          bytes: rawResult.downloadResult?.transferredBytes || 0,
          elapsed: rawResult.downloadResult?.totalTime || 0
        },
        upload: {
          bandwidth: rawResult.uploadResult ? this.convertMbpsToBps(rawResult.uploadResult.speed) : 0,
          bytes: rawResult.uploadResult?.transferredBytes || 0,
          elapsed: rawResult.uploadResult?.totalTime || 0
        },
        ping: {
          latency: rawResult.pingResult?.latency || 0,
          jitter: rawResult.pingResult?.jitter || null,
          high: null,
          low: null
        },
        server: {
          id: rawResult.bestServer?.id || null,
          name: rawResult.bestServer?.name || 'Unknown',
          host: rawResult.bestServer?.host || null,
          location: rawResult.bestServer?.name || 'Unknown',
          country: rawResult.bestServer?.country || 'Unknown',
          cc: rawResult.bestServer?.cc || null,
          sponsor: rawResult.bestServer?.sponsor || 'Unknown',
          distance: rawResult.bestServer?.distance || null
        },
        result: {
          id: null,
          url: null,
          persisted: false
        },
        interface: {
          internalIp: null,
          name: null,
          macAddr: null,
          isVpn: false,
          externalIp: rawResult.client?.ip || null
        },
        client: {
          ip: rawResult.client?.ip || null,
          isp: rawResult.client?.isp || 'Unknown',
          country: rawResult.client?.country || 'Unknown'
        },
        status: 'completed'
      };

      result.speeds = {
        downloadMbps: rawResult.downloadResult?.speed || 0,
        uploadMbps: rawResult.uploadResult?.speed || 0,
        downloadFormatted: this.formatSpeed(result.download.bandwidth),
        uploadFormatted: this.formatSpeed(result.upload.bandwidth),
        pingFormatted: `${result.ping.latency.toFixed(1)} ms`
      };

      log.info(`Speed test results: ↓${result.speeds.downloadFormatted} ↑${result.speeds.uploadFormatted} ${result.speeds.pingFormatted}`);

      return result;

    } catch (error) {
      log.error('Failed to process test result:', error);
      throw new Error(`測定結果の処理に失敗しました: ${error.message}`);
    }
  }

  convertMbpsToBps(mbps) {
    return Math.round(mbps * 1000000);
  }

  convertBpsToMbps(bps) {
    return Math.round((bps / 1000000) * 100) / 100;
  }

  formatSpeed(bps) {
    const mbps = this.convertBpsToMbps(bps);

    if (mbps >= 1000) {
      return `${(mbps / 1000).toFixed(2)} Gbps`;
    } else if (mbps >= 1) {
      return `${mbps.toFixed(2)} Mbps`;
    } else {
      return `${(bps / 1000).toFixed(0)} Kbps`;
    }
  }

  categorizeError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('connection') ||
        message.includes('timeout') || message.includes('dns')) {
      return 'NETWORK_ERROR';
    } else if (message.includes('server') || message.includes('unavailable')) {
      return 'SERVER_ERROR';
    } else if (message.includes('config') || message.includes('parameter')) {
      return 'CONFIG_ERROR';
    } else if (message.includes('permission') || message.includes('access')) {
      return 'PERMISSION_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  cancel() {
    if (!this.isRunning) {
      log.warn('No test is currently running to cancel');
      return false;
    }

    try {
      if (this.testTimeout) {
        clearTimeout(this.testTimeout);
        this.testTimeout = null;
      }

      this.isRunning = false;
      this.currentTest = null;

      log.info('Speed test cancelled by user');
      this.emit('testCancelled');

      return true;
    } catch (error) {
      log.error('Error cancelling speed test:', error);
      return false;
    }
  }

  async getAvailableServers() {
    try {
      log.info('Fetching available speed test servers...');

      const servers = await this.speedtest.listOoklaServers(50);

      log.info(`Retrieved ${servers.length} available servers`);
      return servers;

    } catch (error) {
      log.error('Failed to get available servers:', error);
      throw new Error(`利用可能なサーバーの取得に失敗しました: ${error.message}`);
    }
  }

  async getBestServer() {
    try {
      log.info('Finding best speed test server...');

      const servers = await this.speedtest.listOoklaServers(10);

      if (servers.length === 0) {
        throw new Error('No servers available');
      }

      const bestServer = servers[0];

      log.info(`Best server found: ${bestServer.sponsor} - ${bestServer.name}`);
      return bestServer;

    } catch (error) {
      log.error('Failed to get best server:', error);
      throw new Error(`最適なサーバーの取得に失敗しました: ${error.message}`);
    }
  }

  setServer(serverId) {
    this.config.serverId = serverId;
    log.info(`Server ID set to: ${serverId}`);
  }

  setTimeout(timeoutMs) {
    if (timeoutMs < 30000 || timeoutMs > 300000) {
      throw new Error('タイムアウト値は30秒から300秒の間で設定してください');
    }

    this.config.maxTime = timeoutMs;
    log.info(`Speed test timeout set to: ${timeoutMs}ms`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      hasCurrentTest: this.currentTest !== null,
      config: { ...this.config }
    };
  }

  onTestProgress(callback) {
    this.on('testProgress', callback);
  }

  onTestStarted(callback) {
    this.on('testStarted', callback);
  }

  onTestCompleted(callback) {
    this.on('testCompleted', callback);
  }

  onTestError(callback) {
    this.on('testError', callback);
  }

  onTestCancelled(callback) {
    this.on('testCancelled', callback);
  }

  onTestTimeout(callback) {
    this.on('testTimeout', callback);
  }

  removeAllListeners() {
    super.removeAllListeners();
    log.info('All SpeedTest service listeners removed');
  }
}

module.exports = SpeedTestService;
