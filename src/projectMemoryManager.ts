import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';

const { readFile, writeFile, mkdir, appendFile, stat } = fs;

/**
 * Project Memory Manager for Claude Code Chat
 *
 * This module provides deep project memory integration using a local knowledge graph
 * stored in `.claude/memory.jsonl`. It works alongside the Memory MCP server to:
 *
 * 1. Maintain persistent project knowledge across sessions
 * 2. Store entities (project, tasks, files, decisions, patterns)
 * 3. Track relationships between entities
 * 4. Enable AI to reconstruct "A to Z" knowledge of the project
 *
 * The memory system uses JSONL format for efficient append-only storage
 * and integrates with the existing ProjectContextManager for comprehensive
 * context preservation.
 */

// ==================== Entity Types ====================

export type EntityType =
    | 'project'      // Project-level information
    | 'task'         // Tasks being worked on
    | 'file'         // Important files
    | 'decision'     // Key decisions made
    | 'pattern'      // Code patterns established
    | 'bug'          // Bugs found and fixed
    | 'feature'      // Features implemented
    | 'dependency'   // Dependencies added/removed
    | 'architecture' // Architecture decisions
    | 'conversation' // Conversation summaries
    | 'milestone';   // Project milestones

export interface MemoryEntity {
    name: string;              // Unique entity identifier (e.g., "project_claude_code_chat")
    entityType: EntityType;    // Type of entity
    observations: string[];    // Facts/observations about this entity
    createdAt: string;         // ISO timestamp
    updatedAt: string;         // ISO timestamp
    metadata?: {
        importance?: 'low' | 'medium' | 'high' | 'critical';
        status?: 'active' | 'completed' | 'deprecated';
        tags?: string[];
        relatedFiles?: string[];
        sessionId?: string;
    };
}

export interface MemoryRelation {
    from: string;       // Source entity name
    to: string;         // Target entity name
    relationType: string; // Type of relationship
    createdAt: string;  // ISO timestamp
    metadata?: {
        description?: string;
        strength?: 'weak' | 'strong' | 'essential';
    };
}

export interface MemoryOperation {
    type: 'create_entity' | 'update_entity' | 'delete_entity' |
          'create_relation' | 'delete_relation' | 'add_observation';
    timestamp: string;
    data: any;
}

export interface ProjectMemoryState {
    entities: Map<string, MemoryEntity>;
    relations: MemoryRelation[];
    lastUpdated: string;
    version: number;
}

export interface MemorySearchResult {
    entity: MemoryEntity;
    relevance: number;
    matchedObservations: string[];
}

// Search index entry for inverted index
interface SearchIndexEntry {
    entityName: string;
    field: 'name' | 'observation' | 'tag';
    position: number;  // Position in observations array (for observations)
}

// ==================== Main Class ====================

export class ProjectMemoryManager {
    private _workspacePath: string | undefined;
    private _memoryDir: string | undefined;
    private _memoryFilePath: string | undefined;
    private _indexPath: string | undefined;
    private _graphPath: string | undefined;
    private _scratchpadPath: string | undefined;
    private _rawEventsPath: string | undefined;
    private _state: ProjectMemoryState;
    private _isInitialized: boolean = false;
    private _isDirty: boolean = false;
    private _autoSaveTimer: NodeJS.Timeout | undefined;
    private _fileWatcher: vscode.FileSystemWatcher | undefined;
    private _lastExternalUpdate: number = 0;

    // Search index - inverted index for fast text search
    private _searchIndex: Map<string, SearchIndexEntry[]> = new Map();  // token -> entries
    private _searchIndexDirty: boolean = false;

    // Search result cache for performance optimization
    private _searchCache: Map<string, { results: MemorySearchResult[]; timestamp: number }> = new Map();
    private readonly _searchCacheTTL: number = 30000; // 30 seconds TTL
    private readonly _maxSearchCacheSize: number = 100; // Max cached queries

    // Settings
    private readonly _autoSaveIntervalMs: number = 10000; // 10 seconds
    private readonly _maxObservationsPerEntity: number = 50;
    private readonly _maxEntities: number = 500;
    private readonly _minTokenLength: number = 2;  // Minimum token length for indexing
    private readonly _fileWatchDebounceMs: number = 1000; // Debounce for file watch events

    constructor() {
        this._state = {
            entities: new Map(),
            relations: [],
            lastUpdated: new Date().toISOString(),
            version: 1
        };
    }

