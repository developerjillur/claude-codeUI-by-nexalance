/**
 * Utility Functions for Claude Code Chat Extension
 *
 * This file contains shared utility functions for:
 * - Debouncing and throttling
 * - Caching (LRU cache)
 * - Error handling
 * - Async utilities
 * - Event management
 */

import { CacheEntry, LRUCacheOptions, DebouncedFunction } from './types';

// ==================== Debounce & Throttle ====================

/**
 * Creates a debounced version of a function
 * The function will only be called after it stops being called for the specified wait time
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    waitMs: number
): DebouncedFunction<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    let lastArgs: Parameters<T> | undefined;
    let lastResult: ReturnType<T> | undefined;

    const debounced = (...args: Parameters<T>): void => {
        lastArgs = args;

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            if (lastArgs) {
                lastResult = func(...lastArgs);
            }
            timeoutId = undefined;
        }, waitMs);
    };

    debounced.cancel = (): void => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
        }
    };

    debounced.flush = (): ReturnType<T> | undefined => {
        if (timeoutId && lastArgs) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
            lastResult = func(...lastArgs);
        }
        return lastResult;
    };

    return debounced;
}

/**
 * Creates a throttled version of a function
 * The function will be called at most once per specified time interval
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limitMs: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let lastCall = 0;
    let lastResult: ReturnType<T> | undefined;

    return (...args: Parameters<T>): ReturnType<T> | undefined => {
        const now = Date.now();

        if (now - lastCall >= limitMs) {
            lastCall = now;
            lastResult = func(...args);
        }

        return lastResult;
    };
}

/**
 * Creates a throttled async function that queues calls
 */
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
    func: T,
    limitMs: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
    let lastCall = 0;
    let pendingPromise: Promise<Awaited<ReturnType<T>>> | null = null;

    return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall < limitMs && pendingPromise) {
            return pendingPromise;
        }

        if (timeSinceLastCall < limitMs) {
            await sleep(limitMs - timeSinceLastCall);
        }

        lastCall = Date.now();
        pendingPromise = func(...args);

        try {
            return await pendingPromise;
        } finally {
            pendingPromise = null;
        }
    };
}

// ==================== LRU Cache ====================

/**
 * Least Recently Used (LRU) Cache implementation
 */
export class LRUCache<K, V> {
    private _cache: Map<K, CacheEntry<V>> = new Map();
    private _maxSize: number;
    private _ttlMs: number | undefined;

    constructor(options: LRUCacheOptions) {
        this._maxSize = options.maxSize;
        this._ttlMs = options.ttlMs;
    }

    /**
     * Get a value from the cache
     */
    get(key: K): V | undefined {
        const entry = this._cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check if expired
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this._cache.delete(key);
            return undefined;
        }

        // Move to end (most recently used)
        this._cache.delete(key);
        this._cache.set(key, entry);

        return entry.value;
    }

    /**
     * Set a value in the cache
     */
    set(key: K, value: V, ttlMs?: number): void {
        // Remove if exists (to update position)
        if (this._cache.has(key)) {
            this._cache.delete(key);
        }

        // Evict oldest if at capacity
        if (this._cache.size >= this._maxSize) {
            const oldestKey = this._cache.keys().next().value;
            if (oldestKey !== undefined) {
                this._cache.delete(oldestKey);
            }
        }

        const effectiveTtl = ttlMs ?? this._ttlMs;
        const entry: CacheEntry<V> = {
            value,
            timestamp: Date.now(),
            expiresAt: effectiveTtl ? Date.now() + effectiveTtl : undefined
        };

        this._cache.set(key, entry);
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: K): boolean {
        const entry = this._cache.get(key);

        if (!entry) {
            return false;
        }

        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this._cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete a key from the cache
     */
    delete(key: K): boolean {
        return this._cache.delete(key);
    }

    /**
     * Clear the cache
     */
    clear(): void {
        this._cache.clear();
    }

    /**
     * Get cache size
     */
    get size(): number {
        return this._cache.size;
    }

    /**
     * Get all keys
     */
    keys(): IterableIterator<K> {
        return this._cache.keys();
    }

    /**
     * Clean up expired entries
     */
    cleanup(): number {
        let removed = 0;
        const now = Date.now();

        for (const [key, entry] of this._cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this._cache.delete(key);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; maxSize: number; hitRate?: number } {
        return {
            size: this._cache.size,
            maxSize: this._maxSize
        };
    }
}

// ==================== Async Utilities ====================

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelayMs?: number;
        maxDelayMs?: number;
        backoffMultiplier?: number;
        shouldRetry?: (error: unknown) => boolean;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelayMs = 1000,
        maxDelayMs = 30000,
        backoffMultiplier = 2,
        shouldRetry = () => true
    } = options;

    let lastError: unknown;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }

            await sleep(delay);
            delay = Math.min(delay * backoffMultiplier, maxDelayMs);
        }
    }

    throw lastError;
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId!);
    }
}

