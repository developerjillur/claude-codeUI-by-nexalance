import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const exec = util.promisify(cp.exec);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const unlink = util.promisify(fs.unlink);
const copyFile = util.promisify(fs.copyFile);
const access = util.promisify(fs.access);

/**
 * Enhanced Checkpoint Manager for Claude Code Chat
 *
 * Stores backups in .claude/checkpoints folder (like Cursor)
 * Provides robust file tracking for large projects (1000+ files)
 * Supports WordPress plugin development with thousands of files
 */

export interface CheckpointMetadata {
    id: string;
    timestamp: string;
    message: string;
    conversationId?: string;
    messageIndex?: number;
    files: FileSnapshot[];
    mediaFiles: MediaFileReference[];  // Media files - only names stored, not content
    deletedFiles: string[];
    type: 'full' | 'incremental' | 'auto-backup';  // auto-backup for restore backups
    parentCheckpointId?: string;
    isRestoreBackup?: boolean;  // True if this was created before a restore operation
    restoredFromCheckpointId?: string;  // The checkpoint ID that was restored from
}

export interface FileSnapshot {
    relativePath: string;
    hash: string;
    size: number;
    backupPath: string;
}

export interface MediaFileReference {
    relativePath: string;
    size: number;
    extension: string;
    // Media files are NOT backed up - only their names are stored
}

export interface CheckpointIndex {
    version: number;
    checkpoints: CheckpointMetadata[];
    lastUpdated: string;
    workspacePath: string;
    lastRestoreBackupId?: string;  // ID of the most recent auto-backup created before restore
}

export interface RestoreOptions {
    confirmBeforeRestore?: boolean;
    createBackupBeforeRestore?: boolean;
    preserveUntracked?: boolean;
}

export interface FileChange {
    path: string;
    type: 'added' | 'modified' | 'deleted';
    hash?: string;
}

export interface RestorePreview {
    checkpoint: CheckpointMetadata;
    filesToRestore: string[];
    filesToDelete: string[];
    currentChanges: FileChange[];
    totalChanges: number;
}

// Cache entry for file hash with modification time
interface FileHashCacheEntry {
    hash: string;
    mtime: number;  // File modification time in milliseconds
    size: number;   // File size for additional validation
}

export class CheckpointManager {
    private _checkpointsDir: string | undefined;
    private _backupsDir: string | undefined;
    private _indexPath: string | undefined;
    private _workspacePath: string | undefined;
    private _checkpointIndex: CheckpointIndex | undefined;
    private _isInitialized: boolean = false;
    private _currentFileHashes: Map<string, string> = new Map();
    private _maxCheckpoints: number = 100;

    // File hash cache - stores hash with mtime to avoid rehashing unchanged files
    private _fileHashCache: Map<string, FileHashCacheEntry> = new Map();
    private _hashCachePath: string | undefined;
    private _cacheHits: number = 0;
    private _cacheMisses: number = 0;

    // Media file extensions - these will be tracked but NOT backed up (only names stored)
    private _mediaExtensions: string[] = [
        // Images
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif',
        '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.orf', '.sr2', '.heic', '.heif',
        // Videos
        '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.mpeg', '.mpg',
        '.3gp', '.3g2', '.ogv', '.vob', '.mts', '.m2ts', '.ts',
        // Audio
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.aiff', '.ape',
        '.opus', '.mid', '.midi',
        // Other binary media
        '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
        '.exe', '.dll', '.so', '.dylib',
        '.ttf', '.otf', '.woff', '.woff2', '.eot'
    ];

    // Protected directories - files in these directories should NEVER be deleted during restore
    // These typically contain user uploads, media, and irreplaceable assets
    private _protectedDirectories: string[] = [
        'uploads',
        'wp-content/uploads',
        'media',
        'images',
        'assets/images',
        'assets/media',
        'public/uploads',
        'public/images',
        'public/media',
        'storage/app/public',
        'static/images',
        'static/media',
        'content/uploads',
        'files',
        'attachments'
    ];

