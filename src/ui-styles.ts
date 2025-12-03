const styles = `
<style>
    /* ===== Theme-Aware CSS Variables ===== */
    :root {
        --accent-blue: #2e6fed;
        --accent-blue-light: #1ea3d6;
        --accent-green: #10b981;
        --accent-purple: #7c5cc4;
        --accent-orange: #e5a030;
        --accent-red: #dc4545;
        --accent-cyan: #1ea3d6;
        --accent-gold: #d4a53c;
        --accent-gold-bg: rgba(212, 165, 60, 0.12);
        --accent-gold-border: rgba(212, 165, 60, 0.35);

        /* Theme-aware surface colors - uses VS Code variables with fallbacks */
        --surface-elevated: var(--vscode-editor-inactiveSelectionBackground, rgba(255, 255, 255, 0.03));
        --surface-hover: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
        --surface-secondary: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.1));
        --border-subtle: var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
        --border-default: var(--vscode-input-border, rgba(128, 128, 128, 0.3));
        --text-muted: var(--vscode-descriptionForeground, rgba(128, 128, 128, 0.7));
        --text-secondary: var(--vscode-foreground, inherit);

        /* Toggle switch knob - needs to contrast with blue background */
        --toggle-knob: #ffffff;
        --toggle-bg: var(--border-default);
    }

    /* Light theme specific overrides */
    @media (prefers-color-scheme: light) {
        :root {
            --surface-elevated: rgba(0, 0, 0, 0.03);
            --surface-hover: rgba(0, 0, 0, 0.05);
            --border-subtle: rgba(0, 0, 0, 0.1);
            --border-default: rgba(0, 0, 0, 0.15);
            --text-muted: rgba(0, 0, 0, 0.5);
            --text-secondary: rgba(0, 0, 0, 0.7);
        }
    }

    /* VS Code light theme detection via background color */
    body.vscode-light {
        --surface-elevated: rgba(0, 0, 0, 0.03);
        --surface-hover: rgba(0, 0, 0, 0.06);
        --surface-secondary: rgba(0, 0, 0, 0.04);
        --border-subtle: rgba(0, 0, 0, 0.1);
        --border-default: rgba(0, 0, 0, 0.2);
        --text-muted: rgba(0, 0, 0, 0.55);
        --text-secondary: rgba(0, 0, 0, 0.75);
        --accent-gold-bg: rgba(212, 165, 60, 0.15);
        --accent-gold-border: rgba(212, 165, 60, 0.4);
    }

    /* VS Code dark theme */
    body.vscode-dark {
        --surface-elevated: rgba(255, 255, 255, 0.03);
        --surface-hover: rgba(255, 255, 255, 0.06);
        --surface-secondary: rgba(255, 255, 255, 0.04);
        --border-subtle: rgba(255, 255, 255, 0.08);
        --border-default: rgba(255, 255, 255, 0.12);
        --text-muted: rgba(255, 255, 255, 0.5);
        --text-secondary: rgba(255, 255, 255, 0.7);
    }

    /* VS Code high contrast theme */
    body.vscode-high-contrast {
        --surface-elevated: transparent;
        --surface-hover: rgba(255, 255, 255, 0.1);
        --border-subtle: var(--vscode-contrastBorder, #ffffff);
        --border-default: var(--vscode-contrastBorder, #ffffff);
        --text-muted: var(--vscode-foreground);
        --text-secondary: var(--vscode-foreground);
    }

    body {
        font-family: var(--vscode-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        margin: 0;
        padding: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
    }

    /* ===== Enhanced Header ===== */
    .header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-subtle);
        background: linear-gradient(180deg, var(--surface-elevated) 0%, transparent 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
    }

    .header h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
        letter-spacing: -0.3px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .header h2::before {
        content: '';
        width: 8px;
        height: 8px;
        background: var(--accent-green);
        border-radius: 50%;
        box-shadow: 0 0 8px var(--accent-green);
    }

    .header-controls {
        display: flex;
        gap: 6px;
        align-items: center;
    }

    .controls {
        display: flex;
        gap: 6px;
        align-items: center;
    }

    /* ===== Enhanced Buttons ===== */
    .btn {
        background-color: var(--surface-elevated);
        color: var(--vscode-foreground);
        border: 1px solid var(--border-default);
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .btn:hover {
        background-color: var(--surface-hover);
        border-color: var(--accent-blue);
        transform: translateY(-1px);
    }

    .btn:active {
        transform: translateY(0);
    }

    .btn.primary {
        background: var(--accent-blue);
        border-color: transparent;
        color: white;
        font-weight: 600;
    }

    .btn.primary:hover {
        background: var(--accent-blue-light);
        box-shadow: 0 4px 12px rgba(46, 111, 237, 0.25);
    }

    .btn.outlined {
        background-color: transparent;
        color: var(--text-secondary);
        border-color: var(--border-default);
    }

    .btn.outlined:hover {
        background-color: var(--surface-hover);
        color: var(--vscode-foreground);
        border-color: var(--accent-blue);
    }

    .btn.stop {
        background-color: transparent;
        color: var(--text-muted);
        border: 1px solid var(--border-subtle);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
    }

    .btn.stop:hover {
        background-color: rgba(239, 68, 68, 0.1);
        color: var(--accent-red);
        border-color: rgba(239, 68, 68, 0.3);
    }

    /* ===== Activity Panel (Running Tasks/Agents) ===== */
    .activity-panel {
        background: var(--surface-elevated);
        border-bottom: 1px solid var(--border-subtle);
        padding: 10px 16px;
        display: none;
        animation: slideDown 0.2s ease;
    }

    .activity-panel.active {
        display: block;
    }

    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .activity-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
    }

    .activity-header .activity-count {
        background: var(--accent-blue);
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
    }

    .activity-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .activity-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px 12px;
        background: var(--surface-hover);
        border-radius: 6px;
        border-left: 3px solid var(--accent-blue);
        font-size: 12px;
    }

    .activity-item.agent {
        border-left-color: var(--accent-purple);
    }

    .activity-item.tool {
        border-left-color: var(--accent-cyan);
    }

    .activity-item.completed {
        border-left-color: var(--accent-green);
        opacity: 0.7;
    }

    .activity-icon {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        flex-shrink: 0;
        background: var(--accent-blue);
        color: white;
    }

    .activity-item.agent .activity-icon {
        background: var(--accent-purple);
    }

    .activity-item.tool .activity-icon {
        background: var(--accent-cyan);
    }

    .activity-content {
        flex: 1;
        min-width: 0;
    }

    .activity-title {
        font-weight: 500;
        color: var(--vscode-foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .activity-details {
        display: flex;
        gap: 12px;
        margin-top: 4px;
        font-size: 11px;
        color: var(--text-muted);
    }

    .activity-detail {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .activity-tree {
        padding-left: 20px;
        margin-top: 6px;
        border-left: 1px dashed var(--border-default);
    }

    .activity-tree-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: 11px;
        color: var(--text-secondary);
        position: relative;
    }

    .activity-tree-item::before {
        content: '└';
        color: var(--border-default);
        margin-right: 4px;
    }

    .activity-tree-item .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent-green);
    }

    .activity-tree-item .status-dot.running {
        background: var(--accent-blue);
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    /* ===== Todo/Progress Panel ===== */
    .todo-panel {
        background: var(--surface-elevated);
        border-bottom: 1px solid var(--border-subtle);
        padding: 8px 16px;
        display: none;
    }

    .todo-panel.active {
        display: block;
    }

    .todo-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }

    .todo-title {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .todo-progress {
        font-size: 11px;
        color: var(--accent-green);
        font-weight: 500;
    }

    .todo-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .todo-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: var(--surface-hover);
        border-radius: 4px;
        font-size: 12px;
    }

    .todo-item.completed {
        opacity: 0.5;
    }

    .todo-item.in-progress {
        border-left: 2px solid var(--accent-blue);
        background: rgba(59, 130, 246, 0.1);
    }

    .todo-checkbox {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        border: 1px solid var(--border-default);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        flex-shrink: 0;
    }

    .todo-item.completed .todo-checkbox {
        background: var(--accent-green);
        border-color: var(--accent-green);
        color: white;
    }

    .todo-item.in-progress .todo-checkbox {
        border-color: var(--accent-blue);
        background: transparent;
    }

    .todo-item.in-progress .todo-checkbox::after {
        content: '';
        width: 6px;
        height: 6px;
        background: var(--accent-blue);
        border-radius: 50%;
        animation: pulse 1s infinite;
    }

    /* Permission Request */
    .permission-request {
        margin: 4px 12px 20px 12px;
        background-color: rgba(252, 188, 0, 0.1);
        border: 1px solid rgba(252, 188, 0, 0.3);
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        animation: slideUp 0.3s ease;
    }

    .permission-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .permission-header .icon {
        font-size: 16px;
    }

    .permission-menu {
        position: relative;
        margin-left: auto;
    }

    .permission-menu-btn {
        background: none;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 16px;
        font-weight: bold;
        transition: all 0.2s ease;
        line-height: 1;
    }

    .permission-menu-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
        color: var(--vscode-foreground);
    }

    .permission-menu-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        background-color: var(--vscode-menu-background);
        border: 1px solid var(--vscode-menu-border);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        min-width: 220px;
        padding: 4px 0;
        margin-top: 4px;
    }

    .permission-menu-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 16px;
        background: none;
        border: none;
        width: 100%;
        text-align: left;
        cursor: pointer;
        color: var(--vscode-foreground);
        transition: background-color 0.2s ease;
    }

    .permission-menu-item:hover {
        background-color: var(--vscode-list-hoverBackground);
    }

    .permission-menu-item .menu-icon {
        font-size: 16px;
        margin-top: 1px;
        flex-shrink: 0;
    }

    .permission-menu-item .menu-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .permission-menu-item .menu-title {
        font-weight: 500;
        font-size: 13px;
        line-height: 1.2;
    }

    .permission-menu-item .menu-subtitle {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        opacity: 0.8;
        line-height: 1.2;
    }

    .permission-content {
        font-size: 13px;
        line-height: 1.4;
        color: var(--vscode-descriptionForeground);
    }



    .permission-tool {
        font-family: var(--vscode-editor-font-family);
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        padding: 8px 10px;
        margin: 8px 0;
        font-size: 12px;
        color: var(--vscode-editor-foreground);
    }

    .permission-buttons {
        margin-top: 2px;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        flex-wrap: wrap;
    }

    .permission-buttons .btn {
        font-size: 12px;
        padding: 6px 12px;
        min-width: 70px;
        text-align: center;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        border-radius: 4px;
        border: 1px solid;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        box-sizing: border-box;
    }

    .permission-buttons .btn.allow {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-background);
    }

    .permission-buttons .btn.allow:hover {
        background-color: var(--vscode-button-hoverBackground);
    }

    .permission-buttons .btn.deny {
        background-color: transparent;
        color: var(--vscode-foreground);
        border-color: var(--vscode-panel-border);
    }

    .permission-buttons .btn.deny:hover {
        background-color: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-focusBorder);
    }

    .permission-buttons .btn.always-allow {
        background-color: rgba(0, 122, 204, 0.1);
        color: var(--vscode-charts-blue);
        border-color: rgba(0, 122, 204, 0.3);
        font-weight: 500;
        min-width: auto;
        padding: 6px 14px;
        height: 28px;
    }

    .permission-buttons .btn.always-allow:hover {
        background-color: rgba(0, 122, 204, 0.2);
        border-color: rgba(0, 122, 204, 0.5);
        transform: translateY(-1px);
    }

    .permission-buttons .btn.always-allow code {
        background-color: rgba(0, 0, 0, 0.2);
        padding: 2px 4px;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family);
        font-size: 11px;
        color: var(--vscode-editor-foreground);
        margin-left: 4px;
        display: inline;
        line-height: 1;
        vertical-align: baseline;
    }

    .permission-decision {
        font-size: 13px;
        font-weight: 600;
        padding: 8px 12px;
        text-align: center;
        border-radius: 4px;
        margin-top: 8px;
    }

    .permission-decision.allowed {
        background-color: rgba(0, 122, 204, 0.15);
        color: var(--vscode-charts-blue);
        border: 1px solid rgba(0, 122, 204, 0.3);
    }

    .permission-decision.denied {
        background-color: rgba(231, 76, 60, 0.15);
        color: #e74c3c;
        border: 1px solid rgba(231, 76, 60, 0.3);
    }

    .permission-decided {
        opacity: 0.7;
        pointer-events: none;
    }

    .permission-decided .permission-buttons {
        display: none;
    }

    .permission-decided.allowed {
        border-color: var(--vscode-inputValidation-infoBackground);
        background-color: rgba(0, 122, 204, 0.1);
    }

    .permission-decided.denied {
        border-color: var(--vscode-inputValidation-errorBorder);
        background-color: var(--vscode-inputValidation-errorBackground);
    }

    /* Permissions Management */
    .permissions-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        background-color: var(--vscode-input-background);
        margin-top: 8px;
    }

    .permission-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-left: 6px;
        padding-right: 6px;
        border-bottom: 1px solid var(--vscode-panel-border);
        transition: background-color 0.2s ease;
        min-height: 32px;
    }

    .permission-item:hover {
        background-color: var(--vscode-list-hoverBackground);
    }

    .permission-item:last-child {
        border-bottom: none;
    }

    .permission-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-grow: 1;
        min-width: 0;
    }

    .permission-tool {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        flex-shrink: 0;
        height: 18px;
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }

    .permission-command {
        font-size: 12px;
        color: var(--vscode-foreground);
        flex-grow: 1;
    }

    .permission-command code {
        background-color: var(--vscode-textCodeBlock-background);
        padding: 3px 6px;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family);
        color: var(--vscode-textLink-foreground);
        font-size: 11px;
        height: 18px;
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }

    .permission-desc {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        font-style: italic;
        flex-grow: 1;
        height: 18px;
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }

    .permission-remove-btn {
        background-color: transparent;
        color: var(--vscode-descriptionForeground);
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
        transition: all 0.2s ease;
        font-weight: 500;
        flex-shrink: 0;
        opacity: 0.7;
    }

    .permission-remove-btn:hover {
        background-color: rgba(231, 76, 60, 0.1);
        color: var(--vscode-errorForeground);
        opacity: 1;
    }

    .permissions-empty {
        padding: 16px;
        text-align: center;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
        font-size: 13px;
    }

    .permissions-empty::before {
        content: "🔒";
        display: block;
        font-size: 16px;
        margin-bottom: 8px;
        opacity: 0.5;
    }

    /* Add Permission Form */
    .permissions-add-section {
        margin-top: 6px;
    }

    .permissions-show-add-btn {
        background-color: transparent;
        color: var(--vscode-descriptionForeground);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        padding: 6px 8px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 400;
        opacity: 0.7;
    }

    .permissions-show-add-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
        opacity: 1;
    }

    .permissions-add-form {
        margin-top: 8px;
        padding: 12px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        background-color: var(--vscode-input-background);
        animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .permissions-form-row {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
    }

    .permissions-tool-select {
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        padding: 4px 8px;
        font-size: 12px;
        min-width: 100px;
        height: 24px;
        flex-shrink: 0;
    }

    .permissions-command-input {
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        padding: 4px 8px;
        font-size: 12px;
        flex-grow: 1;
        height: 24px;
        font-family: var(--vscode-editor-font-family);
    }

    .permissions-command-input::placeholder {
        color: var(--vscode-input-placeholderForeground);
    }

    .permissions-add-btn {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 3px;
        padding: 4px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        height: 24px;
        font-weight: 500;
        flex-shrink: 0;
    }

    .permissions-add-btn:hover {
        background-color: var(--vscode-button-hoverBackground);
    }

    .permissions-add-btn:disabled {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        cursor: not-allowed;
        opacity: 0.5;
    }

    .permissions-cancel-btn {
        background-color: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        padding: 4px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        height: 24px;
        font-weight: 500;
    }

    .permissions-cancel-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-focusBorder);
    }

    .permissions-form-hint {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
        line-height: 1.3;
    }

    .yolo-mode-section {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
        opacity: 1;
        transition: opacity 0.2s ease;
    }

    .yolo-mode-section:hover {
        opacity: 1;
    }

    .yolo-mode-section input[type="checkbox"] {
        transform: scale(0.9);
        margin: 0;
    }

    .yolo-mode-section label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        font-weight: 400;
    }

    /* WSL Alert */
    .wsl-alert {
        margin: 8px 12px;
        background-color: rgba(135, 206, 235, 0.1);
        border: 2px solid rgba(135, 206, 235, 0.3);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(4px);
        animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .wsl-alert-content {
        display: flex;
        align-items: center;
        padding: 14px 18px;
        gap: 14px;
    }

    .wsl-alert-icon {
        font-size: 22px;
        flex-shrink: 0;
    }

    .wsl-alert-text {
        flex: 1;
        font-size: 13px;
        line-height: 1.4;
        color: var(--vscode-foreground);
    }

    .wsl-alert-text strong {
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .wsl-alert-actions {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
    }

    .wsl-alert-actions .btn {
        padding: 6px 14px;
        font-size: 12px;
        border-radius: 6px;
    }

    .wsl-alert-actions .btn:first-child {
        background-color: rgba(135, 206, 235, 0.2);
        border-color: rgba(135, 206, 235, 0.4);
    }

    .wsl-alert-actions .btn:first-child:hover {
        background-color: rgba(135, 206, 235, 0.3);
        border-color: rgba(135, 206, 235, 0.6);
    }

    .chat-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .messages {
        flex: 1;
        padding: 10px;
        overflow-y: auto;
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
        line-height: 1.5;
    }

    /* ===== Tree-Style Message Format ===== */
    .tree-message {
        margin-bottom: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border-subtle);
    }

    .tree-message:last-child {
        border-bottom: none;
    }

    .tree-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 4px 0;
        margin: 0;
        font-size: 14px;
        line-height: 1.7;
    }

    .tree-bullet {
        color: var(--vscode-foreground);
        font-size: 8px;
        margin-top: 9px;
        flex-shrink: 0;
    }

    .tree-bullet.main {
        color: var(--vscode-foreground);
    }

    .tree-content {
        flex: 1;
        color: var(--vscode-foreground);
        font-size: 14px;
        line-height: 1.7;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }

    /* Headings in tree content - larger sizes */
    .tree-content h1 {
        font-size: 24px;
        font-weight: 600;
        margin: 8px 0 4px 0;
        line-height: 1.3;
    }

    .tree-content h2 {
        font-size: 20px;
        font-weight: 600;
        margin: 6px 0 4px 0;
        line-height: 1.3;
    }

    .tree-content h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 4px 0 2px 0;
        line-height: 1.3;
    }

    .tree-content h4 {
        font-size: 16px;
        font-weight: 600;
        margin: 4px 0 2px 0;
        line-height: 1.3;
    }

    .tree-content p {
        margin: 2px 0;
        font-size: 14px;
    }

    .tree-content ul, .tree-content ol {
        margin: 2px 0;
        padding-left: 20px;
    }

    .tree-content li {
        margin: 1px 0;
        font-size: 14px;
    }

    .tree-content code {
        background: var(--vscode-textCodeBlock-background, var(--surface-elevated));
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 13px;
    }

    .tree-content pre {
        margin: 4px 0;
        padding: 8px;
        background: var(--vscode-textCodeBlock-background, var(--surface-elevated));
        border-radius: 4px;
        overflow-x: auto;
    }

    .tree-content strong {
        font-weight: 600;
    }

    .tree-content table {
        margin: 4px 0;
        font-size: 14px;
    }

    .tree-content hr {
        margin: 8px 0;
        border: none;
        border-top: 1px solid var(--border-subtle);
    }

    /* Tree connector for child items */
    .tree-child {
        display: flex;
        align-items: flex-start;
        margin-left: 12px;
        padding: 6px 0;
        font-size: 14px;
        line-height: 1.7;
        color: var(--text-secondary);
        border-left: 1px solid var(--border-subtle);
        padding-left: 12px;
    }

    .tree-connector {
        color: var(--text-muted);
        margin-right: 8px;
        font-family: monospace;
        user-select: none;
        opacity: 0.6;
    }

    .tree-child-content {
        flex: 1;
        line-height: 1.7;
        word-wrap: break-word;
    }

    /* Tool call in tree format */
    .tree-tool {
        display: flex;
        flex-direction: column;
        margin-bottom: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-subtle);
    }

    .tree-tool:last-child {
        border-bottom: none;
    }

    .tree-tool-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 0;
        margin: 0;
        cursor: pointer;
    }

    .tree-tool-header:hover .tree-tool-name {
        text-decoration: underline;
    }

    .tree-tool-bullet {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent-blue);
        flex-shrink: 0;
        margin-top: 8px;
    }

    .tree-tool-bullet.read { background: var(--accent-blue); }
    .tree-tool-bullet.write { background: var(--accent-green); }
    .tree-tool-bullet.edit { background: var(--accent-orange); }
    .tree-tool-bullet.search { background: var(--accent-cyan); }
    .tree-tool-bullet.bash { background: var(--accent-red); }
    .tree-tool-bullet.mcp { background: var(--accent-blue); }
    .tree-tool-bullet.task { background: #e879f9; }

    .tree-tool-name {
        font-weight: 600;
        font-size: 18px;
        color: var(--vscode-foreground);
        line-height: 1.3;
    }

    /* All tool names in white/foreground color - no colored text */
    .tree-tool-name.read,
    .tree-tool-name.write,
    .tree-tool-name.edit,
    .tree-tool-name.search,
    .tree-tool-name.bash,
    .tree-tool-name.mcp,
    .tree-tool-name.task {
        color: var(--vscode-foreground);
    }

    .tree-tool-args {
        color: var(--text-secondary);
        font-size: 14px;
    }

    /* Expand/collapse toggle button - on result lines */
    .tree-result-toggle {
        background: transparent;
        border: none;
        color: var(--accent-blue);
        cursor: pointer;
        padding: 2px 6px;
        font-size: 12px;
        border-radius: 3px;
        margin-left: 8px;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .tree-result-toggle:hover {
        background: var(--surface-hover);
        color: var(--vscode-foreground);
    }

    /* Hidden content container */
    .tree-result-content-full {
        display: none;
        margin-top: 8px;
        padding: 8px 12px;
        background: var(--surface-secondary);
        border-radius: 4px;
        font-family: var(--font-mono);
        font-size: 13px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 300px;
        overflow-y: auto;
        border-left: 2px solid var(--accent-blue);
    }

    .tree-result-content-full.visible {
        display: block;
    }

    /* Tool results container - collapsible */
    .tree-tool-results {
        margin-left: 16px;
        padding-left: 12px;
        border-left: 1px solid var(--border-subtle);
        margin-top: 4px;
        overflow: hidden;
        transition: max-height 0.3s ease;
    }

    .tree-tool-results.collapsed {
        max-height: 0;
        margin-top: 0;
        padding: 0;
        border: none;
    }

    .tree-tool-result {
        margin: 0;
        padding: 8px 0;
        display: flex;
        align-items: flex-start;
        color: var(--text-secondary);
        font-size: 14px;
        line-height: 1.6;
        border-bottom: 1px solid var(--border-subtle);
    }

    .tree-tool-result:last-child {
        border-bottom: none;
    }

    .tree-tool-result .tree-connector {
        margin-right: 8px;
        color: var(--text-muted);
        flex-shrink: 0;
    }

    .tree-tool-result-content {
        flex: 1;
        color: var(--text-secondary);
        word-break: break-word;
    }

    /* Token info in tree format */
    .tree-token-info {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        margin: 4px 0;
        font-size: 14px;
        color: var(--text-secondary);
    }

    .tree-token-icon {
        font-size: 14px;
    }

    /* Status indicator for tree items */
    .tree-status {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        margin: 4px 0;
        background: rgba(229, 160, 48, 0.08);
        border-left: 3px solid var(--accent-orange);
        border-radius: 0 6px 6px 0;
        font-size: 12px;
        color: var(--accent-orange);
    }

    .tree-status.running {
        background: rgba(46, 111, 237, 0.08);
        border-left-color: var(--accent-blue);
        color: var(--accent-blue);
    }

    .tree-status .status-spinner {
        width: 10px;
        height: 10px;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: tree-spin 0.8s linear infinite;
    }

    @keyframes tree-spin {
        to { transform: rotate(360deg); }
    }

    /* Next task indicator */
    .tree-next-task {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: 14px;
        padding: 2px 0;
        font-size: 12px;
        color: var(--text-muted);
    }

    .tree-next-task::before {
        content: '└';
        font-family: monospace;
        margin-right: 4px;
    }

    /* ===== Enhanced Message Styles ===== */
    .message {
        margin-bottom: 12px;
        padding: 12px 14px;
        border-radius: 10px;
        position: relative;
        transition: all 0.2s ease;
    }

    .message:hover {
        transform: translateX(2px);
    }

    /* User Message - Gold/Yellow highlight for easy identification */
    .message.user {
        background: var(--accent-gold-bg);
        border: 1px solid var(--accent-gold-border);
        border-radius: 10px;
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-editor-font-family);
        position: relative;
        overflow: hidden;
    }

    .message.user::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--accent-gold);
        border-radius: 3px 0 0 3px;
    }

    /* Claude/Assistant Message */
    .message.claude {
        background: rgba(16, 185, 129, 0.06);
        border: 1px solid rgba(16, 185, 129, 0.15);
        border-radius: 10px;
        color: var(--vscode-editor-foreground);
        position: relative;
        overflow: hidden;
    }

    .message.claude::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--accent-green);
        border-radius: 3px 0 0 3px;
    }

    /* Error Message */
    .message.error {
        background: rgba(220, 69, 69, 0.08);
        border: 1px solid rgba(220, 69, 69, 0.2);
        border-radius: 10px;
        color: var(--vscode-editor-foreground);
        position: relative;
        overflow: hidden;
    }

    .message.error::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--accent-red);
        border-radius: 3px 0 0 3px;
    }

    /* System Message */
    .message.system {
        background: var(--surface-elevated);
        border: 1px solid var(--border-subtle);
        color: var(--text-muted);
        font-style: italic;
        font-size: 12px;
        padding: 10px 14px;
    }

    /* Tool Message */
    .message.tool {
        background: rgba(124, 92, 196, 0.06);
        border: 1px solid rgba(124, 92, 196, 0.15);
        border-radius: 10px;
        color: var(--vscode-editor-foreground);
        position: relative;
        overflow: hidden;
    }

    .message.tool::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--accent-purple);
        border-radius: 3px 0 0 3px;
    }

    /* Tool Result Message */
    .message.tool-result {
        background: rgba(30, 163, 214, 0.06);
        border: 1px solid rgba(30, 163, 214, 0.15);
        border-radius: 10px;
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-editor-font-family);
        white-space: pre-wrap;
        position: relative;
        overflow: hidden;
    }

    .message.tool-result::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--accent-cyan);
        border-radius: 3px 0 0 3px;
    }

    /* Thinking Message */
    .message.thinking {
        background: rgba(229, 160, 48, 0.06);
        border: 1px solid rgba(229, 160, 48, 0.15);
        border-radius: 10px;
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-editor-font-family);
        font-style: italic;
        opacity: 0.95;
        position: relative;
        overflow: hidden;
    }

    .message.thinking::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--accent-orange);
        border-radius: 3px 0 0 3px;
    }

    /* ===== Enhanced Tool Header ===== */
    .tool-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border-subtle);
    }

    .tool-icon {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: var(--accent-purple);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: white;
        font-weight: 600;
        flex-shrink: 0;
        margin-left: 4px;
        box-shadow: 0 2px 6px rgba(139, 92, 246, 0.3);
    }

    .tool-info {
        font-weight: 500;
        font-size: 13px;
        color: var(--vscode-editor-foreground);
        opacity: 0.9;
    }

    .message-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--border-subtle);
        position: relative;
    }

    .copy-btn {
        background: transparent;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 2px;
        border-radius: 3px;
        opacity: 0;
        transition: opacity 0.2s ease;
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .message:hover .copy-btn {
        opacity: 0.7;
    }

    .copy-btn:hover {
        opacity: 1;
        background-color: var(--vscode-list-hoverBackground);
    }

    /* Message button container */
    .message-btn-container {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
    }

    /* Scroll to prompt button */
    .scroll-to-prompt-btn {
        background: transparent;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 2px;
        border-radius: 3px;
        opacity: 0;
        transition: opacity 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .message:hover .scroll-to-prompt-btn {
        opacity: 0.7;
    }

    .scroll-to-prompt-btn:hover {
        opacity: 1;
        background-color: var(--vscode-list-hoverBackground);
        color: var(--accent-blue);
    }

    /* Edit prompt button */
    .edit-prompt-btn {
        background: transparent;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 2px;
        border-radius: 3px;
        opacity: 0;
        transition: opacity 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .message.user:hover .edit-prompt-btn {
        opacity: 0.7;
    }

    .edit-prompt-btn:hover {
        opacity: 1;
        background-color: var(--vscode-list-hoverBackground);
        color: #3b82f6;
    }

    /* Edit prompt container */
    .edit-prompt-container {
        margin-top: 8px;
        padding: 12px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 8px;
        animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .edit-prompt-textarea {
        width: 100%;
        min-height: 80px;
        max-height: 300px;
        padding: 10px 12px;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        font-family: var(--vscode-font-family);
        font-size: 13px;
        line-height: 1.5;
        resize: none;
        outline: none;
        transition: border-color 0.2s ease;
    }

    .edit-prompt-textarea:focus {
        border-color: var(--vscode-focusBorder);
    }

    .edit-prompt-warning {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding: 8px 10px;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 4px;
        font-size: 11px;
        color: #f59e0b;
    }

    .edit-prompt-warning svg {
        flex-shrink: 0;
    }

    .edit-prompt-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
    }

    .edit-prompt-cancel-btn {
        padding: 6px 14px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .edit-prompt-cancel-btn:hover {
        background: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-focusBorder);
    }

    .edit-prompt-submit-btn {
        padding: 6px 14px;
        background: var(--accent-blue);
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
    }

    .edit-prompt-submit-btn:hover {
        background: var(--accent-blue-light);
        transform: translateY(-1px);
    }

    .edit-prompt-submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .edit-prompt-submit-btn svg.spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    /* Message in editing state */
    .message.user.editing {
        border: 1px solid var(--vscode-focusBorder);
        background: rgba(46, 111, 237, 0.05);
    }

    .message.user.editing .message-content {
        display: none;
    }

    /* Edit restore notification */
    .edit-restore-notification {
        background: rgba(46, 111, 237, 0.12);
        border: 1px solid rgba(46, 111, 237, 0.35);
        border-radius: 8px;
        padding: 12px 16px;
        margin: 12px 0;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideIn 0.3s ease;
    }

    .edit-restore-notification .restore-icon {
        font-size: 20px;
        flex-shrink: 0;
    }

    .edit-restore-notification .restore-text {
        flex: 1;
        font-size: 12px;
        color: var(--vscode-foreground);
    }

    .edit-restore-notification .restore-text strong {
        display: block;
        margin-bottom: 2px;
        color: #3b82f6;
    }

    .edit-restore-notification .restore-text span {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
    }

    .message-icon {
        width: 18px;
        height: 18px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: white;
        font-weight: 600;
        flex-shrink: 0;
        margin-left: 6px;
    }

    .message-icon.user {
        background: var(--accent-gold);
    }

    .message-icon.claude {
        background: var(--accent-green);
    }

    .message-icon.system {
        background: #7f8c8d;
    }

    .message-icon.error {
        background: var(--accent-red);
    }

    .message-label {
        font-weight: 500;
        font-size: 12px;
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .message-content {
        padding-left: 6px;
    }

    /* Code blocks generated by markdown parser only */
    .message-content pre.code-block {
        background-color: var(--vscode-textCodeBlock-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        padding: 12px;
        margin: 8px 0;
        overflow-x: auto;
        font-family: var(--vscode-editor-font-family);
        font-size: 13px;
        line-height: 1.5;
        white-space: pre;
    }

    .message-content pre.code-block code {
        background: none;
        border: none;
        padding: 0;
        color: var(--vscode-editor-foreground);
    }

    .code-line {
        white-space: pre-wrap;
        word-break: break-word;
    }

    /* Code block container and header */
    .code-block-container {
        margin: 8px 0;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        background-color: var(--vscode-textCodeBlock-background);
        overflow: hidden;
    }

    .code-block-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 6px;
        background-color: var(--vscode-editor-background);
        border-bottom: 1px solid var(--vscode-panel-border);
        font-size: 10px;
    }

    .code-block-language {
        color: var(--vscode-descriptionForeground);
        font-family: var(--vscode-editor-font-family);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .code-copy-btn {
        background: none;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 4px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        opacity: 0.7;
    }

    .code-copy-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
        opacity: 1;
    }

    .code-block-container .code-block {
        margin: 0;
        border: none;
        border-radius: 0;
        background: none;
    }

    /* Inline code */
    .message-content code {
        background-color: var(--vscode-textCodeBlock-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        padding: 2px 4px;
        font-family: var(--vscode-editor-font-family);
        font-size: 0.9em;
        color: var(--vscode-editor-foreground);
    }

    .priority-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-left: 6px;
    }

    .priority-badge.high {
        background: rgba(231, 76, 60, 0.15);
        color: #e74c3c;
        border: 1px solid rgba(231, 76, 60, 0.3);
    }

    .priority-badge.medium {
        background: rgba(243, 156, 18, 0.15);
        color: #f39c12;
        border: 1px solid rgba(243, 156, 18, 0.3);
    }

    .priority-badge.low {
        background: rgba(149, 165, 166, 0.15);
        color: #95a5a6;
        border: 1px solid rgba(149, 165, 166, 0.3);
    }

    .tool-input {
        padding: 6px;
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
        line-height: 1.4;
        white-space: pre-line;
    }

    .tool-input-label {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        font-weight: 500;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .tool-input-content {
        color: var(--vscode-editor-foreground);
        opacity: 0.95;
    }

    /* Diff display styles for Edit tool */
    .diff-container {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        overflow: hidden;
    }

    .diff-header {
        background-color: var(--vscode-panel-background);
        padding: 6px 12px;
        font-size: 11px;
        font-weight: 600;
        color: var(--vscode-foreground);
        border-bottom: 1px solid var(--vscode-panel-border);
    }

    .diff-removed,
    .diff-added {
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
        line-height: 1.4;
    }

    .diff-line {
        padding: 2px 12px;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .diff-line.removed {
        background-color: rgba(244, 67, 54, 0.1);
        border-left: 3px solid rgba(244, 67, 54, 0.6);
        color: var(--vscode-foreground);
    }

    .diff-line.added {
        background-color: rgba(76, 175, 80, 0.1);
        border-left: 3px solid rgba(76, 175, 80, 0.6);
        color: var(--vscode-foreground);
    }

    .diff-line.removed::before {
        content: '';
        color: rgba(244, 67, 54, 0.8);
        font-weight: 600;
        margin-right: 8px;
    }

    .diff-line.added::before {
        content: '';
        color: rgba(76, 175, 80, 0.8);
        font-weight: 600;
        margin-right: 8px;
    }

    .diff-expand-container {
        padding: 8px 12px;
        text-align: center;
        border-top: 1px solid var(--vscode-panel-border);
        background-color: var(--vscode-editor-background);
    }

    .diff-expand-btn {
        background: rgba(46, 111, 237, 0.12);
        border: 1px solid rgba(46, 111, 237, 0.3);
        color: var(--accent-blue);
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
    }

    .diff-expand-btn:hover {
        background: rgba(46, 111, 237, 0.2);
        border-color: rgba(46, 111, 237, 0.5);
    }

    .diff-expand-btn:active {
        transform: translateY(1px);
    }

    /* MultiEdit specific styles */
    .single-edit {
        margin-bottom: 12px;
    }

    .edit-number {
        background: var(--surface-elevated);
        border: 1px solid var(--border-default);
        color: var(--vscode-descriptionForeground);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        margin-top: 6px;
        display: inline-block;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .diff-edit-separator {
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--border-subtle), transparent);
        margin: 12px 0;
    }

    /* File path display styles */
    .diff-file-path {
        padding: 8px 12px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .diff-file-path:hover {
        background-color: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-focusBorder);
    }

    .diff-file-path:active {
        transform: translateY(1px);
    }

    .file-path-short,
    .file-path-truncated {
        font-family: var(--vscode-editor-font-family);
        color: var(--vscode-foreground);
        font-weight: 500;
    }

    .file-path-truncated {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 2px 4px;
        border-radius: 3px;
    }

    .file-path-truncated .file-icon {
        font-size: 14px;
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }

    .file-path-truncated:hover {
        color: var(--vscode-textLink-foreground);
        background-color: var(--vscode-list-hoverBackground);
    }

    .file-path-truncated:hover .file-icon {
        opacity: 1;
    }

    .file-path-truncated:active {
        transform: translateY(1px);
    }

    .expand-btn {
        background: rgba(46, 111, 237, 0.12);
        border: 1px solid rgba(46, 111, 237, 0.3);
        color: var(--accent-blue);
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        margin-left: 6px;
        display: inline-block;
        transition: all 0.2s ease;
    }

    .expand-btn:hover {
        background: rgba(46, 111, 237, 0.2);
        border-color: rgba(46, 111, 237, 0.5);
        transform: translateY(-1px);
    }

    .expanded-content {
        margin-top: 8px;
        padding: 12px;
        background: var(--surface-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        position: relative;
    }

    .expanded-content::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--accent-blue);
        border-radius: 0 0 0 6px;
    }

    .expanded-content pre {
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
    }

    /* ===== Enhanced Input Container ===== */
    .input-container {
        padding: 12px 16px;
        padding-top: 0;
        border-top: none;
        background: linear-gradient(180deg, transparent 0%, var(--surface-elevated) 100%);
        display: flex;
        flex-direction: column;
        position: relative;
        gap: 8px;
    }

    /* Resize handle at top of input container */
    .input-resize-handle {
        width: 100%;
        height: 8px;
        cursor: ns-resize;
        background: var(--border-subtle);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
        border-top: 1px solid var(--border-default);
    }

    .input-resize-handle:hover {
        background: var(--accent-blue);
    }

    .input-resize-handle::after {
        content: '';
        width: 40px;
        height: 3px;
        background: var(--text-muted);
        border-radius: 2px;
        transition: background 0.2s ease;
    }

    .input-resize-handle:hover::after {
        background: var(--vscode-foreground);
    }

    .input-resize-handle.dragging {
        background: var(--accent-blue);
    }

    .input-resize-handle.dragging::after {
        background: var(--vscode-foreground);
    }

    /* Animated Border Line Effect for Processing State - Bounce Effect */
    @keyframes borderLineBounce {
        0% {
            left: -30%;
        }
        50% {
            left: 100%;
        }
        100% {
            left: -30%;
        }
    }

    .input-resize-handle.processing {
        position: relative;
        overflow: hidden;
        background: transparent;
    }

    .input-resize-handle.processing::before {
        content: '';
        position: absolute;
        top: 0;
        left: -30%;
        width: 30%;
        height: 2px;
        background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 20%,
            rgba(255, 255, 255, 0.8) 50%,
            rgba(255, 255, 255, 0.3) 80%,
            transparent 100%
        );
        animation: borderLineBounce 3s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
    }

    .input-resize-handle.processing::after {
        z-index: 1;
        background: transparent;
    }

    .input-modes {
        display: flex;
        gap: 16px;
        align-items: center;
        padding-bottom: 4px;
        font-size: 10px;
    }

    .mode-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-secondary);
        transition: all 0.2s ease;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .mode-toggle span {
        cursor: pointer;
        transition: color 0.2s ease;
    }

    .mode-toggle span:hover {
        color: var(--vscode-foreground);
    }

    .mode-toggle:hover {
        color: var(--vscode-foreground);
        background: var(--surface-hover);
    }

    .mode-switch {
        position: relative;
        width: 28px;
        height: 16px;
        background-color: var(--border-default);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .mode-switch.active {
        background: var(--accent-blue);
        box-shadow: 0 2px 8px rgba(46, 111, 237, 0.3);
    }

    .mode-switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 12px;
        height: 12px;
        background-color: var(--toggle-knob);
        border-radius: 50%;
        transition: transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .mode-switch.active::after {
        transform: translateX(12px);
    }

    .textarea-container {
        display: flex;
        gap: 10px;
        align-items: flex-end;
    }

    .textarea-wrapper {
        flex: 1;
        background-color: var(--vscode-input-background);
        border: 1px solid var(--border-default);
        border-radius: 6px;
        overflow: hidden;
    }

    .textarea-wrapper:focus-within {
        border-color: var(--vscode-focusBorder);
    }

    .input-field {
        width: 100%;
        box-sizing: border-box;
        background-color: transparent;
        color: var(--vscode-input-foreground);
        border: none;
        padding: 12px;
        outline: none;
        font-family: var(--vscode-editor-font-family);
        min-height: 68px;
        line-height: 1.4;
        overflow-y: hidden;
        resize: none;
    }

    .input-field:focus {
        border: none;
        outline: none;
    }

    .input-field::placeholder {
        color: var(--vscode-input-placeholderForeground);
        border: none;
        outline: none;
    }

    .input-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 2px 4px;
        border-top: 1px solid var(--vscode-panel-border);
        background-color: var(--vscode-input-background);
    }

    .left-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .model-selector {
        background-color: rgba(128, 128, 128, 0.15);
        color: var(--vscode-foreground);
        border: none;
        padding: 3px 7px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
        opacity: 0.9;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .model-selector:hover {
        background-color: rgba(128, 128, 128, 0.25);
        opacity: 1;
    }

    .tools-btn {
        background-color: rgba(128, 128, 128, 0.15);
        color: var(--vscode-foreground);
        border: none;
        padding: 3px 7px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
        opacity: 0.9;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .tools-btn:hover {
        background-color: rgba(128, 128, 128, 0.25);
        opacity: 1;
    }

    /* Context Window Usage Circle */
    .context-usage-container {
        position: relative;
        display: flex;
        align-items: center;
        margin-left: 4px;
    }

    .context-usage-circle {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(30, 30, 30, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: relative;
        transition: all 0.2s ease;
    }

    .context-usage-circle:hover {
        background: rgba(50, 50, 50, 0.9);
        transform: scale(1.05);
    }

    .context-usage-svg {
        position: absolute;
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
    }

    .context-circle-bg {
        stroke: var(--border-subtle);
    }

    .context-circle-progress {
        stroke: #3b82f6;
        transition: stroke-dasharray 0.3s ease, stroke 0.3s ease;
    }

    .context-circle-progress.warning {
        stroke: #f59e0b;
    }

    .context-circle-progress.critical {
        stroke: #ef4444;
    }

    .context-usage-text {
        font-size: 7px;
        font-weight: 600;
        color: var(--vscode-foreground);
        z-index: 1;
        white-space: nowrap;
    }

    .context-usage-tooltip {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--vscode-editorWidget-background, #252526);
        border: 1px solid var(--vscode-widget-border, #454545);
        border-radius: 6px;
        padding: 10px 14px;
        min-width: 180px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        display: none;
        text-align: center;
    }

    .context-usage-container:hover .context-usage-tooltip {
        display: block;
    }

    .context-tooltip-header {
        font-size: 12px;
        font-weight: 600;
        color: var(--vscode-foreground);
        margin-bottom: 6px;
    }

    .context-tooltip-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: 8px;
    }

    .context-tooltip-body span:first-child {
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-foreground);
    }

    .context-tooltip-body span:last-child {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
    }

    .context-tooltip-action {
        font-size: 11px;
        color: #3b82f6;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s ease;
    }

    .context-tooltip-action:hover {
        background: rgba(59, 130, 246, 0.1);
    }

    /* Context compacting notification */
    .context-compact-notification {
        background: rgba(229, 160, 48, 0.12);
        border: 1px solid rgba(229, 160, 48, 0.4);
        border-radius: 8px;
        padding: 12px 16px;
        margin: 12px 0;
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .context-compact-notification .compact-icon {
        font-size: 20px;
        flex-shrink: 0;
    }

    .context-compact-notification .compact-text {
        flex: 1;
        font-size: 12px;
        color: var(--vscode-foreground);
    }

    .context-compact-notification .compact-text strong {
        display: block;
        margin-bottom: 2px;
    }

    .context-compact-notification .compact-text span {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
    }

    /* Backup Project Context Button */
    .backup-context-btn {
        background-color: transparent;
        color: var(--vscode-descriptionForeground);
        border: 1px solid var(--vscode-panel-border);
        padding: 4px 6px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        position: relative;
    }

    .backup-context-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
        color: var(--vscode-foreground);
        border-color: var(--vscode-focusBorder);
    }

    .backup-context-btn:active {
        transform: scale(0.95);
    }

    .backup-context-btn.saving {
        animation: pulse-save 1s infinite;
        color: #3b82f6;
        border-color: rgba(59, 130, 246, 0.5);
    }

    .backup-context-btn.success {
        color: #22c55e;
        border-color: rgba(34, 197, 94, 0.5);
        background-color: rgba(34, 197, 94, 0.1);
    }

    @keyframes pulse-save {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    /* Backup context tooltip */
    .backup-context-btn::after {
        content: attr(title);
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--vscode-editorWidget-background, #252526);
        border: 1px solid var(--vscode-widget-border, #454545);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
        z-index: 1000;
        pointer-events: none;
    }

    .backup-context-btn:hover::after {
        opacity: 1;
        visibility: visible;
    }

    /* Context Backup Notification */
    .context-backup-notification {
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.4);
        border-radius: 8px;
        padding: 12px 16px;
        margin: 12px 0;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .context-backup-notification .backup-icon {
        font-size: 20px;
        flex-shrink: 0;
    }

    .context-backup-notification .backup-text {
        flex: 1;
        font-size: 12px;
        color: var(--vscode-foreground);
    }

    .context-backup-notification .backup-text strong {
        display: block;
        margin-bottom: 4px;
        color: #22c55e;
    }

    .context-backup-notification .backup-text span {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        display: block;
        margin-top: 4px;
    }

    .context-backup-notification .backup-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
    }

    .context-backup-notification .backup-actions button {
        background: transparent;
        border: 1px solid var(--vscode-panel-border);
        color: var(--vscode-foreground);
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .context-backup-notification .backup-actions button:hover {
        background: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-focusBorder);
    }

    .context-backup-notification .backup-actions button.primary {
        background: rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.5);
        color: #3b82f6;
    }

    .context-backup-notification .backup-actions button.primary:hover {
        background: rgba(59, 130, 246, 0.3);
    }

    /* Context Restore Prompt */
    .context-restore-prompt {
        background: rgba(46, 111, 237, 0.12);
        border: 1px solid rgba(46, 111, 237, 0.4);
        border-radius: 8px;
        padding: 16px;
        margin: 12px;
        animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .context-restore-prompt .restore-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
    }

    .context-restore-prompt .restore-header .restore-icon {
        font-size: 22px;
    }

    .context-restore-prompt .restore-header h4 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .context-restore-prompt .restore-body {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 12px;
        line-height: 1.5;
    }

    .context-restore-prompt .restore-body .snapshot-info {
        background: var(--vscode-editor-background);
        border-radius: 4px;
        padding: 8px 10px;
        margin-top: 8px;
        font-size: 11px;
    }

    .context-restore-prompt .restore-body .snapshot-info div {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
    }

    .context-restore-prompt .restore-body .snapshot-info div:last-child {
        margin-bottom: 0;
    }

    .context-restore-prompt .restore-body .snapshot-info span:first-child {
        color: var(--vscode-descriptionForeground);
    }

    .context-restore-prompt .restore-body .snapshot-info span:last-child {
        color: var(--vscode-foreground);
        font-weight: 500;
    }

    .context-restore-prompt .restore-actions {
        display: flex;
        gap: 8px;
    }

    .context-restore-prompt .restore-actions button {
        flex: 1;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid var(--vscode-panel-border);
    }

    .context-restore-prompt .restore-actions .btn-restore {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
    }

    .context-restore-prompt .restore-actions .btn-restore:hover {
        background: #2563eb;
        border-color: #2563eb;
    }

    .context-restore-prompt .restore-actions .btn-skip {
        background: transparent;
        color: var(--vscode-foreground);
    }

    .context-restore-prompt .restore-actions .btn-skip:hover {
        background: var(--vscode-list-hoverBackground);
    }

    .slash-btn,
    .at-btn {
        background-color: transparent;
        color: var(--vscode-foreground);
        border: none;
        padding: 4px 6px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s ease;
    }

    .slash-btn:hover,
    .at-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
    }

    .image-btn {
        background-color: transparent;
        color: var(--vscode-foreground);
        border: none;
        padding: 4px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        transition: all 0.2s ease;
        padding-top: 6px;
    }

    .image-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
    }

    .send-btn {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 3px 7px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
    }

    .send-btn div {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
    }

    .send-btn span {
        line-height: 1;
    }

    .send-btn:hover {
        background-color: var(--vscode-button-hoverBackground);
    }

    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Send button Stop mode styles */
    .send-btn.stop-mode {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        animation: stopPulse 1.5s ease-in-out infinite;
    }

    .send-btn.stop-mode:hover {
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    }

    @keyframes stopPulse {
        0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
        }
        50% {
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
        }
    }

    .send-btn .send-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
    }

    .send-btn .stop-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }

    .secondary-button {
        background-color: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.2));
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--vscode-panel-border);
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .secondary-button:hover {
        background-color: var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.3));
        border-color: var(--vscode-focusBorder);
    }

    .right-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .yolo-warning {
        font-size: 12px;
        color: var(--vscode-foreground);
        text-align: center;
        font-weight: 500;
        background-color: rgba(255, 99, 71, 0.08);
        border: 1px solid rgba(255, 99, 71, 0.2);
        padding: 8px 12px;
        margin: 4px 4px;
        border-radius: 4px;
        animation: slideDown 0.3s ease;
    }

    .yolo-suggestion {
        margin-top: 12px;
        padding: 12px;
        background-color: rgba(0, 122, 204, 0.1);
        border: 1px solid rgba(0, 122, 204, 0.3);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .yolo-suggestion-text {
        font-size: 12px;
        color: var(--vscode-foreground);
        flex-grow: 1;
    }

    .yolo-suggestion-btn {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 11px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        font-weight: 500;
        flex-shrink: 0;
    }

    .yolo-suggestion-btn:hover {
        background-color: var(--vscode-button-hoverBackground);
    }

    .file-picker-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .file-picker-content {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        width: 400px;
        max-height: 500px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .file-picker-header {
        padding: 12px;
        border-bottom: 1px solid var(--vscode-panel-border);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .file-picker-header span {
        font-weight: 500;
        color: var(--vscode-foreground);
    }

    .file-search-input {
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 6px 8px;
        border-radius: 3px;
        outline: none;
        font-size: 13px;
    }

    .file-search-input:focus {
        border-color: var(--vscode-focusBorder);
    }

    .file-list {
        max-height: 400px;
        overflow-y: auto;
        padding: 4px;
    }

    .file-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 3px;
        font-size: 13px;
        gap: 8px;
    }

    .file-item:hover {
        background-color: var(--vscode-list-hoverBackground);
    }

    .file-item.selected {
        background-color: var(--vscode-list-activeSelectionBackground);
        color: var(--vscode-list-activeSelectionForeground);
    }

    .file-icon {
        font-size: 16px;
        flex-shrink: 0;
    }

    .file-info {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .file-name {
        font-weight: 500;
    }

    .file-path {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
    }

    .file-thumbnail {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        overflow: hidden;
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .thumbnail-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: cover;
    }

    .tools-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .tools-modal-content {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        width: 700px;
        max-width: 90vw;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        overflow: hidden;
    }

    .tools-modal-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--vscode-panel-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
    }

    .tools-modal-body {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .tools-modal-header span {
        font-weight: 600;
        font-size: 14px;
        color: var(--vscode-foreground);
    }

    .tools-close-btn {
        background: none;
        border: none;
        color: var(--vscode-foreground);
        cursor: pointer;
        font-size: 16px;
        padding: 4px;
    }

    .tools-beta-warning {
        padding: 12px 16px;
        background-color: var(--vscode-notifications-warningBackground);
        color: var(--vscode-notifications-warningForeground);
        font-size: 12px;
        border-bottom: 1px solid var(--vscode-panel-border);
    }

    .tools-list {
        padding: 20px;
        max-height: 400px;
        overflow-y: auto;
    }

    /* MCP Modal content area improvements */
    #mcpModal * {
        box-sizing: border-box;
    }

    #mcpModal .tools-list {
        padding: 24px;
        max-height: calc(80vh - 120px);
        overflow-y: auto;
        width: 100%;
    }

    #mcpModal .mcp-servers-list {
        padding: 0;
    }

    #mcpModal .mcp-add-server {
        padding: 0;
    }

    #mcpModal .mcp-add-form {
        padding: 12px;
    }

    .tool-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px 0;
        cursor: pointer;
        border-radius: 6px;
        transition: background-color 0.2s ease;
    }

    .tool-item:last-child {
        border-bottom: none;
    }

    .tool-item:hover {
        background-color: var(--vscode-list-hoverBackground);
        padding: 16px 12px;
        margin: 0 -12px;
    }

    .tool-item input[type="checkbox"], 
    .tool-item input[type="radio"] {
        margin: 0;
        margin-top: 2px;
        flex-shrink: 0;
    }

    .tool-item label {
        color: var(--vscode-foreground);
        font-size: 13px;
        cursor: pointer;
        flex: 1;
        line-height: 1.4;
    }

    .tool-item input[type="checkbox"]:disabled + label {
        opacity: 0.7;
    }

    /* Model selection specific styles */
    .model-explanatory-text {
        padding: 20px;
        padding-bottom: 0px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.4;
    }

    .model-title {
        font-weight: 600;
        margin-bottom: 4px;
    }

    .model-description {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.3;
    }

    .model-title {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .model-name {
        font-weight: 600;
    }

    .model-badge {
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .model-badge.premium {
        background: var(--accent-purple);
        color: white;
    }

    .model-badge.recommended {
        background: var(--accent-green);
        color: white;
    }

    .model-badge.fast {
        background: var(--accent-cyan);
        color: white;
    }

    .model-badge.alias {
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
    }

    .model-badge.default {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
    }

    .model-specs {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        margin-top: 4px;
        opacity: 0.8;
    }

    .tool-item.model-divider {
        border-top: 1px solid var(--vscode-panel-border);
        margin-top: 8px;
        padding-top: 12px;
    }

    .model-option-content {
        flex: 1;
    }

    .default-model-layout {
        cursor: pointer;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        width: 100%;
    }

    .configure-button {
        margin-left: 12px;
        flex-shrink: 0;
        align-self: flex-start;
    }

    /* Thinking intensity slider */
    .thinking-slider-container {
        position: relative;
        padding: 0px 16px;
        margin: 12px 0;
    }

    .thinking-slider {
        width: 100%;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--vscode-panel-border);
        outline: none !important;
        border: none;
        cursor: pointer;
        border-radius: 2px;
    }

    .thinking-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        background: var(--vscode-foreground);
        cursor: pointer;
        border-radius: 50%;
        transition: transform 0.2s ease;
    }

    .thinking-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    .thinking-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: var(--vscode-foreground);
        cursor: pointer;
        border-radius: 50%;
        border: none;
        transition: transform 0.2s ease;
    }

    .thinking-slider::-moz-range-thumb:hover {
        transform: scale(1.2);
    }

    .slider-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 12px;
        padding: 0 8px;
    }

    .slider-label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        opacity: 0.7;
        transition: all 0.2s ease;
        text-align: center;
        width: 100px;
        cursor: pointer;
    }

    .slider-label:hover {
        opacity: 1;
        color: var(--vscode-foreground);
    }

    .slider-label.active {
        opacity: 1;
        color: var(--vscode-foreground);
        font-weight: 500;
    }

    .slider-label:first-child {
        margin-left: -50px;
    }

    .slider-label:last-child {
        margin-right: -50px;
    }

    .settings-group {
        padding-bottom: 20px;
        margin-bottom: 40px;
        border-bottom: 1px solid var(--border-subtle);
    }

    .settings-group h3 {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }


    /* Thinking intensity modal */
    .thinking-modal-description {
        padding: 0px 20px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.5;
        text-align: center;
        margin: 20px;
        margin-bottom: 0px;
    }

    .thinking-modal-actions {
        padding-top: 20px;
        text-align: right;
        border-top: 1px solid var(--vscode-widget-border);
    }

    .confirm-btn {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: 1px solid var(--vscode-panel-border);
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 400;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    .confirm-btn:hover {
        background-color: var(--vscode-button-background);
        border-color: var(--vscode-focusBorder);
    }

    /* Plan Mode modal */
    .plan-modal-description {
        padding: 0px 20px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.5;
        text-align: center;
        margin: 20px;
        margin-bottom: 0px;
    }

    .plan-mode-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
    }

    .plan-mode-option {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        background-color: var(--vscode-editor-background);
    }

    .plan-mode-option:hover {
        border-color: var(--vscode-focusBorder);
        background-color: var(--vscode-list-hoverBackground);
    }

    .plan-mode-option.selected {
        border-color: var(--vscode-focusBorder);
        background-color: rgba(59, 130, 246, 0.1);
    }

    .plan-mode-radio {
        position: relative;
        flex-shrink: 0;
        margin-top: 2px;
    }

    .plan-mode-radio input[type="radio"] {
        position: absolute;
        opacity: 0;
        cursor: pointer;
        height: 0;
        width: 0;
    }

    .plan-mode-radio-custom {
        display: block;
        width: 18px;
        height: 18px;
        border: 2px solid var(--vscode-panel-border);
        border-radius: 50%;
        background-color: var(--vscode-editor-background);
        transition: all 0.2s ease;
    }

    .plan-mode-option:hover .plan-mode-radio-custom {
        border-color: var(--vscode-focusBorder);
    }

    .plan-mode-option.selected .plan-mode-radio-custom {
        border-color: var(--vscode-button-background);
        background-color: var(--vscode-button-background);
    }

    .plan-mode-option.selected .plan-mode-radio-custom::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--vscode-button-foreground);
    }

    .plan-mode-content {
        flex: 1;
        min-width: 0;
    }

    .plan-mode-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
    }

    .plan-mode-icon {
        font-size: 16px;
    }

    .plan-mode-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .plan-mode-badge {
        font-size: 10px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .plan-mode-badge.fast {
        background-color: rgba(234, 179, 8, 0.2);
        color: #eab308;
    }

    .plan-mode-badge.interactive {
        background-color: rgba(59, 130, 246, 0.2);
        color: #3b82f6;
    }

    .plan-mode-badge.autonomous {
        background-color: rgba(139, 92, 246, 0.2);
        color: #8b5cf6;
    }

    .plan-mode-badge.automode {
        background-color: rgba(16, 185, 129, 0.2);
        color: #10b981;
    }

    /* System message for AutoMode */
    .system-message {
        background-color: rgba(16, 185, 129, 0.1);
        border-left: 3px solid #10b981;
        padding: 8px 12px;
        margin: 8px 0;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
    }

    .system-message .message-content {
        font-style: italic;
    }

    .plan-mode-desc {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.5;
    }

    .plan-modal-actions {
        padding: 16px 20px;
        text-align: right;
        border-top: 1px solid var(--vscode-widget-border);
    }

    /* Slash commands modal */
    .slash-commands-search {
        padding: 16px 20px;
        border-bottom: 1px solid var(--vscode-panel-border);
        position: sticky;
        top: 0;
        background-color: var(--vscode-editor-background);
        z-index: 10;
    }

    .search-input-wrapper {
        display: flex;
        align-items: center;
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        background-color: var(--vscode-input-background);
        transition: all 0.2s ease;
        position: relative;
    }

    .search-input-wrapper:focus-within {
        border-color: var(--vscode-focusBorder);
        box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }

    .search-prefix {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        font-size: 13px;
        font-weight: 600;
        border-radius: 4px 0 0 4px;
        border-right: 1px solid var(--vscode-input-border);
    }

    .slash-commands-search input {
        flex: 1;
        padding: 8px 12px;
        border: none !important;
        background: transparent;
        color: var(--vscode-input-foreground);
        font-size: 13px;
        outline: none !important;
        box-shadow: none !important;
    }

    .slash-commands-search input:focus {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
    }

    .slash-commands-search input::placeholder {
        color: var(--vscode-input-placeholderForeground);
    }

    .command-input-wrapper {
        display: flex;
        align-items: center;
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        background-color: var(--vscode-input-background);
        transition: all 0.2s ease;
        width: 100%;
        position: relative;
    }

    .command-input-wrapper:focus-within {
        border-color: var(--vscode-focusBorder);
        box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }

    .command-prefix {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        font-size: 12px;
        font-weight: 600;
        border-radius: 4px 0 0 4px;
        border-right: 1px solid var(--vscode-input-border);
    }

    .slash-commands-section {
        margin-bottom: 32px;
    }

    .slash-commands-section:last-child {
        margin-bottom: 16px;
    }

    .slash-commands-section h3 {
        margin: 16px 20px 12px 20px;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .slash-commands-info {
        padding: 12px 20px;
        background-color: rgba(255, 149, 0, 0.1);
        border: 1px solid rgba(255, 149, 0, 0.2);
        border-radius: 4px;
        margin: 0 20px 16px 20px;
    }

    .slash-commands-info p {
        margin: 0;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        text-align: center;
        opacity: 0.9;
    }

    .prompt-snippet-item {
        border-left: 2px solid var(--vscode-charts-blue);
        background-color: rgba(0, 122, 204, 0.03);
    }

    .prompt-snippet-item:hover {
        background-color: rgba(0, 122, 204, 0.08);
    }

    .add-snippet-item {
        border-left: 2px solid var(--vscode-charts-green);
        background-color: rgba(0, 200, 83, 0.03);
        border-style: dashed;
    }

    .add-snippet-item:hover {
        background-color: rgba(0, 200, 83, 0.08);
        border-style: solid;
    }

    .add-snippet-form {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        padding: 16px;
        margin: 8px 0;
        animation: slideDown 0.2s ease;
    }

    .add-snippet-form .form-group {
        margin-bottom: 12px;
    }

    .add-snippet-form label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
        font-size: 12px;
        color: var(--vscode-foreground);
    }

    .add-snippet-form textarea {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 3px;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-size: 12px;
        font-family: var(--vscode-font-family);
        box-sizing: border-box;
    }

    .add-snippet-form .command-input-wrapper input {
        flex: 1;
        padding: 6px 8px;
        border: none !important;
        background: transparent;
        color: var(--vscode-input-foreground);
        font-size: 12px;
        font-family: var(--vscode-font-family);
        outline: none !important;
        box-shadow: none !important;
    }

    .add-snippet-form .command-input-wrapper input:focus {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
    }

    .add-snippet-form textarea:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }

    .add-snippet-form input::placeholder,
    .add-snippet-form textarea::placeholder {
        color: var(--vscode-input-placeholderForeground);
    }

    .add-snippet-form textarea {
        resize: vertical;
        min-height: 60px;
    }

    .add-snippet-form .form-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 12px;
    }

    .custom-snippet-item {
        position: relative;
    }

    .snippet-actions {
        display: flex;
        align-items: center;
        opacity: 0;
        transition: opacity 0.2s ease;
        margin-left: 8px;
    }

    .custom-snippet-item:hover .snippet-actions {
        opacity: 1;
    }

    .snippet-delete-btn {
        background: none;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 4px;
        border-radius: 3px;
        font-size: 12px;
        transition: all 0.2s ease;
        opacity: 0.7;
    }

    .snippet-delete-btn:hover {
        background-color: rgba(231, 76, 60, 0.1);
        color: var(--vscode-errorForeground);
        opacity: 1;
    }

    .slash-commands-list {
        display: grid;
        gap: 6px;
        padding: 0 20px;
    }

    .slash-command-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid transparent;
        background-color: transparent;
    }

    .slash-command-item:hover {
        background-color: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-list-hoverBackground);
    }

    .slash-command-icon {
        font-size: 16px;
        min-width: 20px;
        text-align: center;
        opacity: 0.8;
    }

    .slash-command-content {
        flex: 1;
    }

    .slash-command-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-foreground);
        margin-bottom: 2px;
    }

    .slash-command-description {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        opacity: 0.7;
        line-height: 1.3;
    }

    /* Quick command input */
    .custom-command-item {
        cursor: default;
    }

    .custom-command-item .command-input-wrapper {
        margin-top: 4px;
        max-width: 200px;
    }

    .custom-command-item .command-input-wrapper input {
        flex: 1;
        padding: 4px 6px;
        border: none !important;
        background: transparent;
        color: var(--vscode-input-foreground);
        font-size: 11px;
        font-family: var(--vscode-editor-font-family);
        outline: none !important;
        box-shadow: none !important;
    }

    .custom-command-item .command-input-wrapper input:focus {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
    }

    .custom-command-item .command-input-wrapper input::placeholder {
        color: var(--vscode-input-placeholderForeground);
        opacity: 0.7;
    }

    .status {
        padding: 8px 12px;
        background: var(--vscode-statusBar-background, var(--surface-elevated));
        color: var(--vscode-statusBar-foreground, var(--vscode-foreground));
        font-size: 12px;
        border-top: 1px solid var(--vscode-panel-border);
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
    }

    .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .status.ready .status-indicator {
        background-color: #00d26a;
        box-shadow: 0 0 6px rgba(0, 210, 106, 0.5);
    }

    .status.processing .status-indicator {
        background-color: #ff9500;
        box-shadow: 0 0 6px rgba(255, 149, 0, 0.5);
        animation: pulse 1.5s ease-in-out infinite;
    }

    .status.error .status-indicator {
        background-color: #ff453a;
        box-shadow: 0 0 6px rgba(255, 69, 58, 0.5);
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
    }

    .status-text {
        flex: 1;
    }

    pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        margin: 0;
    }

    .session-badge {
        margin-left: 16px;
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background-color 0.2s, transform 0.1s;
    }

    .session-badge:hover {
        background-color: var(--vscode-button-hoverBackground);
        transform: scale(1.02);
    }

    .session-icon {
        font-size: 10px;
    }

    .session-label {
        opacity: 0.8;
        font-size: 10px;
    }

    .session-status {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        padding: 2px 6px;
        border-radius: 4px;
        background-color: var(--vscode-badge-background);
        border: 1px solid var(--vscode-panel-border);
    }

    .session-status.active {
        color: var(--vscode-terminal-ansiGreen);
        background-color: rgba(0, 210, 106, 0.1);
        border-color: var(--vscode-terminal-ansiGreen);
    }

    /* Markdown content styles */
    .message h1, .message h2, .message h3, .message h4 {
        margin: 0.8em 0 0.4em 0;
        font-weight: 600;
        line-height: 1.3;
    }

    .message h1 {
        font-size: 1.5em;
        border-bottom: 2px solid var(--vscode-panel-border);
        padding-bottom: 0.3em;
    }

    .message h2 {
        font-size: 1.3em;
        border-bottom: 1px solid var(--vscode-panel-border);
        padding-bottom: 0.2em;
    }

    .message h3 {
        font-size: 1.1em;
    }

    .message h4 {
        font-size: 1.05em;
    }

    .message strong {
        font-weight: 600;
        color: var(--vscode-terminal-ansiBrightWhite);
    }

    .message em {
        font-style: italic;
    }

    .message ul, .message ol {
        margin: 0.6em 0;
        padding-left: 1.5em;
    }

    .message li {
        margin: 0.3em 0;
        line-height: 1.4;
    }

    .message ul li {
        list-style-type: disc;
    }

    .message ol li {
        list-style-type: decimal;
    }

    .message p {
        margin: 0.5em 0;
        line-height: 1.6;
    }

    .message p:first-child {
        margin-top: 0;
    }

    .message p:last-child {
        margin-bottom: 0;
    }

    .message br {
        line-height: 1.2;
    }

    /* Enhanced Checkpoint System Styles */
    .restore-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding: 8px 12px;
        background: rgba(46, 111, 237, 0.08);
        border: 1px solid rgba(46, 111, 237, 0.2);
        border-radius: 8px;
        transition: all 0.2s ease;
    }

    .restore-container:hover {
        border-color: rgba(46, 111, 237, 0.4);
        background: rgba(46, 111, 237, 0.12);
    }

    .restore-container.enhanced {
        border-left: 3px solid var(--vscode-charts-blue);
    }

    .restore-btn {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .restore-btn.dark {
        background-color: #2d2d30;
        color: #999999;
    }

    .restore-btn:hover {
        background-color: var(--vscode-button-hoverBackground);
        transform: translateY(-1px);
    }

    .restore-btn.dark:hover {
        background-color: #3e3e42;
    }

    .restore-btn-icon {
        font-size: 14px;
    }

    .restore-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        margin-left: 12px;
    }

    .restore-date {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        opacity: 0.8;
    }

    .restore-file-count {
        font-size: 10px;
        color: var(--vscode-charts-blue);
        opacity: 0.9;
    }

    /* Checkpoint Preview Modal */
    .checkpoint-preview-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        z-index: 1001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .checkpoint-preview-content {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 12px;
        width: 550px;
        max-width: 90vw;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .checkpoint-preview-header {
        padding: 20px 24px;
        border-bottom: 1px solid var(--vscode-panel-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, rgba(64, 165, 255, 0.1) 0%, transparent 100%);
    }

    .checkpoint-preview-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--vscode-foreground);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .checkpoint-preview-header h3::before {
        content: '⏪';
        font-size: 18px;
    }

    .checkpoint-preview-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
    }

    .checkpoint-message {
        background-color: var(--vscode-textCodeBlock-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 20px;
        font-size: 13px;
        color: var(--vscode-foreground);
        line-height: 1.4;
    }

    .checkpoint-message-label {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
        font-weight: 500;
    }

    .checkpoint-changes-summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }

    .checkpoint-change-stat {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        padding: 12px;
        text-align: center;
    }

    .checkpoint-change-stat.restore {
        border-color: rgba(76, 175, 80, 0.3);
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.08) 0%, transparent 100%);
    }

    .checkpoint-change-stat.delete {
        border-color: rgba(244, 67, 54, 0.3);
        background: linear-gradient(135deg, rgba(244, 67, 54, 0.08) 0%, transparent 100%);
    }

    .checkpoint-change-stat.modify {
        border-color: rgba(255, 193, 7, 0.3);
        background: linear-gradient(135deg, rgba(255, 193, 7, 0.08) 0%, transparent 100%);
    }

    .checkpoint-stat-number {
        font-size: 24px;
        font-weight: 600;
        color: var(--vscode-foreground);
        margin-bottom: 4px;
    }

    .checkpoint-change-stat.restore .checkpoint-stat-number {
        color: #4caf50;
    }

    .checkpoint-change-stat.delete .checkpoint-stat-number {
        color: #f44336;
    }

    .checkpoint-change-stat.modify .checkpoint-stat-number {
        color: #ffc107;
    }

    .checkpoint-stat-label {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .checkpoint-files-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        margin-bottom: 20px;
    }

    .checkpoint-files-header {
        padding: 10px 14px;
        background-color: var(--vscode-panel-background);
        border-bottom: 1px solid var(--vscode-panel-border);
        font-size: 12px;
        font-weight: 500;
        color: var(--vscode-foreground);
        display: flex;
        align-items: center;
        gap: 6px;
        position: sticky;
        top: 0;
    }

    .checkpoint-file-item {
        padding: 8px 14px;
        font-size: 12px;
        font-family: var(--vscode-editor-font-family);
        color: var(--vscode-foreground);
        border-bottom: 1px solid var(--vscode-panel-border);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .checkpoint-file-item:last-child {
        border-bottom: none;
    }

    .checkpoint-file-item.added {
        background-color: rgba(76, 175, 80, 0.08);
    }

    .checkpoint-file-item.modified {
        background-color: rgba(255, 193, 7, 0.08);
    }

    .checkpoint-file-item.deleted {
        background-color: rgba(244, 67, 54, 0.08);
    }

    .checkpoint-file-status {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 500;
        text-transform: uppercase;
    }

    .checkpoint-file-status.added {
        background-color: rgba(76, 175, 80, 0.2);
        color: #4caf50;
    }

    .checkpoint-file-status.modified {
        background-color: rgba(255, 193, 7, 0.2);
        color: #ffc107;
    }

    .checkpoint-file-status.deleted {
        background-color: rgba(244, 67, 54, 0.2);
        color: #f44336;
    }

    .checkpoint-warning {
        background-color: rgba(255, 152, 0, 0.1);
        border: 1px solid rgba(255, 152, 0, 0.3);
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 20px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
    }

    .checkpoint-warning-icon {
        font-size: 16px;
        flex-shrink: 0;
    }

    .checkpoint-warning-text {
        font-size: 12px;
        color: var(--vscode-foreground);
        line-height: 1.4;
    }

    .checkpoint-preview-actions {
        padding: 20px 24px;
        border-top: 1px solid var(--vscode-panel-border);
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background-color: var(--vscode-panel-background);
    }

    .checkpoint-btn {
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .checkpoint-btn.cancel {
        background-color: transparent;
        border: 1px solid var(--vscode-panel-border);
        color: var(--vscode-foreground);
    }

    .checkpoint-btn.cancel:hover {
        background-color: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-focusBorder);
    }

    .checkpoint-btn.restore {
        background-color: var(--vscode-button-background);
        border: none;
        color: var(--vscode-button-foreground);
    }

    .checkpoint-btn.restore:hover {
        background-color: var(--vscode-button-hoverBackground);
        transform: translateY(-1px);
    }

    .checkpoint-btn.restore-backup {
        background-color: rgba(64, 165, 255, 0.15);
        border: 1px solid rgba(64, 165, 255, 0.4);
        color: var(--vscode-charts-blue);
    }

    .checkpoint-btn.restore-backup:hover {
        background-color: rgba(64, 165, 255, 0.25);
        border-color: rgba(64, 165, 255, 0.6);
    }

    /* Checkpoint Stats Badge */
    .checkpoint-stats-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background-color: rgba(64, 165, 255, 0.1);
        border: 1px solid rgba(64, 165, 255, 0.2);
        border-radius: 12px;
        font-size: 10px;
        color: var(--vscode-charts-blue);
        font-weight: 500;
    }

    .checkpoint-stats-badge::before {
        content: '💾';
        font-size: 10px;
    }

    /* Enhanced Restore Option */
    .restore-container.enhanced .restore-preview-btn {
        background-color: transparent;
        border: 1px solid var(--vscode-panel-border);
        color: var(--vscode-foreground);
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        margin-left: 8px;
        transition: all 0.2s ease;
    }

    .restore-container.enhanced .restore-preview-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-focusBorder);
    }

    /* Restore From Backup Notification */
    .restore-from-backup-notification {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%);
        border: 1px solid rgba(59, 130, 246, 0.4);
        border-radius: 8px;
        padding: 12px 16px;
        margin: 12px 0;
        display: none;
    }

    .restore-from-backup-content {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }

    .restore-from-backup-icon {
        font-size: 24px;
        flex-shrink: 0;
    }

    .restore-from-backup-text {
        flex: 1;
        min-width: 150px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .restore-from-backup-text strong {
        color: var(--vscode-foreground);
        font-size: 13px;
    }

    .restore-from-backup-text span {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
    }

    .restore-from-backup-btn {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .restore-from-backup-btn:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }

    .restore-from-backup-dismiss {
        background: transparent;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 4px 8px;
        font-size: 14px;
        opacity: 0.6;
        transition: opacity 0.2s ease;
    }

    .restore-from-backup-dismiss:hover {
        opacity: 1;
    }

    .conversation-history {
        position: absolute;
        top: 60px;
        left: 0;
        right: 0;
        bottom: 60px;
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        z-index: 1000;
    }

    .conversation-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--vscode-widget-border);
    }

    .conversation-header h3 {
        margin: 0;
        font-size: 16px;
    }

    .conversation-list {
        padding: 8px;
        overflow-y: auto;
        height: calc(100% - 60px);
    }

    .conversation-item {
        padding: 12px;
        margin: 4px 0;
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        cursor: pointer;
        background-color: var(--vscode-list-inactiveSelectionBackground);
        user-select: none;
        transition: background-color 0.15s ease;
    }

    .conversation-item:hover {
        background-color: var(--vscode-list-hoverBackground);
    }

    .conversation-item:active {
        background-color: var(--vscode-list-activeSelectionBackground);
    }

    /* Ensure child elements don't capture clicks */
    .conversation-item > * {
        pointer-events: none;
    }

    .conversation-title {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .conversation-meta {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 4px;
    }

    .conversation-preview {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        opacity: 0.8;
    }

    /* Tool loading animation */
    .tool-loading {
        padding: 16px 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        background-color: var(--vscode-panel-background);
        border-top: 1px solid var(--vscode-panel-border);
    }

    .loading-spinner {
        display: flex;
        gap: 4px;
    }

    .loading-ball {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--vscode-button-background);
        animation: bounce 1.4s ease-in-out infinite both;
    }

    .loading-ball:nth-child(1) { animation-delay: -0.32s; }
    .loading-ball:nth-child(2) { animation-delay: -0.16s; }
    .loading-ball:nth-child(3) { animation-delay: 0s; }

    @keyframes bounce {
        0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.5;
        }
        40% {
            transform: scale(1);
            opacity: 1;
        }
    }

    .loading-text {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
    }

    /* Tool completion indicator */
    .tool-completion {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        background-color: rgba(76, 175, 80, 0.1);
        border-top: 1px solid rgba(76, 175, 80, 0.2);
        font-size: 12px;
    }

    .completion-icon {
        color: #4caf50;
        font-weight: bold;
    }

    .completion-text {
        color: var(--vscode-foreground);
        opacity: 0.8;
    }

    /* MCP Servers styles */
    .mcp-servers-list {
        padding: 4px;
    }

    .mcp-server-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        margin-bottom: 16px;
        background-color: var(--vscode-editor-background);
        transition: all 0.2s ease;
    }

    .mcp-server-item:hover {
        border-color: var(--vscode-focusBorder);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .server-info {
        flex: 1;
    }

    .server-name {
        font-weight: 600;
        font-size: 16px;
        color: var(--vscode-foreground);
        margin-bottom: 8px;
    }

    .server-type {
        display: inline-block;
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        margin-bottom: 8px;
    }

    .server-config {
        font-size: 13px;
        color: var(--vscode-descriptionForeground);
        opacity: 0.9;
        line-height: 1.4;
    }

    .server-delete-btn {
        padding: 8px 16px;
        font-size: 13px;
        color: var(--vscode-errorForeground);
        border-color: var(--vscode-errorForeground);
        min-width: 80px;
        justify-content: center;
    }

    .server-delete-btn:hover {
        background-color: var(--vscode-inputValidation-errorBackground);
        border-color: var(--vscode-errorForeground);
    }

    .server-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-shrink: 0;
    }

    .server-edit-btn {
        padding: 8px 16px;
        font-size: 13px;
        color: var(--vscode-foreground);
        border-color: var(--vscode-panel-border);
        min-width: 80px;
        transition: all 0.2s ease;
        justify-content: center;
    }

    .server-edit-btn:hover {
        background-color: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-focusBorder);
    }

    .mcp-add-server {
        text-align: center;
        margin-bottom: 24px;
        padding: 0 4px;
    }

    .mcp-add-form {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 24px;
        margin-top: 20px;
        box-sizing: border-box;
        width: 100%;
    }

    .form-group {
        margin-bottom: 20px;
        box-sizing: border-box;
        width: 100%;
    }

    .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        font-size: 13px;
        color: var(--vscode-foreground);
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        max-width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-size: 13px;
        font-family: var(--vscode-font-family);
        box-sizing: border-box;
        resize: vertical;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
        box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }

    .form-group textarea {
        resize: vertical;
        min-height: 60px;
    }

    .form-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 20px;
    }

    .no-servers {
        text-align: center;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
        padding: 40px 20px;
    }

    /* Popular MCP Servers */
    .mcp-popular-servers {
        margin-top: 32px;
        padding-top: 24px;
        border-top: 1px solid var(--vscode-panel-border);
    }

    .mcp-popular-servers h4 {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
        opacity: 0.9;
    }

    .popular-servers-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 12px;
    }

    .popular-server-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .popular-server-item:hover {
        border-color: var(--vscode-focusBorder);
        background-color: var(--vscode-list-hoverBackground);
        transform: translateY(-1px);
    }

    .popular-server-icon {
        font-size: 24px;
        flex-shrink: 0;
    }

    .popular-server-info {
        flex: 1;
        min-width: 0;
    }

    .popular-server-name {
        font-weight: 600;
        font-size: 13px;
        color: var(--vscode-foreground);
        margin-bottom: 2px;
    }

    .popular-server-desc {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        opacity: 0.8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* ===== Documentation Manager Styles ===== */
    .docs-btn {
        background: linear-gradient(135deg, var(--accent-blue) 0%, #1ea3d6 100%) !important;
        color: white !important;
        border: none !important;
    }

    .docs-btn:hover {
        opacity: 0.9;
    }

    .docs-modal-content {
        max-width: 600px;
    }

    .docs-modal-body {
        padding: 16px;
    }

    .docs-description {
        font-size: 13px;
        color: var(--text-secondary);
        margin: 0 0 16px 0;
        padding: 12px;
        background: var(--surface-secondary);
        border-radius: 6px;
        border-left: 3px solid var(--accent-blue);
    }

    .docs-list {
        margin-bottom: 16px;
    }

    .docs-item {
        display: flex;
        align-items: flex-start;
        padding: 12px;
        background: var(--surface-secondary);
        border-radius: 6px;
        margin-bottom: 8px;
        border: 1px solid var(--border-subtle);
        transition: all 0.2s ease;
    }

    .docs-item:hover {
        border-color: var(--accent-blue);
        background: var(--surface-hover);
    }

    .docs-item-status {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 12px;
        margin-top: 4px;
        flex-shrink: 0;
    }

    .docs-item-status.indexed {
        background: var(--accent-green);
        box-shadow: 0 0 6px var(--accent-green);
    }

    .docs-item-status.indexing {
        background: var(--accent-orange);
        animation: pulse 1.5s infinite;
    }

    .docs-item-status.failed {
        background: var(--accent-red);
    }

    .docs-item-status.pending {
        background: var(--text-muted);
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .docs-item-info {
        flex: 1;
        min-width: 0;
    }

    .docs-item-name {
        font-weight: 600;
        font-size: 14px;
        color: var(--vscode-foreground);
        margin-bottom: 4px;
    }

    .docs-item-meta {
        font-size: 12px;
        color: var(--text-secondary);
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }

    .docs-item-url {
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }

    .docs-item-progress {
        font-size: 12px;
        color: var(--accent-orange);
        margin-top: 4px;
    }

    .docs-item-error {
        font-size: 12px;
        color: var(--accent-red);
        margin-top: 4px;
    }

    .docs-item-actions {
        display: flex;
        gap: 4px;
        margin-left: 12px;
    }

    .docs-action-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .docs-action-btn:hover {
        background: var(--surface-hover);
        color: var(--vscode-foreground);
    }

    .docs-action-btn.delete:hover {
        color: var(--accent-red);
    }

    .docs-action-btn.confirm-yes {
        color: var(--accent-green);
    }

    .docs-action-btn.confirm-yes:hover {
        background: var(--accent-green);
        color: white;
    }

    .docs-action-btn.confirm-yes.delete {
        color: var(--accent-red);
    }

    .docs-action-btn.confirm-yes.delete:hover {
        background: var(--accent-red);
        color: white;
    }

    .docs-action-btn.confirm-no {
        color: var(--text-muted);
    }

    .docs-action-btn.confirm-no:hover {
        background: var(--surface-hover);
        color: var(--vscode-foreground);
    }

    .confirm-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .confirm-text {
        font-size: 12px;
        color: var(--text-secondary);
        margin-right: 4px;
    }

    .docs-add-section {
        text-align: center;
        margin: 16px 0;
    }

    .docs-add-form {
        background: var(--surface-secondary);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        padding: 20px;
        margin-top: 16px;
    }

    .docs-add-form h4 {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .form-hint {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
    }

    .form-row {
        display: flex;
        gap: 16px;
    }

    .form-row .form-group {
        flex: 1;
    }

    .docs-advanced-toggle {
        cursor: pointer;
        color: var(--accent-blue);
        font-size: 12px;
        margin: 12px 0;
        user-select: none;
    }

    .docs-advanced-toggle:hover {
        text-decoration: underline;
    }

    .docs-advanced-options {
        padding: 12px;
        background: var(--vscode-editor-background);
        border-radius: 4px;
        margin-bottom: 16px;
    }

    .docs-stats {
        margin-top: 20px;
        padding: 12px;
        background: var(--surface-secondary);
        border-radius: 6px;
        font-size: 12px;
        color: var(--text-secondary);
        text-align: center;
    }

    .no-docs {
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
        padding: 32px 16px;
    }

    /* @Docs Mention Autocomplete */
    .docs-autocomplete {
        position: absolute;
        bottom: 100%;
        left: 0;
        right: 0;
        background: var(--surface-elevated);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.2);
        margin-bottom: 8px;
    }

    .docs-autocomplete-item {
        display: flex;
        align-items: center;
        padding: 10px 12px;
        cursor: pointer;
        border-bottom: 1px solid var(--border-subtle);
        transition: background 0.15s ease;
    }

    .docs-autocomplete-item:last-child {
        border-bottom: none;
    }

    .docs-autocomplete-item:hover,
    .docs-autocomplete-item.selected {
        background: var(--surface-hover);
    }

    .docs-autocomplete-icon {
        font-size: 16px;
        margin-right: 10px;
    }

    .docs-autocomplete-info {
        flex: 1;
        min-width: 0;
    }

    .docs-autocomplete-name {
        font-weight: 500;
        font-size: 13px;
        color: var(--vscode-foreground);
    }

    .docs-autocomplete-detail {
        font-size: 11px;
        color: var(--text-muted);
    }

    .docs-autocomplete-header {
        padding: 8px 12px;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
        background: var(--surface-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    /* Docs mention tag in input */
    .docs-mention-tag {
        display: inline-block;
        background: linear-gradient(135deg, var(--accent-blue) 0%, #1ea3d6 100%);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        margin: 0 2px;
    }

    /* ===== Project Memory Styles ===== */
    .memory-btn {
        background: linear-gradient(135deg, var(--accent-blue) 0%, #1ea3d6 100%) !important;
        color: white !important;
        border: none !important;
        font-size: 14px !important;
        min-width: 36px !important;
    }

    .memory-btn:hover {
        opacity: 0.9;
    }

    .memory-btn.memory-active {
        animation: memoryPulse 1s ease-in-out infinite;
        box-shadow: 0 0 10px var(--accent-blue), 0 0 20px rgba(46, 111, 237, 0.3);
    }

    @keyframes memoryPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.05); }
    }

    .memory-modal-content {
        max-width: 600px;
    }

    .memory-modal-body {
        padding: 16px;
    }

    .memory-description {
        font-size: 13px;
        color: var(--text-secondary);
        margin: 0 0 16px 0;
        padding: 12px;
        background: var(--surface-secondary);
        border-radius: 6px;
        border-left: 3px solid var(--accent-purple);
    }

    .memory-stats {
        background: var(--surface-secondary);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
    }

    .memory-stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        text-align: center;
    }

    .memory-stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .memory-stat-value {
        font-size: 24px;
        font-weight: 600;
        color: var(--accent-purple);
    }

    .memory-stat-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 4px;
    }

    .memory-last-updated {
        font-size: 11px;
        color: var(--text-muted);
        text-align: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
    }

    .memory-search-section {
        margin-bottom: 16px;
    }

    .memory-search-input {
        width: 100%;
        padding: 10px 12px;
        background: var(--surface-secondary);
        border: 1px solid var(--border-default);
        border-radius: 6px;
        color: var(--vscode-foreground);
        font-size: 13px;
        box-sizing: border-box;
    }

    .memory-search-input:focus {
        outline: none;
        border-color: var(--accent-purple);
    }

    .memory-entities-section,
    .memory-search-results,
    .memory-context-section {
        margin-bottom: 16px;
    }

    .memory-entities-section h4,
    .memory-search-results h4,
    .memory-context-section h4 {
        font-size: 13px;
        font-weight: 600;
        margin: 0 0 12px 0;
        color: var(--vscode-foreground);
    }

    .memory-entity-types {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .memory-entity-type {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--surface-secondary);
        border-radius: 6px;
        font-size: 12px;
    }

    .memory-entity-type-name {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .memory-entity-type-icon {
        font-size: 14px;
    }

    .memory-entity-type-count {
        background: var(--accent-purple);
        color: white;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
    }

    .memory-results-list {
        max-height: 200px;
        overflow-y: auto;
    }

    .memory-result-item {
        padding: 10px 12px;
        background: var(--surface-secondary);
        border-radius: 6px;
        margin-bottom: 8px;
        border: 1px solid var(--border-subtle);
    }

    .memory-result-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
    }

    .memory-result-name {
        font-weight: 600;
        font-size: 13px;
        color: var(--vscode-foreground);
    }

    .memory-result-type {
        font-size: 10px;
        padding: 2px 6px;
        background: var(--accent-purple);
        color: white;
        border-radius: 4px;
        text-transform: uppercase;
    }

    .memory-result-observations {
        font-size: 12px;
        color: var(--text-secondary);
    }

    .memory-result-observations li {
        margin: 4px 0;
        padding-left: 8px;
        border-left: 2px solid var(--border-subtle);
    }

    .memory-context-preview {
        background: var(--surface-secondary);
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 12px;
        max-height: 200px;
        overflow-y: auto;
        font-family: monospace;
        font-size: 11px;
        color: var(--text-secondary);
        white-space: pre-wrap;
    }

    .memory-context-hint {
        color: var(--text-muted);
        font-style: italic;
        font-family: var(--vscode-font-family);
    }

    .memory-context-stats {
        font-size: 10px;
        color: var(--accent-purple);
        font-weight: 600;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-subtle);
        font-family: var(--vscode-font-family);
    }

    .memory-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border-subtle);
    }

    .memory-actions .btn.danger {
        border-color: var(--accent-red);
        color: var(--accent-red);
    }

    .memory-actions .btn.danger:hover {
        background: var(--accent-red);
        color: white;
    }

    .memory-info {
        margin-top: 16px;
        padding: 12px;
        background: var(--surface-secondary);
        border-radius: 6px;
        font-size: 11px;
        color: var(--text-muted);
    }

    .memory-info p {
        margin: 4px 0;
    }

    .memory-info code {
        background: var(--vscode-textCodeBlock-background);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
    }

    /* Memory Settings Section */
    .memory-settings-section {
        margin-bottom: 16px;
        padding: 16px;
        background: var(--surface-secondary);
        border-radius: 8px;
        border: 1px solid var(--border-subtle);
    }

    .memory-settings-section h4 {
        font-size: 13px;
        font-weight: 600;
        margin: 0 0 16px 0;
        color: var(--vscode-foreground);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .memory-setting-item {
        margin-bottom: 16px;
    }

    .memory-setting-item:last-child {
        margin-bottom: 0;
    }

    .memory-setting-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
    }

    .memory-setting-label {
        flex: 1;
        cursor: pointer;
    }

    .memory-setting-title {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-foreground);
        margin-bottom: 4px;
    }

    .memory-setting-desc {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        line-height: 1.4;
    }

    /* Toggle Switch */
    .memory-toggle-switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 22px;
        flex-shrink: 0;
    }

    .memory-toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .memory-toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--border-default);
        transition: 0.3s;
        border-radius: 22px;
    }

    .memory-toggle-slider::before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: var(--toggle-knob);
        transition: 0.3s;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .memory-toggle-switch input:checked + .memory-toggle-slider {
        background-color: var(--accent-purple);
    }

    .memory-toggle-switch input:checked + .memory-toggle-slider::before {
        transform: translateX(18px);
    }

    .memory-toggle-switch input:focus + .memory-toggle-slider {
        box-shadow: 0 0 0 2px var(--accent-purple);
    }

    /* Number Input */
    .memory-setting-input-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
    }

    .memory-setting-input-group input[type="number"] {
        width: 70px;
        padding: 6px 8px;
        background: var(--vscode-input-background);
        border: 1px solid var(--border-default);
        border-radius: 4px;
        color: var(--vscode-input-foreground);
        font-size: 12px;
        text-align: right;
    }

    .memory-setting-input-group input[type="number"]:focus {
        outline: none;
        border-color: var(--accent-purple);
    }

    .memory-setting-unit {
        font-size: 11px;
        color: var(--text-muted);
    }

    /* Context Size Slider */
    .memory-context-slider {
        margin-top: 12px;
        padding-top: 8px;
    }

    .memory-context-slider input[type="range"] {
        width: 100%;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--border-default);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
    }

    .memory-context-slider input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        background: var(--accent-purple);
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.15s ease;
    }

    .memory-context-slider input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.15);
    }

    .memory-context-slider input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: var(--accent-purple);
        border-radius: 50%;
        cursor: pointer;
        border: none;
    }

    .memory-slider-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 6px;
        font-size: 10px;
        color: var(--text-muted);
    }

    .memory-slider-labels span {
        text-align: center;
        min-width: 30px;
    }

    /* ==================== Task Manager Styles ==================== */

    .task-manager-modal-content {
        max-width: 700px;
    }

    .task-manager-body {
        padding: 16px;
    }

    .task-manager-description {
        font-size: 13px;
        color: var(--text-secondary);
        margin: 0 0 16px 0;
        padding: 12px;
        background: var(--surface-secondary);
        border-radius: 8px;
        border-left: 3px solid var(--accent-blue);
    }

    /* Session Health Section */
    .session-health-section {
        background: var(--surface-secondary);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        border: 1px solid var(--border-subtle);
    }

    .session-health-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    }

    .session-health-icon {
        font-size: 16px;
    }

    .session-health-title {
        font-weight: 600;
        font-size: 13px;
        color: var(--vscode-foreground);
    }

    .session-health-bar {
        height: 8px;
        background: var(--border-default);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
    }

    .session-health-progress {
        height: 100%;
        background: var(--accent-green);
        border-radius: 4px;
        transition: width 0.3s ease, background-color 0.3s ease;
    }

    .session-health-progress.warning {
        background: var(--accent-orange);
    }

    .session-health-progress.critical {
        background: var(--accent-red);
    }

    .session-health-info {
        font-size: 12px;
        color: var(--text-secondary);
    }

    .session-health-tokens {
        color: var(--text-muted);
    }

    .session-health-recommendation {
        margin-top: 12px;
        padding: 10px;
        background: rgba(255, 100, 100, 0.1);
        border-radius: 6px;
        font-size: 12px;
        color: var(--accent-red);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
    }

    /* Task List Section */
    .task-list-section {
        margin-bottom: 16px;
    }

    .task-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .task-list-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .task-filters {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    }

    .task-filter-btn {
        padding: 6px 12px;
        font-size: 11px;
        border: 1px solid var(--border-subtle);
        background: transparent;
        color: var(--text-secondary);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .task-filter-btn:hover {
        background: var(--surface-hover);
        border-color: var(--border-default);
    }

    .task-filter-btn.active {
        background: var(--accent-blue);
        color: white;
        border-color: var(--accent-blue);
    }

    .task-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
    }

    .task-list-loading {
        padding: 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 12px;
    }

    .task-item {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-subtle);
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .task-item:last-child {
        border-bottom: none;
    }

    .task-item:hover {
        background: var(--surface-hover);
    }

    .task-item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
    }

    .task-item-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-foreground);
        flex: 1;
        margin-right: 8px;
    }

    .task-item-status {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 10px;
        text-transform: uppercase;
        font-weight: 600;
    }

    .task-item-status.active {
        background: rgba(0, 200, 83, 0.15);
        color: var(--accent-green);
    }

    .task-item-status.completed {
        background: rgba(0, 122, 255, 0.15);
        color: var(--accent-blue);
    }

    .task-item-status.deprecated {
        background: rgba(128, 128, 128, 0.15);
        color: var(--text-muted);
    }

    .task-item-description {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.4;
        margin-bottom: 8px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .task-item-meta {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: var(--text-muted);
    }

    .task-item-importance {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .task-item-importance.critical {
        color: var(--accent-red);
    }

    .task-item-importance.high {
        color: var(--accent-orange);
    }

    .task-item-importance.medium {
        color: var(--accent-blue);
    }

    .task-item-importance.low {
        color: var(--text-muted);
    }

    .task-item-progress {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .task-progress-bar {
        width: 60px;
        height: 4px;
        background: var(--border-default);
        border-radius: 2px;
        overflow: hidden;
    }

    .task-progress-fill {
        height: 100%;
        background: var(--accent-green);
        border-radius: 2px;
    }

    /* Task Details Panel */
    .task-details-panel {
        background: var(--surface-secondary);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        border: 1px solid var(--border-subtle);
    }

    .task-details-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-subtle);
    }

    .task-details-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .task-details-content {
        font-size: 13px;
    }

    .task-detail-row {
        display: flex;
        margin-bottom: 12px;
    }

    .task-detail-label {
        width: 120px;
        font-weight: 500;
        color: var(--text-secondary);
        flex-shrink: 0;
    }

    .task-detail-value {
        flex: 1;
        color: var(--vscode-foreground);
    }

    .task-observations-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .task-observations-list li {
        padding: 8px 12px;
        background: var(--surface-elevated);
        border-radius: 6px;
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--text-secondary);
        border-left: 2px solid var(--accent-blue);
    }

    .task-observations-list li:last-child {
        margin-bottom: 0;
    }

    .task-related-files {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .task-file-tag {
        padding: 4px 8px;
        background: var(--surface-elevated);
        border-radius: 4px;
        font-size: 11px;
        font-family: var(--vscode-editor-font-family, monospace);
        color: var(--accent-cyan);
    }

    .task-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
    }

    /* Create Task Section */
    .create-task-section {
        background: var(--surface-secondary);
        border-radius: 8px;
        padding: 16px;
        border: 1px solid var(--border-subtle);
    }

    .create-task-section h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .create-task-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .task-input {
        padding: 10px 12px;
        font-size: 13px;
        background: var(--surface-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        color: var(--vscode-input-foreground);
        outline: none;
        transition: border-color 0.2s ease;
    }

    .task-input:focus {
        border-color: var(--accent-blue);
    }

    .task-textarea {
        padding: 10px 12px;
        font-size: 13px;
        background: var(--surface-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        color: var(--vscode-input-foreground);
        outline: none;
        resize: vertical;
        min-height: 80px;
        font-family: inherit;
        transition: border-color 0.2s ease;
    }

    .task-textarea:focus {
        border-color: var(--accent-blue);
    }

    .create-task-options {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .task-select {
        padding: 8px 12px;
        font-size: 12px;
        background: var(--surface-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        color: var(--vscode-input-foreground);
        outline: none;
        cursor: pointer;
        flex: 1;
    }

    .task-select:focus {
        border-color: var(--accent-blue);
    }

    /* Add observation input */
    .add-observation-section {
        margin-top: 12px;
        display: flex;
        gap: 8px;
    }

    .add-observation-input {
        flex: 1;
        padding: 8px 12px;
        font-size: 12px;
        background: var(--surface-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        color: var(--vscode-input-foreground);
        outline: none;
    }

    .add-observation-input:focus {
        border-color: var(--accent-blue);
    }

    /* Empty state */
    .task-list-empty {
        padding: 40px 20px;
        text-align: center;
        color: var(--text-muted);
    }

    .task-list-empty-icon {
        font-size: 32px;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .task-list-empty-text {
        font-size: 13px;
        margin-bottom: 4px;
    }

    .task-list-empty-hint {
        font-size: 11px;
        color: var(--text-muted);
    }

    /* ==================== Unified Context Manager Styles ==================== */

    .context-manager-modal-content {
        max-width: 720px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
    }

    .context-manager-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-subtle);
        background: linear-gradient(180deg, var(--surface-elevated) 0%, transparent 100%);
    }

    .context-manager-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 16px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .context-manager-icon {
        font-size: 20px;
    }

    /* Context Manager Tabs */
    .context-manager-tabs {
        display: flex;
        gap: 4px;
        padding: 12px 16px;
        background: var(--surface-secondary);
        border-bottom: 1px solid var(--border-subtle);
        overflow-x: auto;
    }

    .context-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .context-tab:hover {
        background: var(--surface-hover);
        color: var(--vscode-foreground);
    }

    .context-tab.active {
        background: var(--accent-blue);
        color: white;
        border-color: var(--accent-blue);
    }

    .context-tab .tab-icon {
        font-size: 14px;
    }

    .context-tab .tab-label {
        font-weight: 500;
    }

    .context-manager-body {
        flex: 1;
        overflow-y: auto;
        padding: 0;
    }

    .context-tab-content {
        display: none;
        padding: 20px;
        animation: fadeIn 0.2s ease;
    }

    .context-tab-content.active {
        display: block;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* Overview Tab */
    .context-overview-description {
        font-size: 13px;
        color: var(--text-secondary);
        padding: 12px 16px;
        background: var(--surface-secondary);
        border-radius: 8px;
        border-left: 3px solid var(--accent-blue);
        margin-bottom: 20px;
    }

    .context-overview-description p {
        margin: 0;
        line-height: 1.5;
    }

    /* Session Health Card */
    .context-session-health {
        background: var(--surface-secondary);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 20px;
        border: 1px solid var(--border-subtle);
    }

    .context-session-health .session-health-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
    }

    .session-health-status {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .session-health-icon {
        font-size: 16px;
    }

    .session-health-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .session-health-badge {
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 12px;
        background: rgba(16, 185, 129, 0.15);
        color: var(--accent-green);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .session-health-badge.warning {
        background: rgba(229, 160, 48, 0.15);
        color: var(--accent-orange);
    }

    .session-health-badge.critical {
        background: rgba(220, 69, 69, 0.15);
        color: var(--accent-red);
    }

    .refresh-btn {
        padding: 6px 8px !important;
        min-width: auto !important;
    }

    .refresh-icon {
        font-size: 12px;
    }

    .session-health-bar-container {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .context-session-health .session-health-bar {
        flex: 1;
        height: 10px;
        background: var(--border-default);
        border-radius: 5px;
        overflow: hidden;
    }

    .context-session-health .session-health-progress {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-green), var(--accent-blue));
        border-radius: 5px;
        transition: width 0.5s ease, background 0.3s ease;
    }

    .context-session-health .session-health-progress.warning {
        background: linear-gradient(90deg, var(--accent-orange), var(--accent-gold));
    }

    .context-session-health .session-health-progress.critical {
        background: linear-gradient(90deg, var(--accent-red), var(--accent-orange));
    }

    .session-health-percent {
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-foreground);
        min-width: 40px;
        text-align: right;
    }

    .session-health-details {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
    }

    .health-detail-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .health-detail-label {
        font-size: 10px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
    }

    .health-detail-value {
        font-size: 18px;
        font-weight: 600;
        color: var(--accent-blue);
    }

    .context-session-health .session-health-recommendation {
        margin-top: 14px;
        padding: 12px;
        background: rgba(220, 69, 69, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(220, 69, 69, 0.2);
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .recommendation-icon {
        font-size: 16px;
        flex-shrink: 0;
    }

    .recommendation-text {
        flex: 1;
        font-size: 12px;
        color: var(--accent-red);
        line-height: 1.4;
    }

    /* Quick Stats Grid */
    .context-quick-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }

    .quick-stat-card {
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .quick-stat-card:hover {
        background: var(--surface-hover);
        border-color: var(--accent-blue);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .quick-stat-card.info {
        cursor: default;
    }

    .quick-stat-card.info:hover {
        transform: none;
        border-color: var(--border-subtle);
        box-shadow: none;
    }

    .quick-stat-icon {
        font-size: 22px;
        flex-shrink: 0;
    }

    .quick-stat-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .quick-stat-value {
        font-size: 18px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .quick-stat-label {
        font-size: 11px;
        color: var(--text-muted);
    }

    .quick-stat-arrow {
        color: var(--text-muted);
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    .quick-stat-card:hover .quick-stat-arrow {
        opacity: 1;
    }

    /* Context Priority Section */
    .context-priority-section {
        background: var(--surface-secondary);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 20px;
        border: 1px solid var(--border-subtle);
    }

    .priority-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .priority-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .priority-info {
        cursor: help;
        opacity: 0.6;
    }

    .priority-bars {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .priority-bar-item {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .priority-bar-label {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 80px;
        font-size: 12px;
        color: var(--text-secondary);
    }

    .priority-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .priority-dot.critical {
        background: var(--accent-red);
        box-shadow: 0 0 6px var(--accent-red);
    }

    .priority-dot.high {
        background: var(--accent-orange);
        box-shadow: 0 0 6px var(--accent-orange);
    }

    .priority-dot.medium {
        background: var(--accent-blue);
        box-shadow: 0 0 6px var(--accent-blue);
    }

    .priority-dot.low {
        background: var(--accent-green);
        box-shadow: 0 0 6px var(--accent-green);
    }

    .priority-bar-track {
        flex: 1;
        height: 6px;
        background: var(--border-default);
        border-radius: 3px;
        overflow: hidden;
    }

    .priority-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.5s ease;
    }

    .priority-bar-fill.critical {
        background: linear-gradient(90deg, var(--accent-red), rgba(220, 69, 69, 0.7));
    }

    .priority-bar-fill.high {
        background: linear-gradient(90deg, var(--accent-orange), rgba(229, 160, 48, 0.7));
    }

    .priority-bar-fill.medium {
        background: linear-gradient(90deg, var(--accent-blue), rgba(46, 111, 237, 0.7));
    }

    .priority-bar-fill.low {
        background: linear-gradient(90deg, var(--accent-green), rgba(16, 185, 129, 0.7));
    }

    .priority-bar-percent {
        min-width: 36px;
        text-align: right;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
    }

    /* Recent Activity Timeline */
    .context-recent-activity {
        background: var(--surface-secondary);
        border-radius: 10px;
        padding: 16px;
        border: 1px solid var(--border-subtle);
    }

    .context-recent-activity h4 {
        margin: 0 0 14px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .activity-timeline {
        max-height: 180px;
        overflow-y: auto;
    }

    .activity-timeline-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-subtle);
    }

    .activity-timeline-item:last-child {
        border-bottom: none;
    }

    .activity-timeline-icon {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--surface-hover);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        flex-shrink: 0;
    }

    .activity-timeline-content {
        flex: 1;
    }

    .activity-timeline-text {
        font-size: 12px;
        color: var(--vscode-foreground);
        margin-bottom: 2px;
    }

    .activity-timeline-time {
        font-size: 10px;
        color: var(--text-muted);
    }

    .activity-empty {
        text-align: center;
        padding: 24px;
        color: var(--text-muted);
        font-size: 12px;
    }

    /* Memory Tab */
    .memory-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .memory-stats-inline {
        display: flex;
        gap: 10px;
    }

    .stat-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        font-size: 12px;
    }

    .stat-chip-value {
        font-weight: 600;
        color: var(--accent-purple);
    }

    .stat-chip-label {
        color: var(--text-muted);
    }

    .memory-last-update {
        font-size: 11px;
        color: var(--text-muted);
    }

    .memory-search-wrapper {
        position: relative;
        margin-bottom: 16px;
    }

    .memory-search-wrapper .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 14px;
        opacity: 0.5;
    }

    .memory-search-section .memory-search-input {
        width: 100%;
        padding: 10px 12px 10px 38px;
        background: var(--surface-secondary);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        color: var(--vscode-foreground);
        font-size: 13px;
        box-sizing: border-box;
    }

    .memory-graph-section {
        background: var(--surface-secondary);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
        border: 1px solid var(--border-subtle);
    }

    .memory-graph-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
    }

    .memory-graph-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .context-preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .context-preview-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .memory-actions-row {
        display: flex;
        gap: 12px;
        justify-content: center;
        padding-top: 16px;
        border-top: 1px solid var(--border-subtle);
        margin-top: 16px;
    }

    .memory-actions-row .btn.danger {
        border-color: var(--accent-red);
        color: var(--accent-red);
    }

    .memory-actions-row .btn.danger:hover {
        background: var(--accent-red);
        color: white;
    }

    /* Tasks Tab */
    .tasks-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .task-list-container {
        margin-bottom: 16px;
    }

    .task-list-container .task-list {
        max-height: 320px;
        overflow-y: auto;
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
    }

    .task-list-container .task-list-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 20px;
        text-align: center;
    }

    .task-list-container .empty-icon {
        font-size: 36px;
        opacity: 0.4;
        margin-bottom: 12px;
    }

    .task-list-container .empty-hint {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 6px;
    }

    .create-task-section {
        background: var(--surface-secondary);
        border-radius: 10px;
        border: 1px solid var(--border-subtle);
        overflow: hidden;
    }

    .create-task-section.collapsed .create-task-form {
        display: none;
    }

    .create-task-toggle {
        width: 100%;
        padding: 14px 16px;
        background: transparent;
        border: none;
        color: var(--accent-blue);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: background 0.2s ease;
    }

    .create-task-toggle:hover {
        background: var(--surface-hover);
    }

    .create-task-form {
        padding: 0 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .task-input {
        width: 100%;
        padding: 10px 12px;
        background: var(--surface-elevated);
        border: 1px solid var(--border-default);
        border-radius: 6px;
        color: var(--vscode-foreground);
        font-size: 13px;
        box-sizing: border-box;
    }

    .task-input:focus {
        outline: none;
        border-color: var(--accent-blue);
    }

    /* Scratchpad Tab */
    .scratchpad-description {
        font-size: 13px;
        color: var(--text-secondary);
        padding: 12px 16px;
        background: var(--surface-secondary);
        border-radius: 8px;
        border-left: 3px solid var(--accent-purple);
        margin-bottom: 20px;
    }

    .scratchpad-description p {
        margin: 0;
        line-height: 1.5;
    }

    .scratchpad-add-section {
        background: var(--surface-secondary);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 20px;
        border: 1px solid var(--border-subtle);
    }

    .scratchpad-add-form {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .scratchpad-type-select {
        padding: 10px 12px;
        background: var(--surface-elevated);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        color: var(--vscode-foreground);
        font-size: 12px;
        cursor: pointer;
        min-width: 120px;
    }

    .scratchpad-type-select:focus {
        outline: none;
        border-color: var(--accent-purple);
    }

    .scratchpad-input {
        flex: 1;
        padding: 10px 14px;
        background: var(--surface-elevated);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        color: var(--vscode-foreground);
        font-size: 13px;
    }

    .scratchpad-input:focus {
        outline: none;
        border-color: var(--accent-purple);
    }

    .scratchpad-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .scratchpad-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        transition: all 0.2s ease;
    }

    .scratchpad-item:hover {
        border-color: var(--accent-purple);
    }

    .scratchpad-item-type {
        font-size: 18px;
        flex-shrink: 0;
    }

    .scratchpad-item-content {
        flex: 1;
        font-size: 13px;
        color: var(--vscode-foreground);
        line-height: 1.4;
    }

    .scratchpad-item-actions {
        display: flex;
        gap: 6px;
    }

    .scratchpad-item-btn {
        padding: 4px 8px;
        background: transparent;
        border: 1px solid var(--border-subtle);
        border-radius: 4px;
        color: var(--text-muted);
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .scratchpad-item-btn:hover {
        background: var(--surface-hover);
        color: var(--vscode-foreground);
    }

    .scratchpad-item-btn.delete:hover {
        background: rgba(220, 69, 69, 0.1);
        color: var(--accent-red);
        border-color: var(--accent-red);
    }

    .scratchpad-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 20px;
        text-align: center;
        background: var(--surface-secondary);
        border-radius: 10px;
        border: 1px dashed var(--border-subtle);
    }

    .scratchpad-empty .empty-icon {
        font-size: 36px;
        opacity: 0.4;
        margin-bottom: 12px;
    }

    .scratchpad-empty p {
        margin: 0 0 6px 0;
        font-size: 13px;
        color: var(--text-secondary);
    }

    .scratchpad-empty .empty-hint {
        font-size: 11px;
        color: var(--text-muted);
    }

    /* Settings Tab */
    .settings-section {
        background: var(--surface-secondary);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
        border: 1px solid var(--border-subtle);
    }

    .settings-section h4 {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-subtle);
    }

    .setting-item {
        margin-bottom: 16px;
    }

    .setting-item:last-child {
        margin-bottom: 0;
    }

    .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
    }

    .setting-info {
        flex: 1;
    }

    .setting-title {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-foreground);
        margin-bottom: 4px;
    }

    .setting-desc {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        line-height: 1.4;
    }

    /* Toggle Switch */
    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 42px;
        height: 24px;
        flex-shrink: 0;
    }

    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--border-default);
        transition: 0.3s;
        border-radius: 24px;
    }

    .toggle-slider::before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: var(--toggle-knob);
        transition: 0.3s;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .toggle-switch input:checked + .toggle-slider {
        background-color: var(--accent-blue);
    }

    .toggle-switch input:checked + .toggle-slider::before {
        transform: translateX(18px);
    }

    .toggle-switch input:focus + .toggle-slider {
        box-shadow: 0 0 0 2px var(--accent-blue);
    }

    .setting-input-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    .setting-input-group input[type="number"] {
        width: 80px;
        padding: 8px 10px;
        background: var(--vscode-input-background);
        border: 1px solid var(--border-default);
        border-radius: 6px;
        color: var(--vscode-input-foreground);
        font-size: 12px;
        text-align: right;
    }

    .setting-input-group input[type="number"]:focus {
        outline: none;
        border-color: var(--accent-blue);
    }

    .setting-unit {
        font-size: 11px;
        color: var(--text-muted);
    }

    .context-slider-container {
        margin-top: 14px;
    }

    .context-slider-container input[type="range"] {
        width: 100%;
        height: 6px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--border-default);
        border-radius: 3px;
        outline: none;
        margin-bottom: 8px;
    }

    .context-slider-container input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        background: var(--accent-blue);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(46, 111, 237, 0.3);
        transition: transform 0.15s ease;
    }

    .context-slider-container input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.1);
    }

    .slider-labels {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: var(--text-muted);
    }

    .storage-info {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .storage-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: var(--surface-elevated);
        border-radius: 6px;
        border: 1px solid var(--border-subtle);
    }

    .storage-icon {
        font-size: 16px;
        flex-shrink: 0;
    }

    .storage-path {
        flex: 1;
        font-family: monospace;
        font-size: 12px;
        color: var(--text-secondary);
    }

    .storage-label {
        font-size: 10px;
        color: var(--text-muted);
        background: var(--surface-secondary);
        padding: 3px 8px;
        border-radius: 4px;
    }

    /* Context Manager Footer */
    .context-manager-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        border-top: 1px solid var(--border-subtle);
        background: var(--surface-elevated);
        flex-shrink: 0;
    }

    .footer-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-muted);
    }

    .footer-status .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent-green);
    }

    .footer-status .status-text {
        font-weight: 500;
    }

    .footer-actions {
        display: flex;
        gap: 10px;
    }

    .footer-actions .btn.small {
        padding: 6px 14px;
        font-size: 12px;
    }

    /* Context Manager Button */
    .context-manager-btn {
        background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue));
        color: white !important;
        border: none !important;
        position: relative;
        overflow: hidden;
    }

    .context-manager-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.5s ease;
    }

    .context-manager-btn:hover::before {
        left: 100%;
    }

    .context-manager-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(124, 92, 196, 0.3);
    }

    /* Responsive adjustments */
    @media (max-width: 500px) {
        .context-quick-stats {
            grid-template-columns: 1fr;
        }

        .context-manager-tabs {
            padding: 10px 12px;
            gap: 2px;
        }

        .context-tab {
            padding: 6px 10px;
            font-size: 11px;
        }

        .context-tab .tab-label {
            display: none;
        }

        .scratchpad-add-form {
            flex-direction: column;
        }

        .scratchpad-type-select {
            width: 100%;
        }
    }
</style>`

export default styles