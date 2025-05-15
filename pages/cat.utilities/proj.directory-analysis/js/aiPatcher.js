// --- FILE: js/aiPatcher.js --- //
import { appState, elements } from './main.js';
import * as fileSystem from 'fileSystem';
import * as fileEditor from 'fileEditor';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as combineMode from 'combineMode';
import * as utils from './utils.js';
import * as treeView from './treeView.js'; // IMPORT treeView

// Holds the queue of patch operations to be reviewed one by one
let patchQueue = [];
let currentPatchBeingReviewed = null; // { filePath, originalContent, patchedContent, patchOp, isNewFile, log }

function parsePatchInstructions(patchJsonString) {
    try {
        const patches = JSON.parse(patchJsonString);
        if (!Array.isArray(patches)) {
            throw new Error("Patch instructions should be a JSON array.");
        }
        patches.forEach(op => {
            if (typeof op.file !== 'string' || typeof op.operation !== 'string') {
                throw new Error("Each patch must have 'file' and 'operation' string properties.");
            }
            switch (op.operation) {
                case 'create_file_with_content':
                    if (typeof op.newText !== 'string') {
                        throw new Error("'create_file_with_content' operation requires 'newText' property.");
                    }
                    break;
                case 'replace_segment_after_anchor':
                case 'insert_text_after_anchor':
                case 'delete_segment_after_anchor':
                    if (typeof op.anchorText !== 'string') {
                        throw new Error(`Operation '${op.operation}' requires 'anchorText'.`);
                    }
                    if (op.operation !== 'insert_text_after_anchor' && typeof op.segmentToAffect !== 'string') {
                        throw new Error(`Operation '${op.operation}' requires 'segmentToAffect'.`);
                    }
                    if (op.operation !== 'delete_segment_after_anchor' && typeof op.newText !== 'string') {
                        throw new Error(`Operation '${op.operation}' requires 'newText'.`);
                    }
                    break;
                default:
                    throw new Error(`Unsupported operation type: '${op.operation}'.`);
            }
        });
        return patches;
    } catch (error) {
        console.error("Error parsing CAPCA patch JSON:", error);
        errorHandler.showError({
            name: "PatchParseError", message: `Invalid CAPCA patch JSON: ${error.message}`, stack: error.stack
        });
        return null;
    }
}

function findRobustAnchorIndex(content, anchorText, originalLineHint = 1, windowLines = 10) {
    if (!anchorText || anchorText.length === 0) return 0;
    const normalizedContent = content.replace(/\r\n/g, "\n");
    const normalizedAnchorText = anchorText.replace(/\r\n/g, "\n");
    const contentLines = normalizedContent.split('\n');
    const anchorLines = normalizedAnchorText.split('\n');
    const firstAnchorLine = anchorLines[0];
    const hintLineIndex = originalLineHint - 1;
    const searchStartLine = Math.max(0, hintLineIndex - windowLines);
    const searchEndLine = Math.min(contentLines.length, hintLineIndex + windowLines + anchorLines.length);

    for (let i = searchStartLine; i < searchEndLine; i++) {
        if (contentLines[i] !== undefined && contentLines[i].includes(firstAnchorLine)) {
            if (anchorLines.length === 1) {
                let charOffset = 0;
                for (let k = 0; k < i; k++) charOffset += contentLines[k].length + 1;
                return charOffset + contentLines[i].indexOf(firstAnchorLine);
            }
            let fullMatch = true;
            for (let j = 1; j < anchorLines.length; j++) {
                if ((i + j) >= contentLines.length || contentLines[i + j] !== anchorLines[j]) {
                    fullMatch = false;
                    break;
                }
            }
            if (fullMatch) {
                let charOffset = 0;
                for (let k = 0; k < i; k++) charOffset += contentLines[k].length + 1;
                return charOffset + contentLines[i].indexOf(firstAnchorLine);
            }
        }
    }
    const globalIndex = normalizedContent.indexOf(normalizedAnchorText);
    return globalIndex;
}