    // Exclude patterns for files/folders that should not be tracked
    private _excludePatterns: string[] = [
        'node_modules',
        '.git',
        '.claude/checkpoints',
        '.vscode',
        'vendor',
        'wp-content/uploads',
        'wp-content/cache',
        'wp-content/upgrade',
        'wp-content/wflogs',
        '.DS_Store',
        'Thumbs.db',
        '*.log',
        '*.tmp',
        '*.swp',
        '*.swo',
        '.env',
        '.env.local',
        'dist',
        'build',
        '.next',
        '__pycache__',
        '*.pyc',
        '.sass-cache',
        '.idea',
        '*.vsix'
    ];

    constructor(private readonly _context: vscode.ExtensionContext) {}

    /**
     * Initialize the checkpoint system - stores in .claude/checkpoints
     */
    public async initialize(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.log('CheckpointManager: No workspace folder available');
                return false;
            }

            this._workspacePath = workspaceFolder.uri.fsPath;

            // Store checkpoints in .claude/checkpoints (like Cursor)
            this._checkpointsDir = path.join(this._workspacePath, '.claude', 'checkpoints');
            this._backupsDir = path.join(this._checkpointsDir, 'backups');
            this._indexPath = path.join(this._checkpointsDir, 'index.json');
            this._hashCachePath = path.join(this._checkpointsDir, 'hash-cache.json');

            // Ensure directories exist
            await this._ensureDirectoryExists(this._checkpointsDir);
            await this._ensureDirectoryExists(this._backupsDir);

            // Load or create checkpoint index
            await this._loadCheckpointIndex();

            // Load hash cache from disk (persists across sessions)
            await this._loadHashCache();

            // Build initial file hash map (uses cache for unchanged files)
            const startTime = Date.now();
            await this._scanAllFiles();
            const scanTime = Date.now() - startTime;

            this._isInitialized = true;
            console.log('CheckpointManager: Initialized successfully');
            console.log(`CheckpointManager: Workspace path: ${this._workspacePath}`);
            console.log(`CheckpointManager: Checkpoints dir: ${this._checkpointsDir}`);
            console.log(`CheckpointManager: Tracking ${this._currentFileHashes.size} files`);
            console.log(`CheckpointManager: Scan time: ${scanTime}ms (cache hits: ${this._cacheHits}, misses: ${this._cacheMisses})`);

