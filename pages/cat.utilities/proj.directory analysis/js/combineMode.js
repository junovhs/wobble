import { appState, elements } from './main.js';
import * as fileSystem from 'fileSystem';
import { formatBytes } from './utils.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';

// Update the list display in combine mode
export function updateCombineModeListDisplay() {
    elements.selectedFilesContainer.innerHTML = '';
    const filesToDisplay = (appState.selectionCommitted && appState.committedScanData) 
        ? appState.committedScanData.allFilesList 
        : [];

    if (filesToDisplay.length === 0) {
        elements.selectedFilesContainer.innerHTML = `<div class="empty-notice">${appState.selectionCommitted ? 'NO FILES IN COMMITTED SELECTION.' : 'COMMIT SELECTIONS TO POPULATE THIS LIST.'}</div>`;
        elements.copySelectedBtn.disabled = true;
        return;
    }
    
    elements.copySelectedBtn.disabled = false;

    filesToDisplay.forEach(file => {
        const div = document.createElement('div');
        div.className = 'selected-file';
        div.innerHTML = `<div class="selected-file-name">${file.path} (${formatBytes(file.size)})</div><div class="selected-file-actions"><span class="preview-btn" title="Preview">👁️</span></div>`;
        div.querySelector('.preview-btn').addEventListener('click', () => fileSystem.previewFile(file.entryHandle));
        elements.selectedFilesContainer.appendChild(div);
    });
}

// Copy the content of selected files to clipboard
export async function copySelectedFiles() {
    const filesToCopy = (appState.selectionCommitted && appState.committedScanData) 
        ? appState.committedScanData.allFilesList 
        : [];
        
    if (filesToCopy.length === 0) {
        notificationSystem.showNotification('No files in the committed selection to copy.');
        return;
    }
    
    let combined = `// COMBINED CONTENT (${filesToCopy.length} files) - ${new Date().toISOString()}\n\n`;
    elements.loader.classList.add('visible');
    elements.loader.textContent = `COMBINING ${filesToCopy.length} FILES...`;
    
    try {
        for (const file of filesToCopy) {
            try {
                combined += `// ===== FILE: ${file.path} ===== //\n${await fileSystem.readFileContent(file.entryHandle)}\n// ===== END ${file.path} ===== //\n\n`;
            } catch (e) {
                combined += `// ERROR reading ${file.path}: ${e.message}\n\n`;
            }
        }
        
        await navigator.clipboard.writeText(combined);
        notificationSystem.showNotification('Combined content copied to clipboard!');
    } catch (e) {
        console.error('Clipboard copy failed:', e);
        errorHandler.showError({
            name: "ClipboardError",
            message: "Failed to copy combined files to clipboard.",
            stack: e.stack,
            cause: e
        });
    } finally {
        elements.loader.classList.remove('visible');
    }
}