async function calculateProposedChange(filePath, patchOp, currentBatchFileStates = new Map()) {
    let rawOriginalContent = "";
    let contentToProcess = "";
    let isNewFile = false;
    let logEntry = "";
    const basePathForState = filePath;

    if (patchOp.operation === 'create_file_with_content') {
        const existingFile = appState.fullScanData?.allFilesList.find(f => f.path === basePathForState);
        if (existingFile || currentBatchFileStates.has(basePathForState)) {
            return { success: false, log: `  - Op: create_file. Error: File '${basePathForState}' already exists (or was created in this batch).`, originalContent: "", patchedContent: "" };
        }
        isNewFile = true;
        const normalizedNewText = patchOp.newText.replace(/\r\n/g, "\n");
        logEntry = `  - Op: create_file. Proposed content for new file '${basePathForState}'.`;
        const proposed = { success: true, log: logEntry, originalContent: "", patchedContent: normalizedNewText, isNewFile };
        currentBatchFileStates.set(basePathForState, proposed.patchedContent);
        return proposed;
    }

    if (currentBatchFileStates.has(basePathForState)) {
        contentToProcess = currentBatchFileStates.get(basePathForState);
        rawOriginalContent = contentToProcess; 
    } else if (fileEditor.hasEditedContent(basePathForState)) {
        rawOriginalContent = fileEditor.getEditedContent(basePathForState);
        contentToProcess = rawOriginalContent.replace(/\r\n/g, "\n");
    } else {
        const fileData = appState.fullScanData?.allFilesList.find(f => f.path === basePathForState);
        if (!fileData) {
            return { success: false, log: `  - Op: ${patchOp.operation}. Error: File '${basePathForState}' not found.`, originalContent: "", patchedContent: "" };
        }
        try {
            rawOriginalContent = await fileSystem.readFileContent(fileData.entryHandle, basePathForState);
            contentToProcess = rawOriginalContent.replace(/\r\n/g, "\n");
        } catch (e) {
            return { success: false, log: `  - Error reading original content for '${basePathForState}': ${e.message}`, originalContent: "", patchedContent: "" };
        }
    }
    
    const originalContentForDiff = contentToProcess;
    let proposedContentNormalized = contentToProcess;

    const normalizedAnchorText = patchOp.anchorText.replace(/\r\n/g, "\n");
    const normalizedSegmentToAffect = patchOp.segmentToAffect ? patchOp.segmentToAffect.replace(/\r\n/g, "\n") : "";
    const normalizedNewText = patchOp.newText ? patchOp.newText.replace(/\r\n/g, "\n") : "";

    if (patchOp.operation === 'replace_segment_after_anchor' ||
        patchOp.operation === 'insert_text_after_anchor' ||
        patchOp.operation === 'delete_segment_after_anchor') {

        let anchorIndex = findRobustAnchorIndex(contentToProcess, normalizedAnchorText, patchOp.originalLineOfAnchor || 1);
        if (anchorIndex === -1) {
            logEntry = `  - Op: ${patchOp.operation}. Error: Anchor text "${shorten(normalizedAnchorText)}" not found in '${basePathForState}'.`;
            return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
        }
        const afterAnchorIndex = anchorIndex + normalizedAnchorText.length;

        if (patchOp.operation === 'insert_text_after_anchor') {
            proposedContentNormalized = contentToProcess.substring(0, afterAnchorIndex) +
                                        normalizedNewText +
                                        contentToProcess.substring(afterAnchorIndex);
            logEntry = `  - Op: insert_text_after_anchor. Success: Inserted text after anchor "${shorten(normalizedAnchorText)}".`;
        } else { 
            const segmentStartIndex = contentToProcess.indexOf(normalizedSegmentToAffect, afterAnchorIndex);
            const leniencyChars = patchOp.leniencyChars === undefined ? 5 : patchOp.leniencyChars;
            if (normalizedSegmentToAffect.length > 0 && (segmentStartIndex === -1 || segmentStartIndex > afterAnchorIndex + leniencyChars )) {
                const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                logEntry = `  - Op: ${patchOp.operation}. Error: Segment "${shorten(normalizedSegmentToAffect)}" not found sufficiently close after anchor "${shorten(normalizedAnchorText)}". Expected around index ${afterAnchorIndex} (within ${leniencyChars} chars), first match at ${segmentStartIndex}. Content after anchor: "${shorten(foundInstead, 40)}..."`;
                return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
            }

            if (patchOp.operation === 'replace_segment_after_anchor') {
                 if (normalizedSegmentToAffect.length === 0 && normalizedNewText.length > 0) {
                    proposedContentNormalized = contentToProcess.substring(0, afterAnchorIndex) +
                                                normalizedNewText +
                                                contentToProcess.substring(afterAnchorIndex);
                    logEntry = `  - Op: replace_segment_after_anchor (as insert). Success: Inserted text as 'segmentToAffect' was empty.`;
                 } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex !== -1 && segmentStartIndex <= afterAnchorIndex + leniencyChars) {
                    proposedContentNormalized = contentToProcess.substring(0, segmentStartIndex) +
                                                normalizedNewText +
                                                contentToProcess.substring(segmentStartIndex + normalizedSegmentToAffect.length);
                    logEntry = `  - Op: replace_segment_after_anchor. Success: Replaced segment "${shorten(normalizedSegmentToAffect)}".`;
                 } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex === -1) {
                    const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                    logEntry = `  - Op: ${patchOp.operation}. Error: Non-empty segment "${shorten(normalizedSegmentToAffect)}" not found close after anchor "${shorten(normalizedAnchorText)}". Content after anchor: "${shorten(foundInstead, 40)}..."`;
                    return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
                 } else { 
                    logEntry = `  - Op: replace_segment_after_anchor. Info: 'segmentToAffect' and 'newText' were empty. No change.`;
                 }
            } else if (patchOp.operation === 'delete_segment_after_anchor') {
                if (normalizedSegmentToAffect.length === 0) {
                    logEntry = `  - Op: delete_segment_after_anchor. Info: 'segmentToAffect' was empty, no change made.`;
                } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex !== -1 && segmentStartIndex <= afterAnchorIndex + leniencyChars) {
                    proposedContentNormalized = contentToProcess.substring(0, segmentStartIndex) +
                                                contentToProcess.substring(segmentStartIndex + normalizedSegmentToAffect.length);
                    logEntry = `  - Op: delete_segment_after_anchor. Success: Deleted segment "${shorten(normalizedSegmentToAffect)}".`;
                } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex === -1) {
                    // Corrected variable name below: anchorIndex to afterAnchorIndex
                    const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                    logEntry = `  - Op: ${patchOp.operation}. Error: Non-empty segment "${shorten(normalizedSegmentToAffect)}" not found close after anchor "${shorten(normalizedAnchorText)}". Content after anchor: "${shorten(foundInstead,40)}..."`;
                    return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
                }
            }
        }
    } else {
        logEntry = `  - Op: ${patchOp.operation}. Error: Unknown CAPCA operation type for existing file.`;
        return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
    }

    if (proposedContentNormalized !== originalContentForDiff) {
        currentBatchFileStates.set(basePathForState, proposedContentNormalized);
    }
    return { success: true, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized, isNewFile };
}