    /**
     * Initialize the project memory manager
     */
    public async initialize(workspacePath?: string): Promise<boolean> {
        try {
            this._workspacePath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            if (!this._workspacePath) {
                console.log('ProjectMemoryManager: No workspace folder found');
                return false;
            }

            // Set up paths
            this._memoryDir = path.join(this._workspacePath, '.claude');
            this._memoryFilePath = path.join(this._memoryDir, 'memory.jsonl');
            this._indexPath = path.join(this._memoryDir, 'memory-index.json');
            this._graphPath = path.join(this._memoryDir, 'memory-graph.json');
            this._scratchpadPath = path.join(this._memoryDir, 'scratchpad.json');
            this._rawEventsPath = path.join(this._memoryDir, 'memory', 'raw-events.jsonl');

            // Ensure directories exist (basic memory folders)
            await this._ensureDir(this._memoryDir);
            await this._ensureDir(path.join(this._memoryDir, 'memory'));
            await this._ensureDir(path.join(this._memoryDir, 'memory', 'sessions'));

            // Initialize Smart Memory folders (hooks, agents, commands, skills)
            await this._initializeSmartMemoryFolders();

            // Load existing memory
            await this._loadMemory();

            // Initialize project entity if not exists
            await this._ensureProjectEntity();

            // Build search index for fast lookups
            this._rebuildSearchIndex();

            // Start auto-save
            this._startAutoSave();

            // Set up file watcher for external changes (from hooks)
            this._setupFileWatcher();

            this._isInitialized = true;
            console.log(`ProjectMemoryManager: Initialized with ${this._state.entities.size} entities, search index built`);

            return true;
        } catch (error: any) {
            console.error('ProjectMemoryManager: Initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Check if initialized
     */
    public isInitialized(): boolean {
        return this._isInitialized;
    }

    /**
     * Get memory file path for MCP configuration
     */
    public getMemoryFilePath(): string | undefined {
        return this._memoryFilePath;
    }

    // ==================== Entity Operations ====================

    /**
     * Create a new entity in memory
     */
    public async createEntity(
        name: string,
        entityType: EntityType,
        observations: string[] = [],
        metadata?: MemoryEntity['metadata']
    ): Promise<MemoryEntity | null> {
        if (!this._isInitialized) return null;

        // Check if entity already exists
        if (this._state.entities.has(name)) {
            console.log(`ProjectMemoryManager: Entity ${name} already exists, updating instead`);
            return this.addObservations(name, observations);
        }

        const now = new Date().toISOString();
        const entity: MemoryEntity = {
            name,
            entityType,
            observations: observations.slice(0, this._maxObservationsPerEntity),
            createdAt: now,
            updatedAt: now,
            metadata: {
                importance: metadata?.importance || 'medium',
                status: metadata?.status || 'active',
                tags: metadata?.tags || [],
                relatedFiles: metadata?.relatedFiles || [],
                sessionId: metadata?.sessionId
            }
        };

        this._state.entities.set(name, entity);
        this._state.lastUpdated = now;
        this._isDirty = true;
        this._searchCache.clear(); // Invalidate search cache on entity change

        // Log operation
        await this._appendOperation({
            type: 'create_entity',
            timestamp: now,
            data: entity
        });

        // Update search index
        this._indexEntity(entity);

        console.log(`ProjectMemoryManager: Created entity ${name} (${entityType})`);
        return entity;
    }

    /**
     * Add observations to an existing entity
     */
    public async addObservations(
        entityName: string,
        observations: string[]
    ): Promise<MemoryEntity | null> {
        if (!this._isInitialized) return null;

        const entity = this._state.entities.get(entityName);
        if (!entity) {
            console.log(`ProjectMemoryManager: Entity ${entityName} not found`);
            return null;
        }

        const now = new Date().toISOString();

        // Add new observations (avoid duplicates using Set for O(1) lookup)
        const existingObservations = new Set(entity.observations);
        for (const obs of observations) {
            if (!existingObservations.has(obs)) {
                entity.observations.push(obs);
                existingObservations.add(obs);
            }
        }

        // Trim to max observations
        if (entity.observations.length > this._maxObservationsPerEntity) {
            entity.observations = entity.observations.slice(-this._maxObservationsPerEntity);
        }

        entity.updatedAt = now;
        this._state.lastUpdated = now;
        this._isDirty = true;
        this._searchCache.clear(); // Invalidate search cache on observation change

        // Log operation
        await this._appendOperation({
            type: 'add_observation',
            timestamp: now,
            data: { entityName, observations }
        });

        // Update search index with new observations
        this._indexObservations(entityName, observations, entity.observations.length - observations.length);

        return entity;
    }

    /**
     * Get an entity by name
     */
    public getEntity(name: string): MemoryEntity | undefined {
        return this._state.entities.get(name);
    }

    /**
     * Get all entities of a specific type
     */
    public getEntitiesByType(entityType: EntityType): MemoryEntity[] {
        const entities: MemoryEntity[] = [];
        for (const entity of this._state.entities.values()) {
            if (entity.entityType === entityType) {
                entities.push(entity);
            }
        }
        return entities;
    }

    /**
     * Search entities by keyword using inverted index for fast lookup
     * Includes caching for performance optimization
     */
    public searchEntities(query: string, limit: number = 50): MemorySearchResult[] {
        const queryLower = query.toLowerCase();
        const cacheKey = `${queryLower}:${limit}`;
        const now = Date.now();

        // Check cache first for performance
        const cached = this._searchCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < this._searchCacheTTL) {
            return cached.results;
        }

        const queryTokens = this._tokenize(queryLower);

        // Early exit for empty queries
        if (queryTokens.length === 0) {
            return [];
        }

        // Use inverted index for fast search
        const entityScores: Map<string, { relevance: number; matchedObservations: Set<number> }> = new Map();

        for (const token of queryTokens) {
            // Get exact matches from index
            const exactMatches = this._searchIndex.get(token) || [];
            for (const entry of exactMatches) {
                const current = entityScores.get(entry.entityName) || { relevance: 0, matchedObservations: new Set() };

                // Score based on field type
                switch (entry.field) {
                    case 'name':
                        current.relevance += 10;
                        break;
                    case 'tag':
                        current.relevance += 5;
                        break;
                    case 'observation':
                        current.relevance += 2;
                        current.matchedObservations.add(entry.position);
                        break;
                }

                entityScores.set(entry.entityName, current);
            }

            // Also check prefix matches for partial word search
            for (const [indexToken, entries] of this._searchIndex.entries()) {
                if (indexToken.startsWith(token) && indexToken !== token) {
                    for (const entry of entries) {
                        const current = entityScores.get(entry.entityName) || { relevance: 0, matchedObservations: new Set() };
                        // Lower score for prefix matches
                        current.relevance += entry.field === 'name' ? 5 : entry.field === 'tag' ? 2 : 1;
                        if (entry.field === 'observation') {
                            current.matchedObservations.add(entry.position);
                        }
                        entityScores.set(entry.entityName, current);
                    }
                }
            }
        }

        // Build results array
        const results: MemorySearchResult[] = [];

        for (const [entityName, scores] of entityScores.entries()) {
            const entity = this._state.entities.get(entityName);
            if (!entity) continue;

            // Get the matched observation texts
            const matchedObservations: string[] = [];
            for (const pos of scores.matchedObservations) {
                if (entity.observations[pos]) {
                    matchedObservations.push(entity.observations[pos]);
                }
            }

            results.push({
                entity,
                relevance: scores.relevance,
                matchedObservations
            });
        }

        // Sort by relevance and limit
        const finalResults = results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);

        // Cache the results
        this._cacheSearchResults(cacheKey, finalResults, now);

        return finalResults;
    }

    /**
     * Cache search results with LRU-style eviction
     */
    private _cacheSearchResults(key: string, results: MemorySearchResult[], timestamp: number): void {
        // Evict oldest entries if cache is full
        if (this._searchCache.size >= this._maxSearchCacheSize) {
            let oldestKey: string | null = null;
            let oldestTime = Infinity;

            for (const [k, v] of this._searchCache.entries()) {
                if (v.timestamp < oldestTime) {
                    oldestTime = v.timestamp;
                    oldestKey = k;
                }
            }

            if (oldestKey) {
                this._searchCache.delete(oldestKey);
            }
        }

        this._searchCache.set(key, { results, timestamp });
    }

    /**
     * Invalidate search cache (called when entities change)
     */
    public invalidateSearchCache(): void {
        this._searchCache.clear();
    }

    /**
     * Delete an entity
     */
    public async deleteEntity(name: string): Promise<boolean> {
        if (!this._isInitialized || !this._state.entities.has(name)) {
            return false;
        }

        const now = new Date().toISOString();

        // Remove from search index before deleting
        this._removeFromIndex(name);

        this._state.entities.delete(name);

        // Remove related relations
        this._state.relations = this._state.relations.filter(
            r => r.from !== name && r.to !== name
        );

        this._state.lastUpdated = now;
        this._isDirty = true;
        this._searchCache.clear(); // Invalidate search cache on entity deletion

        await this._appendOperation({
            type: 'delete_entity',
            timestamp: now,
            data: { name }
        });

        return true;
    }

    // ==================== Relation Operations ====================

    /**
     * Create a relation between entities
     */
    public async createRelation(
        from: string,
        to: string,
        relationType: string,
        metadata?: MemoryRelation['metadata']
    ): Promise<MemoryRelation | null> {
        if (!this._isInitialized) return null;

        // Verify both entities exist
        if (!this._state.entities.has(from) || !this._state.entities.has(to)) {
            console.log(`ProjectMemoryManager: Cannot create relation - entity not found`);
            return null;
        }

        // Check if relation already exists
        const existing = this._state.relations.find(
            r => r.from === from && r.to === to && r.relationType === relationType
        );
        if (existing) {
            return existing;
        }

        const now = new Date().toISOString();
        const relation: MemoryRelation = {
            from,
            to,
            relationType,
            createdAt: now,
            metadata
        };

        this._state.relations.push(relation);
        this._state.lastUpdated = now;
        this._isDirty = true;

        await this._appendOperation({
            type: 'create_relation',
            timestamp: now,
            data: relation
        });

        console.log(`ProjectMemoryManager: Created relation ${from} -[${relationType}]-> ${to}`);
        return relation;
    }

    /**
     * Get relations for an entity
     */
    public getRelations(entityName: string): MemoryRelation[] {
        return this._state.relations.filter(
            r => r.from === entityName || r.to === entityName
        );
    }

    // ==================== Memory Context Operations ====================

    /**
     * Record a conversation message for memory
     */
    public async recordConversation(
        role: 'user' | 'assistant',
        content: string,
        sessionId?: string
    ): Promise<void> {
        if (!this._isInitialized) return;

        // Extract key information from the message
        const extracted = this._extractMemoryPoints(content, role);

        // Create or update task entities
        for (const task of extracted.tasks) {
            const entityName = this._generateEntityName('task', task);
            await this.createEntity(entityName, 'task', [task], {
                importance: 'medium',
                status: 'active',
                sessionId
            });
        }

        // Create or update decision entities
        for (const decision of extracted.decisions) {
            const entityName = this._generateEntityName('decision', decision);
            await this.createEntity(entityName, 'decision', [decision], {
                importance: 'high',
                status: 'active',
                sessionId
            });
        }

        // Track file references
        for (const file of extracted.files) {
            const entityName = this._generateEntityName('file', file);
            const existingEntity = this._state.entities.get(entityName);
            if (existingEntity) {
                await this.addObservations(entityName, [`Referenced in conversation: ${content.substring(0, 100)}...`]);
            } else {
                await this.createEntity(entityName, 'file', [`File discussed: ${file}`], {
                    importance: 'medium',
                    relatedFiles: [file],
                    sessionId
                });
            }
        }

        // Update project entity with summary
        const projectEntity = this.getEntity('project_main');
        if (projectEntity && extracted.summary) {
            await this.addObservations('project_main', [extracted.summary]);
        }
    }

    /**
     * Record a task completion
     */
    public async recordTaskCompletion(
        taskDescription: string,
        outcome: string,
        filesModified?: string[]
    ): Promise<void> {
        const entityName = this._generateEntityName('task', taskDescription);
        const entity = this._state.entities.get(entityName);

        if (entity) {
            await this.addObservations(entityName, [
                `COMPLETED: ${outcome}`,
                ...(filesModified ? [`Files modified: ${filesModified.join(', ')}`] : [])
            ]);
            entity.metadata = { ...entity.metadata, status: 'completed' };
            this._isDirty = true;
        } else {
            await this.createEntity(entityName, 'task', [
                `Task: ${taskDescription}`,
                `COMPLETED: ${outcome}`,
                ...(filesModified ? [`Files modified: ${filesModified.join(', ')}`] : [])
            ], {
                importance: 'medium',
                status: 'completed',
                relatedFiles: filesModified
            });
        }
    }

    /**
     * Record a key decision
     */
    public async recordDecision(
        decision: string,
        reasoning: string,
        alternatives?: string[]
    ): Promise<void> {
        const entityName = this._generateEntityName('decision', decision);

        const observations = [
            `Decision: ${decision}`,
            `Reasoning: ${reasoning}`
        ];

        if (alternatives && alternatives.length > 0) {
            observations.push(`Alternatives considered: ${alternatives.join(', ')}`);
        }

        await this.createEntity(entityName, 'decision', observations, {
            importance: 'high',
            status: 'active'
        });

        // Create relation to project
        await this.createRelation(entityName, 'project_main', 'decision_for');
    }

    /**
     * Record a code pattern
     */
    public async recordPattern(
        patternName: string,
        description: string,
        examples: string[]
    ): Promise<void> {
        const entityName = this._generateEntityName('pattern', patternName);

        await this.createEntity(entityName, 'pattern', [
            `Pattern: ${patternName}`,
            `Description: ${description}`,
            ...examples.map(e => `Example: ${e}`)
        ], {
            importance: 'high',
            status: 'active'
        });
    }

    /**
     * Generate comprehensive project memory context prompt
     */
    public generateMemoryContextPrompt(): string {
        const parts: string[] = [];

        parts.push('=== PROJECT MEMORY CONTEXT ===\n');
        parts.push('The following is a comprehensive knowledge base of this project:\n');

        // Project overview
        const projectEntity = this.getEntity('project_main');
        if (projectEntity) {
            parts.push('## Project Overview');
            for (const obs of projectEntity.observations.slice(-10)) {
                parts.push(`- ${obs}`);
            }
            parts.push('');
        }

        // Active tasks
        const tasks = this.getEntitiesByType('task').filter(e => e.metadata?.status === 'active');
        if (tasks.length > 0) {
            parts.push('## Active Tasks');
            for (const task of tasks.slice(-10)) {
                parts.push(`### ${task.name}`);
                for (const obs of task.observations.slice(-3)) {
                    parts.push(`- ${obs}`);
                }
            }
            parts.push('');
        }

        // Completed tasks (recent)
        const completedTasks = this.getEntitiesByType('task').filter(e => e.metadata?.status === 'completed');
        if (completedTasks.length > 0) {
            parts.push('## Recently Completed Tasks');
            for (const task of completedTasks.slice(-5)) {
                parts.push(`- ${task.name}: ${task.observations[task.observations.length - 1] || ''}`);
            }
            parts.push('');
        }

        // Key decisions
        const decisions = this.getEntitiesByType('decision');
        if (decisions.length > 0) {
            parts.push('## Key Decisions');
            for (const decision of decisions.slice(-10)) {
                parts.push(`### ${decision.name}`);
                for (const obs of decision.observations.slice(-2)) {
                    parts.push(`- ${obs}`);
                }
            }
            parts.push('');
        }

        // Important files
        const files = this.getEntitiesByType('file');
        if (files.length > 0) {
            parts.push('## Important Files');
            for (const file of files.slice(-15)) {
                parts.push(`- ${file.name}: ${file.observations[0] || ''}`);
            }
            parts.push('');
        }

        // Patterns established
        const patterns = this.getEntitiesByType('pattern');
        if (patterns.length > 0) {
            parts.push('## Established Patterns');
            for (const pattern of patterns) {
                parts.push(`### ${pattern.name}`);
                for (const obs of pattern.observations.slice(0, 2)) {
                    parts.push(`- ${obs}`);
                }
            }
            parts.push('');
        }

        // Architecture decisions
        const architecture = this.getEntitiesByType('architecture');
        if (architecture.length > 0) {
            parts.push('## Architecture');
            for (const arch of architecture) {
                parts.push(`- ${arch.name}: ${arch.observations[0] || ''}`);
            }
            parts.push('');
        }

        parts.push('=== END PROJECT MEMORY ===\n');

        return parts.join('\n');
    }

    /**
     * Get memory statistics
     */
    public getMemoryStats(): {
        totalEntities: number;
        entitiesByType: Record<EntityType, number>;
        totalRelations: number;
        totalObservations: number;
        lastUpdated: string;
    } {
        const entitiesByType: Record<EntityType, number> = {
            project: 0,
            task: 0,
            file: 0,
            decision: 0,
            pattern: 0,
            bug: 0,
            feature: 0,
            dependency: 0,
            architecture: 0,
            conversation: 0,
            milestone: 0
        };

        let totalObservations = 0;

        for (const entity of this._state.entities.values()) {
            entitiesByType[entity.entityType]++;
            totalObservations += entity.observations.length;
        }

        return {
            totalEntities: this._state.entities.size,
            entitiesByType,
            totalRelations: this._state.relations.length,
            totalObservations,
            lastUpdated: this._state.lastUpdated
        };
    }

    /**
     * Export memory for MCP sync
     */
    public exportForMCP(): { entities: MemoryEntity[]; relations: MemoryRelation[] } {
        return {
            entities: Array.from(this._state.entities.values()),
            relations: this._state.relations
        };
    }

    /**
     * Clear all memory
     */
    public async clearMemory(): Promise<boolean> {
        try {
            this._state = {
                entities: new Map(),
                relations: [],
                lastUpdated: new Date().toISOString(),
                version: this._state.version + 1
            };

            // Clear search index and cache
            this._searchIndex.clear();
            this._searchCache.clear();
            this._searchIndexDirty = false;

            // Rewrite memory file
            if (this._memoryFilePath) {
                await writeFile(this._memoryFilePath, '');
            }

            // Re-initialize project entity
            await this._ensureProjectEntity();

            this._isDirty = false;
            console.log('ProjectMemoryManager: Memory cleared');
            return true;
        } catch (error: any) {
            console.error('ProjectMemoryManager: Failed to clear memory:', error.message);
            return false;
        }
    }

    /**
     * Force save memory
     */
    public async saveMemory(): Promise<void> {
        await this._saveMemoryIndex();
    }

    /**
     * Dispose the manager
     */
    public dispose(): void {
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = undefined;
        }

        // Dispose file watcher
        if (this._fileWatcher) {
            this._fileWatcher.dispose();
            this._fileWatcher = undefined;
        }

        // Force save on dispose (fire and forget with error handling)
        if (this._isDirty) {
            this._saveMemoryIndex().catch(err => {
                console.error('ProjectMemoryManager: Failed to save memory index on dispose:', err.message);
            });
        }

        // Clear search index and cache to free memory
        this._searchIndex.clear();
        this._searchCache.clear();
        this._searchIndexDirty = false;

        console.log('ProjectMemoryManager: Disposed');
    }

