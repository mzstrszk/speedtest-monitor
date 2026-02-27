const schedule = require('node-schedule');
const EventEmitter = require('events');
const log = require('electron-log');

class SchedulerService extends EventEmitter {
  constructor(speedTestService, configService) {
    super();
    
    this.speedTestService = speedTestService;
    this.configService = configService;
    
    this.job = null;
    this.isRunning = false;
    this.nextRunTime = null;
    this.runCount = 0;
    this.lastRunTime = null;
    this.lastRunResult = null;
    
    this.quietHoursJob = null;
    this.isInQuietHours = false;
    
    this.setupConfigWatcher();
    this.setupSpeedTestListeners();
  }

  setupConfigWatcher() {
    this.configService.onConfigChange((key, _newValue, _oldValue) => {
      if (key === 'measurementInterval' || key === 'schedulerSettings') {
        log.info(`Scheduler config changed: ${key}`);
        if (this.isRunning) {
          this.restart();
        }
      }
    });
  }

  setupSpeedTestListeners() {
    this.speedTestService.onTestStarted(() => {
      this.emit('testStarted');
    });

    this.speedTestService.onTestCompleted((result) => {
      this.runCount++;
      this.lastRunTime = new Date();
      this.lastRunResult = result;
      
      log.info(`Scheduled test completed (#${this.runCount})`);
      this.emit('testCompleted', result);
    });

    this.speedTestService.onTestError((error) => {
      this.lastRunTime = new Date();
      this.lastRunResult = { error: true, message: error.message };
      
      log.error('Scheduled test failed:', error);
      this.emit('testError', error);
    });
  }

  async start() {
    if (this.isRunning) {
      log.warn('Scheduler is already running');
      return false;
    }

    try {
      const schedulerSettings = this.configService.get('schedulerSettings');
      
      if (!schedulerSettings.enabled) {
        log.info('Scheduler is disabled in settings');
        return false;
      }

      const intervalMinutes = schedulerSettings.intervalMinutes || 60;
      
      this.scheduleRegularTests(intervalMinutes);
      
      if (schedulerSettings.quietHoursEnabled) {
        this.setupQuietHours(schedulerSettings);
      }
      
      this.isRunning = true;
      this.updateNextRunTime();
      
      log.info(`Scheduler started with ${intervalMinutes} minute interval`);
      this.emit('started');
      
      return true;
    } catch (error) {
      log.error('Failed to start scheduler:', error);
      throw error;
    }
  }

  scheduleRegularTests(intervalMinutes) {
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    this.job = schedule.scheduleJob(cronExpression, async () => {
      if (this.isInQuietHours) {
        log.info('Skipping scheduled test due to quiet hours');
        return;
      }

      if (this.speedTestService.isRunning) {
        log.warn('Skipping scheduled test - another test is already running');
        return;
      }

      try {
        log.info('Running scheduled speed test...');
        await this.speedTestService.runTest();
        this.updateNextRunTime();
      } catch (error) {
        log.error('Scheduled speed test failed:', error);
      }
    });

    log.info(`Regular tests scheduled with cron: ${cronExpression}`);
  }

