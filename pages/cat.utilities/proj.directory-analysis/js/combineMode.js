import { appState, elements } from './main.js';
import * as fileSystem from 'fileSystem';
import { formatBytes, isLikelyTextFile } from './utils.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';

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
    
    // Count text files for button state
    const textFileCount = filesToDisplay.filter(file => isLikelyTextFile(file.path)).length;
    elements.copySelectedBtn.disabled = textFileCount === 0;

    filesToDisplay.forEach(file => {
        const div = document.createElement('div');
        div.className = 'selected-file';
        const isTextFile = isLikelyTextFile(file.path);
        
        if (!isTextFile) {
            div.classList.add('binary-file');
        }
        
        div.innerHTML = `
            <div class="selected-file-name">${file.path} (${formatBytes(file.size)})${!isTextFile ? ' <span class="binary-badge" title="Binary file - will be skipped when combining">BINARY</span>' : ''}</div>
            <div class="selected-file-actions">
                ${isTextFile ? '<span class="edit-btn" title="Edit file">✏️</span>' : ''}
                <span class="preview-btn" title="Preview">👁️</span>
            </div>
        `;
        
        // Add event listeners
        if (isTextFile) {
            div.querySelector('.edit-btn').addEventListener('click', () => fileEditor.openFileInEditor(file)); // Changed from fileSystem
        }
        div.querySelector('.preview-btn').addEventListener('click', () => fileSystem.previewFile(file.entryHandle, file.path)); // Pass path for edited content check
        
        elements.selectedFilesContainer.appendChild(div);
    });
    
    // Show summary of binary files if any are present
    const binaryFileCount = filesToDisplay.length - textFileCount;
    if (binaryFileCount > 0 && textFileCount > 0) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'binary-summary';
        summaryDiv.textContent = `Note: ${binaryFileCount} binary files (images, media, etc.) will be skipped when combining.`;
        elements.selectedFilesContainer.appendChild(summaryDiv);
    } else if (binaryFileCount > 0 && textFileCount === 0) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'binary-summary warning';
        summaryDiv.textContent = `Warning: All ${binaryFileCount} selected files are binary (images, media, etc.) and cannot be combined.`;
        elements.selectedFilesContainer.appendChild(summaryDiv);
    }
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
    
    // Filter to only include text files
    const textFiles = filesToCopy.filter(file => isLikelyTextFile(file.path));
    const skippedCount = filesToCopy.length - textFiles.length;
    
    if (textFiles.length === 0) {
        notificationSystem.showNotification('No text files found in selection. Binary files like images and media were skipped.');
        return;
    }
    
    let combined = `// COMBINED CONTENT (${textFiles.length} files) - ${new Date().toISOString()}\n`;
    if (skippedCount > 0) {
        combined += `// NOTE: ${skippedCount} binary files were skipped (images, videos, etc.)\n`;
    }
    combined += `\n`;
    
    elements.loader.classList.add('visible');
    elements.loader.textContent = `COMBINING ${textFiles.length} FILES...`;
    
    try {
        for (const file of textFiles) {
            try {
                let content;
                let sourceInfo = "";
                if (fileEditor.hasEditedContent(file.path)) {
                    content = fileEditor.getEditedContent(file.path);
                    sourceInfo = fileEditor.isPatched(file.path) ? "(EDITED & PATCHED)" : "(EDITED)";
                } else {
                    content = await fileSystem.readFileContent(file.entryHandle);
                }
                combined += `// ===== FILE: ${file.path} ${sourceInfo} ===== //\n${content}\n// ===== END ${file.path} ===== //\n\n`;
            } catch (e) {
                combined += `// ERROR reading ${file.path}: ${e.message}\n\n`;
            }
        }
        
        await navigator.clipboard.writeText(combined);
        notificationSystem.showNotification(`Combined ${textFiles.length} text files to clipboard${skippedCount > 0 ? ` (${skippedCount} binary files skipped)` : ''}!`);
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
        elements.loader.textContent = 'ANALYSING SECTOR... STAND BY...'; // Reset loader text
    }
}