    // ==================== Hook Integration Methods ====================

    /**
     * Set up file watcher for external changes (from Claude Code hooks)
     */
    private _setupFileWatcher(): void {
        if (!this._memoryDir) return;

        try {
            // Watch for changes to memory files
            const pattern = new vscode.RelativePattern(
                this._memoryDir,
                '{memory.jsonl,memory-index.json,memory-graph.json,scratchpad.json,memory/raw-events.jsonl}'
            );

            this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

            // Handle file changes with debounce
            this._fileWatcher.onDidChange(async (uri) => {
                await this._handleExternalFileChange(uri);
            });

            this._fileWatcher.onDidCreate(async (uri) => {
                await this._handleExternalFileChange(uri);
            });

            console.log('ProjectMemoryManager: File watcher set up for external changes');
        } catch (error: any) {
            console.error('ProjectMemoryManager: Failed to set up file watcher:', error.message);
        }
    }

    /**
     * Handle external file changes (from hooks)
     */
    private async _handleExternalFileChange(uri: vscode.Uri): Promise<void> {
        const now = Date.now();

        // Debounce to avoid rapid reloads
        if (now - this._lastExternalUpdate < this._fileWatchDebounceMs) {
            return;
        }
        this._lastExternalUpdate = now;

        const filename = path.basename(uri.fsPath);
        console.log(`ProjectMemoryManager: External change detected in ${filename}`);

        try {
            if (filename === 'memory.jsonl') {
                // Reload memory from JSONL
                await this._reloadFromJSONL();
            } else if (filename === 'memory-index.json') {
                // Reload index if it was updated externally
                await this._reloadIndex();
            } else if (filename === 'scratchpad.json') {
                // Scratchpad changes are informational
                console.log('ProjectMemoryManager: Scratchpad updated externally');
            }
        } catch (error: any) {
            console.error('ProjectMemoryManager: Error handling external change:', error.message);
        }
    }

