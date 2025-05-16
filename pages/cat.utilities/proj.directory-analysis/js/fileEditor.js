// --- FILE: js/fileEditor.js --- //
import { appState, elements } from './main.js';
import * as fileSystem from 'fileSystem';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import { getFileExtension } from './utils.js';

const editedFiles = new Map();
let cmOnChangeHandler = null; // To store and manage the change handler

// Helper to get CodeMirror mode from file extension
function getCodeMirrorMode(filePath) {
    const extension = getFileExtension(filePath);
    switch (extension) {
        case '.js': case '.mjs': case '.json': return { name: "javascript", json: extension === '.json' };
        case '.ts': case '.tsx': return "text/typescript";
        case '.css': return "text/css";
        case '.html': case '.htm': case '.xml': return "htmlmixed";
        case '.md': return "text/markdown";
        case '.py': return "text/x-python";
        case '.java': return "text/x-java";
        case '.c': case '.h': case '.cpp': case '.hpp': return "text/x-c++src";
        case '.cs': return "text/x-csharp";
        default: return "text/plain";
    }
}

export function initFileEditor() {
    if (typeof CodeMirror !== 'undefined') {
        appState.editorInstance = CodeMirror(elements.editorContent, {
            lineNumbers: true,
            theme: "material-darker",
            mode: "text/plain",
            gutters: ["CodeMirror-linenumbers"],
            autoCloseBrackets: true,
            matchBrackets: true,
            styleActiveLine: true,
        });

        // Define the change handler
        cmOnChangeHandler = (cmInstance, changeObj) => {
            // Ignore programmatic changes during file loading
            if (changeObj.origin === 'setValue' && appState.isLoadingFileContent) {
                return;
            }
            if (appState.currentEditingFile) {
                const fileState = editedFiles.get(appState.currentEditingFile.path) || { content: '', isPatched: false, savedInSession: false };
                editedFiles.set(appState.currentEditingFile.path, {
                    ...fileState,
                    content: cmInstance.getValue(),
                    savedInSession: false
                });
                setEditorStatus('unsaved');
            }
        };

        appState.editorInstance.on('change', cmOnChangeHandler);

        appState.editorInstance.setOption("extraKeys", {
            "Ctrl-S": function(cm) { saveFileChanges(); },
            "Cmd-S": function(cm) { saveFileChanges(); }
        });

    } else {
        console.error("CodeMirror library not loaded. File editor will not function correctly.");
        elements.editorContent.textContent = "Error: Code editor library not loaded.";
    }

    elements.saveEditorBtn.addEventListener('click', saveFileChanges);
    elements.closeEditorBtn.addEventListener('click', closeEditor);
}

export async function openFileInEditor(file) {
    console.log(`[FileEditor] Attempting to open: ${file.path}, Type: ${file.entryHandle ? 'Existing File' : 'New/Virtual File'}`);
    appState.isLoadingFileContent = true; // Flag to ignore CM change event

    try {
        appState.currentEditingFile = file;
        setEditorStatus('loading');
        elements.editorFileTitle.textContent = `EDITING: ${file.name}`;
        elements.editorInfo.textContent = `Path: ${file.path}`;
        elements.fileEditor.style.display = 'flex';

        // Set "Loading file..." without triggering our custom change handler logic
        if (appState.editorInstance) {
            console.log("[FileEditor] Programmatically setting editor to 'Loading file...'");
            appState.editorInstance.setValue('Loading file...'); // This will still trigger CM's internal 'setValue' origin
        } else {
            console.warn("[FileEditor] appState.editorInstance is null when trying to set 'Loading file...'");
            elements.editorContent.textContent = 'Loading file...'; // Fallback if CM not ready
        }

        let contentToLoad = "// Content not loaded //";
        let statusToSet = 'error';

        if (editedFiles.has(file.path)) {
            const fileState = editedFiles.get(file.path);
            // IMPORTANT: Use the cached content, not the "Loading file..." placeholder
            contentToLoad = fileState.content;
            console.log(`[FileEditor] Found in editedFiles. Cached content length: ${contentToLoad?.length}. Patched: ${fileState.isPatched}, SavedInSession: ${fileState.savedInSession}`);

            if (fileState.savedInSession) {
                statusToSet = fileState.isPatched ? 'patched_saved' : 'saved';
            } else {
                if (file.entryHandle) { // If it's an existing file, compare current cached content to original
                    const originalContent = await fileSystem.readFileContent(file.entryHandle, file.path, true); // forceOriginal=true
                    if (contentToLoad === originalContent && !fileState.isPatched) {
                        statusToSet = 'unchanged';
                    } else if (fileState.isPatched) {
                        statusToSet = 'patched_unsaved';
                    } else { // Manually changed from original, not saved in session
                        statusToSet = 'unsaved';
                    }
                } else { // New file, not saved in session
                    statusToSet = fileState.isPatched ? 'patched_unsaved' : 'unsaved';
                }
            }
        } else if (file.entryHandle) { // File not in cache, read from disk
            console.log(`[FileEditor] Not in editedFiles, reading from entryHandle for: ${file.path}`);
            contentToLoad = await fileSystem.readFileContent(file.entryHandle, file.path, true); // forceOriginal=true
            console.log(`[FileEditor] Read from entryHandle. Content length: ${contentToLoad?.length}`);
            // Add to cache *after* reading
            editedFiles.set(file.path, {
                content: contentToLoad,
                isPatched: false,
                savedInSession: false // It's fresh from disk, not "saved" by user action yet
            });
            statusToSet = 'unchanged';
        } else { // New file not in editedFiles and no handle (should have been added by create_file_with_content)
            console.error(`[FileEditor] CRITICAL: File ${file.path} has no entryHandle and is NOT in editedFiles. This indicates a previous step might have failed to register it.`);
            contentToLoad = `// Error: Could not load content for new file ${file.path}. File not found in editor's cache.`;
            statusToSet = 'error';
            errorHandler.showError({
                name: "FileOpenConsistencyError",
                message: `Could not load content for ${file.path}. New file missing from editor state cache.`
            });
        }

        console.log(`[FileEditor] About to set final editor content for ${file.path}. Status to set: ${statusToSet}. Content length: ${contentToLoad ? contentToLoad.length : 'undefined'}.`);
        if (appState.editorInstance) {
            appState.editorInstance.setValue(contentToLoad || "// Error: Content was unexpectedly empty after loading logic.");
            const mode = getCodeMirrorMode(file.path);
            console.log(`[FileEditor] Setting CodeMirror mode to:`, mode);
            appState.editorInstance.setOption("mode", mode);

            setTimeout(() => {
                if (elements.fileEditor.style.display === 'flex' && appState.editorInstance) {
                    appState.editorInstance.refresh();
                    appState.editorInstance.focus();
                }
            }, 100);
        } else {
             console.error("[FileEditor] appState.editorInstance is null when trying to set final content.");
        }
        setEditorStatus(statusToSet);

    } catch (err) {
        console.error(`[FileEditor] Error in openFileInEditor for '${file.path}':`, err);
        setEditorStatus('error', err.message);
        if (appState.editorInstance) appState.editorInstance.setValue(`Error loading file: ${err.message}`);
        else if (elements.editorContent.firstChild && elements.editorContent.firstChild.CodeMirror) {
            // If CM was attached to the div directly
            elements.editorContent.firstChild.CodeMirror.setValue(`Error loading file: ${err.message}`);
        } else {
            elements.editorContent.textContent = `Error loading file: ${err.message}`;
        }
        errorHandler.showError({
            name: err.name || "FileOpenError",
            message: `Failed to open file: ${file.name || file.path}. ${err.message}`,
            stack: err.stack, cause: err, path: file.path
        });
    } finally {
        appState.isLoadingFileContent = false; // Re-enable CM change handler logic
        console.log("[FileEditor] isLoadingFileContent set to false.");
    }
}