function showNextPatchInModal() {
    if (patchQueue.length === 0) {
        elements.aiPatchOutputLog.textContent += "\n\nAll patches reviewed.";
        notificationSystem.showNotification("All patches reviewed.", { duration: 3000 });
        currentPatchBeingReviewed = null;
        return;
    }
    currentPatchBeingReviewed = patchQueue.shift();
    const { filePath, originalContent, patchedContent, patchOp } = currentPatchBeingReviewed;
    const dmp = new window.diff_match_patch(); // Ensure it's using the global
    elements.diffFilePath.textContent = `${filePath} (${patchOp.operation})`;
    if (patchOp.operation === 'create_file_with_content') {
        elements.diffOutputContainer.innerHTML = `<p><b>PROPOSED NEW FILE CONTENT:</b></p><pre style="background:#e6ffe6; padding:5px;">${escapeHtml(patchedContent)}</pre>`;
    } else {
        const diff = dmp.diff_main(originalContent, patchedContent);
        dmp.diff_cleanupSemantic(diff);
        elements.diffOutputContainer.innerHTML = dmp.diff_prettyHtml(diff);
    }
    elements.aiPatchDiffModal.style.display = 'block';
}

function closeDiffModalAndProceed(applyChange) {
    if (!currentPatchBeingReviewed) return;
    const { filePath, patchedContent, patchOp, isNewFile, log } = currentPatchBeingReviewed;

    if (applyChange) {
        elements.aiPatchOutputLog.textContent += `\nUser ACTION: Applied - ${filePath} for operation ${patchOp.operation}.\n  Details: ${log || "Content set."}\n`;
        if (isNewFile) {
             if (appState.fullScanData && appState.fullScanData.allFilesList && !appState.fullScanData.allFilesList.find(f => f.path === filePath)) {
                const newFileEntry = { // This is the fileInfo object for the tree
                    name: filePath.substring(filePath.lastIndexOf('/') + 1),
                    path: filePath,
                    type: 'file', // Explicitly set type
                    size: patchedContent.length,
                    extension: utils.getFileExtension(filePath),
                    entryHandle: null, // New files don't have an original FileSystemHandle from scan
                    depth: (filePath.match(/\//g) || []).length - (appState.fullScanData.directoryData.name.match(/\//g) || []).length // Depth relative to scanned root
                };
                // Adjust depth if root itself has slashes (less common for root name but possible)
                if (appState.fullScanData.directoryData.path === filePath.substring(0, appState.fullScanData.directoryData.path.length) && filePath.includes('/')) {
                    // Depth is count of slashes after the root path part
                    const relativePath = filePath.substring(appState.fullScanData.directoryData.path.length + 1);
                    newFileEntry.depth = (relativePath.match(/\//g) || []).length + 1;
                } else if (!filePath.includes('/')) { // file in root, e.g. "new_file.txt" when root is "project_name"
                     newFileEntry.depth = 1;
                } else { // file in subfolder, e.g. "project_name/sub/new_file.txt"
                    const rootParts = appState.fullScanData.directoryData.path.split('/').length;
                    const fileParts = filePath.split('/').length;
                    newFileEntry.depth = fileParts - rootParts;

                }

                appState.fullScanData.allFilesList.push(newFileEntry); // Add to the master list of all files
                treeView.addFileToTree(newFileEntry); // <<<< CALL TO UPDATE THE TREE
                console.log(`File ${filePath} created virtually and added to tree. Tree refresh needed for full visibility if parent was collapsed.`);
                notificationSystem.showNotification(`File ${filePath} created.`, {duration: 2500});
             }
        }
        fileEditor.setEditedContent(filePath, patchedContent, true);
        if (appState.currentEditingFile && appState.currentEditingFile.path === filePath) {
            fileEditor.setEditorStatus('patched_unsaved');
        }
        if (appState.isCombineMode) combineMode.updateCombineModeListDisplay(); // Ensure combine mode reflects it
    } else {
        elements.aiPatchOutputLog.textContent += `\nUser ACTION: Skipped - ${filePath} for operation ${patchOp.operation}.\n`;
    }
    elements.aiPatchDiffModal.style.display = 'none';
    currentPatchBeingReviewed = null;
    showNextPatchInModal();
}

export async function processPatches(patchInstructions) {
    if (!patchInstructions || patchInstructions.length === 0) {
        elements.aiPatchOutputLog.textContent = "No patch instructions provided."; return;
    }
    const hasNonCreateOps = patchInstructions.some(p => p.operation !== 'create_file_with_content');
    if (hasNonCreateOps && (!appState.fullScanData || !appState.fullScanData.allFilesList)) {
        elements.aiPatchOutputLog.textContent = "Error: No directory scanned or file list unavailable. Load a directory first.";
        return;
    }
    elements.aiPatchOutputLog.textContent = "Preparing patches for review...\n";
    patchQueue = [];
    let initialLog = "";
    let successfullyPreparedCount = 0;
    let currentBatchFileStates = new Map();
    for (const patchOp of patchInstructions) {
        const filePath = patchOp.file;
        const result = await calculateProposedChange(filePath, patchOp, currentBatchFileStates);
        initialLog += `\nFile: ${filePath} (${patchOp.operation})\n${result.log}\n`;
        if (result.success || (patchOp.operation === 'create_file_with_content' && result.success)) {
            if (patchOp.operation === 'create_file_with_content' || result.originalContent !== result.patchedContent) {
                patchQueue.push({ ...result, filePath, patchOp }); // Ensure all relevant fields (isNewFile etc) from result are passed
                successfullyPreparedCount++;
            } else {
                 initialLog += "  - Info: No effective change proposed by this operation (content identical).\n";
            }
        }
    }
    elements.aiPatchOutputLog.textContent = initialLog + `\n--- Prepared ${successfullyPreparedCount} patches for review. ---\n`;
    if (patchQueue.length > 0) {
        showNextPatchInModal();
    } else {
        notificationSystem.showNotification("No changes to review or all patches failed.", { duration: 4000 });
    }
}

function shorten(text, maxLength = 30) {
    if (typeof text !== 'string') return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&") // Corrected from &
         .replace(/</g, "<")  // Corrected from <
         .replace(/>/g, ">")  // Corrected from >
         .replace(/"/g, "&quot;")
         .replace(/'/g, "'"); // Corrected from '
}

export function initAiPatcher() {
    elements.applyAiPatchBtn.addEventListener('click', () => {
        const patchJson = elements.aiPatchInput.value;
        if (!patchJson.trim()) {
            notificationSystem.showNotification("Patch input is empty.", {duration: 3000});
            elements.aiPatchOutputLog.textContent = "Patch input empty.";
            return;
        }
        const parsedInstructions = parsePatchInstructions(patchJson);
        if (parsedInstructions) {
            processPatches(parsedInstructions);
        } else {
             elements.aiPatchOutputLog.textContent = "Failed to parse CAPCA patches. Check format/errors.";
        }
    });
    elements.closeAiPatchDiffModal.addEventListener('click', () => closeDiffModalAndProceed(false));
    elements.confirmApplyPatchChanges.addEventListener('click', () => closeDiffModalAndProceed(true));
    elements.skipPatchChanges.addEventListener('click', () => closeDiffModalAndProceed(false));
    elements.cancelAllPatchChanges.addEventListener('click', () => {
        patchQueue = [];
        closeDiffModalAndProceed(false); // Closes current modal without applying
        elements.aiPatchOutputLog.textContent += "\n\nUser ACTION: Cancelled all remaining patches.\n";
        notificationSystem.showNotification("All remaining patches cancelled.", { duration: 3000 });
    });
}
// --- ENDFILE: js/aiPatcher.js --- //