    /**
     * Reload memory from JSONL file (for hook integration)
     */
    private async _reloadFromJSONL(): Promise<void> {
        if (!this._memoryFilePath) return;

        try {
            const content = await readFile(this._memoryFilePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());

            // Get the last known line count
            const existingCount = this._state.entities.size;

            // Reprocess all operations
            const newState: ProjectMemoryState = {
                entities: new Map(),
                relations: [],
                lastUpdated: new Date().toISOString(),
                version: this._state.version
            };

            for (const line of lines) {
                try {
                    const operation: MemoryOperation = JSON.parse(line);
                    this._applyOperationToState(operation, newState);
                } catch {
                    // Skip invalid lines
                }
            }

            // Only update if there are actual changes
            if (newState.entities.size !== existingCount) {
                this._state = newState;
                this._rebuildSearchIndex();
                console.log(`ProjectMemoryManager: Reloaded ${newState.entities.size} entities from external changes`);
            }
        } catch (error: any) {
            console.error('ProjectMemoryManager: Failed to reload from JSONL:', error.message);
        }
    }

    /**
     * Apply operation to a specific state object
     */
    private _applyOperationToState(operation: MemoryOperation, state: ProjectMemoryState): void {
        switch (operation.type) {
            case 'create_entity':
                state.entities.set(operation.data.name, operation.data);
                break;
            case 'update_entity':
            case 'add_observation':
                const entity = state.entities.get(operation.data.entityName);
                if (entity && operation.data.observations) {
                    for (const obs of operation.data.observations) {
                        if (!entity.observations.includes(obs)) {
                            entity.observations.push(obs);
                        }
                    }
                    entity.updatedAt = operation.timestamp;
                }
                break;
            case 'delete_entity':
                state.entities.delete(operation.data.name);
                state.relations = state.relations.filter(
                    r => r.from !== operation.data.name && r.to !== operation.data.name
                );
                break;
            case 'create_relation':
                state.relations.push(operation.data);
                break;
            case 'delete_relation':
                state.relations = state.relations.filter(
                    r => !(r.from === operation.data.from &&
                           r.to === operation.data.to &&
                           r.relationType === operation.data.relationType)
                );
                break;
        }
    }

