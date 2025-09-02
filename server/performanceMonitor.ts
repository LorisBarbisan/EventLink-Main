// Comprehensive performance monitoring and alerting system for EventLink
import { performance } from 'perf_hooks';
import { Request, Response, NextFunction } from 'express';
import { memoryManager } from './memoryOptimization';

interface PerformanceMetrics {
  timestamp: number;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  memoryUsed: number;
  cpuUsage: number;
}

interface AlertThresholds {
  slowRequestMs: number;
  highMemoryMB: number;
  errorRate: number;
  cpuPercent: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory = 1000;
  private alertThresholds: AlertThresholds = {
    slowRequestMs: 2000,     // 2 seconds
    highMemoryMB: 512,       // 512MB
    errorRate: 0.05,         // 5% error rate
    cpuPercent: 80           // 80% CPU usage
  };
  private alertCooldown = new Map<string, number>();
  private readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.startCpuMonitoring();
    this.startPeriodicReporting();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Express middleware for automatic request monitoring
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Override res.end to capture response data
      const originalEnd = res.end.bind(res);
      
      res.end = function(chunk?: any, encoding?: any, cb?: any) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        const endMemory = process.memoryUsage().heapUsed;

        // Record performance metrics
        const metric: PerformanceMetrics = {
          timestamp: Date.now(),
          endpoint: req.path,
          method: req.method,
          responseTime,
          statusCode: res.statusCode,
          memoryUsed: Math.round(endMemory / 1024 / 1024),
          cpuUsage: process.cpuUsage().user / 1000000 // Convert to seconds
        };

        PerformanceMonitor.getInstance().recordMetric(metric);

        // Call original res.end with proper arguments
        return originalEnd(chunk, encoding, cb);
      };

      next();
    };
  }

  private recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep metrics history limited
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // Check for alerts
    this.checkAlerts(metric);
  }

  private checkAlerts(metric: PerformanceMetrics) {
    const now = Date.now();

    // Slow request alert
    if (metric.responseTime > this.alertThresholds.slowRequestMs) {
      this.sendAlert('slow_request', {
        message: `Slow request detected: ${metric.endpoint} took ${Math.round(metric.responseTime)}ms`,
        severity: 'warning',
        metric
      });
    }

    // High memory alert
    if (metric.memoryUsed > this.alertThresholds.highMemoryMB) {
      this.sendAlert('high_memory', {
        message: `High memory usage: ${metric.memoryUsed}MB`,
        severity: 'warning',
        metric
      });
    }

    // Error rate alert (check last 50 requests)
    const recentMetrics = this.metrics.slice(-50);
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = errorCount / recentMetrics.length;
    
    if (errorRate > this.alertThresholds.errorRate && recentMetrics.length >= 10) {
      this.sendAlert('high_error_rate', {
        message: `High error rate: ${Math.round(errorRate * 100)}% of recent requests failed`,
        severity: 'critical',
        metric
      });
    }
  }

  private sendAlert(type: string, alert: any) {
    const now = Date.now();
    const lastAlert = this.alertCooldown.get(type) || 0;

    // Respect cooldown period
    if (now - lastAlert < this.COOLDOWN_MS) {
      return;
    }

    this.alertCooldown.set(type, now);

    // In production, you'd send this to a monitoring service
    console.warn(`🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.message}`);
    
    // For now, just log. In production, integrate with:
    // - Email notifications
    // - Slack webhooks  
    // - PagerDuty
    // - DataDog/New Relic
  }

  private startCpuMonitoring() {
    let lastCpuUsage = process.cpuUsage();
    
    setInterval(() => {
      const currentCpuUsage = process.cpuUsage(lastCpuUsage);
      const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000 * 100; // Convert to percentage
      
      if (cpuPercent > this.alertThresholds.cpuPercent) {
        this.sendAlert('high_cpu', {
          message: `High CPU usage: ${Math.round(cpuPercent)}%`,
          severity: 'warning',
          cpuPercent
        });
      }
      
      lastCpuUsage = process.cpuUsage();
    }, 60000); // Check every minute
  }

  private startPeriodicReporting() {
    setInterval(() => {
      const report = this.generateReport();
      console.log(`📊 Performance Report: ${JSON.stringify(report, null, 2)}`);
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  // Generate performance report
  generateReport() {
    if (this.metrics.length === 0) {
      return { message: 'No metrics available' };
    }

    const recentMetrics = this.metrics.slice(-100); // Last 100 requests
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = errorCount / recentMetrics.length;
    const memoryStats = memoryManager.getMemoryStats();

    const slowestEndpoints = recentMetrics
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 5)
      .map(m => ({ endpoint: m.endpoint, time: Math.round(m.responseTime) }));

    return {
      timestamp: new Date().toISOString(),
      totalRequests: recentMetrics.length,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100) + '%',
      memory: memoryStats,
      slowestEndpoints,
      alerts: {
        thresholds: this.alertThresholds,
        recentAlerts: Array.from(this.alertCooldown.keys()).length
      }
    };
  }

  // Health check endpoint data
  getHealthCheck() {
    const memoryStats = memoryManager.getMemoryStats();
    const recentMetrics = this.metrics.slice(-20);
    const avgResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length 
      : 0;

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: memoryStats,
      averageResponseTime: Math.round(avgResponseTime),
      requestsInLast5Min: recentMetrics.length,
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  // Get performance analytics for dashboard
  getAnalytics(hours: number = 1) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const relevantMetrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    if (relevantMetrics.length === 0) {
      return { message: 'No data for specified time range' };
    }

    // Group by endpoint
    const endpointStats = relevantMetrics.reduce((acc, metric) => {
      if (!acc[metric.endpoint]) {
        acc[metric.endpoint] = {
          count: 0,
          totalTime: 0,
          errors: 0,
          maxTime: 0
        };
      }
      
      acc[metric.endpoint].count++;
      acc[metric.endpoint].totalTime += metric.responseTime;
      acc[metric.endpoint].maxTime = Math.max(acc[metric.endpoint].maxTime, metric.responseTime);
      
      if (metric.statusCode >= 400) {
        acc[metric.endpoint].errors++;
      }
      
      return acc;
    }, {} as any);

    // Calculate averages and format data
    const analytics = Object.entries(endpointStats).map(([endpoint, stats]: [string, any]) => ({
      endpoint,
      requests: stats.count,
      avgResponseTime: Math.round(stats.totalTime / stats.count),
      maxResponseTime: Math.round(stats.maxTime),
      errorRate: Math.round((stats.errors / stats.count) * 100),
      requestsPerHour: Math.round((stats.count / hours))
    }));

    return {
      timeRange: `${hours} hour(s)`,
      totalRequests: relevantMetrics.length,
      endpoints: analytics.sort((a, b) => b.requests - a.requests)
    };
  }
}

// Initialize performance monitor
export const performanceMonitor = PerformanceMonitor.getInstance();