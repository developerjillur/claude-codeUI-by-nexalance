import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';

const { readFile, writeFile, mkdir, stat } = fs;

/**
 * Self-Verification Engine for Claude Code Chat
 *
 * Inspired by Cursor's Shadow Workspace pattern, this module provides
 * a verification layer that helps catch errors before they reach the user.
 *
 * Key Features:
 * 1. Response Validation - Check AI responses for common issues
 * 2. Code Lint Integration - Verify code snippets using VS Code's diagnostics
 * 3. Consistency Checking - Ensure responses align with project context
 * 4. Self-Correction Suggestions - Propose fixes for detected issues
 * 5. Quality Scoring - Rate response quality for feedback loops
 *
 * Note: This is a "lite" implementation without a full shadow workspace,
 * using VS Code's built-in diagnostics API instead.
 */

// ==================== Types ====================

export interface VerificationResult {
    isValid: boolean;
    confidence: number;  // 0-1
    issues: VerificationIssue[];
    suggestions: string[];
    qualityScore: number;  // 0-100
    metadata: {
        codeBlocksChecked: number;
        diagnosticsFound: number;
        consistencyScore: number;
        completenessScore: number;
    };
}

export interface VerificationIssue {
    type: 'error' | 'warning' | 'suggestion';
    category: 'syntax' | 'type' | 'lint' | 'consistency' | 'completeness' | 'security';
    message: string;
    location?: {
        codeBlock: number;
        line?: number;
        column?: number;
    };
    suggestedFix?: string;
    severity: number;  // 1-10
}

export interface CodeBlock {
    language: string;
    content: string;
    startIndex: number;
    endIndex: number;
}

export interface VerificationContext {
    projectType?: string;
    activeFile?: string;
    recentDecisions?: string[];
    knownPatterns?: string[];
    forbiddenPatterns?: string[];
}

// ==================== Main Class ====================

export class SelfVerificationEngine {
    private _workspacePath: string | undefined;
    private _isInitialized: boolean = false;

