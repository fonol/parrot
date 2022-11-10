import { html, Component } from '../preact-bundle.js';
import { createRef } from '../preact-10.7.js';
import {
    getSurroundingTopLevelExpr,
    getSymbolUnderOrBeforeCursor,
    getLeafNameWithExtension,
    getPrecedingExpr,
    padStartEnd
} from '../scripts/utils.js';
import {
    getSlurpForwardTarget,
    getSlurpBackwardTarget,
} from '../scripts/paredit.js';



export class Editor extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        path: props.path,
        content: '',
        symbolInfo: null

      };
      this.loading = false;
      this.editorInitialized = false;
      this.editor = null;
      this.editorTarget = createRef();
      this.symbolInfo = createRef();
      this.originalValue = '';
      this.editingExistingFile = props.path && props.path.length > 0;
        if (typeof props.onWantsToClose !== 'function') {
            console.error("[Editor] missing 'onWantsToClose' prop");
        }
    }
    componentDidMount() {
        if (this.editingExistingFile) {
            this.fetchFileContent();
        } else {
            this.setState({
               content: ''
            }, this.initEditor);
        }
    }
    componentDidUpdate(prevProps) {
        if (prevProps.path !== this.props.path ) {
           this.loading = true;
           this.setState({ path: this.props.path }, this.fetchFileContent);
           this.editingExistingFile = this.props.path && this.props.path.length > 0;
           this.forceUpdate();
        }
    }
    shouldComponentUpdate(prevProps) {
        if (this.props.path !== prevProps.path) {
            return true;
        }
        return false;
    }	
    /**
     * Public
     */
    getValue() {
        if (!this.editor) {
            return null;
        }
        return this.editor.state.doc.toString();
    }
    setValue(text) {
        if (!this.editor) {
            notifications.error('Cannot set value: editor not initialized yet.');
            return;
        }
        this.setState({ content: text });
        this.editor.dispatch({
            changes: { from: 0, to: this.editor.state.doc.length, insert: text }
        });
    }
    refresh() {
        let currentValue = this.getValue();
        this.editor = null;
        if (!this.editingFile()) {
            this.setState({ content: currentValue }, this.initEditor);
        } else {
            this.initEditor();
        }
    }
    /**
     * Focus the editor and set the cursor at the given position.
     * @param {*} pos 1-based absolute position
     */
    setCursorToPosition(pos) {
        if (pos === null) {
            return;
        }
        if (this.loading || !this.editorInitialized) {
            setTimeout(() => { this.setCursorToPosition(pos) }, 100);
            return;
        }
        this.editor.focus();
        this.editor.dispatch({selection: {anchor: pos-1, head: pos-1}})
        this.centerLine(pos);
    }
    /**
     * Focus the editor and set the cursor at the given position.
     */
    setCursorToLineAndCol(line, col) {
        if (this.loading || !this.editorInitialized) {
            setTimeout(() => { this.setCursorToLineAndCol(line, col) }, 100);
            return;
        }
        let lines = this.getValue()
            .split('\n');
        if (line < 0 || line >= lines.length) {
            notifications.error("Could not find that line in the file.");
            return;
        }
        this.editor.focus();
        let pos = this.posToOffset({ line: line, ch: col });
        this.editor.dispatch({selection: {anchor: pos, head: pos}})
        this.centerLine(pos);
    }

    /**
     * Private
     */
    editingFile() {
        return this.state.path && this.state.path.length > 0;
    }

    fetchFileContent() {
        if (!this.state.path || !this.state.path.length) {
            this.setState({ content: '' }, this.initEditor);
            this.originalValue = '';
            this.editingExistingFile = false;
            return;
        }
        this.loading = true;
        this.editorInitialized = false;
        let self = this;
        window.backend.getFileContent(this.state.path)
        .then(function (content) {
            self.originalValue = content;
            self.setState({
                content: content
            }, self.initEditor);
            self.loading = false;
        })
        .catch(function(errMessage) {
            window.notifications.error(errMessage);
            self.setState({errMessage : errMessage}); 
            self.loading = false;
            self.props.onWantsToClose();
        });
    }

    initEditor() {
        console.log('initEditor');

        let editorConf = {
            vimMode: window.config.get('vim_mode'),
            vimAltEsc: window.config.get('vim_esc'),
            showLineNumbers: window.config.get('show_line_numbers')
        }; 

        let map = {};
        let compileAndLoadFileShortCut = window.config.get('shortcut_compile_and_load_file');
        if (compileAndLoadFileShortCut) {
            map[compileAndLoadFileShortCut] = this.replCompileAndLoadFile.bind(this);
        }
        let compileTopLevelShortCut = window.config.get('shortcut_compile_top_level');
        if (compileTopLevelShortCut) {
            map[compileTopLevelShortCut] = this.compileTopLevelForm.bind(this);
        }
        let evalLastExprShortCut = window.config.get('shortcut_eval_last_expression');
        if (evalLastExprShortCut) {
            map[evalLastExprShortCut] = this.evalLastExprBeforeCursor.bind(this);
        }
        let findDefinitionShortCut = window.config.get('shortcut_find_definition');
        if (findDefinitionShortCut) {
            map[findDefinitionShortCut] = this.findDefintion.bind(this);
        }
        let slurpForwardShortcut = window.config.get('shortcut_slurp_forward');
        if (slurpForwardShortcut) {
            map[slurpForwardShortcut] = this.slurpForward.bind(this);
        }
        let slurpBackwardShortcut = window.config.get('shortcut_slurp_backward');
        if (slurpBackwardShortcut) {
            map[slurpBackwardShortcut] = this.slurpBackward.bind(this);
        }



        if (!this.editor) {
            this.editorTarget.current.innerHTML = '';
            this.editor = window.initEditor(this.editorTarget.current, editorConf, map, this.onCodemirrorUpdate.bind(this));
            // this.editor = window.CodeMirror.fromTextArea(this.editorTarget.current, {
            //     mode:  'commonlisp',
            //     styleActiveLine: true,
            //     lineNumbers: showLineNumbers,
            //     gutter: showLineNumbers,
            //     indentUnit: 4,
            //     indentWithTabs: false,
            //     keyMap: vimMode ? 'vim': 'default'
            //     // extraKeys: { Tab: 'indentMore', Enter: this.onEnter.bind(this), Up: this.onArrowUp.bind(this), Down: this.onArrowDown.bind(this) }
            // });
            // this.editor.refresh();
            // let self = this;
            // self.editor.on("cursorActivity", self.onCodeMirrorCursorActivity.bind(self));
            // self.editor.on("blur", self.onCodemirrorBlur.bind(self));
        }

        // fill value
        this.editor.dispatch({
            changes: { from: 0, to: this.editor.state.doc.length, insert: this.state.content }
        });

        this.editor.focus()
        this.editorInitialized = true;
    }
    posToOffset({line, ch}) {
        return this.editor.state.doc.line(line + 1).from + ch;
    }
    offsetToPos(offset) {
        let line = this.editor.state.doc.lineAt(offset)
        return { line: line.number - 1, ch: offset - line.from };
    }
    /** Current line index (starts at 1!) */
    getCurrentLine() {
        return this.editor.state.doc.lineAt(this.editor.state.selection.main.head).number;
    }
    getCurrentColumn() {
        return this.offsetToPos(this.editor.state.selection.ranges[0].from).ch;
    }
    /** Text on line with the given index, indexes start at 1! */
    getLineText(lineIx) {
        return this.getValue().split('\n')[lineIx - 1];
    }
    getTextBeforeCursor() {
        let line = this.getCurrentLine();
        let ch = this.getCurrentColumn();
        let text = this.getLineText(line).substr(0, ch);
        while (line > 1) {
            line--;
            text = this.getLineText(line)+'\n' + text;
        }
        return text;
    }
    getTextAfterCursor() {
        let doc = this.editor.state.doc;
        let line = this.getCurrentLine();
        let ch = this.getCurrentColumn();
        let text = this.getLineText(line); 
        text = text.substring(ch);
        while (line < doc.lines) {
            line++;
            text += '\n'+ this.getLineText(line);
        }
        return text;
    }
    compileTopLevelForm() {
        let before = this.getTextBeforeCursor();
        let after = this.getTextAfterCursor();
        let cursorPos = this.getCursorPosition();
        let topLevelExpr = getSurroundingTopLevelExpr(before, after, cursorPos.pos, cursorPos.line, cursorPos.col);
        if (topLevelExpr !== null) {

            let lines = topLevelExpr.text.split(/\n/g).map(l => l.replace(/\t/g, '    '));
            let lmaxLen = Math.max(Math.max(...lines.map(l => l.length)) + 2, 40);
            window.app.writeToREPL(`\r\n${TCOLORS.BG_FORM}\x1b[38;5;8m${padStartEnd('[COMPILING]', lmaxLen, ' ')}\x1b[0m`);
            window.app.writeToREPL(`${TCOLORS.BG_FORM}\x1b[38;5;240m${'~'.padEnd(lmaxLen, '~')}\x1b[0m`);
            for (let l of lines) {
                if (l.length < lmaxLen) {
                    l = ` ${l} `.padEnd(lmaxLen, ' ');
                }
                window.app.writeToREPL(`${TCOLORS.BG_FORM}\x1b[38;5;232m${l}\x1b[0m`);
            }
            window.app.writeToREPL('\n');
            backend.replCompileForm(topLevelExpr.text, this.editingExistingFile ? this.state.path : 'Scratch', topLevelExpr.position, this.editingExistingFile ? this.state.path: null);
        } else {
            notifications.error('Found no top-level form around your cursor.');
        }
    }
    evalLastExprBeforeCursor() {
        let before = this.getTextBeforeCursor();
        if (before && before.length) {
            let preceding = getPrecedingExpr(before);
            if (preceding !== null) {
                backend.interactiveEvalForm(preceding);
            } else {
                notifications.error("Found no expression to evaluate that precedes your cursor.");
            }
        } else {
            notifications.error("Found no expression to evaluate that precedes your cursor.");
        }
        return true;
    }
    replCompileAndLoadFile() {
        let self = this;
        this.save()
            .then(() => {
                if (self.state.path && self.state.path.length) {
                    window.app.writeToREPL(`\x1b[38;5;246mLoading file \x1b[0m\x1b[48;5;28m ${getLeafNameWithExtension(self.state.path)} \x1b[0m`);
                    backend.replCompileAndLoadFile(self.state.path)
                } else {
                    window.app.writeToREPL(`\x1b[38;5;246mLoading buffer \x1b[0m\x1b[48;5;28m Scratch \x1b[0m`);
                    backend.replEval(self.getValue());
                }

            })
        return true;
    }
    findDefintion() {
        let before = this.getTextBeforeCursor();
        let after = this.getTextAfterCursor();
        let form = getSymbolUnderOrBeforeCursor(before, after);
        if (form && form.length) {
            backend.findDefinition(form);
        } else {
            notifications.error("Could not find form under or before cursor.");
        }
        return true;
    }
    slurpForward() {
        let textBefore = this.getTextBeforeCursor();
        let textAfter = this.getTextAfterCursor();
        let cursorPos = this.getCursorPosition().pos;
        let t = getSlurpForwardTarget(textBefore, textAfter, cursorPos);
        if (t === null) {
            notifications.error('Nothing to slurp.');
        } else {
            let slurpTargetText = this.getTextFromAbsPos(t.slurpTargetStart, t.slurpTargetEnd);
            this.editor.dispatch({
                changes: [{
                    from: t.slurpTargetStart-1,
                    to: t.slurpTargetEnd,
                    insert: ''
                },
                {
                    from: t.slurpDest,
                    to: t.slurpDest,
                    insert: ' ' + slurpTargetText
                }]
            });
        }
        return true;
    }
    slurpBackward() {
        let textBefore = this.getTextBeforeCursor();
        let textAfter = this.getTextAfterCursor();
        let cursorPos = this.getCursorPosition().pos;
        let t = getSlurpBackwardTarget(textBefore, textAfter, cursorPos);
        if (t === null) {
            notifications.error('Nothing to slurp.');
        } else {
            let slurpTargetText = this.getTextFromAbsPos(t.slurpTargetStart, t.slurpTargetEnd);
            this.editor.dispatch({
                changes: [{
                    from: t.slurpTargetStart,
                    to: t.slurpTargetEnd+1,
                    insert: ''
                },
                {
                    from: t.slurpDest,
                    to: t.slurpDest,
                    insert:  slurpTargetText + ' '
                }]
            });
        }
        return true;
    }

    getCursorPosition() {
        let line = this.getCurrentLine();
        let ch = this.getCurrentColumn();
        let abs_c = ch;

        let lc = line;
        while (lc > 1) {
            lc--;
            abs_c += this.getLineText(lc).length + 1;
        }
        return {
            pos: abs_c,
            line: line,
            col: ch,
        }
    }

    //
    // symbol hovering 
    // 
    onSymbolMouseLeave(node) {
        node.classList.remove('cm-info-shown');
        this.removeHoverLoadingMeter();
        this._symbolHover = null;
        this.symbolInfo.current.style.display = 'none';
        clearTimeout(this._nodeHoverDebounce);
        clearTimeout(this._nodeHoverMeterDebounce);
    }
    removeHoverLoadingMeter() {
        let meter = document.getElementById('cm-info-loading-meter');
        if (meter) {
            meter.remove();
        }
    }
    onSymbolHover(e) {
        let node = document.elementFromPoint(e.clientX, e.clientY) 
        if (node && node.className.startsWith('ͼ')) {
            let nodeText = node.innerText;
            // todo: * * around global vars is not included here

            if (!nodeText.includes(' ') && nodeText !== this._symbolHover) {

                let nodebox = node.getBoundingClientRect();

                // display loading meter
                this._nodeHoverMeterDebounce = setTimeout(() => {
                    let meter = document.createElement('div');
                    meter.id = 'cm-info-loading-meter';
                    document.body.appendChild(meter);
                    meter.style.top = (nodebox.top + nodebox.height) + "px";
                    meter.style.left = nodebox.left + 'px';
                    meter.style.width = nodebox.width + 'px';
                    meter.innerHTML = '<span><span class="bar"></span></span>';
                }, 500);

                node.onmouseleave = () => this.onSymbolMouseLeave(node);
                node.onclick = () => this.onSymbolMouseLeave(node);
                node.classList.add('cm-info-shown');
                let self = this;
                this._symbolHover = nodeText;
                this._nodeHoverDebounce = setTimeout(() => {
                    backend.getSymbolInfo(nodeText)
                        .then(([describeResult, aproposResult]) => {
                            self.removeHoverLoadingMeter();
                            self.setState(s => {
                                s.symbolInfo = { describe: describeResult, apropos: aproposResult };
                                return s;
                            });
                            self.forceUpdate();
                            // position box under symbol
                            let ibox = self.symbolInfo.current;
                            let ebox = self.editorTarget.current.getBoundingClientRect();
                            ibox.style.display = 'block';
                            ibox.style.top = (nodebox.top + nodebox.height - ebox.top) + "px";
                            ibox.style.left = (nodebox.left - ebox.left) + 'px';
                        })
                }, 2000);
            }
        }
    }

    getTextFromAbsPos(start, end) {
        return this.getValue().substring(start, end);
    }
    /**
     * Vertically center the editor around the given line.
     */
    centerLine(pos) {
        // todo: this feels like a hack
        this.editor.scrollDOM.scrollTop = 0;
        let coords = this.editor.coordsAtPos(pos);
        let box = this.editor.scrollDOM.getBoundingClientRect();
        let h = box.height;
        this.editor.scrollDOM.scrollTop = coords.top - box.top - h / 2;
    }
    /* This is called anytime the editor's content changed */
    onCodemirrorUpdate() {

        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            if (this.getValue() !== this.originalValue) {
                if (this.editingExistingFile) {
                    console.log('Editor: Saving...');
                    this.save();
                }
                if (this.props.onChange) {
                    this.props.onChange(this.state.path);
                }
            }
        }, 1000);
    }
  
    async save() {
        if (!this.editingExistingFile) {
            return;
        }
        let content = this.getValue();
        if (content !== this.state.content) {
            this.originalValue = content;
            return window.backend.saveFileContent(this.state.path, content)
                .then($bus.trigger('file-saved', this.state.path));
        }
        return Promise.resolve();
    }
    render() {
        return html`
            <div class="editor" onmousemove=${this.onSymbolHover.bind(this)}>
                <div class="flex-row flex-right" style="position: absolute; top: 10px; right: 10px; z-index: 2;">
                    <div class="btn-icon icon-only" onClick=${this.replCompileAndLoadFile.bind(this)} title="Load file to REPL" style="width: auto; height: auto;">
                        <svg height="28" width="28" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M160 368L32 256l128-112M352 368l128-112-128-112M192 288.1l64 63.9 64-63.9M256 160v176.03"/></svg>
                    </div>
                </div>
                <div class="h-100" ref=${this.editorTarget}></div>
                <div ref=${this.symbolInfo} class="cm-symbol-info">
                    ${this.state.symbolInfo !== null && html`
                        <div>
                            *Symbol info*
                            <!-- todo -->
                            <!-- ${this.state.symbolInfo.describe} -->
                            <!-- ${this.state.symbolInfo.apropos} -->
                        </div>
                    `}
                </div>
            </div>`
    }
  }