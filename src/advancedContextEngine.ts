import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import { ProjectMemoryManager, MemoryEntity, MemorySearchResult, EntityType, MemoryRelation } from './projectMemoryManager';

const { readFile, writeFile, mkdir, appendFile } = fs;

/**
 * Advanced Context Engine for Claude Code Chat
 *
 * Inspired by research from:
 * - Anthropic's Context Engineering guide
 * - Manus AI's context engineering lessons
 * - LangChain's agent context patterns
 * - Mem0's graph-based memory architecture
 * - Cursor's Priompt and Shadow Workspace patterns
 *
 * Key Features:
 * 1. Priority-based Context Management (Priompt-like)
 * 2. Graph-based Memory with Conflict Detection (Mem0-style)
 * 3. Memory Decay and Consolidation
 * 4. Semantic Chunking and Retrieval
 * 5. Context Compression with Restorable Pointers
 * 6. Attention Manipulation via Scratchpad (Manus-style)
 * 7. KV-Cache Optimization Awareness
 * 8. Self-Verification Loop Integration
 */

// ==================== Types ====================

/**
 * Priority tiers for context items (Priompt-inspired)
 */
export type ContextPriority = 'critical' | 'high' | 'medium' | 'low' | 'disposable';

/**
 * Memory types following cognitive science patterns
 */
export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';

/**
 * Context item with priority metadata
 */
export interface PrioritizedContextItem {
    id: string;
    content: string;
    priority: ContextPriority;
    memoryType: MemoryType;
    tokenEstimate: number;
    relevanceScore: number;
    recencyScore: number;
    usageCount: number;
    lastAccessedAt: string;
    createdAt: string;
    expiresAt?: string;
    sourceType: 'rule' | 'memory' | 'file' | 'conversation' | 'scratchpad' | 'task';
    metadata: {
        entityRef?: string;
        fileRef?: string;
        canRestore?: boolean;  // Can be dropped and restored later
        restoreHint?: string;  // How to restore (file path, entity name, etc.)
        isCompressed?: boolean;
        originalTokens?: number;
    };
}

/**
 * Graph node for entity relationships (Mem0-style)
 */
export interface MemoryGraphNode {
    entityName: string;
    entityType: EntityType;
    embedding?: number[];  // Semantic embedding (simulated)
    connections: MemoryGraphEdge[];
    temporalMarkers: {
        createdAt: string;
        lastAccessedAt: string;
        accessCount: number;
        decayScore: number;  // 0-1, lower = more decayed
    };
}

/**
 * Graph edge for relationships
 */
export interface MemoryGraphEdge {
    targetEntity: string;
    relationType: string;
    strength: number;  // 0-1
    isValid: boolean;  // For conflict resolution (mark invalid vs delete)
    createdAt: string;
    metadata?: Record<string, any>;
}

/**
 * Scratchpad entry for attention manipulation (Manus-style)
 */
export interface ScratchpadEntry {
    id: string;
    type: 'todo' | 'note' | 'decision' | 'observation' | 'goal';
    content: string;
    priority: number;  // 1-10
    status: 'active' | 'completed' | 'cancelled';
    createdAt: string;
    updatedAt: string;
}

/**
 * Context budget allocation
 */
export interface ContextBudget {
    totalTokens: number;
    allocations: {
        critical: number;      // Rules, system prompts (never dropped)
        high: number;          // Active files, recent decisions
        medium: number;        // Related context, older history
        low: number;           // Background info, can be summarized
        disposable: number;    // Can be dropped entirely
    };
    reserved: {
        response: number;      // Reserved for model response
        safety: number;        // Safety buffer
    };
}

/**
 * Session state for tracking
 */
export interface EnhancedSessionState {
    sessionId: string;
    startedAt: string;
    messageCount: number;
    estimatedTokens: number;
    lastPromptTokens: number;
    contextHistory: Array<{
        timestamp: string;
        tokensUsed: number;
        itemsIncluded: number;
    }>;
    compressionEvents: number;
    isStale: boolean;
}

/**
 * Context generation result
 */
export interface ContextGenerationResult {
    context: string;
    tokenEstimate: number;
    includedItems: PrioritizedContextItem[];
    droppedItems: PrioritizedContextItem[];
    compressionApplied: boolean;
    confidence: number;
    recommendations: string[];
    debug: {
        priorityBreakdown: Record<ContextPriority, number>;
        memoryTypeBreakdown: Record<MemoryType, number>;
        droppedReason: Record<string, string>;
    };
}

// ==================== Main Class ====================

export class AdvancedContextEngine {
    private _memoryManager: ProjectMemoryManager | null = null;
    private _workspacePath: string | undefined;
    private _isInitialized: boolean = false;

    // Context items pool
    private _contextPool: Map<string, PrioritizedContextItem> = new Map();

    // Memory graph for relationships
    private _memoryGraph: Map<string, MemoryGraphNode> = new Map();

    // Scratchpad for attention manipulation
    private _scratchpad: Map<string, ScratchpadEntry> = new Map();

    // Session state
    private _sessionState: EnhancedSessionState | null = null;

    // Configuration
    private readonly _config = {
        // Token limits (Claude context window)
        maxContextTokens: 200000,
        defaultResponseReserve: 16000,
        safetyBuffer: 5000,

        // Priority allocations (percentage of available tokens)
        priorityAllocations: {
            critical: 0.15,    // 15% for rules, system prompts
            high: 0.35,       // 35% for active context
            medium: 0.30,     // 30% for supporting context
            low: 0.15,        // 15% for background
            disposable: 0.05  // 5% for optional
        },

        // Memory decay settings
        decayHalfLifeHours: 24,  // Memory loses 50% relevance in 24 hours
        minDecayScore: 0.1,      // Minimum decay (never fully forget)
        accessBoostFactor: 1.5,  // How much access boosts relevance

        // Compression thresholds
        compressionThreshold: 0.85,  // Start compressing at 85% capacity
        aggressiveCompressionThreshold: 0.95,  // Aggressive compression at 95%

        // Relevance scoring weights
        relevanceWeights: {
            keywordMatch: 0.3,
            semanticSimilarity: 0.25,
            recency: 0.2,
            frequency: 0.15,
            graphConnection: 0.1
        },

        // Scratchpad settings
        maxScratchpadItems: 20,
        scratchpadBoostFactor: 2.0  // Boost recent scratchpad items
    };

