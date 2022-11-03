export function fileNameIsValid(fname) {
    let r1 =/^[^/:*?"<>|]+$/; 
    let r2 =/^\./; 
    let r3 =/^(nul|prn|con|lpt[0-9]|com[0-9])(\.|$)/i;
    return r1.test(fname)&&!r2.test(fname)&&!r3.test(fname);
}
export function getLeafNameWithExtension(fpath) {
    return fpath.split('\\').pop().split('/').pop();
}
export function getLeafNameWithoutExtension(fpath) {
    let pathRepl = fpath.replace(/\\/g, '/');
    if (pathRepl.endsWith('/')) {
        pathRepl = pathRepl.replace(/\/$/g, '');
        return pathRepl.substring(pathRepl.lastIndexOf('/')+1);
    }
    return pathRepl.substring(pathRepl.lastIndexOf('/')+1).replace(/.(lisp|cl)$/gi, '');
}
export function getFolderNameFromFile(path) {
    let pathRepl = path.replace(/\\/g, '/');
    let stem = pathRepl.substring(0, pathRepl.lastIndexOf('/') + 1);
    return stem;
}
export function replaceFileNameInPath(path, newFileName) {
    let pathRepl = path.replace(/\\/g, '/');
    let stem = pathRepl.substring(0, pathRepl.lastIndexOf('/') + 1);
    return stem + newFileName;
}
export function trimPrefix(path, prefix) {
    let pathRepl = path.replace(/\\/g, '/');
    let prefixRepl = prefix.replace(/\\/g, '/');
    if (pathRepl.startsWith(prefixRepl)) {
        return pathRepl.substring(prefixRepl.length);
    }
    return pathRepl;
}
export function normalizePath(path) {
    return path.replace(/\\/g, '/');
}
export function joinPaths(path1, path2) {

    path1 = normalizePath(path1);
    path2 = normalizePath(path2);
    if (!path1.endsWith('/') && !path2.startsWith('/')) {
        return `${path1}/${path2}`;
    }
    if (path1.endsWith('/') && path2.startsWith('/')) {
        return `${path1.substring(0, path1.length-1)}/${path2}`;
    }
    return `${path1}/${path2}`;
}
export function hasBalancedNumberOfParentheses(text) {
    let counts = countClosedAndOpenedParentheses(text);
    return counts.closed === counts.opened;
}
export function countClosedAndOpenedParentheses(text) {
    if (!text || text == '') {
        return { closed: 0, opened: 0};
    }
    let opened = 0;
    let closed = 0;
    for (var i = 0; i < text.length; i++) {
        let c = text.charAt(i);
        if (c === ')') {
            closed++;
        } else if (c === '(') {
            opened++;
        }
    }
    return { closed: closed, opened: opened };
}

export function getPrecedingExpr(textBeforeCursor) {
    let opened = 0;
    let insideBraces = false;
    let raw = false;
    let startIx = -1;

    for (var i = textBeforeCursor.length-1; i >= 0; i--) {
        let c = textBeforeCursor.charAt(i);
        if (c === ')') {
            if (!raw) {
                insideBraces = true;
            }
            opened++;
        } else if (c === '(') {
            opened--;
            if (insideBraces && opened === 0) {
                startIx = i;
                break;
            }
        } else if (c !== ' ' && c !== '\t' && c !== '\n' && !insideBraces) {
            raw = true;
        } else if ((c === ' ' || c === '\t' || c === '\n') && raw) {
            startIx = i;
            break;
        }
    }
    // special case: reached beginning of string
    // and inside raw
    if (raw && startIx === -1) {
        startIx = 0;
    }
    if (startIx === -1) {
        return null;
    }
    return textBeforeCursor.substring(startIx).trim();
}
export function getSymbolUnderOrBeforeCursor(textBeforeCursor, textAfterCursor) {
    if (!textBeforeCursor && !textAfterCursor) {
        return null;
    }
    let ignoreAfter = /(\n|\t| |")$/g.test(textBeforeCursor)|| !textAfterCursor || !textAfterCursor.length || /^(\n|\t| |"| )/g.test(textAfterCursor) ;

    textBeforeCursor = textBeforeCursor.trim();
    let startIx = -1;
    for (var i = textBeforeCursor.length - 1; i >= 0; i--) {
        let c = textBeforeCursor.charAt(i);
        if (c === '"' || c === '(' || c === ')' || c === '#' || c === ' ' || c === '\n' || c === '\t') {
            startIx = i+1;
            break;
        }
        if (i === 0) {
            startIx = 0;
        }
    }
    if (startIx === -1) {
        return null;
    }
    if (!ignoreAfter) {
        let endIx = 0;
        for (var i = 0; i < textAfterCursor.length; i++) {
            let c = textAfterCursor.charAt(i);
            if (c === '"' || c === '(' || c === ')' || c === '#' || c === ' ' || c === '\n' || c === '\t') {
                endIx = i;
                break;
            }
            if (i === textAfterCursor.length - 1) {
                endIx = i + 1;
                break;
            }
        }
        return textBeforeCursor.substring(startIx) + textAfterCursor.substring(0, endIx);
    }
    return textBeforeCursor.substring(startIx);
}

export function getSurroundingTopLevelExpr(textBeforeCursor, textAfterCursor, cursorPos, cursorLine, cursorCol) {

    let startIx = -1;
    let opened = 0;
    let posDiff = 0;
    let lineDiff = 0;
    for (var i = textBeforeCursor.length-1; i >= 0; i--) {
        let c = textBeforeCursor.charAt(i);
        posDiff++;
        if (c === '\n') {
            lineDiff++;
        }
        if (c === '(') {
            opened++;
            if (i === 0 || hasBalancedNumberOfParentheses(textBeforeCursor.substring(0, i))) {
                startIx = i;
                break;
            }
        } else if (c === ')') {
            opened--;
        }
    }
   
    if (startIx === -1 || opened === 0) {
        return null;
    }
    // the position of the top level expr
    let textBeforeStartIx = textBeforeCursor.substring(0, startIx);
    let lastLineBegin = textBeforeStartIx.lastIndexOf('\n');
    if (lastLineBegin === -1) {
        lastLineBegin === 0;
    }
    let col = startIx - lastLineBegin;
    let startingPos = {
        pos: cursorPos - posDiff,
        line: cursorLine - lineDiff,
        col: col
        
    };

    for (var i = 0; i < textAfterCursor.length; i++) {
        let c = textAfterCursor.charAt(i);
        if (c === '(') {
            opened++;
        } else if (c === ')') {
            opened--;
            if (opened === 0) {
                return {
                    position: startingPos,
                    text: textBeforeCursor.substring(startIx) + textAfterCursor.substring(0, i + 1)
                };
            }
        }
    }
    return null;
}

export function padStartEnd(text, len, padChar) {
    let remaining = len - text.length;
    if (remaining <= 0) {
        return text;
    }
    if (remaining % 2 === 0) {
        return text.padStart(text.length + remaining / 2, padChar).padEnd(len, padChar);
    }
    return text.padStart(text.length + Math.trunc(remaining / 2.0)+1, padChar).padEnd(len, padChar);
}