import { hasBalancedNumberOfParentheses } from "./utils.js";

/**
 * Trying to implement some of the basic functions from paredit
 */

export function getSlurpForwardTarget(textBeforeCursor, textAfterCursor, cursorPos) {

    let canSlurp = false;
    let toSlurp = '';
    let slurping = false;
    let startIx = -1;
    let lastSlurpDest = -1;
    let insideString = false;
    let open = 0;
    let cPrev = '';
    for (var i = 0; i < textAfterCursor.length; i++) {
        let c = textAfterCursor.charAt(i);
        let isEnd = i === textAfterCursor.length - 1;
        if (c === '"' && cPrev !== '\\') {
            insideString = !insideString;
        }
        if (c === '(' && !insideString) {
            open++;
        } else if (c === ')' && !insideString) {
            open--;
        }
        if (!slurping) {
            if (c === ' ' || c === '\n' || c === '\t') {
                cPrev = c;
                continue;
            } else if (c === ')' && open < 0) {
                lastSlurpDest = i;
                canSlurp = true;
                cPrev = c;
                continue;
            }
        }

        if (canSlurp) {
            let finished = false;
            toSlurp += c;
            slurping = true;
            if (toSlurp.length === 1) {
                startIx = i;
            }
            // check if form to slurp is closed
            // 1. string literal
            if (/^".*(?<!\\)"$/g.test(toSlurp)) {
                finished = true;
            }
            // 2. form inside parentheses
            if (/^'?\(.*\)$/g.test(toSlurp) && hasBalancedNumberOfParentheses(toSlurp)) {
                finished = true;
            }
            // 3. symbol name, end reached
            if (!/^("|'?\()/g.test(toSlurp) && (c === ' ' || c === '\n' || c === '\t' || c === ')' || isEnd)) {

                if (c === ')' || c === ' ' || c === '\t' || c === '\n') {
                    toSlurp = toSlurp.substring(0, toSlurp.length - 1);
                }
                finished = true;
            }

            if (finished) {
                return {
                    slurpTargetStart: cursorPos + startIx,
                    slurpTargetEnd: cursorPos + startIx + toSlurp.length,
                    slurpDest: cursorPos + lastSlurpDest
                };
            }
        }
        cPrev = c;
    }
    return null;
}
export function getSlurpBackwardTarget(textBeforeCursor, textAfterCursor, cursorPos) {

    let canSlurp = false;
    let toSlurp = '';
    let slurping = false;
    let startIx = -1;
    let lastSlurpDest = -1;
    let insideString = false;
    let open = 0;

    for (var i = textBeforeCursor.length-1; i >= 0; i--) {
        let c = textBeforeCursor.charAt(i);
        let isEnd = i === 0;
        if (c === '"' && (i === 0 || textBeforeCursor.charAt(i-1) !== '\\')) {
            insideString = !insideString;
        }
        if (c === '(' && !insideString) {
            open++;
        } else if (c === ')' && !insideString) {
            open--;
        }
        if (!slurping) {
            if (c === ' ' || c === '\n' || c === '\t') {
                continue;
            } else if (c === '(' && open > 0) {
                lastSlurpDest = i;
                canSlurp = true;
                continue;
            }
        }

        if (canSlurp) {
            let finished = false;
            toSlurp = c + toSlurp;
            slurping = true;
            if (toSlurp.length === 1) {
                startIx = i;
            }
            // check if form to slurp is closed
            // 1. string literal
            if (/^".*(?<!\\)"$/g.test(toSlurp)) {
                finished = true;
            }
            // 2. form inside parentheses
            if (/^'?\(.*\)$/g.test(toSlurp) && hasBalancedNumberOfParentheses(toSlurp)) {
                finished = true;
            }
            // 3. symbol name, end reached
            if (!/("|\)'?)$/g.test(toSlurp) && (c === ' ' || c === '\n' || c === '\t' || c === '(' || isEnd)) {
                if (c === '(' || c === ' ' || c === '\t' || c === '\n') {
                    toSlurp = toSlurp.substring(1, toSlurp.length);
                }
                finished = true;
            }

            if (finished) {
                return {
                    slurpTargetStart: cursorPos - (textBeforeCursor.length - startIx) - toSlurp.length + 1,
                    slurpTargetEnd: cursorPos - (textBeforeCursor.length - startIx) + 1,
                    slurpDest: cursorPos - (textBeforeCursor.length - lastSlurpDest) + 1
                };
            }
        }
    }
    return null;
}