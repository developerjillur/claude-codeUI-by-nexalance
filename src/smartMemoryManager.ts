import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import { ProjectMemoryManager, MemoryEntity, MemorySearchResult, EntityType } from './projectMemoryManager';

const { readFile, writeFile, mkdir } = fs;

/**
 * Smart Memory Manager for Claude Code Chat
 *
 * This module provides intelligent, AI-powered memory injection that:
 * 1. Analyzes the user's prompt to understand intent
 * 2. Searches memory for ONLY relevant context
 * 3. Injects minimal but sufficient context
 * 4. Prevents "Prompt is too long" errors
 * 5. Provides task management with detail views
 *
 * Key improvements over basic memory injection:
 * - Relevance-based selection (not dump all)
 * - Token budget management
 * - Intent classification
 * - Smart summarization
 */

// ==================== Types ====================

export interface TaskDetails {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'completed' | 'deprecated';
    importance: 'low' | 'medium' | 'high' | 'critical';
    createdAt: string;
    updatedAt: string;
    observations: string[];
    relatedFiles: string[];
    relatedDecisions: string[];
    relatedEntities: string[];
    progress: number; // 0-100
}

export interface SmartContextResult {
    context: string;
    tokenEstimate: number;
    relevantEntities: string[];
    confidence: number;
    wasInjected: boolean;
    reason: string;
}

export interface PromptAnalysis {
    intent: 'task' | 'question' | 'code' | 'fix' | 'review' | 'general';
    keywords: string[];
    entities: string[];
    complexity: 'simple' | 'medium' | 'complex';
    requiresHistory: boolean;
    suggestedContextSize: number;
}

export interface SessionContext {
    sessionId: string;
    messageCount: number;
    estimatedTokens: number;
    lastCompactionTime: string | null;
    isOverBudget: boolean;
}

// ==================== Main Class ====================

export class SmartMemoryManager {
    private _memoryManager: ProjectMemoryManager | null = null;
    private _workspacePath: string | undefined;
    private _isInitialized: boolean = false;

    // Token budgets
    private readonly _maxContextTokens: number = 4000; // Default max tokens for context
    private readonly _maxSessionTokens: number = 150000; // Claude's context window safety margin
    private readonly _reservedTokensForResponse: number = 16000; // Reserve for response

    // Relevance thresholds
    private readonly _minRelevanceScore: number = 3; // Minimum relevance to include
    private readonly _highRelevanceScore: number = 8; // High relevance threshold

    // Intent keywords for classification
    private readonly _intentKeywords: Record<string, string[]> = {
        task: ['implement', 'create', 'build', 'add', 'develop', 'make', 'setup', 'configure'],
        fix: ['fix', 'bug', 'error', 'issue', 'problem', 'broken', 'not working', 'fails'],
        question: ['what', 'how', 'why', 'where', 'when', 'explain', 'describe', 'tell me'],
        review: ['review', 'check', 'analyze', 'look at', 'examine', 'audit'],
        code: ['code', 'function', 'class', 'method', 'variable', 'import', 'export'],
        general: []
    };

    constructor() {}

