// Memory optimization utilities for EventLink platform
import { performance } from 'perf_hooks';

// Memory monitoring and cleanup utilities
export class MemoryManager {
  private static instance: MemoryManager;
  private memoryUsageHistory: number[] = [];
  private maxHistoryLength = 100;
  private cleanupIntervals: NodeJS.Timeout[] = [];

  private constructor() {
    this.startMemoryMonitoring();
    this.setupCleanupRoutines();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  // Monitor memory usage over time
  private startMemoryMonitoring() {
    const interval = setInterval(() => {
      const usage = process.memoryUsage();
      const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      this.memoryUsageHistory.push(usedMB);
      if (this.memoryUsageHistory.length > this.maxHistoryLength) {
        this.memoryUsageHistory.shift();
      }

      // Log warning if memory usage is consistently high
      if (usedMB > 500) { // 500MB threshold
        console.warn(`⚠️  High memory usage detected: ${usedMB}MB`);
      }
    }, 30000); // Check every 30 seconds

    this.cleanupIntervals.push(interval);
  }

  // Setup automatic cleanup routines
  private setupCleanupRoutines() {
    // Force garbage collection periodically (if --expose-gc flag is used)
    const gcInterval = setInterval(() => {
      if (global.gc) {
        global.gc();
      }
    }, 300000); // Every 5 minutes

    this.cleanupIntervals.push(gcInterval);
  }

  // Get current memory statistics
  getMemoryStats() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // Resident Set Size
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // Used heap
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // Total heap
      external: Math.round(usage.external / 1024 / 1024), // External memory
      history: this.memoryUsageHistory.slice(-10) // Last 10 measurements
    };
  }

  // Performance monitoring wrapper
  measurePerformance<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now();
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const end = performance.now();
        if (end - start > 1000) { // Log slow operations (>1s)
          console.warn(`🐌 Slow operation "${label}": ${Math.round(end - start)}ms`);
        }
      });
    } else {
      const end = performance.now();
      if (end - start > 100) { // Log slow sync operations (>100ms)
        console.warn(`🐌 Slow sync operation "${label}": ${Math.round(end - start)}ms`);
      }
      return result;
    }
  }

  // Cleanup on app shutdown
  cleanup() {
    this.cleanupIntervals.forEach(interval => clearInterval(interval));
    console.log('🧹 Memory manager cleanup completed');
  }
}

// Enhanced cache with memory-aware limits
export class MemoryAwareCache<T> {
  private cache = new Map<string, { data: T; expiry: number; size: number }>();
  private maxMemoryMB: number;
  private currentMemoryMB: number = 0;

  constructor(maxMemoryMB: number = 50) { // 50MB default limit
    this.maxMemoryMB = maxMemoryMB;
  }

  set(key: string, data: T, ttlSeconds: number = 300): boolean {
    const size = this.estimateSize(data);
    const expiry = Date.now() + (ttlSeconds * 1000);

    // Check if adding this item would exceed memory limit
    if (this.currentMemoryMB + size > this.maxMemoryMB) {
      this.evictLRU(); // Remove least recently used items
    }

    // Still too large? Skip caching
    if (size > this.maxMemoryMB / 2) {
      console.warn(`⚠️  Item too large to cache: ${size}MB`);
      return false;
    }

    this.cache.set(key, { data, expiry, size });
    this.currentMemoryMB += size;
    return true;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.currentMemoryMB -= item.size;
      return this.cache.delete(key);
    }
    return false;
  }

  private estimateSize(data: any): number {
    // Rough estimation of object size in MB
    const jsonString = JSON.stringify(data);
    return jsonString.length / (1024 * 1024);
  }

  private evictLRU() {
    // Simple eviction - remove 25% of oldest items
    const entries = Array.from(this.cache.entries());
    const toRemove = Math.ceil(entries.length * 0.25);
    
    for (let i = 0; i < toRemove && entries.length > 0; i++) {
      const [key] = entries[i];
      this.delete(key);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      memoryUsedMB: this.currentMemoryMB,
      memoryLimitMB: this.maxMemoryMB,
      memoryUtilization: (this.currentMemoryMB / this.maxMemoryMB) * 100
    };
  }
}

// Initialize memory manager
export const memoryManager = MemoryManager.getInstance();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('🔄 Graceful shutdown initiated...');
  memoryManager.cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Graceful shutdown initiated...');
  memoryManager.cleanup();  
  process.exit(0);
});