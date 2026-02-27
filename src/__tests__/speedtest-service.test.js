/**
 * SpeedTestService Unit Tests
 */

const SpeedTestService = require('../services/speedtest-service');

describe('SpeedTestService', () => {
  let service;
  let mockDatabaseService;

  beforeEach(() => {
    mockDatabaseService = {
      isConnected: jest.fn().mockReturnValue(true),
      insertSpeedTestResult: jest.fn().mockResolvedValue(true),
      insertSpeedTestError: jest.fn().mockResolvedValue(true),
    };

    service = new SpeedTestService(mockDatabaseService);
  });

  afterEach(() => {
    if (service) {
      service.removeAllListeners();
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(service.isRunning).toBe(false);
      expect(service.config.maxTime).toBe(120000);
      expect(service.config.measureDownload).toBe(true);
      expect(service.config.measureUpload).toBe(true);
    });

    it('should store database service reference', () => {
      expect(service.databaseService).toBe(mockDatabaseService);
    });
  });

  describe('convertBpsToMbps', () => {
    it('should convert bps to Mbps correctly', () => {
      expect(service.convertBpsToMbps(1000000)).toBe(1);
      expect(service.convertBpsToMbps(125000000)).toBe(125);
      expect(service.convertBpsToMbps(500000)).toBe(0.5);
    });
  });

  describe('convertMbpsToBps', () => {
    it('should convert Mbps to bps correctly', () => {
      expect(service.convertMbpsToBps(1)).toBe(1000000);
      expect(service.convertMbpsToBps(125)).toBe(125000000);
      expect(service.convertMbpsToBps(0.5)).toBe(500000);
    });
  });

  describe('formatSpeed', () => {
    it('should format speed in Mbps for normal speeds', () => {
      expect(service.formatSpeed(125000000)).toBe('125.00 Mbps');
      expect(service.formatSpeed(1000000)).toBe('1.00 Mbps');
    });

    it('should format speed in Gbps for high speeds', () => {
      expect(service.formatSpeed(1500000000)).toBe('1.50 Gbps');
    });

    it('should format speed in Kbps for low speeds', () => {
      expect(service.formatSpeed(500000)).toBe('500 Kbps');
    });
  });

  describe('categorizeError', () => {
    it('should categorize network errors', () => {
      const error = new Error('network connection failed');
      expect(service.categorizeError(error)).toBe('NETWORK_ERROR');
    });

    it('should categorize timeout errors', () => {
      const error = new Error('request timeout');
      expect(service.categorizeError(error)).toBe('NETWORK_ERROR');
    });

    it('should categorize server errors', () => {
      const error = new Error('server unavailable');
      expect(service.categorizeError(error)).toBe('SERVER_ERROR');
    });

    it('should categorize unknown errors', () => {
      const error = new Error('something went wrong');
      expect(service.categorizeError(error)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('setTimeout', () => {
    it('should set timeout within valid range', () => {
      service.setTimeout(60000);
      expect(service.config.maxTime).toBe(60000);
    });

    it('should throw error for timeout below minimum', () => {
      expect(() => service.setTimeout(20000)).toThrow();
    });

    it('should throw error for timeout above maximum', () => {
      expect(() => service.setTimeout(400000)).toThrow();
    });
  });

  describe('setServer', () => {
    it('should set server ID', () => {
      service.setServer(12345);
      expect(service.config.serverId).toBe(12345);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = service.getStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('hasCurrentTest');
      expect(status).toHaveProperty('config');
      expect(status.isRunning).toBe(false);
    });
  });

  describe('processTestResult', () => {
    it('should process successful test result', () => {
      const rawResult = {
        downloadResult: {
          speed: 100,
          transferredBytes: 10000000,
          totalTime: 5000,
        },
        uploadResult: {
          speed: 50,
          transferredBytes: 5000000,
          totalTime: 3000,
        },
        pingResult: {
          latency: 15.5,
          jitter: 2.3,
        },
        bestServer: {
          id: 12345,
          name: 'Test Server',
          host: 'test.example.com',
          country: 'Japan',
          cc: 'JP',
          sponsor: 'Test ISP',
          distance: 10.5,
        },
        client: {
          ip: '192.168.1.1',
          isp: 'Test ISP',
          country: 'Japan',
        },
      };

      const result = service.processTestResult(rawResult, 10000);

      expect(result.status).toBe('completed');
      expect(result.testDuration).toBe(10000);
      expect(result.speeds.downloadMbps).toBe(100);
      expect(result.speeds.uploadMbps).toBe(50);
      expect(result.ping.latency).toBe(15.5);
      expect(result.server.name).toBe('Test Server');
      expect(result.client.isp).toBe('Test ISP');
    });
  });
});