/**
 * Execute operations in parallel with concurrency limit
 */
export async function parallelLimit<T, R>(
    items: T[],
    limit: number,
    operation: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let currentIndex = 0;

    async function worker(): Promise<void> {
        while (currentIndex < items.length) {
            const index = currentIndex++;
            results[index] = await operation(items[index], index);
        }
    }

    const workers = Array(Math.min(limit, items.length))
        .fill(null)
        .map(() => worker());

    await Promise.all(workers);
    return results;
}

// ==================== Error Utilities ====================

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return 'Unknown error';
}

/**
 * Safe error stack extraction
 */
export function getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.stack;
    }
    return undefined;
}

/**
 * Type guard to check if error is an Error object
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

/**
 * Create a typed error with additional context
 */
export class ExtensionError extends Error {
    public readonly code: string;
    public readonly context?: Record<string, unknown>;

    constructor(message: string, code: string, context?: Record<string, unknown>) {
        super(message);
        this.name = 'ExtensionError';
        this.code = code;
        this.context = context;
    }
}

// ==================== Event Emitter ====================

type EventCallback<T = any> = (data: T) => void;

/**
 * Simple typed event emitter
 */
export class EventEmitter<Events extends Record<string, any>> {
    private _listeners: Map<keyof Events, Set<EventCallback>> = new Map();

    /**
     * Subscribe to an event
     */
    on<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event)!.add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event (one time only)
     */
    once<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
        const wrapper = (data: Events[K]) => {
            this.off(event, wrapper);
            callback(data);
        };
        return this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     */
    off<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): void {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    /**
     * Emit an event
     */
    emit<K extends keyof Events>(event: K, data: Events[K]): void {
        const listeners = this._listeners.get(event);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${String(event)}:`, getErrorMessage(error));
                }
            }
        }
    }

    /**
     * Remove all listeners for an event or all events
     */
    removeAllListeners(event?: keyof Events): void {
        if (event) {
            this._listeners.delete(event);
        } else {
            this._listeners.clear();
        }
    }

    /**
     * Get listener count for an event
     */
    listenerCount(event: keyof Events): number {
        return this._listeners.get(event)?.size ?? 0;
    }
}

// ==================== String Utilities ====================

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
    if (str.length <= maxLength) {
        return str;
    }
    return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = ''): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Sanitize string for use as filename
 */
export function sanitizeFilename(str: string): string {
    return str
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 200);
}

// ==================== Object Utilities ====================

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as T;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as T;
    }

    if (obj instanceof Map) {
        return new Map(Array.from(obj.entries()).map(([k, v]) => [k, deepClone(v)])) as T;
    }

    if (obj instanceof Set) {
        return new Set(Array.from(obj).map(v => deepClone(v))) as T;
    }

    const cloned: Record<string, unknown> = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
        }
    }
    return cloned as T;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target;

    const source = sources.shift();
    if (source === undefined) return target;

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
                // Recursively merge plain objects
                const merged = deepMerge(
                    { ...targetValue } as Record<string, unknown>,
                    sourceValue as Record<string, unknown>
                );
                (target as Record<string, unknown>)[key] = merged;
            } else if (sourceValue !== undefined) {
                (target as Record<string, unknown>)[key] = sourceValue;
            }
        }
    }

    return deepMerge(target, ...sources);
}

/**
 * Check if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && value.constructor === Object;
}

// ==================== Lazy Initialization ====================

/**
 * Lazy initialization wrapper
 */
export class Lazy<T> {
    private _value: T | undefined;
    private _initialized = false;
    private readonly _initializer: () => T;

    constructor(initializer: () => T) {
        this._initializer = initializer;
    }

    get value(): T {
        if (!this._initialized) {
            this._value = this._initializer();
            this._initialized = true;
        }
        return this._value!;
    }

    get isInitialized(): boolean {
        return this._initialized;
    }

    reset(): void {
        this._value = undefined;
        this._initialized = false;
    }
}

/**
 * Async lazy initialization wrapper
 */
export class AsyncLazy<T> {
    private _value: T | undefined;
    private _initialized = false;
    private _initializing: Promise<T> | null = null;
    private readonly _initializer: () => Promise<T>;

    constructor(initializer: () => Promise<T>) {
        this._initializer = initializer;
    }

    async getValue(): Promise<T> {
        if (this._initialized) {
            return this._value!;
        }

        if (this._initializing) {
            return this._initializing;
        }

        this._initializing = this._initializer();

        try {
            this._value = await this._initializing;
            this._initialized = true;
            return this._value;
        } finally {
            this._initializing = null;
        }
    }

    get isInitialized(): boolean {
        return this._initialized;
    }

    reset(): void {
        this._value = undefined;
        this._initialized = false;
        this._initializing = null;
    }
}
