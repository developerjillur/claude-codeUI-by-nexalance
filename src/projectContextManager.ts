import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';

/**
 * Project Context Manager for Claude Code Chat
 *
 * Solves the session loss problem by:
 * 1. Persisting all conversations to .claude/context/ folder
 * 2. Creating AI-generated context summaries for quick restoration
 * 3. Auto-loading previous context when extension starts
 * 4. Allowing manual "Backup Project Context" snapshots
 *
 * This ensures you never lose your chat history or context, even when:
 * - VS Code closes
 * - You start a new chat session
 * - The extension restarts
 */

const { readFile, writeFile, mkdir, readdir, stat, unlink } = fs;

export interface ConversationEntry {
    id: string;
    timestamp: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokenEstimate?: number;
    metadata?: {
        model?: string;
        toolsUsed?: string[];
        filesModified?: string[];
        isThinking?: boolean;
    };
}

export interface ConversationSession {
    sessionId: string;
    startTime: string;
    endTime?: string;
    title: string;  // Auto-generated from first user message
    messages: ConversationEntry[];
    summary?: string;  // AI-generated summary
    metadata: {
        totalMessages: number;
        totalTokens: number;
        filesWorkedOn: string[];
        keyDecisions: string[];
        model?: string;
    };
}

export interface ProjectContextSnapshot {
    id: string;
    timestamp: string;
    type: 'auto' | 'manual';
    name: string;
    description: string;

    // Current project state
    projectSummary: string;
    recentConversationIds: string[];

    // Key information to restore
    currentGoals: string[];
    completedTasks: string[];
    pendingTasks: string[];
    keyDecisions: string[];
    importantFiles: string[];
    codeChanges: string[];

    // For quick context injection
    contextPrompt: string;  // Ready-to-use prompt to restore context
}

export interface ProjectContextIndex {
    version: number;
    projectPath: string;
    lastUpdated: string;

    // Active conversation
    currentSessionId?: string;

    // All sessions
    sessions: {
        id: string;
        title: string;
        startTime: string;
        messageCount: number;
    }[];

    // Context snapshots
    snapshots: {
        id: string;
        name: string;
        timestamp: string;
        type: 'auto' | 'manual';
    }[];

    // Settings
    autoSaveEnabled: boolean;
    autoSaveIntervalMs: number;
    maxSessionsToKeep: number;
    maxSnapshotsToKeep: number;
}

export class ProjectContextManager {
    private _workspacePath: string | undefined;
    private _contextDir: string | undefined;
    private _sessionsDir: string | undefined;
    private _snapshotsDir: string | undefined;
    private _indexPath: string | undefined;
    private _index: ProjectContextIndex | undefined;
    private _currentSession: ConversationSession | undefined;
    private _isInitialized: boolean = false;
    private _autoSaveTimer: NodeJS.Timeout | undefined;
    private _onContextChange: ((snapshot: ProjectContextSnapshot | null) => void) | null = null;
    private _isSaving: boolean = false; // Lock to prevent concurrent saves

    // Auto-save settings
    private _autoSaveEnabled: boolean = true;
    private _autoSaveIntervalMs: number = 30000;  // 30 seconds
    private _maxSessionsToKeep: number = 50;
    private _maxSnapshotsToKeep: number = 20;

    constructor() {}

    /**
     * Set callback for context changes
     */
    public setContextChangeCallback(callback: (snapshot: ProjectContextSnapshot | null) => void): void {
        this._onContextChange = callback;
    }