function saveFileChanges() {
    if (!appState.currentEditingFile || !appState.editorInstance) return;

    const filePath = appState.currentEditingFile.path;
    const currentEditorContent = appState.editorInstance.getValue();

    const fileState = editedFiles.get(filePath) || { isPatched: false };
    editedFiles.set(filePath, {
        content: currentEditorContent,
        isPatched: fileState.isPatched,
        savedInSession: true
    });

    setEditorStatus(fileState.isPatched ? 'patched_saved' : 'saved');
    notificationSystem.showNotification(`Changes for ${appState.currentEditingFile.name} confirmed in browser memory.`);
}

function closeEditor() {
    if (appState.currentEditingFile) {
        const fileState = editedFiles.get(appState.currentEditingFile.path);
        // Note: No confirmation for unsaved changes, as per handoff doc (changes are kept in memory)
    }
    elements.fileEditor.style.display = 'none';
    if (appState.editorInstance) appState.editorInstance.setValue('');
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
            disableSave = true;
            break;
        case 'unsaved':
            const currentFile = appState.currentEditingFile ? editedFiles.get(appState.currentEditingFile.path) : null;
            if (currentFile && currentFile.isPatched && !currentFile.savedInSession) {
                textContent = 'PATCHED (Unsaved)';
            } else if (currentFile && !currentFile.isPatched && !currentFile.savedInSession) {
                textContent = 'UNSAVED (Manual)';
            } else { // Generic unsaved, or if currentFile state is unusual
                textContent = 'UNSAVED';
            }
            statusEl.classList.add(`status-unsaved`);
            disableSave = false;
            break;
        case 'saved':
            textContent = 'SAVED (Manual)';
            statusEl.classList.add(`status-saved`);
            // After saving, disable save button until further changes
            disableSave = true;
            break;
        case 'patched_unsaved':
            textContent = 'PATCHED (Unsaved)';
            statusEl.classList.add(`status-unsaved`);
            disableSave = false;
            break;
        case 'patched_saved':
            textContent = 'PATCHED (Saved)';
            statusEl.classList.add(`status-saved`);
            disableSave = true;
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

export function setEditedContent(filePath, content, wasPatched = false) {
    const existingState = editedFiles.get(filePath) || {};
    editedFiles.set(filePath, {
        content: content,
        isPatched: existingState.isPatched || wasPatched,
        savedInSession: false
    });

    if (appState.currentEditingFile && appState.currentEditingFile.path === filePath && appState.editorInstance) {
        appState.isLoadingFileContent = true; // Prevent CM change handler during this setValue
        appState.editorInstance.setValue(content);
        appState.editorInstance.setOption("mode", getCodeMirrorMode(filePath));
        appState.isLoadingFileContent = false;
        setEditorStatus('patched_unsaved');
    }
}

export function isPatched(filePath) {
    return editedFiles.get(filePath)?.isPatched || false;
}
// --- ENDFILE: js/fileEditor.js --- //