    /**
     * Reload index from external file
     */
    private async _reloadIndex(): Promise<void> {
        if (!this._indexPath) return;

        try {
            const indexContent = await readFile(this._indexPath, 'utf-8');
            const index = JSON.parse(indexContent);

            // Check if this is a newer version
            if (index.lastUpdated && index.lastUpdated > this._state.lastUpdated) {
                this._state.entities = new Map(index.entities.map((e: MemoryEntity) => [e.name, e]));
                this._state.relations = index.relations || [];
                this._state.lastUpdated = index.lastUpdated;
                this._rebuildSearchIndex();
                console.log('ProjectMemoryManager: Reloaded index from external changes');
            }
        } catch (error: any) {
            console.error('ProjectMemoryManager: Failed to reload index:', error.message);
        }
    }

    /**
     * Get the scratchpad data (active context from hooks)
     */
    public async getScratchpad(): Promise<{
        activeGoals: any[];
        currentTasks: any[];
        recentContext: any[];
        sessionId: string | null;
        lastUpdated: string;
    } | null> {
        if (!this._scratchpadPath) return null;

        try {
            const content = await readFile(this._scratchpadPath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return {
                activeGoals: [],
                currentTasks: [],
                recentContext: [],
                sessionId: null,
                lastUpdated: new Date().toISOString()
            };
        }
    }

    /**
     * Get raw events count (for hooks integration status)
     */
    public async getRawEventsCount(): Promise<number> {
        if (!this._rawEventsPath) return 0;

        try {
            const content = await readFile(this._rawEventsPath, 'utf-8');
            return content.split('\n').filter(line => line.trim()).length;
        } catch {
            return 0;
        }
    }

    /**
     * Get hooks integration status
     */
    public async getHooksStatus(): Promise<{
        isActive: boolean;
        rawEventsCount: number;
        lastEventTime: string | null;
        scratchpadActive: boolean;
    }> {
        const rawEventsCount = await this.getRawEventsCount();
        const scratchpad = await this.getScratchpad();

        return {
            isActive: rawEventsCount > 0,
            rawEventsCount,
            lastEventTime: scratchpad?.lastUpdated || null,
            scratchpadActive: scratchpad !== null && (
                scratchpad.activeGoals.length > 0 ||
                scratchpad.currentTasks.length > 0
            )
        };
    }

    // ==================== Private Methods ====================

    private async _ensureDir(dirPath: string): Promise<void> {
        try {
            await mkdir(dirPath, { recursive: true });
        } catch (error: any) {
            if (error.code !== 'EEXIST') throw error;
        }
    }

    /**
     * Initialize Smart Memory System folders and copy templates
     * This creates hooks, agents, commands, skills folders with template files
     */
    private async _initializeSmartMemoryFolders(): Promise<void> {
        if (!this._memoryDir) return;

        try {
            // Check if already initialized (marker file exists)
            const markerPath = path.join(this._memoryDir, '.smart-memory-initialized');
            try {
                await stat(markerPath);
                // Already initialized, skip
                console.log('ProjectMemoryManager: Smart Memory folders already initialized');
                return;
            } catch {
                // Not initialized, proceed with setup
            }

            // Create all required folders
            const foldersToCreate = [
                path.join(this._memoryDir, 'hooks', 'utils'),
                path.join(this._memoryDir, 'agents'),
                path.join(this._memoryDir, 'commands'),
                path.join(this._memoryDir, 'skills', 'memory'),
                path.join(this._memoryDir, 'context')
            ];

            for (const folder of foldersToCreate) {
                await this._ensureDir(folder);
            }

            console.log('ProjectMemoryManager: Created Smart Memory folder structure');

            // Copy template files from extension bundle
            await this._copySmartMemoryTemplates();

            // Write marker file to indicate initialization is complete
            await writeFile(markerPath, JSON.stringify({
                initializedAt: new Date().toISOString(),
                version: '2.1.38',
                folders: foldersToCreate.map(f => path.relative(this._memoryDir!, f))
            }, null, 2));

            console.log('ProjectMemoryManager: Smart Memory System initialized successfully');

        } catch (error: any) {
            console.error('ProjectMemoryManager: Failed to initialize Smart Memory folders:', error.message);
            // Don't fail initialization - this is enhancement, not critical
        }
    }

    /**
     * Copy Smart Memory template files to user project
     */
    private async _copySmartMemoryTemplates(): Promise<void> {
        if (!this._memoryDir) return;

        try {
            // Get extension path from VS Code
            const extension = vscode.extensions.getExtension('DeveloperJillur.claude-codeui-by-nexalance');
            if (!extension) {
                console.log('ProjectMemoryManager: Extension not found, skipping template copy');
                return;
            }

            const extensionPath = extension.extensionPath;
            const templatesDir = path.join(extensionPath, 'templates', '.claude');

            // Check if templates directory exists
            try {
                await stat(templatesDir);
            } catch {
                console.log('ProjectMemoryManager: Templates directory not found, skipping');
                return;
            }

            // Copy template files (don't overwrite existing)
            const filesToCopy = [
                // Hooks
                { src: 'hooks/post_tool_use.py', dest: 'hooks/post_tool_use.py' },
                { src: 'hooks/user_prompt_submit.py', dest: 'hooks/user_prompt_submit.py' },
                { src: 'hooks/stop.py', dest: 'hooks/stop.py' },
                { src: 'hooks/utils/__init__.py', dest: 'hooks/utils/__init__.py' },
                { src: 'hooks/utils/memory_client.py', dest: 'hooks/utils/memory_client.py' },
                { src: 'hooks/utils/entity_extractor.py', dest: 'hooks/utils/entity_extractor.py' },
                { src: 'hooks/utils/secure_filter.py', dest: 'hooks/utils/secure_filter.py' },
                // Agents
                { src: 'agents/memory-curator.md', dest: 'agents/memory-curator.md' },
                { src: 'agents/goal-tracker.md', dest: 'agents/goal-tracker.md' },
                { src: 'agents/security-guardian.md', dest: 'agents/security-guardian.md' },
                // Commands
                { src: 'commands/remember.md', dest: 'commands/remember.md' },
                { src: 'commands/recall.md', dest: 'commands/recall.md' },
                { src: 'commands/goals.md', dest: 'commands/goals.md' },
                { src: 'commands/memory-status.md', dest: 'commands/memory-status.md' },
                // Skills
                { src: 'skills/memory/SKILL.md', dest: 'skills/memory/SKILL.md' }
            ];

            let copiedCount = 0;
            for (const file of filesToCopy) {
                const srcPath = path.join(templatesDir, file.src);
                const destPath = path.join(this._memoryDir, file.dest);

                try {
                    // Check if destination already exists
                    await stat(destPath);
                    // File exists, skip
                    continue;
                } catch {
                    // File doesn't exist, copy it
                }

                try {
                    // Ensure destination directory exists
                    await this._ensureDir(path.dirname(destPath));

                    // Read source and write to destination
                    const content = await readFile(srcPath, 'utf-8');
                    await writeFile(destPath, content, 'utf-8');
                    copiedCount++;
                } catch (copyError: any) {
                    console.warn(`ProjectMemoryManager: Failed to copy ${file.src}: ${copyError.message}`);
                }
            }

            if (copiedCount > 0) {
                console.log(`ProjectMemoryManager: Copied ${copiedCount} template files to project`);
            }

        } catch (error: any) {
            console.error('ProjectMemoryManager: Error copying templates:', error.message);
        }
    }

    private async _loadMemory(): Promise<void> {
        try {
            // Try to load from index first (faster)
            if (this._indexPath) {
                try {
                    const indexContent = await readFile(this._indexPath, 'utf-8');
                    const index = JSON.parse(indexContent);

                    this._state.entities = new Map(index.entities.map((e: MemoryEntity) => [e.name, e]));
                    this._state.relations = index.relations || [];
                    this._state.lastUpdated = index.lastUpdated || new Date().toISOString();
                    this._state.version = index.version || 1;

                    console.log('ProjectMemoryManager: Loaded from index');
                    return;
                } catch {
                    // Index doesn't exist, try loading from JSONL
                }
            }

            // Load from JSONL file
            if (this._memoryFilePath) {
                try {
                    const content = await readFile(this._memoryFilePath, 'utf-8');
                    const lines = content.split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        try {
                            const operation: MemoryOperation = JSON.parse(line);
                            this._applyOperation(operation);
                        } catch {
                            // Skip invalid lines
                        }
                    }

                    console.log('ProjectMemoryManager: Loaded from JSONL');
                } catch {
                    // File doesn't exist yet
                    console.log('ProjectMemoryManager: No existing memory file');
                }
            }
        } catch (error: any) {
            console.error('ProjectMemoryManager: Failed to load memory:', error.message);
        }
    }