  setupQuietHours(settings) {
    const { quietHoursStart, quietHoursEnd } = settings;
    
    if (!quietHoursStart || !quietHoursEnd) {
      log.warn('Quiet hours enabled but times not properly configured');
      return;
    }

    try {
      const [startHour, startMinute] = quietHoursStart.split(':').map(Number);
      const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);

      const startCron = `${startMinute} ${startHour} * * *`;
      const endCron = `${endMinute} ${endHour} * * *`;

      this.quietHoursJob = {
        start: schedule.scheduleJob(startCron, () => {
          this.isInQuietHours = true;
          log.info('Entering quiet hours - scheduled tests will be skipped');
          this.emit('quietHoursStarted');
        }),
        end: schedule.scheduleJob(endCron, () => {
          this.isInQuietHours = false;
          log.info('Exiting quiet hours - scheduled tests will resume');
          this.emit('quietHoursEnded');
        })
      };

      this.checkInitialQuietHoursState(startHour, startMinute, endHour, endMinute);
      
      log.info(`Quiet hours scheduled: ${quietHoursStart} - ${quietHoursEnd}`);
    } catch (error) {
      log.error('Failed to setup quiet hours:', error);
    }
  }

  checkInitialQuietHoursState(startHour, startMinute, endHour, endMinute) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    let isInQuietHours = false;
    
    if (startTotalMinutes < endTotalMinutes) {
      isInQuietHours = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
    } else {
      isInQuietHours = currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes;
    }

    this.isInQuietHours = isInQuietHours;
    
    if (isInQuietHours) {
      log.info('Currently in quiet hours period');
    }
  }

  async stop() {
    if (!this.isRunning) {
      log.warn('Scheduler is not running');
      return false;
    }

    try {
      if (this.job) {
        this.job.cancel();
        this.job = null;
      }

      if (this.quietHoursJob) {
        if (this.quietHoursJob.start) {
          this.quietHoursJob.start.cancel();
        }
        if (this.quietHoursJob.end) {
          this.quietHoursJob.end.cancel();
        }
        this.quietHoursJob = null;
      }

      this.isRunning = false;
      this.nextRunTime = null;
      this.isInQuietHours = false;

      log.info('Scheduler stopped');
      this.emit('stopped');
      
      return true;
    } catch (error) {
      log.error('Failed to stop scheduler:', error);
      throw error;
    }
  }

  async restart() {
    log.info('Restarting scheduler...');
    
    await this.stop();
    await this.start();
    
    log.info('Scheduler restarted');
    this.emit('restarted');
  }

  updateNextRunTime() {
    if (this.job && this.job.nextInvocation) {
      this.nextRunTime = this.job.nextInvocation();
    } else {
      this.nextRunTime = null;
    }
  }

  async runTestNow() {
    if (!this.isRunning) {
      throw new Error('スケジューラーが実行されていません');
    }

    if (this.speedTestService.isRunning) {
      throw new Error('測定が既に実行中です');
    }

    try {
      log.info('Running manual test through scheduler...');
      const result = await this.speedTestService.runTest();
      
      this.emit('manualTestCompleted', result);
      return result;
    } catch (error) {
      log.error('Manual test through scheduler failed:', error);
      this.emit('manualTestError', error);
      throw error;
    }
  }

  getStatus() {
    const schedulerSettings = this.configService.get('schedulerSettings');
    
    return {
      isRunning: this.isRunning,
      isEnabled: schedulerSettings.enabled,
      intervalMinutes: schedulerSettings.intervalMinutes,
      nextRunTime: this.nextRunTime ? this.nextRunTime.toISOString() : null,
      lastRunTime: this.lastRunTime ? this.lastRunTime.toISOString() : null,
      runCount: this.runCount,
      lastRunResult: this.lastRunResult,
      quietHours: {
        enabled: schedulerSettings.quietHoursEnabled,
        isInQuietHours: this.isInQuietHours,
        start: schedulerSettings.quietHoursStart,
        end: schedulerSettings.quietHoursEnd
      }
    };
  }

  getNextRunInfo() {
    if (!this.nextRunTime) {
      return null;
    }

    const now = new Date();
    const timeDiff = this.nextRunTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      return {
        nextRun: this.nextRunTime.toISOString(),
        timeUntilNext: '実行中または直後',
        minutesUntilNext: 0
      };
    }

    const minutesUntilNext = Math.ceil(timeDiff / (1000 * 60));
    
    return {
      nextRun: this.nextRunTime.toISOString(),
      timeUntilNext: this.formatTimeUntilNext(timeDiff),
      minutesUntilNext
    };
  }

  formatTimeUntilNext(timeDiff) {
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    } else {
      return `${minutes}分`;
    }
  }

  getRunHistory() {
    return {
      totalRuns: this.runCount,
      lastRunTime: this.lastRunTime,
      lastRunResult: this.lastRunResult
    };
  }

  updateInterval(intervalMinutes) {
    if (intervalMinutes < 5 || intervalMinutes > 1440) {
      throw new Error('測定間隔は5分から1440分（24時間）の間で設定してください');
    }

    const currentSettings = this.configService.get('schedulerSettings');
    const newSettings = {
      ...currentSettings,
      intervalMinutes
    };

    this.configService.set('schedulerSettings', newSettings);
    
    log.info(`Measurement interval updated to ${intervalMinutes} minutes`);
    
    if (this.isRunning) {
      this.restart();
    }
  }

  updateQuietHours(enabled, startTime = null, endTime = null) {
    const currentSettings = this.configService.get('schedulerSettings');
    const newSettings = {
      ...currentSettings,
      quietHoursEnabled: enabled
    };

    if (enabled && startTime && endTime) {
      if (!this.validateTimeFormat(startTime) || !this.validateTimeFormat(endTime)) {
        throw new Error('時間は HH:MM 形式で入力してください');
      }
      
      newSettings.quietHoursStart = startTime;
      newSettings.quietHoursEnd = endTime;
    }

    this.configService.set('schedulerSettings', newSettings);
    
    log.info(`Quiet hours updated: enabled=${enabled}, ${startTime}-${endTime}`);
    
    if (this.isRunning) {
      this.restart();
    }
  }

  validateTimeFormat(timeString) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  }

  onStarted(callback) {
    this.on('started', callback);
  }

  onStopped(callback) {
    this.on('stopped', callback);
  }

  onRestarted(callback) {
    this.on('restarted', callback);
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

  onQuietHoursStarted(callback) {
    this.on('quietHoursStarted', callback);
  }

  onQuietHoursEnded(callback) {
    this.on('quietHoursEnded', callback);
  }

  removeAllListeners() {
    super.removeAllListeners();
    log.info('All Scheduler service listeners removed');
  }
}

module.exports = SchedulerService;