    // Paths
    private _scratchpadPath: string | undefined;
    private _graphPath: string | undefined;

    constructor() {}

    /**
     * Initialize the advanced context engine
     */
    public async initialize(
        memoryManager: ProjectMemoryManager,
        workspacePath?: string
    ): Promise<boolean> {
        try {
            this._memoryManager = memoryManager;
            this._workspacePath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            if (!this._memoryManager || !this._memoryManager.isInitialized()) {
                console.log('AdvancedContextEngine: Memory manager not available');
                return false;
            }

            if (this._workspacePath) {
                const claudeDir = path.join(this._workspacePath, '.claude');
                this._scratchpadPath = path.join(claudeDir, 'scratchpad.json');
                this._graphPath = path.join(claudeDir, 'memory-graph.json');

                // Load existing data
                await this._loadScratchpad();
                await this._loadMemoryGraph();
            }

            // Initialize session state
            this._initializeSession();

            // Build initial context pool from memory
            await this._buildContextPoolFromMemory();

            this._isInitialized = true;
            console.log('AdvancedContextEngine: Initialized successfully');
            return true;
        } catch (error: any) {
            console.error('AdvancedContextEngine: Initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Check if initialized
     */
    public isInitialized(): boolean {
        return this._isInitialized && this._memoryManager !== null;
    }

    // ==================== Priority-Based Context Management ====================

    /**
     * Generate optimized context for a prompt (Priompt-inspired)
     */
    public async generateOptimizedContext(
        userPrompt: string,
        options: {
            maxTokens?: number;
            includeRules?: boolean;
            includeScratchpad?: boolean;
            forceItems?: string[];
        } = {}
    ): Promise<ContextGenerationResult> {
        if (!this._isInitialized) {
            return this._emptyContextResult('Engine not initialized');
        }

        const budget = this._calculateContextBudget(options.maxTokens);
        const promptAnalysis = this._analyzePromptIntent(userPrompt);

        // Update scratchpad with current task context
        if (options.includeScratchpad !== false) {
            await this._updateScratchpadFromPrompt(userPrompt, promptAnalysis);
        }

        // Step 1: Collect all potential context items
        const candidates = await this._collectContextCandidates(userPrompt, promptAnalysis);

        // Step 2: Score and rank items
        const scoredItems = this._scoreAndRankItems(candidates, promptAnalysis);

        // Step 3: Apply priority-based selection within budget
        const selectedItems = this._selectItemsWithinBudget(scoredItems, budget, options.forceItems);

        // Step 4: Apply compression if needed
        const { items: finalItems, compressionApplied } = await this._applyCompressionIfNeeded(
            selectedItems,
            budget
        );

        // Step 5: Build the context string
        const context = this._buildContextString(finalItems, promptAnalysis);

        // Step 6: Track for session management
        this._trackContextUsage(finalItems);

        // Calculate dropped items
        const includedIds = new Set(finalItems.map(i => i.id));
        const droppedItems = scoredItems.filter(i => !includedIds.has(i.id));

        return {
            context,
            tokenEstimate: this._estimateTokens(context),
            includedItems: finalItems,
            droppedItems,
            compressionApplied,
            confidence: this._calculateConfidence(finalItems, promptAnalysis),
            recommendations: this._generateRecommendations(finalItems, droppedItems, budget),
            debug: {
                priorityBreakdown: this._calculatePriorityBreakdown(finalItems),
                memoryTypeBreakdown: this._calculateMemoryTypeBreakdown(finalItems),
                droppedReason: this._calculateDroppedReasons(droppedItems, budget)
            }
        };
    }

    /**
     * Calculate context budget based on current session state
     */
    private _calculateContextBudget(maxTokensOverride?: number): ContextBudget {
        const totalAvailable = maxTokensOverride ||
            (this._config.maxContextTokens - this._config.defaultResponseReserve - this._config.safetyBuffer);

        const sessionTokensUsed = this._sessionState?.estimatedTokens || 0;
        const effectiveTotal = Math.max(0, totalAvailable - sessionTokensUsed);

        return {
            totalTokens: effectiveTotal,
            allocations: {
                critical: Math.floor(effectiveTotal * this._config.priorityAllocations.critical),
                high: Math.floor(effectiveTotal * this._config.priorityAllocations.high),
                medium: Math.floor(effectiveTotal * this._config.priorityAllocations.medium),
                low: Math.floor(effectiveTotal * this._config.priorityAllocations.low),
                disposable: Math.floor(effectiveTotal * this._config.priorityAllocations.disposable)
            },
            reserved: {
                response: this._config.defaultResponseReserve,
                safety: this._config.safetyBuffer
            }
        };
    }

    /**
     * Collect all potential context items
     */
    private async _collectContextCandidates(
        prompt: string,
        analysis: PromptIntentAnalysis
    ): Promise<PrioritizedContextItem[]> {
        const candidates: PrioritizedContextItem[] = [];

        // 1. Add scratchpad items (highest attention priority - Manus pattern)
        const scratchpadItems = this._getScratchpadAsContextItems();
        candidates.push(...scratchpadItems);

        // 2. Add relevant memory items
        if (this._memoryManager) {
            const memoryResults = this._memoryManager.searchEntities(
                analysis.keywords.join(' '),
                100
            );

            for (const result of memoryResults) {
                const item = this._memoryEntityToContextItem(result);
                candidates.push(item);
            }
        }

        // 3. Add items from context pool (already scored)
        for (const item of this._contextPool.values()) {
            if (!candidates.find(c => c.id === item.id)) {
                candidates.push(item);
            }
        }

        // 4. Add graph-connected items
        const connectedItems = await this._getGraphConnectedItems(analysis.entities);
        candidates.push(...connectedItems);

        return candidates;
    }

    /**
     * Score and rank items based on relevance
     */
    private _scoreAndRankItems(
        items: PrioritizedContextItem[],
        analysis: PromptIntentAnalysis
    ): PrioritizedContextItem[] {
        const now = Date.now();

        for (const item of items) {
            // Calculate component scores
            const keywordScore = this._calculateKeywordScore(item, analysis.keywords);
            const semanticScore = this._calculateSemanticScore(item, analysis);
            const recencyScore = this._calculateRecencyScore(item, now);
            const frequencyScore = this._calculateFrequencyScore(item);
            const graphScore = this._calculateGraphScore(item);

            // Apply decay
            const decayMultiplier = this._getDecayMultiplier(item);

            // Calculate final relevance score
            item.relevanceScore = (
                keywordScore * this._config.relevanceWeights.keywordMatch +
                semanticScore * this._config.relevanceWeights.semanticSimilarity +
                recencyScore * this._config.relevanceWeights.recency +
                frequencyScore * this._config.relevanceWeights.frequency +
                graphScore * this._config.relevanceWeights.graphConnection
            ) * decayMultiplier;

            // Boost scratchpad items (Manus attention manipulation)
            if (item.sourceType === 'scratchpad') {
                item.relevanceScore *= this._config.scratchpadBoostFactor;
            }

            item.recencyScore = recencyScore;
        }

        // Sort by priority tier first, then by relevance within tier
        return items.sort((a, b) => {
            const priorityOrder: Record<ContextPriority, number> = {
                critical: 5, high: 4, medium: 3, low: 2, disposable: 1
            };

            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;

            return b.relevanceScore - a.relevanceScore;
        });
    }

    /**
     * Select items within budget constraints
     */
    private _selectItemsWithinBudget(
        rankedItems: PrioritizedContextItem[],
        budget: ContextBudget,
        forceItems?: string[]
    ): PrioritizedContextItem[] {
        const selected: PrioritizedContextItem[] = [];
        const usedTokens: Record<ContextPriority, number> = {
            critical: 0, high: 0, medium: 0, low: 0, disposable: 0
        };

        // First, add forced items
        if (forceItems) {
            for (const id of forceItems) {
                const item = rankedItems.find(i => i.id === id);
                if (item) {
                    selected.push(item);
                    usedTokens[item.priority] += item.tokenEstimate;
                }
            }
        }

        // Then add remaining items within budget
        for (const item of rankedItems) {
            // Skip if already added
            if (selected.find(s => s.id === item.id)) continue;

            const allocation = budget.allocations[item.priority];
            const currentUsed = usedTokens[item.priority];

            // Check if item fits in its priority tier
            if (currentUsed + item.tokenEstimate <= allocation) {
                selected.push(item);
                usedTokens[item.priority] += item.tokenEstimate;
            } else {
                // Try to fit in a lower tier if space available
                const lowerTiers: ContextPriority[] = ['disposable', 'low', 'medium'];
                for (const tier of lowerTiers) {
                    if (usedTokens[tier] + item.tokenEstimate <= budget.allocations[tier]) {
                        selected.push(item);
                        usedTokens[tier] += item.tokenEstimate;
                        break;
                    }
                }
            }
        }

        return selected;
    }

    /**
     * Apply compression if approaching budget limits
     */
    private async _applyCompressionIfNeeded(
        items: PrioritizedContextItem[],
        budget: ContextBudget
    ): Promise<{ items: PrioritizedContextItem[]; compressionApplied: boolean }> {
        const totalTokens = items.reduce((sum, i) => sum + i.tokenEstimate, 0);
        const usageRatio = totalTokens / budget.totalTokens;

        if (usageRatio < this._config.compressionThreshold) {
            return { items, compressionApplied: false };
        }

        const compressedItems = [...items];

        // Strategy 1: Summarize low-priority items
        if (usageRatio >= this._config.compressionThreshold) {
            for (let i = 0; i < compressedItems.length; i++) {
                const item = compressedItems[i];
                if (item.priority === 'low' || item.priority === 'disposable') {
                    if (item.content.length > 200) {
                        const compressed = this._compressContent(item.content);
                        compressedItems[i] = {
                            ...item,
                            content: compressed,
                            tokenEstimate: this._estimateTokens(compressed),
                            metadata: {
                                ...item.metadata,
                                isCompressed: true,
                                originalTokens: item.tokenEstimate
                            }
                        };
                    }
                }
            }
        }

        // Strategy 2: Replace with restorable pointers (Manus pattern)
        if (usageRatio >= this._config.aggressiveCompressionThreshold) {
            for (let i = 0; i < compressedItems.length; i++) {
                const item = compressedItems[i];
                if (item.metadata.canRestore && item.priority !== 'critical') {
                    const pointer = `[Reference: ${item.metadata.restoreHint}]`;
                    compressedItems[i] = {
                        ...item,
                        content: pointer,
                        tokenEstimate: this._estimateTokens(pointer),
                        metadata: {
                            ...item.metadata,
                            isCompressed: true,
                            originalTokens: item.tokenEstimate
                        }
                    };
                }
            }
        }

        return { items: compressedItems, compressionApplied: true };
    }

    /**
     * Build the final context string
     */
    private _buildContextString(
        items: PrioritizedContextItem[],
        analysis: PromptIntentAnalysis
    ): string {
        if (items.length === 0) return '';

        const sections: Map<string, string[]> = new Map();

        // Group by source type
        for (const item of items) {
            const section = this._getSectionForItem(item);
            if (!sections.has(section)) {
                sections.set(section, []);
            }
            sections.get(section)!.push(item.content);
        }

        // Build context with clear sections
        const parts: string[] = [];
        parts.push('=== INTELLIGENT CONTEXT ===\n');

        // Order sections by importance
        const sectionOrder = [
            'Current Task Focus',
            'Active Goals',
            'Key Decisions',
            'Related Code',
            'Project Knowledge',
            'Background Context'
        ];

        for (const section of sectionOrder) {
            const content = sections.get(section);
            if (content && content.length > 0) {
                parts.push(`\n## ${section}\n`);
                parts.push(content.join('\n'));
            }
        }

        parts.push('\n=== END CONTEXT ===\n');

        return parts.join('\n');
    }

    // ==================== Memory Graph Operations (Mem0-style) ====================

    /**
     * Add or update a node in the memory graph
     */
    public async addToMemoryGraph(
        entityName: string,
        entityType: EntityType,
        connections?: Array<{ target: string; relation: string; strength: number }>
    ): Promise<void> {
        const now = new Date().toISOString();

        const existing = this._memoryGraph.get(entityName);

        if (existing) {
            // Update existing node
            existing.temporalMarkers.lastAccessedAt = now;
            existing.temporalMarkers.accessCount++;
            existing.temporalMarkers.decayScore = this._calculateDecayScore(existing.temporalMarkers);

            // Add new connections
            if (connections) {
                for (const conn of connections) {
                    const existingEdge = existing.connections.find(
                        e => e.targetEntity === conn.target && e.relationType === conn.relation
                    );

                    if (existingEdge) {
                        // Update strength
                        existingEdge.strength = Math.min(1, existingEdge.strength + 0.1);
                    } else {
                        // Check for conflicts (Mem0 pattern)
                        const conflicting = await this._detectConflicts(entityName, conn);

                        if (conflicting.length > 0) {
                            // Mark old edges as invalid instead of deleting
                            for (const edge of conflicting) {
                                edge.isValid = false;
                            }
                        }

                        existing.connections.push({
                            targetEntity: conn.target,
                            relationType: conn.relation,
                            strength: conn.strength,
                            isValid: true,
                            createdAt: now
                        });
                    }
                }
            }
        } else {
            // Create new node
            const newNode: MemoryGraphNode = {
                entityName,
                entityType,
                connections: connections?.map(c => ({
                    targetEntity: c.target,
                    relationType: c.relation,
                    strength: c.strength,
                    isValid: true,
                    createdAt: now
                })) || [],
                temporalMarkers: {
                    createdAt: now,
                    lastAccessedAt: now,
                    accessCount: 1,
                    decayScore: 1.0
                }
            };

            this._memoryGraph.set(entityName, newNode);
        }

        await this._saveMemoryGraph();
    }

    /**
     * Detect conflicting relationships (Mem0 pattern)
     */
    private async _detectConflicts(
        entityName: string,
        newConnection: { target: string; relation: string; strength: number }
    ): Promise<MemoryGraphEdge[]> {
        const conflicts: MemoryGraphEdge[] = [];
        const node = this._memoryGraph.get(entityName);

        if (!node) return conflicts;

        // Find edges that might conflict
        // E.g., if new relation is "uses_library_X", old "uses_library_Y" might conflict
        const conflictPatterns = [
            { pattern: /^uses_/, exclusive: true },
            { pattern: /^status_/, exclusive: true },
            { pattern: /^version_/, exclusive: true }
        ];

        for (const edge of node.connections) {
            if (!edge.isValid) continue;

            for (const { pattern, exclusive } of conflictPatterns) {
                if (exclusive &&
                    pattern.test(newConnection.relation) &&
                    pattern.test(edge.relationType) &&
                    edge.relationType !== newConnection.relation) {
                    conflicts.push(edge);
                }
            }
        }

        return conflicts;
    }

    /**
     * Get items connected via the memory graph
     */
    private async _getGraphConnectedItems(
        seedEntities: string[]
    ): Promise<PrioritizedContextItem[]> {
        const items: PrioritizedContextItem[] = [];
        const visited = new Set<string>();

        // BFS to find connected entities
        const queue = [...seedEntities];
        let depth = 0;
        const maxDepth = 2;

        while (queue.length > 0 && depth < maxDepth) {
            const currentLevel = [...queue];
            queue.length = 0;

            for (const entityName of currentLevel) {
                if (visited.has(entityName)) continue;
                visited.add(entityName);

                const node = this._memoryGraph.get(entityName);
                if (!node) continue;

                // Add connected entities to queue
                for (const edge of node.connections) {
                    if (edge.isValid && edge.strength > 0.3) {
                        queue.push(edge.targetEntity);
                    }
                }

                // Create context item from this node
                const entity = this._memoryManager?.getEntity(entityName);
                if (entity) {
                    items.push({
                        id: `graph_${entityName}`,
                        content: this._formatEntityContent(entity),
                        priority: depth === 0 ? 'high' : 'medium',
                        memoryType: 'semantic',
                        tokenEstimate: this._estimateTokens(this._formatEntityContent(entity)),
                        relevanceScore: node.temporalMarkers.decayScore * (1 - depth * 0.3),
                        recencyScore: 0,
                        usageCount: node.temporalMarkers.accessCount,
                        lastAccessedAt: node.temporalMarkers.lastAccessedAt,
                        createdAt: node.temporalMarkers.createdAt,
                        sourceType: 'memory',
                        metadata: {
                            entityRef: entityName,
                            canRestore: true,
                            restoreHint: `Entity: ${entityName}`
                        }
                    });
                }
            }

            depth++;
        }

        return items;
    }

    // ==================== Scratchpad Operations (Manus-style) ====================

    /**
     * Add entry to scratchpad for attention manipulation
     */
    public async addToScratchpad(
        type: ScratchpadEntry['type'],
        content: string,
        priority: number = 5
    ): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const entry: ScratchpadEntry = {
            id,
            type,
            content,
            priority: Math.min(10, Math.max(1, priority)),
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        this._scratchpad.set(id, entry);

        // Prune if over limit
        if (this._scratchpad.size > this._config.maxScratchpadItems) {
            await this._pruneScratchpad();
        }

        await this._saveScratchpad();
        return id;
    }

    /**
     * Update scratchpad entry
     */
    public async updateScratchpadEntry(
        id: string,
        updates: Partial<Pick<ScratchpadEntry, 'content' | 'priority' | 'status'>>
    ): Promise<boolean> {
        const entry = this._scratchpad.get(id);
        if (!entry) return false;

        if (updates.content !== undefined) entry.content = updates.content;
        if (updates.priority !== undefined) entry.priority = updates.priority;
        if (updates.status !== undefined) entry.status = updates.status;
        entry.updatedAt = new Date().toISOString();

        await this._saveScratchpad();
        return true;
    }

    /**
     * Get scratchpad as context items
     */
    private _getScratchpadAsContextItems(): PrioritizedContextItem[] {
        const items: PrioritizedContextItem[] = [];

        for (const entry of this._scratchpad.values()) {
            if (entry.status !== 'active') continue;

            const priorityMap: Record<ScratchpadEntry['type'], ContextPriority> = {
                goal: 'critical',
                todo: 'high',
                decision: 'high',
                note: 'medium',
                observation: 'low'
            };

            items.push({
                id: `scratchpad_${entry.id}`,
                content: `[${entry.type.toUpperCase()}] ${entry.content}`,
                priority: priorityMap[entry.type] || 'medium',
                memoryType: 'working',
                tokenEstimate: this._estimateTokens(entry.content),
                relevanceScore: entry.priority / 10,
                recencyScore: 0,
                usageCount: 1,
                lastAccessedAt: entry.updatedAt,
                createdAt: entry.createdAt,
                sourceType: 'scratchpad',
                metadata: {}
            });
        }

        return items;
    }

    /**
     * Update scratchpad based on prompt analysis (Manus attention recitation)
     */
    private async _updateScratchpadFromPrompt(
        prompt: string,
        analysis: PromptIntentAnalysis
    ): Promise<void> {
        // Extract potential todos
        const todoPatterns = [
            /(?:TODO|TASK|need to|should|must|want to):\s*([^.!?\n]+)/gi,
            /(?:implement|fix|add|create|update|remove)\s+([^.!?\n]+)/gi
        ];

        for (const pattern of todoPatterns) {
            let match;
            while ((match = pattern.exec(prompt)) !== null) {
                const task = match[1].trim();
                if (task.length > 10 && task.length < 200) {
                    // Check if similar todo exists
                    const existing = Array.from(this._scratchpad.values()).find(
                        e => e.type === 'todo' &&
                             e.status === 'active' &&
                             this._calculateStringSimilarity(e.content, task) > 0.7
                    );

                    if (!existing) {
                        await this.addToScratchpad('todo', task, 7);
                    }
                }
            }
        }

        // Extract goals from intent
        if (analysis.intent === 'task' && analysis.complexity === 'complex') {
            const goalExists = Array.from(this._scratchpad.values()).some(
                e => e.type === 'goal' && e.status === 'active'
            );

            if (!goalExists) {
                await this.addToScratchpad('goal', `Working on: ${prompt.substring(0, 100)}...`, 10);
            }
        }
    }

    /**
     * Prune old/completed scratchpad entries
     */
    private async _pruneScratchpad(): Promise<void> {
        const entries = Array.from(this._scratchpad.entries());

        // Sort by priority and recency
        entries.sort((a, b) => {
            if (a[1].status !== b[1].status) {
                return a[1].status === 'active' ? -1 : 1;
            }
            return new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime();
        });

        // Keep only top items
        const toKeep = entries.slice(0, this._config.maxScratchpadItems);
        this._scratchpad = new Map(toKeep);
    }

    // ==================== Session Management ====================

    /**
     * Initialize or reset session state
     */
    private _initializeSession(): void {
        this._sessionState = {
            sessionId: crypto.randomUUID(),
            startedAt: new Date().toISOString(),
            messageCount: 0,
            estimatedTokens: 0,
            lastPromptTokens: 0,
            contextHistory: [],
            compressionEvents: 0,
            isStale: false
        };
    }

    /**
     * Track context usage for session management
     */
    private _trackContextUsage(items: PrioritizedContextItem[]): void {
        if (!this._sessionState) return;

        const tokensUsed = items.reduce((sum, i) => sum + i.tokenEstimate, 0);

        this._sessionState.messageCount++;
        this._sessionState.lastPromptTokens = tokensUsed;
        this._sessionState.estimatedTokens += tokensUsed;
        this._sessionState.contextHistory.push({
            timestamp: new Date().toISOString(),
            tokensUsed,
            itemsIncluded: items.length
        });

        // Check if session is getting stale
        const historyLength = this._sessionState.contextHistory.length;
        if (historyLength > 20) {
            this._sessionState.isStale = true;
        }
    }

    /**
     * Get session health report
     */
    public getSessionHealth(): {
        status: 'healthy' | 'warning' | 'critical';
        usagePercent: number;
        messageCount: number;
        recommendation: string;
        metrics: {
            totalTokensUsed: number;
            averageTokensPerMessage: number;
            compressionEvents: number;
            isStale: boolean;
        };
    } {
        if (!this._sessionState) {
            return {
                status: 'healthy',
                usagePercent: 0,
                messageCount: 0,
                recommendation: 'No active session',
                metrics: {
                    totalTokensUsed: 0,
                    averageTokensPerMessage: 0,
                    compressionEvents: 0,
                    isStale: false
                }
            };
        }

        const maxTokens = this._config.maxContextTokens - this._config.defaultResponseReserve;
        const usagePercent = (this._sessionState.estimatedTokens / maxTokens) * 100;

        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        let recommendation = 'Session is within normal limits';

        if (usagePercent >= 90 || this._sessionState.isStale) {
            status = 'critical';
            recommendation = 'Start a new session to maintain optimal performance';
        } else if (usagePercent >= 70) {
            status = 'warning';
            recommendation = 'Consider starting a new session soon';
        }

        return {
            status,
            usagePercent,
            messageCount: this._sessionState.messageCount,
            recommendation,
            metrics: {
                totalTokensUsed: this._sessionState.estimatedTokens,
                averageTokensPerMessage: this._sessionState.messageCount > 0
                    ? Math.round(this._sessionState.estimatedTokens / this._sessionState.messageCount)
                    : 0,
                compressionEvents: this._sessionState.compressionEvents,
                isStale: this._sessionState.isStale
            }
        };
    }

    /**
     * Force new session
     */
    public forceNewSession(): void {
        this._initializeSession();
        this._contextPool.clear();
        console.log('AdvancedContextEngine: Session reset');
    }

    // ==================== Helper Methods ====================

    /**
     * Analyze prompt intent
     */
    private _analyzePromptIntent(prompt: string): PromptIntentAnalysis {
        const promptLower = prompt.toLowerCase();

        // Intent classification
        const intentScores: Record<string, number> = {
            task: 0, question: 0, fix: 0, review: 0, code: 0, general: 0
        };

        const intentKeywords: Record<string, string[]> = {
            task: ['implement', 'create', 'build', 'add', 'develop', 'make', 'setup'],
            fix: ['fix', 'bug', 'error', 'issue', 'problem', 'broken', 'not working'],
            question: ['what', 'how', 'why', 'where', 'explain', 'describe'],
            review: ['review', 'check', 'analyze', 'examine', 'audit', 'look at'],
            code: ['function', 'class', 'method', 'variable', 'import', 'refactor']
        };

        for (const [intent, keywords] of Object.entries(intentKeywords)) {
            for (const keyword of keywords) {
                if (promptLower.includes(keyword)) {
                    intentScores[intent]++;
                }
            }
        }

        const topIntent = Object.entries(intentScores)
            .sort((a, b) => b[1] - a[1])[0][0] as PromptIntentAnalysis['intent'];

        // Extract keywords
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'for', 'of', 'in', 'on', 'with', 'and', 'or', 'but', 'this', 'that', 'i', 'you', 'we', 'it', 'can', 'please', 'help', 'want', 'need']);
        const keywords = promptLower
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));