    private _applyOperation(operation: MemoryOperation): void {
        switch (operation.type) {
            case 'create_entity':
                this._state.entities.set(operation.data.name, operation.data);
                break;
            case 'update_entity':
            case 'add_observation':
                const entity = this._state.entities.get(operation.data.entityName);
                if (entity && operation.data.observations) {
                    for (const obs of operation.data.observations) {
                        if (!entity.observations.includes(obs)) {
                            entity.observations.push(obs);
                        }
                    }
                    entity.updatedAt = operation.timestamp;
                }
                break;
            case 'delete_entity':
                this._state.entities.delete(operation.data.name);
                this._state.relations = this._state.relations.filter(
                    r => r.from !== operation.data.name && r.to !== operation.data.name
                );
                break;
            case 'create_relation':
                this._state.relations.push(operation.data);
                break;
            case 'delete_relation':
                this._state.relations = this._state.relations.filter(
                    r => !(r.from === operation.data.from &&
                           r.to === operation.data.to &&
                           r.relationType === operation.data.relationType)
                );
                break;
        }
    }

    private async _appendOperation(operation: MemoryOperation): Promise<void> {
        if (!this._memoryFilePath) return;

        try {
            await appendFile(this._memoryFilePath, JSON.stringify(operation) + '\n');
        } catch (error: any) {
            console.error('ProjectMemoryManager: Failed to append operation:', error.message);
        }
    }

