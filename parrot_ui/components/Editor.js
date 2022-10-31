import { html, Component } from '../preact-bundle.js';
import { createRef } from '../preact-10.7.js';
import { getSurroundingTopLevelExpr, getSymbolUnderOrBeforeCursor, getLeafNameWithExtension, getPrecedingExpr } from '../scripts/utils.js';



export class Editor extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        path: props.path,
        content: ''
      };
      this.editor = null;
      this.editorTarget = createRef();
      this.originalValue = '';
      this.editingExistingFile = props.path && props.path.length > 0;
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
        return this.editor.getDoc().getValue();
    }
    refresh() {
        let currentValue = this.editor.getDoc().getValue();
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
        let lines = this.editor.getValue().split('\n');
        let cpos = 0;
        let line = -1;
        let ch = -1;
        for (let l = 0; l < lines.length; l++) {
            if (lines[l].length + 1 + cpos >= pos) {
                line = l;
                ch =  pos - cpos-1;
                break;
            }
            cpos += lines[l].length + 1;
        }
        if (line !== -1) {
            this.editor.focus();
            this.editor.setCursor({line: line, ch: ch})
        }
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
        let self = this;
        window.backend.getFileContent(this.state.path)
        .then(function (content) {
            self.originalValue = content;
            self.setState({
                content: content
            }, self.initEditor);
        })
        .catch(function(errMessage) {
            // window.notifications.error(errMessage);
            self.setState({errMessage : errMessage}); 
        });
    }

    initEditor() {
        console.log('initEditor');

        let vimMode = window.config.get('vim_mode');
        let vimAltEsc = window.config.get('vim_esc');
        let showLineNumbers = window.config.get('show_line_numbers');

        if (!this.editor) {
            this.editor = window.CodeMirror.fromTextArea(this.editorTarget.current, {
                mode:  'commonlisp',
                styleActiveLine: true,
                lineNumbers: showLineNumbers,
                gutter: showLineNumbers,
                indentUnit: 4,
                indentWithTabs: false,
                keyMap: vimMode ? 'vim': 'default'
                // extraKeys: { Tab: 'indentMore', Enter: this.onEnter.bind(this), Up: this.onArrowUp.bind(this), Down: this.onArrowDown.bind(this) }
            });
            this.editor.refresh();
            let self = this;
            // self.editor.on("update", self.onCodemirrorUpdate.bind(self));
            // self.editor.on("viewportChange", self.onCodemirrorUpdate.bind(self));
            self.editor.on("cursorActivity", self.onCodeMirrorCursorActivity.bind(self));
            // self.editor.on("change", self.onCodemirrorChange.bind(self));
            self.editor.on("blur", self.onCodemirrorBlur.bind(self));
        }
        if (vimMode) {
            CodeMirror.Vim.mapclear();
            if (vimAltEsc && vimAltEsc !== '') {
                CodeMirror.Vim.map(vimAltEsc, '<Esc>', 'insert');
            }
        }
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

        this.editor.addKeyMap(map);


        this.editor.getDoc().setValue(this.state.content);
        this.editor.focus()
    }
    getTextBeforeCursor() {
        let doc = this.editor.getDoc();
        let line = doc.getCursor().line;
        let ch = doc.getCursor().ch;
        let text = doc.getLine(line).substr(0, ch);
        while (line > 0) {
            line--;
            text = doc.getLine(line)+'\n' + text;
        }
        return text;
    }
    getTextAfterCursor() {
        let doc = this.editor.getDoc();
        let line = doc.getCursor().line;
        let ch = doc.getCursor().ch;
        let text = doc.getLine(line);
        text = text.substring(ch);
        while (line < doc.size-1) {
            line++;
            text += '\n'+ doc.getLine(line);
        }
        return text;
    }
    compileTopLevelForm() {
        let before = this.getTextBeforeCursor();
        let after = this.getTextAfterCursor();
        let cursorPos = this.getCursorPosition();
        let topLevelExpr = getSurroundingTopLevelExpr(before, after, cursorPos.pos, cursorPos.line, cursorPos.col);
        if (topLevelExpr !== null) {
            window.app.writeToREPL(`Compiling form \r\n\x1b[36;5;168m${topLevelExpr.text.replace(/\n/g, '\r\n')}`);
            backend.replCompileForm(topLevelExpr.text, this.editingExistingFile ? this.state.path : 'Scratch', topLevelExpr.position, this.editingExistingFile ? this.state.path: null);
        } else {
            notifications.error('Found no top-level form around your cursor.');
        }
    }
    evalTopLevelForm() {
        let before = this.getTextBeforeCursor();
        let after = this.getTextAfterCursor();
        let topLevelExpr = getSurroundingTopLevelExpr(before, after);
        if (topLevelExpr !== null) {
            window.app.writeToREPL(`Evaluating form \r\n\x1b[36;5;168m${topLevelExpr.replace(/\n/g, '\r\n')}`);
            backend.replEval(topLevelExpr);
        }
    }
    evalLastExprBeforeCursor() {
        let before = this.getTextBeforeCursor();
        if (before) {
            let preceding = getPrecedingExpr(before);
            if (preceding !== null) {
                backend.interactiveEvalForm(preceding);
            }
        }
    }
    replCompileAndLoadFile() {
        if (this.state.path && this.state.path.length) {
            window.app.writeToREPL(`\x1b[38;5;246mLoading file \x1b[0m\x1b[48;5;28m ${getLeafNameWithExtension(this.state.path)} \x1b[0m`);
            backend.replCompileAndLoadFile(this.state.path)
                //.catch(notifications.error);
        } else {
            window.app.writeToREPL(`\x1b[38;5;246mLoading buffer \x1b[0m\x1b[48;5;28m Scratch \x1b[0m`);
            backend.replEval(this.editor.getDoc().getValue());
        }
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
    }
    getCursorPosition() {
        let doc = this.editor.getDoc();
        let line = doc.getCursor().line;
        let ch = doc.getCursor().ch;
        let abs_c = ch;

        let lc = line;
        while (lc > 0) {
            lc--;
            abs_c += doc.getLine(lc).length + 1;
        }
        return {
            pos: abs_c,
            line: line,
            col: ch,
        }
    }



    onCodemirrorChange(cm, e) {
  
    }
    onEnter(cm) {
        return this.onNewLine(cm);
    }
    onNewLine(cm) {
       
    }   
    onCodemirrorBlur() {
        let hasChanges = this.originalValue !== this.editor.getDoc().getValue();
        if (hasChanges && this.editingExistingFile) {
            this.save();
        }
        if (hasChanges && this.props.onChange) {
            console.log('Editor: onBlur(), hasChanges > onChange()');
            this.props.onChange(this.state.path);
        }
    }
    // code that needs to run after rerender
    onCodemirrorUpdate() {
      
    }
    onCodeMirrorCursorActivity() {
    }
    async save() {
        let content = this.editor.getDoc().getValue();
        if (content !== this.state.content) {
            this.originalValue = content;
            return window.backend.saveFileContent(this.state.path, content)
                .then($bus.trigger('file-saved', this.state.path));
        }
        return Promise.resolve();
    }
    render() {
        return html`
            <div class="editor">
                <div class="flex-row flex-right" style="position: absolute; top: 10px; right: 10px; z-index: 2;">
                    <div class="btn-icon icon-only" onClick=${this.replCompileAndLoadFile.bind(this)} title="Load file to REPL" style="width: auto; height: auto;">
                        <svg height="28" width="28" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M160 368L32 256l128-112M352 368l128-112-128-112M192 288.1l64 63.9 64-63.9M256 160v176.03"/></svg>
                    </div>
                </div>
                <textarea ref=${this.editorTarget}></textarea>
            </div>`
    }
  }