    /**
     * Initialize the project context manager
     */
    public async initialize(workspacePath?: string): Promise<boolean> {
        try {
            this._workspacePath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            if (!this._workspacePath) {
                console.log('ProjectContextManager: No workspace folder found');
                return false;
            }

            // Set up directory structure
            this._contextDir = path.join(this._workspacePath, '.claude', 'context');
            this._sessionsDir = path.join(this._contextDir, 'sessions');
            this._snapshotsDir = path.join(this._contextDir, 'snapshots');
            this._indexPath = path.join(this._contextDir, 'index.json');

            // Create directories
            await this._ensureDir(this._contextDir);
            await this._ensureDir(this._sessionsDir);
            await this._ensureDir(this._snapshotsDir);

            // Load or create index
            await this._loadOrCreateIndex();

            // Start auto-save timer
            if (this._autoSaveEnabled) {
                this._startAutoSave();
            }

            this._isInitialized = true;
            console.log('ProjectContextManager: Initialized successfully');
            console.log(`ProjectContextManager: ${this._index?.sessions.length || 0} sessions, ${this._index?.snapshots.length || 0} snapshots`);

            return true;
        } catch (error: any) {
            console.error('ProjectContextManager: Initialization failed:', error.message);
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
     * Start a new conversation session
     */
    public startNewSession(model?: string): string {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const now = new Date().toISOString();

        this._currentSession = {
            sessionId,
            startTime: now,
            title: 'New Conversation',
            messages: [],
            metadata: {
                totalMessages: 0,
                totalTokens: 0,
                filesWorkedOn: [],
                keyDecisions: [],
                model
            }
        };

        // Update index
        if (this._index) {
            this._index.currentSessionId = sessionId;
            this._index.sessions.push({
                id: sessionId,
                title: 'New Conversation',
                startTime: now,
                messageCount: 0
            });
            // Fire and forget with error handling
            this._saveIndex().catch(err => {
                console.error('ProjectContextManager: Failed to save index on new session:', err.message);
            });
        }

        console.log(`ProjectContextManager: Started new session ${sessionId}`);
        return sessionId;
    }

    /**
     * Add a message to the current session
     */
    public async addMessage(
        role: 'user' | 'assistant' | 'system',
        content: string,
        metadata?: ConversationEntry['metadata']
    ): Promise<void> {
        if (!this._currentSession) {
            this.startNewSession(metadata?.model);
        }

        const entry: ConversationEntry = {
            id: `msg_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
            timestamp: new Date().toISOString(),
            role,
            content,
            tokenEstimate: this._estimateTokens(content),
            metadata
        };

        this._currentSession!.messages.push(entry);
        this._currentSession!.metadata.totalMessages++;
        this._currentSession!.metadata.totalTokens += entry.tokenEstimate || 0;

        // Update title from first user message
        if (role === 'user' && this._currentSession!.title === 'New Conversation') {
            this._currentSession!.title = this._generateTitle(content);
            this._updateSessionInIndex();
        }

        // Extract files and decisions from assistant messages
        if (role === 'assistant') {
            this._extractMetadata(content);
        }

        // Track files modified
        if (metadata?.filesModified) {
            for (const file of metadata.filesModified) {
                if (!this._currentSession!.metadata.filesWorkedOn.includes(file)) {
                    this._currentSession!.metadata.filesWorkedOn.push(file);
                }
            }
        }
    }

    /**
     * End the current session
     */
    public async endSession(): Promise<void> {
        if (!this._currentSession || !this._sessionsDir) return;

        this._currentSession.endTime = new Date().toISOString();

        // Generate summary
        this._currentSession.summary = this._generateSessionSummary(this._currentSession);

        // Save session to file
        const sessionPath = path.join(this._sessionsDir, `${this._currentSession.sessionId}.json`);
        await writeFile(sessionPath, JSON.stringify(this._currentSession, null, 2));

        // Update index
        this._updateSessionInIndex();
        await this._saveIndex();

        console.log(`ProjectContextManager: Ended session ${this._currentSession.sessionId}`);

        // Create auto-snapshot if significant conversation
        if (this._currentSession.messages.length >= 5) {
            await this.createSnapshot('auto', 'Auto-saved session context');
        }

        this._currentSession = undefined;
    }

    /**
     * Save the current session without ending it
     */
    public async saveCurrentSession(): Promise<void> {
        if (!this._currentSession || !this._sessionsDir) return;

        // Wait if another save is in progress
        if (this._isSaving) {
            // Don't block indefinitely, just skip if already saving
            console.log('ProjectContextManager: Save already in progress, skipping');
            return;
        }

        this._isSaving = true;
        try {
            const sessionPath = path.join(this._sessionsDir, `${this._currentSession.sessionId}.json`);
            await writeFile(sessionPath, JSON.stringify(this._currentSession, null, 2));
            this._updateSessionInIndex();
            await this._saveIndex();

            console.log(`ProjectContextManager: Saved session ${this._currentSession.sessionId}`);
        } finally {
            this._isSaving = false;
        }
    }

    /**
     * Create a project context snapshot (manual backup)
     */
    public async createSnapshot(
        type: 'auto' | 'manual' = 'manual',
        description?: string
    ): Promise<ProjectContextSnapshot | null> {
        if (!this._isInitialized || !this._snapshotsDir || !this._index) {
            return null;
        }

        try {
            const snapshotId = `snapshot_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const now = new Date().toISOString();

            // Gather information from recent sessions
            const recentSessions = await this._loadRecentSessions(5);

            // Extract key information
            const allFiles: string[] = [];
            const allDecisions: string[] = [];
            const allGoals: string[] = [];
            const allTasks: string[] = [];
            const codeChanges: string[] = [];

            for (const session of recentSessions) {
                allFiles.push(...session.metadata.filesWorkedOn);
                allDecisions.push(...session.metadata.keyDecisions);

                // Extract goals and tasks from messages
                for (const msg of session.messages) {
                    if (msg.role === 'user') {
                        const goals = this._extractGoals(msg.content);
                        allGoals.push(...goals);
                    }
                    if (msg.role === 'assistant') {
                        const tasks = this._extractTasks(msg.content);
                        allTasks.push(...tasks);
                        const changes = this._extractCodeChanges(msg.content);
                        codeChanges.push(...changes);
                    }
                }
            }

            // Create context prompt for restoration
            const contextPrompt = this._generateContextPrompt(
                allGoals,
                allDecisions,
                allFiles,
                allTasks,
                codeChanges,
                recentSessions
            );

            // Create project summary
            const projectSummary = this._generateProjectSummary(
                recentSessions,
                allFiles,
                allDecisions
            );

            const snapshot: ProjectContextSnapshot = {
                id: snapshotId,
                timestamp: now,
                type,
                name: type === 'manual'
                    ? `Manual Backup - ${new Date().toLocaleString()}`
                    : `Auto Backup - ${new Date().toLocaleString()}`,
                description: description || 'Project context snapshot',
                projectSummary,
                recentConversationIds: recentSessions.map(s => s.sessionId),
                currentGoals: [...new Set(allGoals)].slice(0, 10),
                completedTasks: [...new Set(allTasks.filter(t => t.includes('completed') || t.includes('done')))].slice(0, 10),
                pendingTasks: [...new Set(allTasks.filter(t => !t.includes('completed') && !t.includes('done')))].slice(0, 10),
                keyDecisions: [...new Set(allDecisions)].slice(0, 10),
                importantFiles: [...new Set(allFiles)].slice(0, 20),
                codeChanges: [...new Set(codeChanges)].slice(0, 15),
                contextPrompt
            };

            // Save snapshot to file
            const snapshotPath = path.join(this._snapshotsDir, `${snapshotId}.json`);
            await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

            // Update index
            this._index.snapshots.push({
                id: snapshotId,
                name: snapshot.name,
                timestamp: now,
                type
            });
            this._index.lastUpdated = now;
            await this._saveIndex();

            // Cleanup old snapshots
            await this._cleanupOldSnapshots();

            console.log(`ProjectContextManager: Created snapshot ${snapshotId}`);

            // Notify callback
            if (this._onContextChange) {
                this._onContextChange(snapshot);
            }

            return snapshot;
        } catch (error: any) {
            console.error('ProjectContextManager: Failed to create snapshot:', error.message);
            return null;
        }
    }

    /**
     * Get the latest snapshot for context restoration
     */
    public async getLatestSnapshot(): Promise<ProjectContextSnapshot | null> {
        if (!this._index || !this._snapshotsDir || this._index.snapshots.length === 0) {
            return null;
        }

        const latestMeta = this._index.snapshots[this._index.snapshots.length - 1];
        return this._loadSnapshot(latestMeta.id);
    }

    /**
     * Get all snapshots
     */
    public getSnapshotsList(): { id: string; name: string; timestamp: string; type: string }[] {
        return this._index?.snapshots || [];
    }

    /**
     * List all snapshots with message count
     */
    public async listSnapshots(): Promise<Array<{
        id: string;
        timestamp: number;
        messageCount: number;
        type: 'auto' | 'manual';
        name: string;
    }>> {
        if (!this._index || !this._snapshotsDir) return [];

        const results: Array<{
            id: string;
            timestamp: number;
            messageCount: number;
            type: 'auto' | 'manual';
            name: string;
        }> = [];

        for (const snapshotMeta of this._index.snapshots) {
            const snapshot = await this._loadSnapshot(snapshotMeta.id);
            if (snapshot) {
                results.push({
                    id: snapshot.id,
                    timestamp: new Date(snapshot.timestamp).getTime(),
                    messageCount: snapshot.recentConversationIds.length * 10, // Approximate
                    type: snapshot.type,
                    name: snapshot.name
                });
            }
        }

        return results.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Set callback for auto-save events
     */
    private _autoSaveCallback: (() => Promise<void>) | null = null;

    public setAutoSaveCallback(callback: () => Promise<void>): void {
        this._autoSaveCallback = callback;
    }

    /**
     * Enable auto-save functionality
     */
    public enableAutoSave(): void {
        this._autoSaveEnabled = true;
        if (!this._autoSaveTimer) {
            this._startAutoSave();
        }
    }

    /**
     * Disable auto-save functionality
     */
    public disableAutoSave(): void {
        this._autoSaveEnabled = false;
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = undefined;
        }
    }

    /**
     * Load a specific snapshot
     */
    public async loadSnapshot(snapshotId: string): Promise<ProjectContextSnapshot | null> {
        return this._loadSnapshot(snapshotId);
    }

    /**
     * Get the context restoration prompt from a snapshot
     */
    public async getContextPrompt(snapshotId?: string): Promise<string | null> {
        let snapshot: ProjectContextSnapshot | null;

        if (snapshotId) {
            snapshot = await this._loadSnapshot(snapshotId);
        } else {
            snapshot = await this.getLatestSnapshot();
        }

        return snapshot?.contextPrompt || null;
    }

    /**
     * Get recent sessions
     */
    public async getRecentSessions(limit: number = 10): Promise<ConversationSession[]> {
        return this._loadRecentSessions(limit);
    }

    /**
     * Get current session
     */
    public getCurrentSession(): ConversationSession | undefined {
        return this._currentSession;
    }

    /**
     * Load a previous session and set it as current
     */
    public async restoreSession(sessionId: string): Promise<boolean> {
        if (!this._sessionsDir) return false;

        try {
            const sessionPath = path.join(this._sessionsDir, `${sessionId}.json`);
            const content = await readFile(sessionPath, 'utf-8');
            this._currentSession = JSON.parse(content);

            if (this._index) {
                this._index.currentSessionId = sessionId;
                await this._saveIndex();
            }

            console.log(`ProjectContextManager: Restored session ${sessionId}`);
            return true;
        } catch (error: any) {
            console.error(`ProjectContextManager: Failed to restore session ${sessionId}:`, error.message);
            return false;
        }
    }

    /**
     * Get conversation history as messages for API
     */
    public getConversationForAPI(): Array<{ role: string; content: string }> {
        if (!this._currentSession) return [];

        return this._currentSession.messages
            .filter(m => m.role !== 'system' || m.content.includes('[Previous conversation summary]'))
            .map(m => ({
                role: m.role,
                content: m.content
            }));
    }

    /**
     * Clear all context data
     */
    public async clearAllContext(): Promise<boolean> {
        try {
            if (this._contextDir) {
                // Remove all session files
                if (this._sessionsDir) {
                    const files = await readdir(this._sessionsDir);
                    for (const file of files) {
                        await unlink(path.join(this._sessionsDir, file));
                    }
                }

                // Remove all snapshot files
                if (this._snapshotsDir) {
                    const files = await readdir(this._snapshotsDir);
                    for (const file of files) {
                        await unlink(path.join(this._snapshotsDir, file));
                    }
                }

                // Reset index
                if (this._index) {
                    this._index.sessions = [];
                    this._index.snapshots = [];
                    this._index.currentSessionId = undefined;
                    this._index.lastUpdated = new Date().toISOString();
                    await this._saveIndex();
                }
            }

            this._currentSession = undefined;
            console.log('ProjectContextManager: Cleared all context');
            return true;
        } catch (error: any) {
            console.error('ProjectContextManager: Failed to clear context:', error.message);
            return false;
        }
    }

    /**
     * Stop auto-save and cleanup
     */
    public dispose(): void {
        // Clear auto-save timer
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = undefined;
        }

        // Save current session before disposing (fire and forget with error handling)
        if (this._currentSession) {
            this.saveCurrentSession().catch(err => {
                console.error('ProjectContextManager: Error saving session on dispose:', err.message);
            });
        }

        // Clear callbacks to prevent memory leaks
        this._autoSaveCallback = null;

        // Clear current session reference
        this._currentSession = undefined;

        console.log('ProjectContextManager: Disposed');
    }

    // ==================== Private Methods ====================

    private async _ensureDir(dirPath: string): Promise<void> {
        try {
            await mkdir(dirPath, { recursive: true });
        } catch (error: any) {
            if (error.code !== 'EEXIST') throw error;
        }
    }

    private async _loadOrCreateIndex(): Promise<void> {
        if (!this._indexPath || !this._workspacePath) return;

        try {
            const content = await readFile(this._indexPath, 'utf-8');
            this._index = JSON.parse(content);
        } catch {
            // Create new index
            this._index = {
                version: 1,
                projectPath: this._workspacePath,
                lastUpdated: new Date().toISOString(),
                sessions: [],
                snapshots: [],
                autoSaveEnabled: true,
                autoSaveIntervalMs: 30000,
                maxSessionsToKeep: 50,
                maxSnapshotsToKeep: 20
            };
            await this._saveIndex();
        }
    }

    private async _saveIndex(): Promise<void> {
        if (!this._indexPath || !this._index) return;

        this._index.lastUpdated = new Date().toISOString();
        await writeFile(this._indexPath, JSON.stringify(this._index, null, 2));
    }

    private _updateSessionInIndex(): void {
        if (!this._index || !this._currentSession) return;

        const sessionMeta = this._index.sessions.find(s => s.id === this._currentSession!.sessionId);
        if (sessionMeta) {
            sessionMeta.title = this._currentSession.title;
            sessionMeta.messageCount = this._currentSession.messages.length;
        }
    }

    private _startAutoSave(): void {
        this._autoSaveTimer = setInterval(async () => {
            if (this._currentSession && this._currentSession.messages.length > 0) {
                try {
                    await this.saveCurrentSession();
                } catch (error) {
                    console.error('ProjectContextManager: Auto-save failed:', error);
                }
            }
        }, this._autoSaveIntervalMs);
    }

    private async _loadRecentSessions(limit: number): Promise<ConversationSession[]> {
        if (!this._sessionsDir || !this._index) return [];

        const sessions: ConversationSession[] = [];
        const recentIds = this._index.sessions
            .slice(-limit)
            .reverse()
            .map(s => s.id);

        for (const id of recentIds) {
            try {
                const sessionPath = path.join(this._sessionsDir, `${id}.json`);
                const content = await readFile(sessionPath, 'utf-8');
                sessions.push(JSON.parse(content));
            } catch {
                // Session file might not exist yet
            }
        }

        // Include current session if exists
        if (this._currentSession && !sessions.find(s => s.sessionId === this._currentSession!.sessionId)) {
            sessions.unshift(this._currentSession);
        }

        return sessions;
    }

    private async _loadSnapshot(snapshotId: string): Promise<ProjectContextSnapshot | null> {
        if (!this._snapshotsDir) return null;

        try {
            const snapshotPath = path.join(this._snapshotsDir, `${snapshotId}.json`);
            const content = await readFile(snapshotPath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    private async _cleanupOldSnapshots(): Promise<void> {
        if (!this._index || !this._snapshotsDir) return;

        while (this._index.snapshots.length > this._maxSnapshotsToKeep) {
            const oldest = this._index.snapshots.shift();
            if (oldest) {
                try {
                    await unlink(path.join(this._snapshotsDir, `${oldest.id}.json`));
                } catch {
                    // Ignore if already deleted
                }
            }
        }
    }

    private _estimateTokens(text: string): number {
        const charCount = text.length;
        const wordCount = text.split(/\s+/).length;
        return Math.ceil((charCount * 0.25 + wordCount * 1.3) / 2);
    }

    private _generateTitle(userMessage: string): string {
        // Take first line or first 50 chars
        const firstLine = userMessage.split('\n')[0].trim();
        if (firstLine.length <= 50) {
            return firstLine;
        }
        return firstLine.substring(0, 47) + '...';
    }

    private _extractMetadata(assistantContent: string): void {
        if (!this._currentSession) return;

        // Extract file paths
        const fileMatches = assistantContent.match(/(?:\/[\w\-./]+\.\w+)|(?:`[^`]+\.\w+`)/g);
        if (fileMatches) {
            for (const file of fileMatches) {
                const cleanFile = file.replace(/`/g, '');
                if (!this._currentSession.metadata.filesWorkedOn.includes(cleanFile)) {
                    this._currentSession.metadata.filesWorkedOn.push(cleanFile);
                }
            }
        }

        // Extract decisions
        const decisionPatterns = [
            /decided to ([^.!?\n]+)/gi,
            /will use ([^.!?\n]+) for/gi,
            /the approach is ([^.!?\n]+)/gi,
            /implemented ([^.!?\n]+)/gi
        ];

        for (const pattern of decisionPatterns) {
            pattern.lastIndex = 0; // Reset regex state for reuse
            let match;
            while ((match = pattern.exec(assistantContent)) !== null) {
                const decision = match[1].substring(0, 100);
                if (!this._currentSession.metadata.keyDecisions.includes(decision)) {
                    this._currentSession.metadata.keyDecisions.push(decision);
                }
            }
        }
    }

    private _extractGoals(userContent: string): string[] {
        const goals: string[] = [];
        const patterns = [
            /(?:i want to|i need to|please|help me|can you) ([^.!?\n]+)/gi,
            /(?:implement|create|build|add|fix|update) ([^.!?\n]+)/gi
        ];

        for (const pattern of patterns) {
            pattern.lastIndex = 0; // Reset regex state for reuse
            let match;
            while ((match = pattern.exec(userContent)) !== null) {
                goals.push(match[1].substring(0, 100));
            }
        }

        return goals;
    }

    private _extractTasks(assistantContent: string): string[] {
        const tasks: string[] = [];
        const patterns = [
            /(?:I've |I have |I |We )(created|modified|fixed|implemented|added|removed|updated|completed) ([^.!?\n]+)/gi,
            /(?:TODO|PENDING|NEXT): ([^.!?\n]+)/gi
        ];

        for (const pattern of patterns) {
            pattern.lastIndex = 0; // Reset regex state for reuse
            let match;
            while ((match = pattern.exec(assistantContent)) !== null) {
                tasks.push(match[0].substring(0, 100));
            }
        }

        return tasks;
    }

    private _extractCodeChanges(assistantContent: string): string[] {
        const changes: string[] = [];
        const patterns = [
            /(?:Created|Modified|Updated|Added|Removed|Fixed) (?:file |in )?([^\n]+\.[\w]+)/gi,
            /(?:wrote|edited|changed) ([^\n]+\.[\w]+)/gi
        ];

        for (const pattern of patterns) {
            pattern.lastIndex = 0; // Reset regex state for reuse
            let match;
            while ((match = pattern.exec(assistantContent)) !== null) {
                changes.push(match[0].substring(0, 150));
            }
        }

        return changes;
    }

    private _generateSessionSummary(session: ConversationSession): string {
        const parts: string[] = [];

        parts.push(`Session: ${session.title}`);
        parts.push(`Duration: ${session.startTime} to ${session.endTime || 'ongoing'}`);
        parts.push(`Messages: ${session.messages.length}`);

        if (session.metadata.filesWorkedOn.length > 0) {
            parts.push(`Files: ${session.metadata.filesWorkedOn.slice(0, 5).join(', ')}`);
        }

        if (session.metadata.keyDecisions.length > 0) {
            parts.push(`Key Decisions: ${session.metadata.keyDecisions.slice(0, 3).join('; ')}`);
        }

        return parts.join('\n');
    }

    private _generateProjectSummary(
        sessions: ConversationSession[],
        files: string[],
        decisions: string[]
    ): string {
        const parts: string[] = [];

        parts.push('=== Project Context Summary ===\n');

        parts.push(`Total Sessions: ${sessions.length}`);
        parts.push(`Files Worked On: ${[...new Set(files)].length}`);
        parts.push(`Key Decisions Made: ${[...new Set(decisions)].length}`);
        parts.push('');

        if (sessions.length > 0) {
            parts.push('Recent Conversations:');
            for (const session of sessions.slice(0, 3)) {
                parts.push(`- ${session.title} (${session.messages.length} messages)`);
            }
            parts.push('');
        }

        if (files.length > 0) {
            parts.push('Important Files:');
            for (const file of [...new Set(files)].slice(0, 10)) {
                parts.push(`- ${file}`);
            }
            parts.push('');
        }

        if (decisions.length > 0) {
            parts.push('Key Decisions:');
            for (const decision of [...new Set(decisions)].slice(0, 5)) {
                parts.push(`- ${decision}`);
            }
        }

        return parts.join('\n');
    }

    private _generateContextPrompt(
        goals: string[],
        decisions: string[],
        files: string[],
        tasks: string[],
        codeChanges: string[],
        sessions: ConversationSession[]
    ): string {
        const parts: string[] = [];

        parts.push('[RESTORED PROJECT CONTEXT]\n');
        parts.push('The following is a summary of previous conversations in this project:\n');

        if (goals.length > 0) {
            parts.push('## Goals & Objectives:');
            for (const goal of [...new Set(goals)].slice(0, 5)) {
                parts.push(`- ${goal}`);
            }
            parts.push('');
        }

        if (decisions.length > 0) {
            parts.push('## Key Decisions Made:');
            for (const decision of [...new Set(decisions)].slice(0, 5)) {
                parts.push(`- ${decision}`);
            }
            parts.push('');
        }

        if (files.length > 0) {
            parts.push('## Files Previously Worked On:');
            parts.push([...new Set(files)].slice(0, 15).join(', '));
            parts.push('');
        }

        const completed = tasks.filter(t => t.toLowerCase().includes('completed') || t.toLowerCase().includes('done'));
        const pending = tasks.filter(t => !t.toLowerCase().includes('completed') && !t.toLowerCase().includes('done'));

        if (completed.length > 0) {
            parts.push('## Completed Tasks:');
            for (const task of [...new Set(completed)].slice(0, 5)) {
                parts.push(`- ${task}`);
            }
            parts.push('');
        }

        if (pending.length > 0) {
            parts.push('## Pending/In-Progress:');
            for (const task of [...new Set(pending)].slice(0, 5)) {
                parts.push(`- ${task}`);
            }
            parts.push('');
        }

        if (codeChanges.length > 0) {
            parts.push('## Recent Code Changes:');
            for (const change of [...new Set(codeChanges)].slice(0, 5)) {
                parts.push(`- ${change}`);
            }
            parts.push('');
        }

        // Add recent conversation summaries
        if (sessions.length > 0) {
            parts.push('## Recent Conversation Summaries:');
            for (const session of sessions.slice(0, 3)) {
                if (session.summary) {
                    parts.push(`\n### ${session.title}`);
                    parts.push(session.summary);
                }
            }
        }

        parts.push('\n[END OF RESTORED CONTEXT]\n');
        parts.push('Please continue assisting with this project, taking the above context into account.\n');

        return parts.join('\n');
    }
}

// Export singleton getter
let _instance: ProjectContextManager | null = null;

export function getProjectContextManager(): ProjectContextManager {
    if (!_instance) {
        _instance = new ProjectContextManager();
    }
    return _instance;
}

export async function createProjectContextManager(): Promise<ProjectContextManager | null> {
    const manager = new ProjectContextManager();
    const initialized = await manager.initialize();
    if (initialized) {
        return manager;
    }
    return null;
}