        // Extract entity references
        const entities: string[] = [];
        const fileMatches = prompt.match(/(?:\/[\w\-./]+\.\w+)|(?:`[^`]+\.\w+`)/g);
        if (fileMatches) entities.push(...fileMatches.map(f => f.replace(/`/g, '')));

        const codeMatches = prompt.match(/`([^`]+)`/g);
        if (codeMatches) entities.push(...codeMatches.map(c => c.replace(/`/g, '')));

        // Complexity
        let complexity: 'simple' | 'medium' | 'complex' = 'simple';
        if (prompt.length > 500 || keywords.length > 15) complexity = 'complex';
        else if (prompt.length > 200 || keywords.length > 8) complexity = 'medium';

        return {
            intent: topIntent,
            keywords: [...new Set(keywords)].slice(0, 20),
            entities: [...new Set(entities)],
            complexity,
            requiresHistory: /previous|earlier|before|last time|continue|again/.test(promptLower)
        };
    }

    /**
     * Memory entity to context item
     */
    private _memoryEntityToContextItem(result: MemorySearchResult): PrioritizedContextItem {
        const entity = result.entity;
        const content = this._formatEntityContent(entity);

        const priorityMap: Record<EntityType, ContextPriority> = {
            project: 'high',
            task: 'high',
            decision: 'high',
            pattern: 'medium',
            architecture: 'medium',
            bug: 'medium',
            feature: 'medium',
            file: 'medium',
            dependency: 'low',
            conversation: 'low',
            milestone: 'low'
        };

        const memoryTypeMap: Record<EntityType, MemoryType> = {
            project: 'semantic',
            task: 'procedural',
            decision: 'semantic',
            pattern: 'procedural',
            architecture: 'semantic',
            bug: 'episodic',
            feature: 'semantic',
            file: 'semantic',
            dependency: 'semantic',
            conversation: 'episodic',
            milestone: 'episodic'
        };

        return {
            id: `memory_${entity.name}`,
            content,
            priority: priorityMap[entity.entityType] || 'medium',
            memoryType: memoryTypeMap[entity.entityType] || 'semantic',
            tokenEstimate: this._estimateTokens(content),
            relevanceScore: result.relevance / 10,
            recencyScore: 0,
            usageCount: 1,
            lastAccessedAt: entity.updatedAt,
            createdAt: entity.createdAt,
            sourceType: 'memory',
            metadata: {
                entityRef: entity.name,
                canRestore: true,
                restoreHint: `Entity: ${entity.name}`
            }
        };
    }

    /**
     * Format entity content
     */
    private _formatEntityContent(entity: MemoryEntity): string {
        const lines: string[] = [];
        const cleanName = entity.name
            .replace(/^(task_|file_|decision_|pattern_|bug_|feature_)/, '')
            .replace(/_[a-f0-9]{8}$/, '')
            .replace(/_/g, ' ');

        lines.push(`**${cleanName}** (${entity.entityType})`);

        for (const obs of entity.observations.slice(-3)) {
            const truncated = obs.length > 150 ? obs.substring(0, 147) + '...' : obs;
            lines.push(`- ${truncated}`);
        }

        return lines.join('\n');
    }

    /**
     * Calculate various scores
     */
    private _calculateKeywordScore(item: PrioritizedContextItem, keywords: string[]): number {
        const content = item.content.toLowerCase();
        let matches = 0;
        for (const keyword of keywords) {
            if (content.includes(keyword)) matches++;
        }
        return keywords.length > 0 ? matches / keywords.length : 0;
    }

    private _calculateSemanticScore(item: PrioritizedContextItem, analysis: PromptIntentAnalysis): number {
        // Simulated semantic similarity based on overlap
        const itemKeywords = item.content.toLowerCase().split(/\s+/);
        const overlap = analysis.keywords.filter(k => itemKeywords.includes(k)).length;
        return Math.min(1, overlap / Math.max(1, analysis.keywords.length));
    }

    private _calculateRecencyScore(item: PrioritizedContextItem, now: number): number {
        const lastAccess = new Date(item.lastAccessedAt).getTime();
        const ageHours = (now - lastAccess) / (1000 * 60 * 60);
        return Math.exp(-ageHours / (this._config.decayHalfLifeHours * 2));
    }

    private _calculateFrequencyScore(item: PrioritizedContextItem): number {
        return Math.min(1, item.usageCount / 10);
    }

    private _calculateGraphScore(item: PrioritizedContextItem): number {
        if (!item.metadata.entityRef) return 0;
        const node = this._memoryGraph.get(item.metadata.entityRef);
        if (!node) return 0;
        return Math.min(1, node.connections.filter(e => e.isValid).length / 5);
    }

    private _getDecayMultiplier(item: PrioritizedContextItem): number {
        if (!item.metadata.entityRef) return 1;
        const node = this._memoryGraph.get(item.metadata.entityRef);
        if (!node) return 1;
        return Math.max(this._config.minDecayScore, node.temporalMarkers.decayScore);
    }

    private _calculateDecayScore(markers: MemoryGraphNode['temporalMarkers']): number {
        const now = Date.now();
        const lastAccess = new Date(markers.lastAccessedAt).getTime();
        const ageHours = (now - lastAccess) / (1000 * 60 * 60);

        // Exponential decay with access boost
        const baseDecay = Math.exp(-ageHours / this._config.decayHalfLifeHours);
        const accessBoost = Math.min(1, markers.accessCount * 0.1);

        return Math.max(
            this._config.minDecayScore,
            Math.min(1, baseDecay + accessBoost)
        );
    }

    /**
     * Compress content
     */
    private _compressContent(content: string): string {
        // Simple compression: keep first sentence and key points
        const sentences = content.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length <= 2) return content;

        const first = sentences[0].trim();
        const keyPhrases: string[] = [];

        // Extract key phrases from remaining sentences
        for (const sentence of sentences.slice(1, 4)) {
            const words = sentence.trim().split(/\s+/);
            if (words.length > 3) {
                keyPhrases.push(words.slice(0, 5).join(' ') + '...');
            }
        }

        return `${first}. Key points: ${keyPhrases.join('; ')}`;
    }

    /**
     * Get section for item
     */
    private _getSectionForItem(item: PrioritizedContextItem): string {
        if (item.sourceType === 'scratchpad') {
            const scratchpadType = item.content.match(/^\[(\w+)\]/)?.[1];
            if (scratchpadType === 'GOAL') return 'Active Goals';
            if (scratchpadType === 'TODO') return 'Current Task Focus';
            if (scratchpadType === 'DECISION') return 'Key Decisions';
        }

        if (item.sourceType === 'memory') {
            if (item.content.includes('(task)')) return 'Current Task Focus';
            if (item.content.includes('(decision)')) return 'Key Decisions';
            if (item.content.includes('(file)') || item.content.includes('(pattern)')) return 'Related Code';
        }

        if (item.priority === 'critical' || item.priority === 'high') return 'Project Knowledge';

        return 'Background Context';
    }

    /**
     * Calculate various breakdowns and metrics
     */
    private _calculatePriorityBreakdown(items: PrioritizedContextItem[]): Record<ContextPriority, number> {
        const breakdown: Record<ContextPriority, number> = {
            critical: 0, high: 0, medium: 0, low: 0, disposable: 0
        };
        for (const item of items) {
            breakdown[item.priority] += item.tokenEstimate;
        }
        return breakdown;
    }

    private _calculateMemoryTypeBreakdown(items: PrioritizedContextItem[]): Record<MemoryType, number> {
        const breakdown: Record<MemoryType, number> = {
            episodic: 0, semantic: 0, procedural: 0, working: 0
        };
        for (const item of items) {
            breakdown[item.memoryType] += item.tokenEstimate;
        }
        return breakdown;
    }

    private _calculateDroppedReasons(
        dropped: PrioritizedContextItem[],
        budget: ContextBudget
    ): Record<string, string> {
        const reasons: Record<string, string> = {};
        for (const item of dropped.slice(0, 10)) {
            if (item.relevanceScore < 0.2) {
                reasons[item.id] = 'Low relevance score';
            } else if (item.tokenEstimate > budget.allocations[item.priority]) {
                reasons[item.id] = 'Exceeded priority tier budget';
            } else {
                reasons[item.id] = 'Budget exhausted';
            }
        }
        return reasons;
    }

    private _calculateConfidence(
        items: PrioritizedContextItem[],
        analysis: PromptIntentAnalysis
    ): number {
        if (items.length === 0) return 0;

        const avgRelevance = items.reduce((sum, i) => sum + i.relevanceScore, 0) / items.length;
        const hasScratchpad = items.some(i => i.sourceType === 'scratchpad');
        const hasHighPriority = items.some(i => i.priority === 'critical' || i.priority === 'high');

        let confidence = avgRelevance;
        if (hasScratchpad) confidence += 0.1;
        if (hasHighPriority) confidence += 0.1;

        return Math.min(1, confidence);
    }

    private _generateRecommendations(
        included: PrioritizedContextItem[],
        dropped: PrioritizedContextItem[],
        budget: ContextBudget
    ): string[] {
        const recommendations: string[] = [];

        const totalUsed = included.reduce((sum, i) => sum + i.tokenEstimate, 0);
        const usagePercent = totalUsed / budget.totalTokens;

        if (usagePercent > 0.9) {
            recommendations.push('Context is near capacity. Consider starting a new session.');
        }

        if (dropped.length > included.length) {
            recommendations.push('Many items were dropped. Consider being more specific in your prompt.');
        }

        const highPriorityDropped = dropped.filter(i => i.priority === 'high');
        if (highPriorityDropped.length > 0) {
            recommendations.push(`${highPriorityDropped.length} high-priority items were dropped due to budget.`);
        }

        return recommendations;
    }

    private _calculateStringSimilarity(a: string, b: string): number {
        const aWords = new Set(a.toLowerCase().split(/\s+/));
        const bWords = new Set(b.toLowerCase().split(/\s+/));
        const intersection = new Set([...aWords].filter(x => bWords.has(x)));
        const union = new Set([...aWords, ...bWords]);
        return intersection.size / union.size;
    }

    private _estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    private _emptyContextResult(reason: string): ContextGenerationResult {
        return {
            context: '',
            tokenEstimate: 0,
            includedItems: [],
            droppedItems: [],
            compressionApplied: false,
            confidence: 0,
            recommendations: [reason],
            debug: {
                priorityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, disposable: 0 },
                memoryTypeBreakdown: { episodic: 0, semantic: 0, procedural: 0, working: 0 },
                droppedReason: {}
            }
        };
    }

    // ==================== Persistence ====================

    private async _loadScratchpad(): Promise<void> {
        if (!this._scratchpadPath) return;

        try {
            const content = await readFile(this._scratchpadPath, 'utf-8');
            const data = JSON.parse(content);
            this._scratchpad = new Map(Object.entries(data));
        } catch {
            // File doesn't exist yet
        }
    }

    private async _saveScratchpad(): Promise<void> {
        if (!this._scratchpadPath) return;

        try {
            const data = Object.fromEntries(this._scratchpad);
            await writeFile(this._scratchpadPath, JSON.stringify(data, null, 2));
        } catch (error: any) {
            console.error('Failed to save scratchpad:', error.message);
        }
    }

    private async _loadMemoryGraph(): Promise<void> {
        if (!this._graphPath) return;

        try {
            const content = await readFile(this._graphPath, 'utf-8');
            const data = JSON.parse(content);
            this._memoryGraph = new Map(Object.entries(data));
        } catch {
            // File doesn't exist yet
        }
    }

    private async _saveMemoryGraph(): Promise<void> {
        if (!this._graphPath) return;

        try {
            const data = Object.fromEntries(this._memoryGraph);
            await writeFile(this._graphPath, JSON.stringify(data, null, 2));
        } catch (error: any) {
            console.error('Failed to save memory graph:', error.message);
        }
    }

    private async _buildContextPoolFromMemory(): Promise<void> {
        if (!this._memoryManager) return;

        // Load all entities into context pool
        const stats = this._memoryManager.getMemoryStats();
        const entityTypes: EntityType[] = [
            'project', 'task', 'decision', 'pattern', 'architecture',
            'bug', 'feature', 'file', 'dependency'
        ];

        for (const type of entityTypes) {
            const entities = this._memoryManager.getEntitiesByType(type);
            for (const entity of entities) {
                const item = this._memoryEntityToContextItem({
                    entity,
                    relevance: 5,
                    matchedObservations: []
                });
                this._contextPool.set(item.id, item);
            }
        }

        console.log(`AdvancedContextEngine: Built context pool with ${this._contextPool.size} items`);
    }

    /**
     * Dispose
     */
    public dispose(): void {
        this._scratchpad.clear();
        this._memoryGraph.clear();
        this._contextPool.clear();
        this._sessionState = null;
        this._isInitialized = false;
        console.log('AdvancedContextEngine: Disposed');
    }
}

// ==================== Types ====================

interface PromptIntentAnalysis {
    intent: 'task' | 'question' | 'fix' | 'review' | 'code' | 'general';
    keywords: string[];
    entities: string[];
    complexity: 'simple' | 'medium' | 'complex';
    requiresHistory: boolean;
}

// ==================== Singleton Export ====================

let _instance: AdvancedContextEngine | null = null;

export function getAdvancedContextEngine(): AdvancedContextEngine {
    if (!_instance) {
        _instance = new AdvancedContextEngine();
    }
    return _instance;
}

export async function createAdvancedContextEngine(
    memoryManager: ProjectMemoryManager,
    workspacePath?: string
): Promise<AdvancedContextEngine | null> {
    const engine = new AdvancedContextEngine();
    const initialized = await engine.initialize(memoryManager, workspacePath);
    if (initialized) {
        return engine;
    }
    return null;
}