            return true;
        } catch (error: any) {
            console.error('CheckpointManager: Initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Create a new checkpoint - backs up code files, stores media file names only
     * @param isRestoreBackup - If true, marks this checkpoint as an auto-backup before restore
     * @param restoredFromCheckpointId - The checkpoint ID being restored from (if isRestoreBackup)
     */
    public async createCheckpoint(
        userMessage: string,
        conversationId?: string,
        messageIndex?: number,
        isRestoreBackup: boolean = false,
        restoredFromCheckpointId?: string
    ): Promise<CheckpointMetadata | null> {
        if (!this._isInitialized || !this._workspacePath || !this._checkpointsDir || !this._backupsDir) {
            console.error('CheckpointManager: Not initialized');
            return null;
        }

        try {
            const now = new Date();
            const timestamp = now.toISOString();
            const checkpointId = `chk_${now.getTime()}_${crypto.randomBytes(4).toString('hex')}`;

            // Create checkpoint backup directory
            const checkpointBackupDir = path.join(this._backupsDir, checkpointId);
            await this._ensureDirectoryExists(checkpointBackupDir);

            // Scan current files to detect all changes
            const currentFiles = await this._scanAllFiles();

            // Get previous checkpoint for comparison
            const previousCheckpoint = this._checkpointIndex?.checkpoints.length
                ? this._checkpointIndex.checkpoints[this._checkpointIndex.checkpoints.length - 1]
                : null;

            const previousFileMap = new Map<string, FileSnapshot>();
            const previousMediaMap = new Map<string, MediaFileReference>();
            if (previousCheckpoint) {
                for (const file of previousCheckpoint.files) {
                    previousFileMap.set(file.relativePath, file);
                }
                for (const media of (previousCheckpoint.mediaFiles || [])) {
                    previousMediaMap.set(media.relativePath, media);
                }
            }

            // Separate code files and media files
            const changedCodeFiles: FileSnapshot[] = [];
            const mediaFiles: MediaFileReference[] = [];
            const deletedFiles: string[] = [];

            // Check for new or modified files
            for (const [relativePath, hash] of currentFiles) {
                const fullPath = path.join(this._workspacePath, relativePath);

                // Check if this is a media file
                if (this._isMediaFile(relativePath)) {
                    // Media files - only store name, don't backup content
                    try {
                        const fileStat = await stat(fullPath);
                        const ext = path.extname(relativePath).toLowerCase();
                        mediaFiles.push({
                            relativePath,
                            size: fileStat.size,
                            extension: ext
                        });
                    } catch (err: any) {
                        // Skip if can't stat
                    }
                    continue;
                }

                // Code file - check if changed and backup
                const prevFile = previousFileMap.get(relativePath);
                if (!prevFile || prevFile.hash !== hash) {
                    // File is new or modified - back it up
                    const backupPath = path.join(checkpointBackupDir, relativePath);

                    try {
                        // Ensure backup directory exists
                        await this._ensureDirectoryExists(path.dirname(backupPath));

                        // Copy file to backup
                        await copyFile(fullPath, backupPath);

                        const fileStat = await stat(fullPath);

                        changedCodeFiles.push({
                            relativePath,
                            hash,
                            size: fileStat.size,
                            backupPath
                        });
                    } catch (err: any) {
                        console.error(`CheckpointManager: Failed to backup ${relativePath}:`, err.message);
                    }
                }
            }

            // Check for deleted files (files in previous checkpoint but not in current)
            if (previousCheckpoint) {
                for (const file of previousCheckpoint.files) {
                    if (!currentFiles.has(file.relativePath)) {
                        deletedFiles.push(file.relativePath);
                    }
                }
            }

            // Build final code files list
            let allCodeFiles: FileSnapshot[] = [];
            if (!previousCheckpoint) {
                // First checkpoint - back up all code files
                for (const [relativePath, hash] of currentFiles) {
                    // Skip media files
                    if (this._isMediaFile(relativePath)) {
                        continue;
                    }

                    const fullPath = path.join(this._workspacePath, relativePath);
                    const backupPath = path.join(checkpointBackupDir, relativePath);

                    try {
                        await this._ensureDirectoryExists(path.dirname(backupPath));
                        await copyFile(fullPath, backupPath);

                        const fileStat = await stat(fullPath);

                        allCodeFiles.push({
                            relativePath,
                            hash,
                            size: fileStat.size,
                            backupPath
                        });
                    } catch (err: any) {
                        console.error(`CheckpointManager: Failed to backup ${relativePath}:`, err.message);
                    }
                }
            } else {
                // For incremental checkpoint, combine previous files with changes
                allCodeFiles = previousCheckpoint.files.filter(f =>
                    !deletedFiles.includes(f.relativePath) &&
                    !changedCodeFiles.find(c => c.relativePath === f.relativePath) &&
                    !this._isMediaFile(f.relativePath)  // Exclude any media files from previous
                );
                allCodeFiles = [...allCodeFiles, ...changedCodeFiles];
            }

            // Create checkpoint message
            const truncatedMessage = userMessage.substring(0, 100);
            const checkpointMessage = isRestoreBackup
                ? `Auto-backup: ${truncatedMessage}${userMessage.length > 100 ? '...' : ''}`
                : `Checkpoint: ${truncatedMessage}${userMessage.length > 100 ? '...' : ''}`;

            // Create checkpoint metadata
            const checkpoint: CheckpointMetadata = {
                id: checkpointId,
                timestamp,
                message: checkpointMessage,
                conversationId,
                messageIndex,
                files: allCodeFiles,
                mediaFiles: mediaFiles,
                deletedFiles,
                type: isRestoreBackup ? 'auto-backup' : (previousCheckpoint ? 'incremental' : 'full'),
                parentCheckpointId: previousCheckpoint?.id,
                isRestoreBackup,
                restoredFromCheckpointId
            };

            // Add to index
            if (!this._checkpointIndex) {
                this._checkpointIndex = {
                    version: 1,
                    checkpoints: [],
                    lastUpdated: timestamp,
                    workspacePath: this._workspacePath
                };
            }

            this._checkpointIndex.checkpoints.push(checkpoint);
            this._checkpointIndex.lastUpdated = timestamp;

            // If this is a restore backup, track it for "Restore From Backup" feature
            if (isRestoreBackup) {
                this._checkpointIndex.lastRestoreBackupId = checkpointId;
            }

            // Save index
            await this._saveCheckpointIndex();

            // Cleanup old checkpoints
            await this._cleanupOldCheckpoints();

            console.log(`CheckpointManager: Created checkpoint ${checkpointId}${isRestoreBackup ? ' (auto-backup)' : ''}`);
            console.log(`CheckpointManager: ${changedCodeFiles.length} code files changed, ${deletedFiles.length} files deleted`);
            console.log(`CheckpointManager: Total ${allCodeFiles.length} code files, ${mediaFiles.length} media files tracked`);

            return checkpoint;
        } catch (error: any) {
            console.error('CheckpointManager: Failed to create checkpoint:', error.message);
            return null;
        }
    }

    /**
     * Preview what will happen when restoring to a checkpoint
     */
    public async previewRestore(checkpointId: string): Promise<RestorePreview | null> {
        if (!this._isInitialized || !this._workspacePath || !this._checkpointIndex) {
            return null;
        }

        try {
            // Find checkpoint
            const checkpoint = this._checkpointIndex.checkpoints.find(
                c => c.id === checkpointId || c.id.startsWith(checkpointId)
            );

            if (!checkpoint) {
                console.error('CheckpointManager: Checkpoint not found:', checkpointId);
                return null;
            }

            // Scan current files
            const currentFiles = await this._scanAllFiles();

            // Build checkpoint file map
            const checkpointFileMap = new Map<string, FileSnapshot>();
            for (const file of checkpoint.files) {
                checkpointFileMap.set(file.relativePath, file);
            }

            const filesToRestore: string[] = [];
            const filesToDelete: string[] = [];
            const currentChanges: FileChange[] = [];

            // Find files that will be restored (modified or deleted since checkpoint)
            for (const file of checkpoint.files) {
                const currentHash = currentFiles.get(file.relativePath);

                if (!currentHash) {
                    // File was deleted since checkpoint - will be restored
                    filesToRestore.push(file.relativePath);
                    currentChanges.push({
                        path: file.relativePath,
                        type: 'deleted',
                        hash: file.hash
                    });
                } else if (currentHash !== file.hash) {
                    // File was modified since checkpoint - will be reverted
                    filesToRestore.push(file.relativePath);
                    currentChanges.push({
                        path: file.relativePath,
                        type: 'modified',
                        hash: currentHash
                    });
                }
            }

            // Find files that will be deleted (added after checkpoint)
            // CRITICAL: Media files and files in protected directories are NEVER deleted
            const checkpointMediaSet = new Set((checkpoint.mediaFiles || []).map(f => f.relativePath));

            for (const [relativePath] of currentFiles) {
                if (!checkpointFileMap.has(relativePath)) {
                    // Skip media files - they are preserved during restore
                    if (this._isMediaFile(relativePath) || checkpointMediaSet.has(relativePath)) {
                        continue;
                    }

                    // Skip files in protected directories
                    if (this._isInProtectedDirectory(relativePath)) {
                        continue;
                    }

                    filesToDelete.push(relativePath);
                    currentChanges.push({
                        path: relativePath,
                        type: 'added'
                    });
                }
            }

            const totalChanges = filesToRestore.length + filesToDelete.length;

            console.log(`CheckpointManager: Preview - ${filesToRestore.length} to restore, ${filesToDelete.length} code files to delete (media files preserved)`);

            return {
                checkpoint,
                filesToRestore,
                filesToDelete,
                currentChanges,
                totalChanges
            };
        } catch (error: any) {
            console.error('CheckpointManager: Preview failed:', error.message);
            return null;
        }
    }

    /**
     * Restore to a specific checkpoint
     */
    public async restoreToCheckpoint(
        checkpointId: string,
        options: RestoreOptions = {}
    ): Promise<{ success: boolean; message: string; restoredFiles?: string[]; backupCheckpointId?: string }> {
        if (!this._isInitialized || !this._workspacePath || !this._checkpointIndex || !this._backupsDir) {
            return { success: false, message: 'Checkpoint system not initialized' };
        }

        try {
            // Find checkpoint
            const checkpoint = this._checkpointIndex.checkpoints.find(
                c => c.id === checkpointId || c.id.startsWith(checkpointId)
            );

            if (!checkpoint) {
                return { success: false, message: 'Checkpoint not found' };
            }

            let backupCheckpointId: string | undefined;

            // Create backup before restore if requested
            if (options.createBackupBeforeRestore) {
                const backupCheckpoint = await this.createCheckpoint(
                    `Auto-backup before restoring to: ${checkpoint.message}`,
                    checkpoint.conversationId,
                    checkpoint.messageIndex,
                    true,  // isRestoreBackup = true
                    checkpointId  // restoredFromCheckpointId
                );
                if (backupCheckpoint) {
                    backupCheckpointId = backupCheckpoint.id;
                    console.log(`CheckpointManager: Created backup checkpoint ${backupCheckpointId}`);
                }
            }

            const restoredFiles: string[] = [];
            const errors: string[] = [];

            // Restore files from checkpoint backup
            for (const file of checkpoint.files) {
                try {
                    const targetPath = path.join(this._workspacePath, file.relativePath);

                    // Ensure target directory exists
                    await this._ensureDirectoryExists(path.dirname(targetPath));

                    // Check if backup file exists
                    if (await this._fileExists(file.backupPath)) {
                        await copyFile(file.backupPath, targetPath);
                        restoredFiles.push(file.relativePath);
                    } else {
                        // Try to find file in parent checkpoint backups
                        const foundBackup = await this._findFileInBackups(file.relativePath, file.hash);
                        if (foundBackup) {
                            await copyFile(foundBackup, targetPath);
                            restoredFiles.push(file.relativePath);
                        } else {
                            errors.push(`Backup not found for: ${file.relativePath}`);
                        }
                    }
                } catch (err: any) {
                    errors.push(`Failed to restore ${file.relativePath}: ${err.message}`);
                }
            }

            // Delete files that were added after checkpoint
            // CRITICAL: Preserve media files and only delete CODE files that didn't exist at checkpoint time
            if (!options.preserveUntracked) {
                const currentFiles = await this._scanAllFiles();

                // Build set of ALL files that should be preserved:
                // 1. Code files from checkpoint
                const checkpointFileSet = new Set(checkpoint.files.map(f => f.relativePath));

                // 2. Media files from checkpoint (these are NOT backed up, just tracked by name)
                const checkpointMediaSet = new Set((checkpoint.mediaFiles || []).map(f => f.relativePath));

                // 3. Current media files should NEVER be deleted (they can't be restored!)
                // This is a safety measure - media files are precious and irreplaceable
                // 4. Files in protected directories should also NEVER be deleted

                let deletedCount = 0;
                let skippedMediaCount = 0;
                let skippedProtectedCount = 0;

                for (const [relativePath] of currentFiles) {
                    // Skip if file was in checkpoint (code files)
                    if (checkpointFileSet.has(relativePath)) {
                        continue;
                    }

                    // Skip if file was a media file in checkpoint
                    if (checkpointMediaSet.has(relativePath)) {
                        continue;
                    }

                    // CRITICAL: Skip ALL media files - they cannot be restored!
                    // Never delete media files during restore - they are irreplaceable
                    if (this._isMediaFile(relativePath)) {
                        skippedMediaCount++;
                        console.log(`CheckpointManager: PRESERVED media file (not deletable): ${relativePath}`);
                        continue;
                    }

                    // CRITICAL: Skip files in protected directories (uploads, images, media folders)
                    // These directories contain user-generated content that cannot be recovered
                    if (this._isInProtectedDirectory(relativePath)) {
                        skippedProtectedCount++;
                        console.log(`CheckpointManager: PRESERVED file in protected directory: ${relativePath}`);
                        continue;
                    }

                    // Only delete non-media files that were added after checkpoint
                    try {
                        const filePath = path.join(this._workspacePath, relativePath);
                        await unlink(filePath);
                        deletedCount++;
                        console.log(`CheckpointManager: Deleted added code file: ${relativePath}`);
                    } catch (err: any) {
                        // File might already be deleted
                    }
                }

                if (skippedMediaCount > 0) {
                    console.log(`CheckpointManager: Protected ${skippedMediaCount} media files from deletion`);
                }
                if (skippedProtectedCount > 0) {
                    console.log(`CheckpointManager: Protected ${skippedProtectedCount} files in protected directories from deletion`);
                }
                console.log(`CheckpointManager: Deleted ${deletedCount} code files added after checkpoint`);
            }

            // Update current file hashes
            await this._scanAllFiles();

            // Remove checkpoints after the restored one
            const checkpointIndex = this._checkpointIndex.checkpoints.findIndex(c => c.id === checkpoint.id);
            if (checkpointIndex !== -1 && !options.createBackupBeforeRestore) {
                this._checkpointIndex.checkpoints = this._checkpointIndex.checkpoints.slice(0, checkpointIndex + 1);
                await this._saveCheckpointIndex();
            }

            const message = errors.length > 0
                ? `Restored ${restoredFiles.length} files with ${errors.length} errors`
                : `Successfully restored ${restoredFiles.length} files`;

            console.log(`CheckpointManager: ${message}`);
            if (errors.length > 0) {
                console.error('CheckpointManager: Errors:', errors);
            }

            return {
                success: true,
                message,
                restoredFiles,
                backupCheckpointId
            };
        } catch (error: any) {
            console.error('CheckpointManager: Restore failed:', error.message);
            return { success: false, message: `Restore failed: ${error.message}` };
        }
    }

    /**
     * Get all checkpoints
     */
    public getCheckpoints(): CheckpointMetadata[] {
        return this._checkpointIndex?.checkpoints || [];
    }

    /**
     * Get checkpoint by ID
     */
    public getCheckpoint(idOrPartialId: string): CheckpointMetadata | undefined {
        return this._checkpointIndex?.checkpoints.find(
            c => c.id === idOrPartialId || c.id.startsWith(idOrPartialId)
        );
    }

    /**
     * Get statistics
     */
    public getStats(): {
        totalCheckpoints: number;
        trackedFiles: number;
        oldestCheckpoint?: string;
        newestCheckpoint?: string;
    } {
        const checkpoints = this._checkpointIndex?.checkpoints || [];

        return {
            totalCheckpoints: checkpoints.length,
            trackedFiles: this._currentFileHashes.size,
            oldestCheckpoint: checkpoints.length > 0 ? checkpoints[0].timestamp : undefined,
            newestCheckpoint: checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].timestamp : undefined
        };
    }

    /**
     * Check if initialized
     */
    public isInitialized(): boolean {
        return this._isInitialized;
    }

    /**
     * Get the last restore backup checkpoint (for "Restore From Backup" feature)
     * Returns the backup that was created before the most recent restore operation
     */
    public getLastRestoreBackup(): CheckpointMetadata | null {
        if (!this._checkpointIndex?.lastRestoreBackupId) {
            return null;
        }

        const backup = this._checkpointIndex.checkpoints.find(
            c => c.id === this._checkpointIndex?.lastRestoreBackupId
        );

        return backup || null;
    }

    /**
     * Check if there is a restore backup available
     */
    public hasRestoreBackup(): boolean {
        return this.getLastRestoreBackup() !== null;
    }

    /**
     * Restore from the last backup (undo restore operation)
     * This restores to the backup that was created before the last "Restore (Keep Backup)" operation
     */
    public async restoreFromBackup(): Promise<{ success: boolean; message: string; restoredFiles?: string[] }> {
        const backup = this.getLastRestoreBackup();

        if (!backup) {
            return {
                success: false,
                message: 'No restore backup available. Use "Restore (Keep Backup)" first to create a backup.'
            };
        }

        console.log(`CheckpointManager: Restoring from backup ${backup.id}`);

        // Restore to the backup checkpoint WITHOUT creating another backup
        const result = await this.restoreToCheckpoint(backup.id, {
            createBackupBeforeRestore: false,
            preserveUntracked: false
        });

        if (result.success) {
            // Clear the lastRestoreBackupId since we've used it
            if (this._checkpointIndex) {
                this._checkpointIndex.lastRestoreBackupId = undefined;
                await this._saveCheckpointIndex();
            }
        }

        return result;
    }

    /**
     * Clear all checkpoints
     */
    public async clearAllCheckpoints(): Promise<boolean> {
        try {
            if (this._checkpointsDir && this._backupsDir) {
                // Remove all backup directories
                await this._removeDirectory(this._backupsDir);
                await this._ensureDirectoryExists(this._backupsDir);
            }

            if (this._checkpointIndex) {
                this._checkpointIndex.checkpoints = [];
                this._checkpointIndex.lastRestoreBackupId = undefined;
                this._checkpointIndex.lastUpdated = new Date().toISOString();
                await this._saveCheckpointIndex();
            }

            return true;
        } catch (error: any) {
            console.error('CheckpointManager: Failed to clear checkpoints:', error.message);
            return false;
        }
    }

    // ==================== Private Methods ====================

    private async _ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await access(dirPath, fs.constants.F_OK);
        } catch {
            await mkdir(dirPath, { recursive: true });
        }
    }

    private async _fileExists(filePath: string): Promise<boolean> {
        try {
            await access(filePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    private async _loadCheckpointIndex(): Promise<void> {
        if (!this._indexPath || !this._workspacePath) return;

        try {
            const content = await readFile(this._indexPath, 'utf-8');
            this._checkpointIndex = JSON.parse(content);
        } catch {
            // Create new index
            this._checkpointIndex = {
                version: 1,
                checkpoints: [],
                lastUpdated: new Date().toISOString(),
                workspacePath: this._workspacePath
            };
        }
    }

    private async _saveCheckpointIndex(): Promise<void> {
        if (!this._indexPath || !this._checkpointIndex) return;

        const content = JSON.stringify(this._checkpointIndex, null, 2);
        await writeFile(this._indexPath, content, 'utf-8');
    }

    private async _scanAllFiles(): Promise<Map<string, string>> {
        if (!this._workspacePath) return new Map();

        this._currentFileHashes.clear();
        this._cacheHits = 0;
        this._cacheMisses = 0;

        await this._scanDirectory(this._workspacePath, '');

        // Save updated cache to disk after scan
        await this._saveHashCache();

        return this._currentFileHashes;
    }

    private async _scanDirectory(dirPath: string, relativePath: string): Promise<void> {
        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

                // Check if should exclude
                if (this._shouldExclude(entryRelativePath, entry.isDirectory())) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await this._scanDirectory(fullPath, entryRelativePath);
                } else if (entry.isFile()) {
                    try {
                        const hash = await this._hashFileWithCache(fullPath, entryRelativePath);
                        this._currentFileHashes.set(entryRelativePath, hash);
                    } catch (err) {
                        // Skip files that can't be read
                    }
                }
            }
        } catch (err: any) {
            console.error(`CheckpointManager: Failed to scan directory ${dirPath}:`, err.message);
        }
    }

    /**
     * Hash a file using cache when possible (checks mtime and size)
     * This dramatically speeds up scanning for large projects
     */
    private async _hashFileWithCache(fullPath: string, relativePath: string): Promise<string> {
        try {
            const fileStat = await stat(fullPath);
            const mtime = fileStat.mtimeMs;
            const size = fileStat.size;

            // Check if we have a cached hash for this file
            const cached = this._fileHashCache.get(relativePath);
            if (cached && cached.mtime === mtime && cached.size === size) {
                // File hasn't changed, use cached hash
                this._cacheHits++;
                return cached.hash;
            }

            // File is new or changed, compute hash
            this._cacheMisses++;
            const hash = await this._hashFile(fullPath);

            // Update cache
            this._fileHashCache.set(relativePath, { hash, mtime, size });

            return hash;
        } catch (err) {
            // Fallback to direct hash if stat fails
            this._cacheMisses++;
            return this._hashFile(fullPath);
        }
    }

    /**
     * Load hash cache from disk
     */
    private async _loadHashCache(): Promise<void> {
        if (!this._hashCachePath) return;

        try {
            const content = await readFile(this._hashCachePath, 'utf-8');
            const cacheData = JSON.parse(content);

            // Convert array back to Map
            if (Array.isArray(cacheData.entries)) {
                this._fileHashCache = new Map(cacheData.entries);
                console.log(`CheckpointManager: Loaded ${this._fileHashCache.size} cached file hashes`);
            }
        } catch (err) {
            // Cache doesn't exist or is invalid, start fresh
            this._fileHashCache = new Map();
            console.log('CheckpointManager: Starting with empty hash cache');
        }
    }

    /**
     * Save hash cache to disk
     */
    private async _saveHashCache(): Promise<void> {
        if (!this._hashCachePath) return;

        try {
            const cacheData = {
                version: 1,
                lastUpdated: new Date().toISOString(),
                entries: Array.from(this._fileHashCache.entries())
            };
            await writeFile(this._hashCachePath, JSON.stringify(cacheData), 'utf-8');
        } catch (err: any) {
            console.error('CheckpointManager: Failed to save hash cache:', err.message);
        }
    }

    private _shouldExclude(relativePath: string, isDirectory: boolean): boolean {
        const normalizedPath = relativePath.replace(/\\/g, '/');

        for (const pattern of this._excludePatterns) {
            // Exact match
            if (normalizedPath === pattern || normalizedPath.endsWith('/' + pattern)) {
                return true;
            }

            // Directory match
            if (isDirectory && (normalizedPath === pattern || normalizedPath.startsWith(pattern + '/'))) {
                return true;
            }

            // Path contains pattern
            if (normalizedPath.includes('/' + pattern + '/') || normalizedPath.startsWith(pattern + '/')) {
                return true;
            }

            // Glob pattern (*.ext)
            if (pattern.startsWith('*')) {
                const extension = pattern.substring(1);
                if (normalizedPath.endsWith(extension)) {
                    return true;
                }
            }
        }

        return false;
    }

    private async _hashFile(filePath: string): Promise<string> {
        const content = await readFile(filePath);
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    /**
     * Check if a file is a media file (should not be backed up, only name stored)
     */
    private _isMediaFile(relativePath: string): boolean {
        const ext = path.extname(relativePath).toLowerCase();
        return this._mediaExtensions.includes(ext);
    }

    /**
     * Check if a file is in a protected directory (should NEVER be deleted)
     * Protected directories contain user uploads, media, and irreplaceable assets
     */
    private _isInProtectedDirectory(relativePath: string): boolean {
        const normalizedPath = relativePath.toLowerCase().replace(/\\/g, '/');
        return this._protectedDirectories.some(dir => {
            const normalizedDir = dir.toLowerCase();
            return normalizedPath.startsWith(normalizedDir + '/') || normalizedPath.includes('/' + normalizedDir + '/');
        });
    }

    private async _findFileInBackups(relativePath: string, hash: string): Promise<string | null> {
        if (!this._checkpointIndex || !this._backupsDir) return null;

        // Search through checkpoints from newest to oldest
        for (let i = this._checkpointIndex.checkpoints.length - 1; i >= 0; i--) {
            const checkpoint = this._checkpointIndex.checkpoints[i];
            const file = checkpoint.files.find(f => f.relativePath === relativePath && f.hash === hash);

            if (file && await this._fileExists(file.backupPath)) {
                return file.backupPath;
            }
        }

        return null;
    }

    private async _cleanupOldCheckpoints(): Promise<void> {
        if (!this._checkpointIndex || !this._backupsDir) return;

        if (this._checkpointIndex.checkpoints.length <= this._maxCheckpoints) {
            return;
        }

        // Remove oldest checkpoints
        const toRemove = this._checkpointIndex.checkpoints.length - this._maxCheckpoints;
        const removedCheckpoints = this._checkpointIndex.checkpoints.splice(0, toRemove);

        // Delete backup directories for removed checkpoints
        for (const checkpoint of removedCheckpoints) {
            const backupDir = path.join(this._backupsDir, checkpoint.id);
            await this._removeDirectory(backupDir);
        }

        await this._saveCheckpointIndex();
    }

    private async _removeDirectory(dirPath: string): Promise<void> {
        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await this._removeDirectory(fullPath);
                } else {
                    await unlink(fullPath);
                }
            }

            await fs.promises.rmdir(dirPath);
        } catch {
            // Directory might not exist
        }
    }
}
