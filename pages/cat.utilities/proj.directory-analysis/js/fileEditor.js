// --- FILE: js/fileEditor.js --- //
import { appState, elements } from './main.js';
import * as fileSystem from 'fileSystem';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';

// Object to store edited file contents with path as key
// Now stores: { path: { content: "...", isPatched: false, savedInSession: false } }
const editedFiles = new Map();

export function initFileEditor() {
    elements.saveEditorBtn.addEventListener('click', saveFileChanges);
    elements.closeEditorBtn.addEventListener('click', closeEditor);

    elements.editorContent.addEventListener('input', () => {
        if (appState.currentEditingFile) {
            const fileState = editedFiles.get(appState.currentEditingFile.path) || { content: '', isPatched: false, savedInSession: false };
            editedFiles.set(appState.currentEditingFile.path, {
                ...fileState,
                content: elements.editorContent.value,
                savedInSession: false // Any manual edit makes it unsaved for the current session state
            });
            setEditorStatus('unsaved'); // General 'unsaved' status after typing
        }
    });

    elements.editorContent.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveFileChanges();
        }
    });
}

export async function openFileInEditor(file) {
    try {
        appState.currentEditingFile = file;

        setEditorStatus('loading');
        elements.editorContent.value = 'Loading file...';
        elements.editorFileTitle.textContent = `EDITING: ${file.name}`;
        elements.editorInfo.textContent = `Path: ${file.path}`;
        elements.fileEditor.style.display = 'flex';

        let contentToLoad;
        let statusToSet = 'unchanged'; // Default status

        if (editedFiles.has(file.path)) {
            const fileState = editedFiles.get(file.path);
            contentToLoad = fileState.content;

            if (fileState.savedInSession) { // If explicitly saved in this session
                statusToSet = fileState.isPatched ? 'patched_saved' : 'saved';
            } else { // Not yet saved in this session (or an edit occurred after save)
                if (file.entryHandle) { // Existing file
                    // For unsaved existing files, compare with original to refine "unsaved" vs "patched_unsaved"
                    const originalContent = await fileSystem.readFileContent(file.entryHandle, file.path); // Read original
                    if (contentToLoad === originalContent && !fileState.isPatched) {
                        statusToSet = 'unchanged'; // Content matches original, not patched
                    } else if (fileState.isPatched) {
                        statusToSet = 'patched_unsaved'; // Patched and not yet "saved" this session
                    } else {
                        statusToSet = 'unsaved'; // Manually changed from original, not "saved" this session
                    }
                } else { // New file (no entryHandle)
                    // New files are effectively patched (content from CAPCA) and need a save to acknowledge
                    statusToSet = 'patched_unsaved';
                }
            }
        } else if (file.entryHandle) { // Original file, not in editedFiles map yet (first open)
            contentToLoad = await fileSystem.readFileContent(file.entryHandle, file.path);
            // Store initial state in editedFiles as unchanged and not saved in session yet.
            // This helps if the user edits it later.
            editedFiles.set(file.path, {
                content: contentToLoad,
                isPatched: false,
                savedInSession: false // Or true if 'unchanged' should mean 'saved' implicitly on open
            });
            statusToSet = 'unchanged';
        } else {
            console.error(`File ${file.path} has no entryHandle and is not in editedFiles. Cannot open.`);
            contentToLoad = `// Error: Could not load content for new file ${file.path}.`;
            statusToSet = 'error';
            errorHandler.showError({
                name: "FileOpenError",
                message: `Could not load content for ${file.path}. New file missing from editor state.`
            });
        }

        elements.editorContent.value = contentToLoad;
        setEditorStatus(statusToSet);
        elements.editorContent.focus();

    } catch (err) {
        console.error(`Error opening file '${file.path}':`, err);
        setEditorStatus('error', err.message);
        elements.editorContent.value = `Error loading file: ${err.message}`;
        errorHandler.showError({
            name: err.name || "FileOpenError",
            message: `Failed to open file: ${file.name || file.path}. ${err.message}`,
            stack: err.stack,
            cause: err,
            path: file.path
        });
    }
}