    private async _saveMemoryIndex(): Promise<void> {
        if (!this._indexPath || !this._isDirty) return;

        try {
            const index = {
                version: this._state.version,
                lastUpdated: this._state.lastUpdated,
                entities: Array.from(this._state.entities.values()),
                relations: this._state.relations
            };

            await writeFile(this._indexPath, JSON.stringify(index, null, 2));
            this._isDirty = false;
            console.log('ProjectMemoryManager: Saved memory index');
        } catch (error: any) {
            console.error('ProjectMemoryManager: Failed to save index:', error.message);
        }
    }

    private _startAutoSave(): void {
        this._autoSaveTimer = setInterval(async () => {
            if (this._isDirty) {
                await this._saveMemoryIndex();
            }
        }, this._autoSaveIntervalMs);
    }

    private async _ensureProjectEntity(): Promise<void> {
        if (!this._state.entities.has('project_main')) {
            const projectName = this._workspacePath
                ? path.basename(this._workspacePath)
                : 'Unknown Project';

            await this.createEntity('project_main', 'project', [
                `Project: ${projectName}`,
                `Initialized: ${new Date().toISOString()}`,
                `Workspace: ${this._workspacePath || 'Unknown'}`
            ], {
                importance: 'critical',
                status: 'active'
            });
        }
    }

    private _generateEntityName(type: EntityType, content: string): string {
        // Create a sanitized, unique name
        const sanitized = content
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);