    /**
     * Initialize the smart memory manager
     */
    public async initialize(
        memoryManager: ProjectMemoryManager,
        workspacePath?: string
    ): Promise<boolean> {
        try {
            this._memoryManager = memoryManager;
            this._workspacePath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            if (!this._memoryManager || !this._memoryManager.isInitialized()) {
                console.log('SmartMemoryManager: Memory manager not available');
                return false;
            }

            this._isInitialized = true;
            console.log('SmartMemoryManager: Initialized successfully');
            return true;
        } catch (error: any) {
            console.error('SmartMemoryManager: Initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Check if initialized
     */
    public isInitialized(): boolean {
        return this._isInitialized && this._memoryManager !== null;
    }

    // ==================== Smart Context Injection ====================

    /**
     * Generate smart, relevant context for a user prompt
     * This is the main entry point for intelligent memory injection
     */
    public async generateSmartContext(
        userPrompt: string,
        sessionContext: SessionContext,
        maxTokens?: number
    ): Promise<SmartContextResult> {
        if (!this._isInitialized || !this._memoryManager) {
            return {
                context: '',
                tokenEstimate: 0,
                relevantEntities: [],
                confidence: 0,
                wasInjected: false,
                reason: 'Memory manager not initialized'
            };
        }

        const tokenBudget = maxTokens || this._maxContextTokens;

        // Step 1: Check if we have room for context
        const availableTokens = this._calculateAvailableTokens(sessionContext, tokenBudget);
        if (availableTokens < 200) {
            return {
                context: '',
                tokenEstimate: 0,
                relevantEntities: [],
                confidence: 0,
                wasInjected: false,
                reason: 'Session too long, no room for memory context'
            };
        }

        // Step 2: Analyze the prompt to understand intent
        const analysis = this._analyzePrompt(userPrompt);

        // Step 3: Search for relevant entities
        const relevantEntities = await this._findRelevantEntities(userPrompt, analysis);

        if (relevantEntities.length === 0) {
            return {
                context: '',
                tokenEstimate: 0,
                relevantEntities: [],
                confidence: 0,
                wasInjected: false,
                reason: 'No relevant memory found for this prompt'
            };
        }

        // Step 4: Build context within token budget
        const contextResult = this._buildContextWithinBudget(
            relevantEntities,
            analysis,
            Math.min(availableTokens, analysis.suggestedContextSize)
        );

        return {
            context: contextResult.context,
            tokenEstimate: contextResult.tokenEstimate,
            relevantEntities: contextResult.entityNames,
            confidence: contextResult.confidence,
            wasInjected: contextResult.context.length > 0,
            reason: contextResult.context.length > 0
                ? `Injected ${contextResult.entityNames.length} relevant memories`
                : 'Context generation produced no content'
        };
    }

    /**
     * Analyze a prompt to understand intent and extract key information
     */
    private _analyzePrompt(prompt: string): PromptAnalysis {
        const promptLower = prompt.toLowerCase();
        const words = promptLower.split(/\s+/);

        // Classify intent
        let intent: PromptAnalysis['intent'] = 'general';
        let maxScore = 0;

        for (const [intentType, keywords] of Object.entries(this._intentKeywords)) {
            const score = keywords.filter(k => promptLower.includes(k)).length;
            if (score > maxScore) {
                maxScore = score;
                intent = intentType as PromptAnalysis['intent'];
            }
        }

        // Extract keywords (nouns and important words)
        const keywords = this._extractKeywords(prompt);

        // Extract potential entity references
        const entities = this._extractEntityReferences(prompt);

        // Determine complexity
        let complexity: PromptAnalysis['complexity'] = 'simple';
        if (prompt.length > 500 || keywords.length > 10) {
            complexity = 'complex';
        } else if (prompt.length > 200 || keywords.length > 5) {
            complexity = 'medium';
        }

        // Determine if history is needed
        const requiresHistory = this._checkIfRequiresHistory(promptLower, intent);

        // Suggest context size based on complexity and intent
        const suggestedContextSize = this._suggestContextSize(complexity, intent, requiresHistory);

        return {
            intent,
            keywords,
            entities,
            complexity,
            requiresHistory,
            suggestedContextSize
        };
    }

    /**
     * Extract meaningful keywords from a prompt
     */
    private _extractKeywords(prompt: string): string[] {
        // Common stop words to filter out
        const stopWords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
            'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
            'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
            'below', 'between', 'under', 'again', 'further', 'then', 'once',
            'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
            'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
            'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and',
            'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that',
            'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
            'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
            'what', 'which', 'who', 'whom', 'please', 'help', 'want', 'like'
        ]);

        const words = prompt.toLowerCase()
            .replace(/[^a-z0-9\s_-]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));

        // Get unique words with frequency
        const wordFreq = new Map<string, number>();
        for (const word of words) {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }

        // Sort by frequency and return top keywords
        return Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([word]) => word);
    }

    /**
     * Extract potential entity references (file paths, function names, etc.)
     */
    private _extractEntityReferences(prompt: string): string[] {
        const entities: string[] = [];

        // File paths
        const fileMatches = prompt.match(/(?:\/[\w\-./]+\.\w+)|(?:`[^`]+\.\w+`)/g);
        if (fileMatches) {
            entities.push(...fileMatches.map(f => f.replace(/`/g, '')));
        }

        // Backtick code references
        const codeMatches = prompt.match(/`([^`]+)`/g);
        if (codeMatches) {
            entities.push(...codeMatches.map(c => c.replace(/`/g, '')));
        }

        // CamelCase or snake_case identifiers
        const identifierMatches = prompt.match(/\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b|\b[a-z]+_[a-z_]+\b/g);
        if (identifierMatches) {
            entities.push(...identifierMatches);
        }

        return [...new Set(entities)];
    }

    /**
     * Check if the prompt requires conversation history
     */
    private _checkIfRequiresHistory(promptLower: string, intent: string): boolean {
        const historyIndicators = [
            'previous', 'earlier', 'before', 'last time', 'we discussed',
            'you said', 'you mentioned', 'continue', 'as we', 'remember',
            'the same', 'like before', 'again', 'still'
        ];

        return historyIndicators.some(indicator => promptLower.includes(indicator));
    }

    /**
     * Suggest appropriate context size based on analysis
     */
    private _suggestContextSize(
        complexity: PromptAnalysis['complexity'],
        intent: PromptAnalysis['intent'],
        requiresHistory: boolean
    ): number {
        let baseSize = 1000;

        // Adjust for complexity
        switch (complexity) {
            case 'simple': baseSize = 500; break;
            case 'medium': baseSize = 1500; break;
            case 'complex': baseSize = 3000; break;
        }

        // Adjust for intent
        switch (intent) {
            case 'task': baseSize *= 1.2; break;
            case 'fix': baseSize *= 1.5; break; // Bugs often need more context
            case 'review': baseSize *= 1.3; break;
            case 'question': baseSize *= 0.8; break;
            case 'code': baseSize *= 1.1; break;
        }

        // Adjust for history requirement
        if (requiresHistory) {
            baseSize *= 1.3;
        }

        return Math.min(Math.round(baseSize), this._maxContextTokens);
    }

    /**
     * Find relevant entities based on prompt and analysis
     */
    private async _findRelevantEntities(
        prompt: string,
        analysis: PromptAnalysis
    ): Promise<MemorySearchResult[]> {
        if (!this._memoryManager) return [];

        // Build search query from keywords and entities
        const searchTerms = [...analysis.keywords, ...analysis.entities];
        const query = searchTerms.join(' ');

        if (!query.trim()) {
            return [];
        }

        // Search memory
        const results = this._memoryManager.searchEntities(query, 50);

        // Filter by minimum relevance
        const filteredResults = results.filter(r => r.relevance >= this._minRelevanceScore);

        // Sort by relevance and importance
        return filteredResults.sort((a, b) => {
            // First by relevance
            if (b.relevance !== a.relevance) {
                return b.relevance - a.relevance;
            }
            // Then by importance
            const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            const aImportance = importanceOrder[a.entity.metadata?.importance || 'medium'];
            const bImportance = importanceOrder[b.entity.metadata?.importance || 'medium'];
            return bImportance - aImportance;
        });
    }

    /**
     * Build context string within token budget
     */
    private _buildContextWithinBudget(
        relevantEntities: MemorySearchResult[],
        analysis: PromptAnalysis,
        tokenBudget: number
    ): { context: string; tokenEstimate: number; entityNames: string[]; confidence: number } {
        const parts: string[] = [];
        const includedEntities: string[] = [];
        let currentTokens = 0;
        const headerTokens = 50; // Reserve for header/footer

        // Start with header
        parts.push('=== RELEVANT PROJECT CONTEXT ===\n');
        currentTokens += headerTokens;

        // Group entities by type for better organization
        const groupedEntities = this._groupEntitiesByType(relevantEntities);

        // Priority order for entity types based on intent
        const typePriority = this._getTypePriorityForIntent(analysis.intent);

        // Process entities in priority order
        for (const entityType of typePriority) {
            const entities = groupedEntities.get(entityType) || [];
            if (entities.length === 0) continue;

            const typeHeader = this._getTypeHeader(entityType);
            const typeHeaderTokens = this._estimateTokens(typeHeader);

            if (currentTokens + typeHeaderTokens > tokenBudget) break;

            parts.push(typeHeader);
            currentTokens += typeHeaderTokens;

            for (const result of entities) {
                const entityContext = this._formatEntityForContext(result);
                const entityTokens = this._estimateTokens(entityContext);

                if (currentTokens + entityTokens > tokenBudget) break;

                parts.push(entityContext);
                currentTokens += entityTokens;
                includedEntities.push(result.entity.name);
            }
        }

        // Add footer
        parts.push('\n=== END CONTEXT ===\n');

        // Calculate confidence based on relevance scores
        const avgRelevance = includedEntities.length > 0
            ? relevantEntities
                .filter(r => includedEntities.includes(r.entity.name))
                .reduce((sum, r) => sum + r.relevance, 0) / includedEntities.length
            : 0;

        const confidence = Math.min(avgRelevance / this._highRelevanceScore, 1);

        return {
            context: includedEntities.length > 0 ? parts.join('\n') : '',
            tokenEstimate: currentTokens,
            entityNames: includedEntities,
            confidence
        };
    }

    /**
     * Group entities by their type
     */
    private _groupEntitiesByType(entities: MemorySearchResult[]): Map<EntityType, MemorySearchResult[]> {
        const grouped = new Map<EntityType, MemorySearchResult[]>();

        for (const result of entities) {
            const type = result.entity.entityType;
            if (!grouped.has(type)) {
                grouped.set(type, []);
            }
            grouped.get(type)!.push(result);
        }

        return grouped;
    }

    /**
     * Get priority order of entity types based on intent
     */
    private _getTypePriorityForIntent(intent: PromptAnalysis['intent']): EntityType[] {
        switch (intent) {
            case 'task':
                return ['task', 'decision', 'file', 'pattern', 'architecture', 'feature', 'project'];
            case 'fix':
                return ['bug', 'file', 'pattern', 'decision', 'task', 'architecture'];
            case 'code':
                return ['file', 'pattern', 'architecture', 'decision', 'task', 'feature'];
            case 'review':
                return ['file', 'decision', 'pattern', 'architecture', 'task', 'bug'];
            case 'question':
                return ['decision', 'architecture', 'pattern', 'project', 'feature', 'file'];
            default:
                return ['task', 'decision', 'file', 'pattern', 'bug', 'feature', 'architecture', 'project'];
        }
    }

    /**
     * Get header for entity type
     */
    private _getTypeHeader(type: EntityType): string {
        const headers: Record<EntityType, string> = {
            project: '\n## Project Info',
            task: '\n## Related Tasks',
            file: '\n## Relevant Files',
            decision: '\n## Key Decisions',
            pattern: '\n## Code Patterns',
            bug: '\n## Known Bugs',
            feature: '\n## Features',
            dependency: '\n## Dependencies',
            architecture: '\n## Architecture',
            conversation: '\n## Previous Discussions',
            milestone: '\n## Milestones'
        };
        return headers[type] || `\n## ${type}`;
    }

    /**
     * Format an entity for context injection
     */
    private _formatEntityForContext(result: MemorySearchResult): string {
        const entity = result.entity;
        const lines: string[] = [];

        // Entity name (cleaned up)
        const cleanName = entity.name
            .replace(/^(task_|file_|decision_|pattern_|bug_|feature_)/, '')
            .replace(/_[a-f0-9]{8}$/, '')
            .replace(/_/g, ' ');

        lines.push(`- **${cleanName}**`);

        // Status if relevant
        if (entity.metadata?.status && entity.metadata.status !== 'active') {
            lines.push(`  Status: ${entity.metadata.status}`);
        }

        // Most relevant observations (max 2-3)
        const relevantObs = result.matchedObservations.length > 0
            ? result.matchedObservations
            : entity.observations;

        for (const obs of relevantObs.slice(0, 2)) {
            const truncated = obs.length > 150 ? obs.substring(0, 147) + '...' : obs;
            lines.push(`  - ${truncated}`);
        }

        return lines.join('\n');
    }

    /**
     * Calculate available tokens for context injection
     */
    private _calculateAvailableTokens(
        sessionContext: SessionContext,
        maxContextTokens: number
    ): number {
        const totalBudget = this._maxSessionTokens - this._reservedTokensForResponse;
        const sessionUsed = sessionContext.estimatedTokens;
        const availableInSession = totalBudget - sessionUsed;

        // Don't exceed the configured max context tokens
        return Math.min(availableInSession, maxContextTokens);
    }

    /**
     * Estimate tokens in a string (rough estimate: ~4 chars per token)
     */
    private _estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    // ==================== Task Manager Functions ====================

    /**
     * Get all tasks with full details
     */
    public async getAllTasks(): Promise<TaskDetails[]> {
        if (!this._memoryManager) return [];

        const taskEntities = this._memoryManager.getEntitiesByType('task');
        const tasks: TaskDetails[] = [];

        for (const entity of taskEntities) {
            tasks.push(await this._entityToTaskDetails(entity));
        }

        // Sort by status (active first) then by importance
        return tasks.sort((a, b) => {
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (b.status === 'active' && a.status !== 'active') return 1;

            const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return importanceOrder[b.importance] - importanceOrder[a.importance];
        });
    }

    /**
     * Get a single task with full details
     */
    public async getTaskDetails(taskId: string): Promise<TaskDetails | null> {
        if (!this._memoryManager) return null;

        const entity = this._memoryManager.getEntity(taskId);
        if (!entity || entity.entityType !== 'task') return null;

        return this._entityToTaskDetails(entity);
    }

    /**
     * Convert a memory entity to TaskDetails
     */
    private async _entityToTaskDetails(entity: MemoryEntity): Promise<TaskDetails> {
        // Get related entities
        const relations = this._memoryManager?.getRelations(entity.name) || [];
        const relatedDecisions = relations
            .filter(r => r.to.startsWith('decision_') || r.from.startsWith('decision_'))
            .map(r => r.to === entity.name ? r.from : r.to);

        const relatedEntities = relations
            .map(r => r.to === entity.name ? r.from : r.to);

        // Calculate progress from observations
        const completedIndicators = ['completed', 'done', 'finished', 'resolved', 'fixed'];
        const progressIndicators = entity.observations.filter(obs =>
            completedIndicators.some(indicator => obs.toLowerCase().includes(indicator))
        );
        const progress = entity.metadata?.status === 'completed'
            ? 100
            : Math.min(progressIndicators.length * 20, 80);

        // Extract description from first observation
        const description = entity.observations[0] || entity.name;

        // Clean up name
        const cleanName = entity.name
            .replace(/^task_/, '')
            .replace(/_[a-f0-9]{8}$/, '')
            .replace(/_/g, ' ');

        return {
            id: entity.name,
            name: cleanName,
            description,
            status: entity.metadata?.status || 'active',
            importance: entity.metadata?.importance || 'medium',
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            observations: entity.observations,
            relatedFiles: entity.metadata?.relatedFiles || [],
            relatedDecisions,
            relatedEntities,
            progress
        };
    }

    /**
     * Update task status
     */
    public async updateTaskStatus(
        taskId: string,
        status: 'active' | 'completed' | 'deprecated'
    ): Promise<boolean> {
        if (!this._memoryManager) return false;

        const entity = this._memoryManager.getEntity(taskId);
        if (!entity) return false;

        entity.metadata = {
            ...entity.metadata,
            status
        };
        entity.updatedAt = new Date().toISOString();

        // Add observation about status change
        await this._memoryManager.addObservations(taskId, [
            `Status changed to ${status} at ${new Date().toLocaleString()}`
        ]);

        return true;
    }

    /**
     * Create a new task
     */
    public async createTask(
        name: string,
        description: string,
        importance: 'low' | 'medium' | 'high' | 'critical' = 'medium',
        relatedFiles?: string[]
    ): Promise<string | null> {
        if (!this._memoryManager) return null;

        const entityName = this._generateEntityName('task', name);

        const entity = await this._memoryManager.createEntity(entityName, 'task', [
            description,
            `Created: ${new Date().toLocaleString()}`
        ], {
            importance,
            status: 'active',
            relatedFiles: relatedFiles || []
        });

        return entity ? entityName : null;
    }

    /**
     * Add observation to a task
     */
    public async addTaskObservation(taskId: string, observation: string): Promise<boolean> {
        if (!this._memoryManager) return false;

        const result = await this._memoryManager.addObservations(taskId, [observation]);
        return result !== null;
    }

    /**
     * Generate entity name
     */
    private _generateEntityName(type: string, content: string): string {
        const sanitized = content
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);

        const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
        return `${type}_${sanitized}_${hash}`;
    }

    // ==================== Session Management ====================

    /**
     * Check if session needs compaction to prevent "prompt too long" error
     */
    public shouldCompactSession(sessionContext: SessionContext): boolean {
        const threshold = this._maxSessionTokens - this._reservedTokensForResponse - 10000;
        return sessionContext.estimatedTokens > threshold;
    }

    /**
     * Get session health status
     */
    public getSessionHealth(sessionContext: SessionContext): {
        status: 'healthy' | 'warning' | 'critical';
        usagePercent: number;
        recommendation: string;
    } {
        const maxUsable = this._maxSessionTokens - this._reservedTokensForResponse;
        const usagePercent = (sessionContext.estimatedTokens / maxUsable) * 100;

        if (usagePercent < 70) {
            return {
                status: 'healthy',
                usagePercent,
                recommendation: 'Session is within normal limits'
            };
        } else if (usagePercent < 90) {
            return {
                status: 'warning',
                usagePercent,
                recommendation: 'Consider starting a new session or compacting context'
            };
        } else {
            return {
                status: 'critical',
                usagePercent,
                recommendation: 'Start a new session to avoid "Prompt too long" errors'
            };
        }
    }

    /**
     * Dispose the manager
     */
    public dispose(): void {
        this._memoryManager = null;
        this._isInitialized = false;
        console.log('SmartMemoryManager: Disposed');
    }
}

// ==================== Singleton Export ====================

let _instance: SmartMemoryManager | null = null;

export function getSmartMemoryManager(): SmartMemoryManager {
    if (!_instance) {
        _instance = new SmartMemoryManager();
    }
    return _instance;
}

export async function createSmartMemoryManager(
    memoryManager: ProjectMemoryManager,
    workspacePath?: string
): Promise<SmartMemoryManager | null> {
    const manager = new SmartMemoryManager();
    const initialized = await manager.initialize(memoryManager, workspacePath);
    if (initialized) {
        return manager;
    }
    return null;
}