function saveFileChanges() {
    if (!appState.currentEditingFile) return;

    const filePath = appState.currentEditingFile.path;
    const currentEditorContent = elements.editorContent.value;

    const fileState = editedFiles.get(filePath) || { isPatched: false }; // Get existing or default patch state
    editedFiles.set(filePath, {
        content: currentEditorContent,
        isPatched: fileState.isPatched, // Preserve original patched status
        savedInSession: true // Mark as saved for this session
    });

    setEditorStatus(fileState.isPatched ? 'patched_saved' : 'saved');
    notificationSystem.showNotification(`Changes for ${appState.currentEditingFile.name} confirmed in browser memory.`);
}

function closeEditor() {
    // Optional: Check for unsaved changes (where fileState.savedInSession is false)
    if (appState.currentEditingFile) {
        const fileState = editedFiles.get(appState.currentEditingFile.path);
        if (fileState && !fileState.savedInSession && elements.editorStatus.textContent.toLowerCase().includes('unsaved')) {
            // Example: Basic confirm, could be a custom modal
            // if (!confirm("You have unsaved changes. Are you sure you want to close? Your changes will remain in memory for this session but won't be 'saved' for next open.")) {
            //     return;
            // }
            // For now, allow close, changes are kept in editedFiles map.
        }
    }
    elements.fileEditor.style.display = 'none';
    appState.currentEditingFile = null;
}

export function setEditorStatus(statusKey, message = '') {
    const statusEl = elements.editorStatus;
    statusEl.className = 'editor-status';

    let textContent = '';
    let disableSave = true;

    switch (statusKey) {
        case 'loading':
            textContent = 'LOADING...';
            statusEl.classList.add(`status-loading`);
            break;
        case 'unchanged':
            textContent = 'UNCHANGED';
            statusEl.classList.add(`status-unchanged`);
            // For an unchanged file, save is typically disabled, but allow if it's to mark as "saved in session"
            // For simplicity, let's allow save if user wants to explicitly mark it.
            // If you want it disabled: disableSave = true;
            disableSave = true; // More logical for "unchanged"
            break;
        case 'unsaved': // Manually edited, OR patched & unsaved
            textContent = 'UNSAVED';
            const currentFile = appState.currentEditingFile ? editedFiles.get(appState.currentEditingFile.path) : null;
            if (currentFile && currentFile.isPatched && !currentFile.savedInSession) {
                textContent = 'PATCHED (Unsaved)';
            } else if (currentFile && !currentFile.isPatched && !currentFile.savedInSession) {
                textContent = 'UNSAVED (Manual)';
            }
            statusEl.classList.add(`status-unsaved`);
            disableSave = false;
            break;
        case 'saved': // Manual edits "saved in session"
            textContent = 'SAVED (Manual)';
            statusEl.classList.add(`status-saved`);
            break;
        case 'patched_unsaved': // Explicitly set by CAPCA application
            textContent = 'PATCHED (Unsaved)';
            statusEl.classList.add(`status-unsaved`);
            disableSave = false;
            break;
        case 'patched_saved': // Patched by AI, and user clicked "Save (In Browser)"
            textContent = 'PATCHED (Saved)';
            statusEl.classList.add(`status-saved`);
            break;
        case 'error':
            textContent = `ERROR: ${message}`;
            statusEl.classList.add(`status-error`);
            break;
        default:
            textContent = statusKey;
    }
    statusEl.textContent = textContent;
    elements.saveEditorBtn.disabled = disableSave;
}

export function hasEditedContent(filePath) {
    return editedFiles.has(filePath);
}

export function getEditedContent(filePath) {
    return editedFiles.get(filePath)?.content;
}

export function getAllEditedFiles() {
    return editedFiles;
}

// When CAPCA applies a patch OR creates a new file
export function setEditedContent(filePath, content, wasPatched = false) {
    const existingState = editedFiles.get(filePath) || {};
    editedFiles.set(filePath, {
        content: content,
        isPatched: existingState.isPatched || wasPatched,
        savedInSession: false // New patch or new file means it's not "saved" in this state yet
    });

    if (appState.currentEditingFile && appState.currentEditingFile.path === filePath) {
        elements.editorContent.value = content;
        // If it was patched, status is 'patched_unsaved'. If created, it's also 'patched_unsaved'
        setEditorStatus('patched_unsaved');
    }
}

export function isPatched(filePath) {
    return editedFiles.get(filePath)?.isPatched || false;
}
// --- ENDFILE: js/fileEditor.js --- //