    // Verification rules
    private readonly _rules = {
        // Common code smell patterns
        codeSmells: [
            { pattern: /console\.log\(/g, message: 'Contains console.log (may be debug code)', severity: 3 },
            { pattern: /TODO:|FIXME:|HACK:/gi, message: 'Contains TODO/FIXME comments', severity: 2 },
            { pattern: /any\s*[;,)]/g, message: 'Uses TypeScript "any" type', severity: 4 },
            { pattern: /\beval\s*\(/g, message: 'Uses eval() which is a security risk', severity: 9 },
            { pattern: /innerHTML\s*=/g, message: 'Direct innerHTML assignment (XSS risk)', severity: 8 },
            { pattern: /password\s*=\s*['"][^'"]+['"]/gi, message: 'Hardcoded password detected', severity: 10 },
            { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, message: 'Hardcoded API key detected', severity: 10 },
        ],

        // Incomplete code patterns
        incompletePatterns: [
            { pattern: /\.\.\./g, message: 'Contains ellipsis (incomplete code)', severity: 7 },
            { pattern: /\/\/ \.{3}/g, message: 'Contains abbreviated code section', severity: 6 },
            { pattern: /\[insert .+\]/gi, message: 'Contains placeholder text', severity: 8 },
            { pattern: /<your .+>/gi, message: 'Contains user placeholder', severity: 5 },
        ],

        // Response quality patterns
        qualityPatterns: [
            { pattern: /I cannot|I'm unable|I don't have/gi, message: 'Response indicates inability', severity: 5 },
            { pattern: /As an AI|As a language model/gi, message: 'Contains AI self-reference', severity: 3 },
            { pattern: /I apologize|Sorry, but/gi, message: 'Contains unnecessary apology', severity: 2 },
        ],

        // Consistency check keywords per language
        languageConsistency: {
            typescript: ['import', 'export', 'interface', 'type', 'const', 'let'],
            javascript: ['import', 'export', 'const', 'let', 'function', 'class'],
            python: ['import', 'def', 'class', 'from', 'return', 'if __name__'],
            rust: ['fn', 'let', 'mut', 'struct', 'impl', 'use'],
            go: ['func', 'package', 'import', 'type', 'struct', 'interface'],
        }
    };

    constructor() {}

    /**
     * Initialize the verification engine
     */
    public async initialize(workspacePath?: string): Promise<boolean> {
        try {
            this._workspacePath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            this._isInitialized = true;
            console.log('SelfVerificationEngine: Initialized');
            return true;
        } catch (error: any) {
            console.error('SelfVerificationEngine: Initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Check if initialized
     */
    public isInitialized(): boolean {
        return this._isInitialized;
    }

    // ==================== Main Verification Methods ====================

    /**
     * Verify an AI response before presenting to user
     */
    public async verifyResponse(
        response: string,
        context?: VerificationContext
    ): Promise<VerificationResult> {
        const issues: VerificationIssue[] = [];

        // Extract code blocks from response
        const codeBlocks = this._extractCodeBlocks(response);

        // 1. Check code blocks for issues
        for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];
            const blockIssues = await this._verifyCodeBlock(block, i, context);
            issues.push(...blockIssues);
        }

        // 2. Check for incomplete patterns
        const incompleteIssues = this._checkIncompletePatterns(response);
        issues.push(...incompleteIssues);

        // 3. Check response quality
        const qualityIssues = this._checkResponseQuality(response);
        issues.push(...qualityIssues);

        // 4. Check consistency with project context
        if (context) {
            const consistencyIssues = this._checkConsistency(response, codeBlocks, context);
            issues.push(...consistencyIssues);
        }

        // 5. Get diagnostics from VS Code (if possible)
        const diagnosticIssues = await this._getVSCodeDiagnostics(codeBlocks);
        issues.push(...diagnosticIssues);

        // Calculate scores
        const qualityScore = this._calculateQualityScore(response, issues, codeBlocks);
        const consistencyScore = this._calculateConsistencyScore(issues);
        const completenessScore = this._calculateCompletenessScore(response, issues);

        // Generate suggestions
        const suggestions = this._generateSuggestions(issues);

        // Determine overall validity
        const criticalIssues = issues.filter(i => i.type === 'error' && i.severity >= 7);
        const isValid = criticalIssues.length === 0;
        const confidence = this._calculateConfidence(issues, qualityScore);

        return {
            isValid,
            confidence,
            issues,
            suggestions,
            qualityScore,
            metadata: {
                codeBlocksChecked: codeBlocks.length,
                diagnosticsFound: diagnosticIssues.length,
                consistencyScore,
                completenessScore
            }
        };
    }

    /**
     * Verify a specific code snippet
     */
    public async verifyCodeSnippet(
        code: string,
        language: string,
        context?: VerificationContext
    ): Promise<VerificationResult> {
        const block: CodeBlock = {
            language,
            content: code,
            startIndex: 0,
            endIndex: code.length
        };

        const issues = await this._verifyCodeBlock(block, 0, context);

        const qualityScore = Math.max(0, 100 - issues.reduce((sum, i) => sum + i.severity * 5, 0));
        const isValid = !issues.some(i => i.type === 'error' && i.severity >= 7);

        return {
            isValid,
            confidence: isValid ? 0.9 : 0.5,
            issues,
            suggestions: this._generateSuggestions(issues),
            qualityScore,
            metadata: {
                codeBlocksChecked: 1,
                diagnosticsFound: 0,
                consistencyScore: 100,
                completenessScore: issues.some(i => i.category === 'completeness') ? 50 : 100
            }
        };
    }

    /**
     * Quick validation without full verification
     */
    public quickValidate(response: string): { valid: boolean; reason?: string } {
        // Check for critical issues only
        for (const rule of this._rules.codeSmells) {
            if (rule.severity >= 9 && rule.pattern.test(response)) {
                return { valid: false, reason: rule.message };
            }
        }

        for (const rule of this._rules.incompletePatterns) {
            if (rule.severity >= 7 && rule.pattern.test(response)) {
                return { valid: false, reason: rule.message };
            }
        }

        return { valid: true };
    }

    // ==================== Code Block Verification ====================

    /**
     * Extract code blocks from markdown response
     */
    private _extractCodeBlocks(response: string): CodeBlock[] {
        const blocks: CodeBlock[] = [];
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            blocks.push({
                language: match[1] || 'unknown',
                content: match[2],
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }

        return blocks;
    }

    /**
     * Verify a single code block
     */
    private async _verifyCodeBlock(
        block: CodeBlock,
        blockIndex: number,
        context?: VerificationContext
    ): Promise<VerificationIssue[]> {
        const issues: VerificationIssue[] = [];

        // Check code smells
        for (const rule of this._rules.codeSmells) {
            rule.pattern.lastIndex = 0; // Reset regex
            if (rule.pattern.test(block.content)) {
                issues.push({
                    type: rule.severity >= 7 ? 'error' : 'warning',
                    category: rule.severity >= 8 ? 'security' : 'lint',
                    message: rule.message,
                    location: { codeBlock: blockIndex },
                    severity: rule.severity
                });
            }
        }

        // Language-specific checks
        const langIssues = this._checkLanguageSpecific(block, blockIndex);
        issues.push(...langIssues);

        // Syntax validation (basic)
        const syntaxIssues = this._checkBasicSyntax(block, blockIndex);
        issues.push(...syntaxIssues);

        // Check against forbidden patterns
        if (context?.forbiddenPatterns) {
            for (const pattern of context.forbiddenPatterns) {
                if (block.content.includes(pattern)) {
                    issues.push({
                        type: 'error',
                        category: 'consistency',
                        message: `Contains forbidden pattern: ${pattern}`,
                        location: { codeBlock: blockIndex },
                        severity: 8
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Language-specific code checks
     */
    private _checkLanguageSpecific(block: CodeBlock, blockIndex: number): VerificationIssue[] {
        const issues: VerificationIssue[] = [];
        const lang = block.language.toLowerCase();

        switch (lang) {
            case 'typescript':
            case 'ts':
                // Check for common TypeScript issues
                if (/:\s*any\b/.test(block.content)) {
                    issues.push({
                        type: 'warning',
                        category: 'type',
                        message: 'Uses "any" type - consider using a specific type',
                        location: { codeBlock: blockIndex },
                        severity: 4,
                        suggestedFix: 'Replace "any" with a specific type or "unknown"'
                    });
                }

                // Check for missing type annotations on functions
                if (/function\s+\w+\s*\([^)]*\)\s*{/.test(block.content) &&
                    !/function\s+\w+\s*\([^)]*\)\s*:\s*\w+/.test(block.content)) {
                    issues.push({
                        type: 'suggestion',
                        category: 'type',
                        message: 'Function missing return type annotation',
                        location: { codeBlock: blockIndex },
                        severity: 3
                    });
                }
                break;

            case 'javascript':
            case 'js':
                // Check for var usage
                if (/\bvar\s+/.test(block.content)) {
                    issues.push({
                        type: 'suggestion',
                        category: 'lint',
                        message: 'Uses "var" - consider using "const" or "let"',
                        location: { codeBlock: blockIndex },
                        severity: 3,
                        suggestedFix: 'Replace "var" with "const" for immutable values or "let" for mutable'
                    });
                }
                break;

            case 'python':
            case 'py':
                // Check for print statements (might be debug code)
                if (/\bprint\s*\(/.test(block.content)) {
                    issues.push({
                        type: 'suggestion',
                        category: 'lint',
                        message: 'Contains print() - may be debug code',
                        location: { codeBlock: blockIndex },
                        severity: 2
                    });
                }

                // Check for bare except
                if (/except\s*:/.test(block.content)) {
                    issues.push({
                        type: 'warning',
                        category: 'lint',
                        message: 'Bare except clause - consider catching specific exceptions',
                        location: { codeBlock: blockIndex },
                        severity: 5
                    });
                }
                break;

            case 'sql':
                // Check for SQL injection risks
                if (/['"].*\$\{.*\}.*['"]/.test(block.content) ||
                    /['"].*\+.*['"]/.test(block.content)) {
                    issues.push({
                        type: 'error',
                        category: 'security',
                        message: 'Potential SQL injection - use parameterized queries',
                        location: { codeBlock: blockIndex },
                        severity: 9,
                        suggestedFix: 'Use parameterized queries instead of string concatenation'
                    });
                }
                break;
        }

        return issues;
    }

    /**
     * Basic syntax validation
     */
    private _checkBasicSyntax(block: CodeBlock, blockIndex: number): VerificationIssue[] {
        const issues: VerificationIssue[] = [];
        const content = block.content;

        // Check for unbalanced brackets
        const brackets = { '{': 0, '[': 0, '(': 0 };
        const closingMap: Record<string, keyof typeof brackets> = { '}': '{', ']': '[', ')': '(' };

        for (const char of content) {
            if (char in brackets) {
                brackets[char as keyof typeof brackets]++;
            } else if (char in closingMap) {
                brackets[closingMap[char]]--;
            }
        }

        for (const [bracket, count] of Object.entries(brackets)) {
            if (count !== 0) {
                issues.push({
                    type: 'error',
                    category: 'syntax',
                    message: `Unbalanced brackets: ${count > 0 ? 'missing' : 'extra'} closing "${bracket === '{' ? '}' : bracket === '[' ? ']' : ')'}"`,
                    location: { codeBlock: blockIndex },
                    severity: 8
                });
            }
        }

        // Check for unclosed strings (basic)
        const singleQuotes = (content.match(/(?<!\\)'/g) || []).length;
        const doubleQuotes = (content.match(/(?<!\\)"/g) || []).length;
        const backticks = (content.match(/(?<!\\)`/g) || []).length;

        if (singleQuotes % 2 !== 0) {
            issues.push({
                type: 'error',
                category: 'syntax',
                message: 'Unclosed single quote string',
                location: { codeBlock: blockIndex },
                severity: 7
            });
        }

        if (doubleQuotes % 2 !== 0) {
            issues.push({
                type: 'error',
                category: 'syntax',
                message: 'Unclosed double quote string',
                location: { codeBlock: blockIndex },
                severity: 7
            });
        }

        // Backticks can be template literals, so only flag if odd count
        if (backticks % 2 !== 0 && block.language.toLowerCase().includes('script')) {
            issues.push({
                type: 'warning',
                category: 'syntax',
                message: 'Possibly unclosed template literal',
                location: { codeBlock: blockIndex },
                severity: 5
            });
        }

        return issues;
    }

    // ==================== Response Quality Checks ====================

    /**
     * Check for incomplete code patterns
     */
    private _checkIncompletePatterns(response: string): VerificationIssue[] {
        const issues: VerificationIssue[] = [];

        for (const rule of this._rules.incompletePatterns) {
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(response)) {
                issues.push({
                    type: 'warning',
                    category: 'completeness',
                    message: rule.message,
                    severity: rule.severity
                });
            }
        }

        return issues;
    }

    /**
     * Check response quality patterns
     */
    private _checkResponseQuality(response: string): VerificationIssue[] {
        const issues: VerificationIssue[] = [];

        for (const rule of this._rules.qualityPatterns) {
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(response)) {
                issues.push({
                    type: 'suggestion',
                    category: 'completeness',
                    message: rule.message,
                    severity: rule.severity
                });
            }
        }

        // Check response length
        if (response.length < 50 && !response.includes('```')) {
            issues.push({
                type: 'suggestion',
                category: 'completeness',
                message: 'Response seems very short',
                severity: 3
            });
        }

        return issues;
    }

    /**
     * Check consistency with project context
     */
    private _checkConsistency(
        response: string,
        codeBlocks: CodeBlock[],
        context: VerificationContext
    ): VerificationIssue[] {
        const issues: VerificationIssue[] = [];

        // Check if response mentions decisions that contradict known decisions
        if (context.recentDecisions) {
            for (const decision of context.recentDecisions) {
                // Look for contradicting statements
                const decisionKeywords = decision.toLowerCase().split(/\s+/).filter(w => w.length > 4);
                const responseLower = response.toLowerCase();

                const hasContradiction = decisionKeywords.some(kw =>
                    responseLower.includes(`not ${kw}`) ||
                    responseLower.includes(`don't use ${kw}`) ||
                    responseLower.includes(`avoid ${kw}`)
                );

                if (hasContradiction) {
                    issues.push({
                        type: 'warning',
                        category: 'consistency',
                        message: `May contradict previous decision: "${decision.substring(0, 50)}..."`,
                        severity: 5
                    });
                }
            }
        }

        // Check if code follows known patterns
        if (context.knownPatterns && codeBlocks.length > 0) {
            for (const pattern of context.knownPatterns) {
                const patternKeyword = pattern.split(/\s+/)[0];
                const usesPattern = codeBlocks.some(b => b.content.includes(patternKeyword));

                if (!usesPattern && response.toLowerCase().includes(pattern.toLowerCase())) {
                    issues.push({
                        type: 'suggestion',
                        category: 'consistency',
                        message: `Mentions pattern "${pattern}" but code may not follow it`,
                        severity: 3
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Get VS Code diagnostics for code blocks (when possible)
     */
    private async _getVSCodeDiagnostics(codeBlocks: CodeBlock[]): Promise<VerificationIssue[]> {
        const issues: VerificationIssue[] = [];

        // This is a simplified version - in a full implementation,
        // we would create temporary files and use VS Code's language services

        try {
            // Get diagnostics from current active editor
            const editor = vscode.window.activeTextEditor;
            if (!editor) return issues;

            const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

            for (const diagnostic of diagnostics) {
                const severity = diagnostic.severity === vscode.DiagnosticSeverity.Error ? 8
                    : diagnostic.severity === vscode.DiagnosticSeverity.Warning ? 5
                    : 3;

                issues.push({
                    type: diagnostic.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
                    category: 'lint',
                    message: `[VS Code] ${diagnostic.message}`,
                    location: {
                        codeBlock: -1,  // From editor, not code block
                        line: diagnostic.range.start.line,
                        column: diagnostic.range.start.character
                    },
                    severity
                });
            }
        } catch {
            // Diagnostics not available
        }

        return issues;
    }

    // ==================== Scoring and Suggestions ====================

    /**
     * Calculate overall quality score
     */
    private _calculateQualityScore(
        response: string,
        issues: VerificationIssue[],
        codeBlocks: CodeBlock[]
    ): number {
        let score = 100;

        // Deduct for issues
        for (const issue of issues) {
            const deduction = issue.type === 'error' ? issue.severity * 3
                : issue.type === 'warning' ? issue.severity * 1.5
                : issue.severity * 0.5;
            score -= deduction;
        }

        // Bonus for code examples
        if (codeBlocks.length > 0) {
            score += 5;
        }

        // Bonus for reasonable length
        if (response.length >= 100 && response.length <= 5000) {
            score += 5;
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Calculate consistency score
     */
    private _calculateConsistencyScore(issues: VerificationIssue[]): number {
        const consistencyIssues = issues.filter(i => i.category === 'consistency');
        const totalSeverity = consistencyIssues.reduce((sum, i) => sum + i.severity, 0);
        return Math.max(0, 100 - totalSeverity * 5);
    }

    /**
     * Calculate completeness score
     */
    private _calculateCompletenessScore(response: string, issues: VerificationIssue[]): number {
        const completenessIssues = issues.filter(i => i.category === 'completeness');
        const totalSeverity = completenessIssues.reduce((sum, i) => sum + i.severity, 0);

        let score = 100 - totalSeverity * 5;

        // Check for truncation indicators
        if (response.endsWith('...') || response.includes('[truncated]')) {
            score -= 20;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate confidence based on verification
     */
    private _calculateConfidence(issues: VerificationIssue[], qualityScore: number): number {
        // Start with quality score normalized
        let confidence = qualityScore / 100;

        // Reduce confidence based on critical issues
        const criticalIssues = issues.filter(i => i.type === 'error' && i.severity >= 7);
        confidence -= criticalIssues.length * 0.15;

        // Reduce based on total issue count
        confidence -= issues.length * 0.02;

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Generate suggestions for improvement
     */
    private _generateSuggestions(issues: VerificationIssue[]): string[] {
        const suggestions: string[] = [];

        // Group issues by category
        const byCategory = new Map<string, VerificationIssue[]>();
        for (const issue of issues) {
            if (!byCategory.has(issue.category)) {
                byCategory.set(issue.category, []);
            }
            byCategory.get(issue.category)!.push(issue);
        }

        // Generate suggestions per category
        if (byCategory.has('security')) {
            suggestions.push('Review and address security concerns before using this code');
        }

        if (byCategory.has('completeness')) {
            suggestions.push('Some code may be incomplete - verify all sections are fully implemented');
        }

        if (byCategory.has('type')) {
            suggestions.push('Consider adding type annotations for better type safety');
        }

        if (byCategory.has('consistency')) {
            suggestions.push('Check that this aligns with existing project patterns and decisions');
        }

        // Add specific fix suggestions from issues
        for (const issue of issues) {
            if (issue.suggestedFix && issue.severity >= 5) {
                suggestions.push(issue.suggestedFix);
            }
        }

        return [...new Set(suggestions)].slice(0, 5);
    }

    // ==================== Self-Correction Support ====================

    /**
     * Generate a correction prompt based on verification issues
     */
    public generateCorrectionPrompt(
        originalResponse: string,
        verificationResult: VerificationResult
    ): string | null {
        if (verificationResult.isValid || verificationResult.issues.length === 0) {
            return null;
        }

        const criticalIssues = verificationResult.issues.filter(
            i => i.type === 'error' && i.severity >= 6
        );

        if (criticalIssues.length === 0) {
            return null;
        }

        const issueDescriptions = criticalIssues
            .map(i => `- ${i.message}${i.suggestedFix ? ` (Fix: ${i.suggestedFix})` : ''}`)
            .join('\n');

        return `The following issues were detected in the response:

${issueDescriptions}

Please revise the response to address these issues while maintaining the original intent.`;
    }

    /**
     * Validate that a correction addressed the issues
     */
    public async validateCorrection(
        originalResult: VerificationResult,
        correctedResponse: string,
        context?: VerificationContext
    ): Promise<{
        improved: boolean;
        remainingIssues: VerificationIssue[];
        improvementPercent: number;
    }> {
        const newResult = await this.verifyResponse(correctedResponse, context);

        const originalSeverity = originalResult.issues.reduce((sum, i) => sum + i.severity, 0);
        const newSeverity = newResult.issues.reduce((sum, i) => sum + i.severity, 0);

        const improved = newSeverity < originalSeverity;
        const improvementPercent = originalSeverity > 0
            ? Math.round(((originalSeverity - newSeverity) / originalSeverity) * 100)
            : 0;

        return {
            improved,
            remainingIssues: newResult.issues,
            improvementPercent: Math.max(0, improvementPercent)
        };
    }

    /**
     * Dispose
     */
    public dispose(): void {
        this._isInitialized = false;
        console.log('SelfVerificationEngine: Disposed');
    }
}

// ==================== Singleton Export ====================

let _instance: SelfVerificationEngine | null = null;

export function getSelfVerificationEngine(): SelfVerificationEngine {
    if (!_instance) {
        _instance = new SelfVerificationEngine();
    }
    return _instance;
}

export async function createSelfVerificationEngine(
    workspacePath?: string
): Promise<SelfVerificationEngine | null> {
    const engine = new SelfVerificationEngine();
    const initialized = await engine.initialize(workspacePath);
    if (initialized) {
        return engine;
    }
    return null;
}