        const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);

        return `${type}_${sanitized}_${hash}`;
    }

    private _extractMemoryPoints(content: string, role: 'user' | 'assistant'): {
        tasks: string[];
        decisions: string[];
        files: string[];
        summary: string;
    } {
        const tasks: string[] = [];
        const decisions: string[] = [];
        const files: string[] = [];

        // Extract tasks
        const taskPatterns = [
            /(?:i want to|i need to|please|can you|let's|we should) ([^.!?\n]+)/gi,
            /(?:TODO|TASK|PENDING):\s*([^.!?\n]+)/gi,
            /(?:working on|implementing|fixing|adding|creating) ([^.!?\n]+)/gi
        ];

        for (const pattern of taskPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const task = match[1].trim();
                if (task.length > 10 && task.length < 200) {
                    tasks.push(task);
                }
            }
        }

        // Extract decisions
        const decisionPatterns = [
            /(?:decided to|will use|the approach is|we'll|going to) ([^.!?\n]+)/gi,
            /(?:choosing|selected|opted for|using) ([^.!?\n]+) (?:because|for|as)/gi
        ];

        for (const pattern of decisionPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const decision = match[1].trim();
                if (decision.length > 10 && decision.length < 200) {
                    decisions.push(decision);
                }
            }
        }

        // Extract file references
        const filePattern = /(?:\/[\w\-./]+\.\w+)|(?:`([^`]+\.\w+)`)/g;
        let fileMatch;
        while ((fileMatch = filePattern.exec(content)) !== null) {
            const file = (fileMatch[1] || fileMatch[0]).replace(/`/g, '');
            if (file.length > 3 && file.length < 200) {
                files.push(file);
            }
        }

        // Generate summary
        const summary = role === 'user'
            ? `User requested: ${content.substring(0, 150)}...`
            : `Assistant: ${content.substring(0, 150)}...`;

        return {
            tasks: [...new Set(tasks)].slice(0, 5),
            decisions: [...new Set(decisions)].slice(0, 5),
            files: [...new Set(files)].slice(0, 10),
            summary
        };
    }

    // ==================== Search Index Methods ====================

    /**
     * Tokenize text for indexing
     */
    private _tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length >= this._minTokenLength);
    }

    /**
     * Rebuild the entire search index from current state
     */
    private _rebuildSearchIndex(): void {
        const startTime = Date.now();
        this._searchIndex.clear();

        for (const entity of this._state.entities.values()) {
            this._indexEntity(entity);
        }

        this._searchIndexDirty = false;
        console.log(`ProjectMemoryManager: Search index built in ${Date.now() - startTime}ms with ${this._searchIndex.size} tokens`);
    }

    /**
     * Index a single entity
     */
    private _indexEntity(entity: MemoryEntity): void {
        // Index entity name
        const nameTokens = this._tokenize(entity.name);
        for (const token of nameTokens) {
            this._addToIndex(token, {
                entityName: entity.name,
                field: 'name',
                position: 0
            });
        }

        // Index tags
        if (entity.metadata?.tags) {
            for (const tag of entity.metadata.tags) {
                const tagTokens = this._tokenize(tag);
                for (const token of tagTokens) {
                    this._addToIndex(token, {
                        entityName: entity.name,
                        field: 'tag',
                        position: 0
                    });
                }
            }
        }

        // Index observations
        for (let i = 0; i < entity.observations.length; i++) {
            const obsTokens = this._tokenize(entity.observations[i]);
            for (const token of obsTokens) {
                this._addToIndex(token, {
                    entityName: entity.name,
                    field: 'observation',
                    position: i
                });
            }
        }

        this._searchIndexDirty = true;
    }

    /**
     * Index specific observations for an entity
     */
    private _indexObservations(entityName: string, observations: string[], startPosition: number): void {
        for (let i = 0; i < observations.length; i++) {
            const obsTokens = this._tokenize(observations[i]);
            for (const token of obsTokens) {
                this._addToIndex(token, {
                    entityName,
                    field: 'observation',
                    position: startPosition + i
                });
            }
        }
        this._searchIndexDirty = true;
    }

    /**
     * Add entry to inverted index
     */
    private _addToIndex(token: string, entry: SearchIndexEntry): void {
        const existing = this._searchIndex.get(token);
        if (existing) {
            // Check if this exact entry already exists
            const isDuplicate = existing.some(
                e => e.entityName === entry.entityName &&
                     e.field === entry.field &&
                     e.position === entry.position
            );
            if (!isDuplicate) {
                existing.push(entry);
            }
        } else {
            this._searchIndex.set(token, [entry]);
        }
    }

    /**
     * Remove all index entries for an entity
     */
    private _removeFromIndex(entityName: string): void {
        for (const [token, entries] of this._searchIndex.entries()) {
            const filtered = entries.filter(e => e.entityName !== entityName);
            if (filtered.length === 0) {
                this._searchIndex.delete(token);
            } else if (filtered.length !== entries.length) {
                this._searchIndex.set(token, filtered);
            }
        }
        this._searchIndexDirty = true;
    }

    /**
     * Get search index statistics
     */
    public getSearchIndexStats(): { tokenCount: number; entryCount: number } {
        let entryCount = 0;
        for (const entries of this._searchIndex.values()) {
            entryCount += entries.length;
        }
        return {
            tokenCount: this._searchIndex.size,
            entryCount
        };
    }
}

// ==================== Singleton Export ====================

let _instance: ProjectMemoryManager | null = null;

export function getProjectMemoryManager(): ProjectMemoryManager {
    if (!_instance) {
        _instance = new ProjectMemoryManager();
    }
    return _instance;
}

export async function createProjectMemoryManager(): Promise<ProjectMemoryManager | null> {
    const manager = new ProjectMemoryManager();
    const initialized = await manager.initialize();
    if (initialized) {
        return manager;
    }
    return null;
}
