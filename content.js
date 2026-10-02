// content.js - The core logic for the Invisible Autocorrect extension.

// --- Main Function ---
// This function sets up the event listener for the entire document.
function setupAutocorrectListener() {
    // We are listening for the 'keyup' event on the whole body. This allows us
    // to capture typing in almost any text input field on any webpage.
    document.body.addEventListener('keyup', handleKeyUp);
}


// --- Load validWords.js ---
// Make sure validWords.js is loaded before content.js in manifest.json

// --- Updated autocorrect logic ---
// Skip autocorrect if the word is valid
function handleKeyUp(event) {
    if (event.key !== ' ') {
        return;
    }
    const activeElement = event.target;
    if (activeElement.tagName.toLowerCase() !== 'textarea' && activeElement.type !== 'text' && activeElement.type !== 'search' && !activeElement.isContentEditable) {
        return;
    }
    const isValueField = typeof activeElement.value === 'string';
    const raw = isValueField ? activeElement.value : activeElement.textContent;
    // The space just typed is at the end of the field; grab the word that sits
    // immediately before that trailing whitespace.
    const match = raw.match(/(\S+)(\s+)$/);
    if (!match) {
        return;
    }
    const wordToCheck = match[1];
    const lower = wordToCheck.toLowerCase();
    // Skip autocorrect if the word is already valid.
    if (typeof validWords !== 'undefined' && validWords.has(lower)) {
        return;
    }
    if (correctionMap[lower]) {
        const correctedWord = matchCase(wordToCheck, correctionMap[lower]);
        // Replace ONLY the last word, keeping everything before it (including
        // newlines and multiple spaces) and the exact trailing whitespace.
        // Rewriting the whole field would otherwise collapse all whitespace.
        const wordStart = raw.length - match[0].length;
        const newText = raw.slice(0, wordStart) + correctedWord + match[2];
        if (isValueField) {
            activeElement.value = newText;
            try {
                activeElement.selectionStart = activeElement.selectionEnd = newText.length;
            } catch (e) { /* some input types disallow selection */ }
        } else {
            activeElement.textContent = newText;
            moveCursorToEnd(activeElement);
        }
        // Track autocorrect for undo
        lastAutocorrect = {
            element: activeElement,
            originalWord: wordToCheck,
            correctedWord: correctedWord,
            timestamp: Date.now()
        };
    }
}

// --- Helper Function: Case Matching ---
// This ensures that if the user typed "Teh", it gets corrected to "The", not "the".
function matchCase(originalWord, correctedWord) {
    if (originalWord.length === 0 || correctedWord.length === 0) {
        return correctedWord;
    }

    // All caps
    if (originalWord === originalWord.toUpperCase()) {
        return correctedWord.toUpperCase();
    }
    
    // Title case (first letter capitalized)
    if (originalWord[0] === originalWord[0].toUpperCase()) {
        return correctedWord.charAt(0).toUpperCase() + correctedWord.slice(1);
    }

    // Default to lowercase
    return correctedWord;
}

// --- Helper Function: Move Cursor ---
// In 'contentEditable' elements, setting textContent moves the cursor to the start.
// This function moves it back to the end for a seamless experience.
function moveCursorToEnd(element) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);

    // Collapse the range to the end point. 
    // false means collapse to the end, true would be to the start.
    range.collapse(false); 
    
    selection.removeAllRanges();
    selection.addRange(range);
}

// --- Undo Autocorrect Feature ---
let lastAutocorrect = {
    element: null,
    originalWord: null,
    correctedWord: null,
    position: null,
    timestamp: null
};

document.body.addEventListener('keydown', function(event) {
    if (event.key === 'Backspace' && lastAutocorrect.element) {
        const activeElement = document.activeElement;
        if (activeElement === lastAutocorrect.element) {
            const isValueField = typeof activeElement.value === 'string';
            const raw = isValueField ? activeElement.value : activeElement.textContent;
            const match = raw.match(/(\S+)(\s+)$/);
            // Only undo if the last word is still the word we just corrected.
            if (match && match[1] === lastAutocorrect.correctedWord) {
                const wordStart = raw.length - match[0].length;
                const newText = raw.slice(0, wordStart) + lastAutocorrect.originalWord + match[2];
                if (isValueField) {
                    activeElement.value = newText;
                    try {
                        activeElement.selectionStart = activeElement.selectionEnd = newText.length;
                    } catch (e) { /* some input types disallow selection */ }
                } else {
                    activeElement.textContent = newText;
                    moveCursorToEnd(activeElement);
                }
                // Clear lastAutocorrect so undo only fires once.
                lastAutocorrect = {
                    element: null,
                    originalWord: null,
                    correctedWord: null,
                    timestamp: null
                };
                // Prevent the Backspace from also deleting a character.
                event.preventDefault();
            }
        }
    }
});

// --- Start the Extension ---
// Run the setup function to activate the event listener.
setupAutocorrectListener();
