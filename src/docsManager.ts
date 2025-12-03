import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

// Types
export interface DocConfig {
    id: string;
    name: string;
    entryUrl: string;
    prefixUrl: string;
    maxPages: number;
    maxDepth: number;
    createdAt: string;
    updatedAt: string;
    status: 'pending' | 'indexing' | 'indexed' | 'failed';
    pageCount: number;
    totalSize: number;
    error?: string;
}

export interface DocPage {
    url: string;
    title: string;
    content: string;
    path: string;
    crawledAt: string;
}

export interface DocsIndex {
    version: string;
    docs: DocConfig[];
    totalPages: number;
    totalSize: number;
    lastUpdated: string;
}

export class DocsManager {
    private workspaceRoot: string;
    private docsDir: string;
    private indexPath: string;
    private onProgressCallback?: (docId: string, current: number, total: number, status: string) => void;
    private crawlAbortControllers: Map<string, boolean> = new Map();

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.docsDir = path.join(workspaceRoot, '.claude', 'docs');
        this.indexPath = path.join(this.docsDir, '_index.json');
    }

    // Initialize the docs directory
    async initialize(): Promise<void> {
        try {
            // Create .claude/docs directory if it doesn't exist
            if (!fs.existsSync(this.docsDir)) {
                fs.mkdirSync(this.docsDir, { recursive: true });
            }

            // Create index file if it doesn't exist
            if (!fs.existsSync(this.indexPath)) {
                const initialIndex: DocsIndex = {
                    version: '1.0',
                    docs: [],
                    totalPages: 0,
                    totalSize: 0,
                    lastUpdated: new Date().toISOString()
                };
                fs.writeFileSync(this.indexPath, JSON.stringify(initialIndex, null, 2));
            }
        } catch (error) {
            console.error('Failed to initialize docs directory:', error);
        }
    }

    // Set progress callback
    setProgressCallback(callback: (docId: string, current: number, total: number, status: string) => void) {
        this.onProgressCallback = callback;
    }

    // Get all docs
    async getDocs(): Promise<DocConfig[]> {
        try {
            await this.initialize();
            const index = this.getIndex();
            return index.docs;
        } catch (error) {
            console.error('Failed to get docs:', error);
            return [];
        }
    }

    // Get index
    private getIndex(): DocsIndex {
        try {
            if (fs.existsSync(this.indexPath)) {
                const content = fs.readFileSync(this.indexPath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.error('Failed to read index:', error);
        }
        return {
            version: '1.0',
            docs: [],
            totalPages: 0,
            totalSize: 0,
            lastUpdated: new Date().toISOString()
        };
    }

    // Save index
    private saveIndex(index: DocsIndex): void {
        try {
            index.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
        } catch (error) {
            console.error('Failed to save index:', error);
        }
    }

    // Add new documentation
    async addDoc(name: string, entryUrl: string, prefixUrl?: string, maxPages: number = 50, maxDepth: number = 3): Promise<DocConfig> {
        await this.initialize();

        const id = this.generateId(name);
        const config: DocConfig = {
            id,
            name,
            entryUrl,
            prefixUrl: prefixUrl || this.extractPrefixUrl(entryUrl),
            maxPages,
            maxDepth,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'pending',
            pageCount: 0,
            totalSize: 0
        };

        // Add to index
        const index = this.getIndex();

        // Check if doc with same name exists
        const existingIndex = index.docs.findIndex(d => d.id === id);
        if (existingIndex >= 0) {
            index.docs[existingIndex] = config;
        } else {
            index.docs.push(config);
        }
        this.saveIndex(index);

        return config;
    }

    // Start crawling a documentation
    async crawlDoc(docId: string): Promise<void> {
        const index = this.getIndex();
        const docConfig = index.docs.find(d => d.id === docId);

        if (!docConfig) {
            throw new Error(`Doc not found: ${docId}`);
        }

        // Update status to indexing
        docConfig.status = 'indexing';
        docConfig.updatedAt = new Date().toISOString();
        this.saveIndex(index);

        // Set abort controller
        this.crawlAbortControllers.set(docId, false);

        try {
            const pages = await this.crawlPages(docConfig);

            // Check if aborted
            if (this.crawlAbortControllers.get(docId)) {
                docConfig.status = 'failed';
                docConfig.error = 'Crawl aborted by user';
                this.saveIndex(index);
                return;
            }

            // Save pages
            await this.saveDocPages(docConfig, pages);

            // Update config
            docConfig.status = 'indexed';
            docConfig.pageCount = pages.length;
            docConfig.totalSize = pages.reduce((sum, p) => sum + p.content.length, 0);
            docConfig.updatedAt = new Date().toISOString();
            docConfig.error = undefined;

            // Update index totals
            index.totalPages = index.docs.reduce((sum, d) => sum + d.pageCount, 0);
            index.totalSize = index.docs.reduce((sum, d) => sum + d.totalSize, 0);
            this.saveIndex(index);

            this.onProgressCallback?.(docId, pages.length, pages.length, 'completed');
        } catch (error: any) {
            docConfig.status = 'failed';
            docConfig.error = error.message || 'Unknown error';
            docConfig.updatedAt = new Date().toISOString();
            this.saveIndex(index);

            this.onProgressCallback?.(docId, 0, 0, `error: ${error.message}`);
            throw error;
        } finally {
            this.crawlAbortControllers.delete(docId);
        }
    }

    // Stop crawling
    stopCrawl(docId: string): void {
        this.crawlAbortControllers.set(docId, true);
    }

    // Crawl pages from a documentation site
    private async crawlPages(config: DocConfig): Promise<DocPage[]> {
        const pages: DocPage[] = [];
        const visited = new Set<string>();
        const queue: { url: string; depth: number }[] = [{ url: config.entryUrl, depth: 0 }];

        while (queue.length > 0 && pages.length < config.maxPages) {
            // Check if aborted
            if (this.crawlAbortControllers.get(config.id)) {
                break;
            }

            const { url, depth } = queue.shift()!;

            // Skip if already visited or exceeds depth
            if (visited.has(url) || depth > config.maxDepth) {
                continue;
            }

            // Skip if not within prefix scope
            if (!this.isWithinScope(url, config.prefixUrl)) {
                continue;
            }

            visited.add(url);

            try {
                this.onProgressCallback?.(config.id, pages.length, config.maxPages, `Crawling: ${url}`);

                const page = await this.fetchAndParsePage(url);
                if (page) {
                    // Get raw HTML links (works even for JS-rendered pages)
                    const rawLinks = (page as any).extractedLinks || [];

                    // Accept pages with content or use them just for link extraction
                    if (page.content.length > 50) {
                        page.path = this.urlToPath(url, config.prefixUrl);
                        pages.push(page);

                        // Extract links from markdown content
                        const markdownLinks = this.extractLinks(page.content, url, config.prefixUrl);

                        // Combine both link sources
                        const allLinks = [...new Set([...markdownLinks, ...rawLinks])];
                        for (const link of allLinks) {
                            if (!visited.has(link) && this.isWithinScope(link, config.prefixUrl)) {
                                queue.push({ url: link, depth: depth + 1 });
                            }
                        }
                    } else {
                        // Even if content is empty, try to follow links for JS-rendered sites
                        for (const link of rawLinks) {
                            if (!visited.has(link) && this.isWithinScope(link, config.prefixUrl)) {
                                queue.push({ url: link, depth: depth + 1 });
                            }
                        }
                    }
                }

                // Rate limiting - wait 300ms between requests
                await this.delay(300);
            } catch (error) {
                console.error(`Failed to crawl ${url}:`, error);
            }
        }

        return pages;
    }

    // Fetch and parse a single page
    private async fetchAndParsePage(url: string): Promise<DocPage | null> {
        return new Promise((resolve) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'identity',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 30000
            };

            const req = protocol.request(options, (res) => {
                // Handle redirects
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).href;
                    this.fetchAndParsePage(redirectUrl).then(resolve);
                    return;
                }

                if (res.statusCode !== 200) {
                    console.log(`Failed to fetch ${url}: status ${res.statusCode}`);
                    resolve(null);
                    return;
                }

                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const { title, content, links } = this.htmlToMarkdown(data, url);
                        resolve({
                            url,
                            title,
                            content,
                            path: '',
                            crawledAt: new Date().toISOString(),
                            extractedLinks: links
                        } as DocPage & { extractedLinks?: string[] });
                    } catch (error) {
                        console.error(`Failed to parse ${url}:`, error);
                        resolve(null);
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`Request error for ${url}:`, error);
                resolve(null);
            });
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });

            req.end();
        });
    }

    // Convert HTML to Markdown
    private htmlToMarkdown(html: string, baseUrl: string): { title: string; content: string; links: string[] } {
        // Extract all links from raw HTML first (for JS-rendered pages that have links in href but not content)
        const rawLinks = this.extractLinksFromRawHtml(html, baseUrl);

        // Extract title from various sources
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i) ||
                          html.match(/<h1[^>]*>([^<]*)<\/h1>/i) ||
                          html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i) ||
                          html.match(/<meta[^>]*name="title"[^>]*content="([^"]*)"[^>]*>/i);
        const title = titleMatch ? this.decodeHtmlEntities(titleMatch[1].trim()) : 'Untitled';

        // Try to extract description for JS-heavy sites
        const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i) ||
                         html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
        const description = descMatch ? this.decodeHtmlEntities(descMatch[1].trim()) : '';

        // Remove script, style, nav, footer, header, aside elements
        let content = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
            .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
            .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
            .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        // Try to extract main content
        const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                         content.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                         content.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                         content.match(/<div[^>]*class="[^"]*documentation[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                         content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

        if (mainMatch) {
            content = mainMatch[1];
        }

        // Convert HTML to Markdown
        let markdown = content
            // Headers
            .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
            .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
            .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
            .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
            .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
            .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')
            // Code blocks
            .replace(/<pre[^>]*><code[^>]*class="[^"]*language-(\w+)[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```$1\n$2\n```\n')
            .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
            .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
            // Inline code
            .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
            // Links
            .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
                const absoluteUrl = this.resolveUrl(href, baseUrl);
                return `[${text}](${absoluteUrl})`;
            })
            // Lists
            .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
            .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n$1\n')
            .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n$1\n')
            // Paragraphs
            .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
            // Bold/Strong
            .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
            // Italic/Em
            .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
            // Line breaks
            .replace(/<br\s*\/?>/gi, '\n')
            // Blockquotes
            .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n')
            // Remove remaining HTML tags
            .replace(/<[^>]+>/g, '')
            // Decode HTML entities
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&[a-z]+;/gi, '')
            // Clean up whitespace
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^\s+|\s+$/g, '')
            .trim();

        // If markdown is too short (JS-rendered site), use description as fallback
        if (markdown.length < 100 && description) {
            markdown = `# ${title}\n\n${description}\n\n${markdown}`;
        }

        return { title, content: markdown, links: rawLinks };
    }

    // Extract links from raw HTML (for JS-rendered pages)
    private extractLinksFromRawHtml(html: string, baseUrl: string): string[] {
        const links: string[] = [];
        // Match href attributes in anchor tags
        const hrefRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
        let match;

        while ((match = hrefRegex.exec(html)) !== null) {
            try {
                const href = match[1];
                // Skip anchors, mailto, tel, javascript, hash-only links
                if (href.startsWith('#') || href.startsWith('mailto:') ||
                    href.startsWith('tel:') || href.startsWith('javascript:') ||
                    href === '' || href === '/') {
                    continue;
                }
                const absoluteUrl = new URL(href, baseUrl).href;
                links.push(absoluteUrl);
            } catch {
                // Invalid URL, skip
            }
        }

        return [...new Set(links)]; // Remove duplicates
    }

    // Decode HTML entities
    private decodeHtmlEntities(text: string): string {
        return text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&[a-z]+;/gi, '');
    }

    // Resolve relative URL to absolute
    private resolveUrl(href: string, baseUrl: string): string {
        try {
            return new URL(href, baseUrl).href;
        } catch {
            return href;
        }
    }

    // Extract links from markdown content
    private extractLinks(content: string, baseUrl: string, prefixUrl: string): string[] {
        const links: string[] = [];
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
            try {
                const href = match[2];
                // Skip anchors, mailto, tel, javascript
                if (href.startsWith('#') || href.startsWith('mailto:') ||
                    href.startsWith('tel:') || href.startsWith('javascript:')) {
                    continue;
                }
                const absoluteUrl = new URL(href, baseUrl).href;
                // Only include links within the prefix scope
                if (this.isWithinScope(absoluteUrl, prefixUrl)) {
                    links.push(absoluteUrl);
                }
            } catch {
                // Invalid URL, skip
            }
        }

        return [...new Set(links)]; // Remove duplicates
    }

    // Check if URL is within the crawl scope
    private isWithinScope(url: string, prefixUrl: string): boolean {
        try {
            return url.startsWith(prefixUrl);
        } catch {
            return false;
        }
    }

    // Convert URL to file path
    private urlToPath(url: string, prefixUrl: string): string {
        try {
            const parsed = new URL(url);
            let pathPart = parsed.pathname
                .replace(/^\//, '')
                .replace(/\/$/, '')
                .replace(/\//g, '-')
                .replace(/[^a-zA-Z0-9-_]/g, '_')
                .toLowerCase();

            return pathPart || 'index';
        } catch {
            return 'page-' + Date.now();
        }
    }

    // Save crawled pages to disk
    private async saveDocPages(config: DocConfig, pages: DocPage[]): Promise<void> {
        const docDir = path.join(this.docsDir, config.id);

        // Create doc directory
        if (!fs.existsSync(docDir)) {
            fs.mkdirSync(docDir, { recursive: true });
        }

        // Save metadata
        const metaPath = path.join(docDir, '_meta.json');
        fs.writeFileSync(metaPath, JSON.stringify({
            ...config,
            pages: pages.map(p => ({ url: p.url, path: p.path, title: p.title }))
        }, null, 2));

        // Save each page
        for (const page of pages) {
            const filePath = path.join(docDir, `${page.path}.md`);
            const content = this.formatPageContent(page, config);
            fs.writeFileSync(filePath, content);
        }

        // Create index.md for the doc
        this.createDocIndexFile(docDir, config, pages);
    }

    // Format page content with frontmatter
    private formatPageContent(page: DocPage, config: DocConfig): string {
        return `---
title: "${page.title.replace(/"/g, '\\"')}"
url: ${page.url}
doc: ${config.name}
crawled_at: ${page.crawledAt}
---

# ${page.title}

> Source: [${page.url}](${page.url})

${page.content}
`;
    }

    // Create index file for a documentation
    private createDocIndexFile(docDir: string, config: DocConfig, pages: DocPage[]): void {
        const toc = pages.map(p => `- [${p.title}](./${p.path}.md)`).join('\n');

        const content = `# ${config.name} Documentation

> Crawled from: [${config.entryUrl}](${config.entryUrl})
> Pages: ${pages.length}
> Last Updated: ${new Date().toISOString()}

## Table of Contents

${toc}

---

*This documentation was automatically crawled and indexed by Claude Code Chat.*
`;

        fs.writeFileSync(path.join(docDir, 'index.md'), content);
    }

    // Delete a documentation
    async deleteDoc(docId: string): Promise<void> {
        const index = this.getIndex();
        const docIndex = index.docs.findIndex(d => d.id === docId);

        if (docIndex >= 0) {
            // Remove from index
            index.docs.splice(docIndex, 1);

            // Recalculate totals
            index.totalPages = index.docs.reduce((sum, d) => sum + d.pageCount, 0);
            index.totalSize = index.docs.reduce((sum, d) => sum + d.totalSize, 0);
            this.saveIndex(index);

            // Delete doc directory
            const docDir = path.join(this.docsDir, docId);
            if (fs.existsSync(docDir)) {
                this.deleteDirectory(docDir);
            }
        }
    }

    // Delete directory recursively
    private deleteDirectory(dirPath: string): void {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const curPath = path.join(dirPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.deleteDirectory(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    // Get documentation content for context injection
    async getDocContent(docName: string): Promise<string> {
        const docs = await this.getDocs();
        const doc = docs.find(d =>
            d.name.toLowerCase() === docName.toLowerCase() ||
            d.id === docName.toLowerCase()
        );

        if (!doc || doc.status !== 'indexed') {
            return '';
        }

        const indexPath = path.join(this.docsDir, doc.id, 'index.md');
        if (fs.existsSync(indexPath)) {
            return fs.readFileSync(indexPath, 'utf-8');
        }
        return '';
    }

    // Search documentation for relevant content
    async searchDoc(docName: string, query: string, maxResults: number = 3): Promise<string[]> {
        const docs = await this.getDocs();
        const doc = docs.find(d =>
            d.name.toLowerCase() === docName.toLowerCase() ||
            d.id === docName.toLowerCase()
        );

        if (!doc || doc.status !== 'indexed') {
            return [];
        }

        const docDir = path.join(this.docsDir, doc.id);
        if (!fs.existsSync(docDir)) {
            return [];
        }

        const results: { content: string; score: number }[] = [];
        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

        const files = fs.readdirSync(docDir).filter(f => f.endsWith('.md') && !f.startsWith('_'));

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(docDir, file), 'utf-8');
                const lowerContent = content.toLowerCase();

                // Simple scoring based on term frequency
                let score = 0;
                for (const term of queryTerms) {
                    const matches = (lowerContent.match(new RegExp(term, 'g')) || []).length;
                    score += matches;
                }

                if (score > 0) {
                    results.push({ content, score });
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }

        // Sort by score and return top results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(r => r.content);
    }

    // Get relevant documentation context for a message
    async getRelevantContext(docName: string, userMessage: string): Promise<string> {
        const docs = await this.getDocs();
        const doc = docs.find(d =>
            d.name.toLowerCase() === docName.toLowerCase() ||
            d.id === docName.toLowerCase()
        );

        if (!doc || doc.status !== 'indexed') {
            return '';
        }

        // For small docs, return the full index
        const fullContent = await this.getDocContent(docName);
        if (fullContent.length < 8000) {
            return fullContent;
        }

        // For larger docs, search for relevant sections
        const relevantSections = await this.searchDoc(docName, userMessage, 3);
        if (relevantSections.length > 0) {
            return relevantSections.join('\n\n---\n\n');
        }

        // Fallback to index
        return fullContent.substring(0, 8000) + '\n\n... (truncated)';
    }

    // Extract @doc mentions from a message
    extractDocMentions(message: string): string[] {
        const regex = /@(\w+)/g;
        const mentions: string[] = [];
        let match;

        while ((match = regex.exec(message)) !== null) {
            mentions.push(match[1]);
        }

        return mentions;
    }

    // Check if a mention is a valid doc reference
    async isDocReference(name: string): Promise<boolean> {
        const docs = await this.getDocs();
        return docs.some(d =>
            d.name.toLowerCase() === name.toLowerCase() ||
            d.id === name.toLowerCase()
        );
    }

    // Process message and inject doc context
    async processMessageWithDocs(message: string): Promise<{ processedMessage: string; docsUsed: string[] }> {
        const mentions = this.extractDocMentions(message);
        const docsUsed: string[] = [];
        let context = '';

        for (const mention of mentions) {
            if (await this.isDocReference(mention)) {
                const docContext = await this.getRelevantContext(mention, message);
                if (docContext) {
                    context += `\n\n--- Documentation: @${mention} ---\n${docContext}\n`;
                    docsUsed.push(mention);
                }
            }
        }

        if (context) {
            return {
                processedMessage: `${context}\n\n--- User Message ---\n${message}`,
                docsUsed
            };
        }

        return { processedMessage: message, docsUsed: [] };
    }

    // Helper methods
    private generateId(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    }

    private extractPrefixUrl(url: string): string {
        try {
            const parsed = new URL(url);
            // Get the path up to the last segment
            const pathParts = parsed.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0) {
                pathParts.pop();
            }
            return `${parsed.protocol}//${parsed.host}/${pathParts.join('/')}/`;
        } catch {
            return url;
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get storage stats
    async getStats(): Promise<{ totalDocs: number; totalPages: number; totalSize: string }> {
        const index = this.getIndex();
        const sizeInKB = (index.totalSize / 1024).toFixed(1);
        const sizeDisplay = index.totalSize > 1024 * 1024
            ? `${(index.totalSize / 1024 / 1024).toFixed(1)} MB`
            : `${sizeInKB} KB`;

        return {
            totalDocs: index.docs.length,
            totalPages: index.totalPages,
            totalSize: sizeDisplay
        };
    }

    /**
     * Dispose and cleanup resources
     */
    public dispose(): void {
        // Abort any ongoing crawls
        for (const [docId] of this.crawlAbortControllers) {
            this.crawlAbortControllers.set(docId, true);
        }
        this.crawlAbortControllers.clear();

        // Clear callback to prevent memory leaks
        this.onProgressCallback = undefined;

        console.log('DocsManager: Disposed');
    }
}
