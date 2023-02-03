import { html, Component } from '../preact-bundle.js'
import { Checkbox } from './common/Checkbox.js';

export class Settings extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        cat: 1,

        pathToSbcl: window.config.get('path_to_sbcl'),
        pathToCore: window.config.get('path_to_core'),
        vimMode: window.config.get('vim_mode'),
        vimEsc: window.config.get('vim_esc'),
        shortcutCompileAndLoadFile: window.config.get('shortcut_compile_and_load_file'),
        shortcutCompileToplevel: window.config.get('shortcut_compile_top_level'),
        shortcutEvalLastExpression: window.config.get('shortcut_eval_last_expression'),
        shortcutFindDefinition: window.config.get('shortcut_find_definition'),
        shortcutSlurpForward: window.config.get('shortcut_slurp_forward'),
        shortcutSlurpBackward: window.config.get('shortcut_slurp_backward'),
        customHighlights: window.config.get('custom_highlights'),
        showLineNumbers: config.get('show_line_numbers')
      };
        if (typeof this.props.accept !== 'function') {
            console.error("Settings: missing accept prop");
        }
    } 
    componentDidMount() {
    }
    componentDidUpdate(prevProps) {
     
    }


    /**
     * Private
     */
    addCustomHighlight() {
        this.setState(s => {
            s.customHighlights.push({
                pattern: '',
                color: ''
            });
            return s;
        })
    }
    removeCustomHighlight(ix) {
        this.setState(s => {
            s.customHighlights.splice(ix, 1);
            return s;
        })
    }
    patternIsValid(p) {
        if (p.length === 0) {
            return true;
        }
        let isValid = true;
        try {
            new RegExp(p, 'g');
        } catch(e) {
            isValid = false;
        }
        return isValid;
    }
    customHighlightPatternIsValid(ix) {
        let p = this.state.customHighlights[ix].pattern;
        return this.patternIsValid(p);
    }

    cancel() {
        this.props.hide();
    }
    accept() {
        window.config.set('vim_mode', this.state.vimMode);
        window.config.set('vim_esc', this.state.vimEsc);
        window.config.set('path_to_sbcl', this.state.pathToSbcl);
        window.config.set('path_to_core', this.state.pathToCore);
        window.config.set('shortcut_compile_and_load_file', this.state.shortcutCompileAndLoadFile);
        window.config.set('show_line_numbers', this.state.showLineNumbers);
        window.config.set('shortcut_compile_top_level', this.state.shortcutCompileToplevel);
        window.config.set('shortcut_eval_last_expression', this.state.shortcutEvalLastExpression);
        window.config.set('shortcut_find_definition', this.state.shortcutFindDefinition);
        window.config.set('shortcut_slurp_forward', this.state.shortcutSlurpForward);
        window.config.set('shortcut_slurp_backward', this.state.shortcutSlurpBackward);

        let validCustomHighlights = this.state.customHighlights.filter(h =>
            h.pattern && h.pattern.length && h.color && h.color.length && this.patternIsValid(h.pattern));
        window.config.set('custom_highlights', validCustomHighlights);
        window.config.write();
        this.props.accept();
    }
    setCat(cat) {
        this.setState({ cat: cat });
    }
   
    render() {
      return html`
            <div class="modal-bg">
                    <div class="modal" >
                        <div class="modal-header">
                            Settings
                        </div>
                        <div class="modal-body overflow-hidden flex-row" style="flex: 1 1 800px; min-width: 1000px">
                            <div class="settings-cats">
                                <div onClick=${() => this.setCat(1)} className=${this.state.cat === 1 ? 'active': ''}>General</div>
                                <div onClick=${() => this.setCat(2)} className=${this.state.cat === 2 ? 'active': ''}>Editor</div>
                                <div onClick=${() => this.setCat(3)} className=${this.state.cat === 3 ? 'active': ''}>Syntax Highlighting</div>
                            </div>
                            <div class="flex-1 flex-col overflow-auto" style="min-width: 500px">
                                ${this.state.cat === 1 && html`
                                    <h3 class="pl-10">General</h3>
                                    <div class="settings-item">
                                        <div>Path to SBCL executable</div>
                                        <div class="text-secondary">e.g. C:/Users/me/SBCL/sbcl.exe</div>
                                        <div>
                                            <input type="text" value=${this.state.pathToSbcl} onChange=${e => this.setState({pathToSbcl: e.target.value})} style="min-width: 500px"/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Path to SBCL core file</div>
                                        <div class="text-secondary">e.g. C:/Users/me/SBCL/sbcl.core</div>
                                        <div>
                                            <input type="text" value=${this.state.pathToCore} onChange=${e => this.setState({pathToCore: e.target.value})} style="min-width: 500px"/>
                                        </div>
                                    </div>
                                
                                `}
                                ${this.state.cat === 2 && html`
                                    <h3 class="pl-10">Editor</h3>
                                    <div class="settings-item">
                                        <div>Compile and load current file</div>
                                        <div class="text-secondary">Shortcut in CodeMirror syntax, e.g. "Shift-Ctrl-l", "Alt-l"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutCompileAndLoadFile} onChange=${e => this.setState({shortcutCompileAndLoadFile: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Compile top-level form</div>
                                        <div class="text-secondary">Shortcut in CodeMirror syntax, e.g. "Shift-Ctrl-c", "Alt-c"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutCompileToplevel} onChange=${e => this.setState({shortcutCompileToplevel: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Evaluate last expression before cursor</div>
                                        <div class="text-secondary">Shortcut in CodeMirror syntax, e.g. "Shift-Ctrl-e", "Alt-e"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutEvalLastExpression} onChange=${e => this.setState({shortcutEvalLastExpression: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Find definition</div>
                                        <div class="text-secondary">Find definition of symbol before or under the cursor.<br/>Shortcut in CodeMirror syntax, e.g. "Shift-Ctrl-d", "Alt-d"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutFindDefinition} onChange=${e => this.setState({shortcutFindDefinition: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Slurp forward</div>
                                        <div class="text-secondary">Shortcut in CodeMirror syntax, e.g. "Ctrl-ArrowRight"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutSlurpForward} onChange=${e => this.setState({shortcutSlurpForward: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Slurp backward</div>
                                        <div class="text-secondary">Shortcut in CodeMirror syntax, e.g. "Ctrl-ArrowLeft"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutSlurpBackward} onChange=${e => this.setState({shortcutSlurpBackward: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Show line numbers</div>
                                        <div class="text-secondary">Show line numbers in the editor</div>
                                        <div>
                                            <${Checkbox} value=${this.state.showLineNumbers} onChange=${v => this.setState({showLineNumbers: v})}></${Checkbox}>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Use VIM mode</div>
                                        <div class="text-secondary">Activate vim keybindings in the editor</div>
                                        <div>
                                            <${Checkbox} value=${this.state.vimMode} onChange=${v => this.setState({vimMode: v})}></${Checkbox}>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Vim: Exit insert mode mapping</div>
                                        <div class="text-secondary">Optional alternative mapping for Esc, e.g. jj, jk</div>
                                        <div>
                                            <input type="text" value=${this.state.vimEsc} onChange=${e => this.setState({vimEsc: e.target.value})}/>
                                        </div>
                                    </div>
                                `}
                                ${this.state.cat === 3 && html`
                                    <!-- ${JSON.stringify(this.state.customHighlights)} -->
                                    <div class="overflow-hidden flex-1 flex-col flex-left">
                                        <div class="text-secondary pl-10">
                                            <p>
                                                Text that matches a pattern defined here will be highlighted with the respective color.<br/>
                                            </p>
                                            <ul class="pl-20">
                                                <li>Patterns will only be matched within a line.</li>
                                                <li>If one or more groups are in the pattern, the <strong>first group</strong> will be colored.</li>
                                                <li>If no groups are in the pattern, the <strong>whole match</strong> will be colored.</li>
                                            </ul>
                                            Examples:
                                            <div class="mb-10 mt-5 flex-row flex-center">
                                                <input type="text" class="text-secondary" readonly value="\\((my-cool-macro) "/>
                                                <span class="ml-15 mr-15">or</span>
                                                <input type="text" class="text-secondary" readonly value="#'[^\\s()]+"/>
                                            </div>
                                        </div>
                                        <hr class="w-100"/>
                                        <div class="mt-10 pl-10">
                                            <button class="mb-10" onClick=${this.addCustomHighlight.bind(this)}>Add rule</button>
                                        </div>
                                        <div class="overflow-auto flex-1">
                                            ${this.state.customHighlights.map((ch,ix) => html`
                                                <div class="settings-item flex-row">
                                                    <input type="text" className=${'w-300px'+(this.customHighlightPatternIsValid(ix) ? '': ' invalid')} value=${ch.pattern} placeholder="Pattern" onInput=${e =>this.setState(s => { s.customHighlights[ix].pattern = e.target.value; return s; })}/>
                                                    <input type="color" value=${ch.color} class="ml-10" onInput=${e => this.setState(s => { s.customHighlights[ix].color = e.target.value; return s; })}/>
                                                    <button class="ml-10" onClick=${() => this.removeCustomHighlight(ix)}>
                                                        <svg height="16" width="16" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>
                                                    </button>
                                                </div>
                                            `)}
                                        </div>
                                    </div>
                                `}

                            </div>

                        </div>
                        <div class="modal-footer flex-row flex-between flex-center">
                            <button class="mr-10 secondary" onClick=${this.cancel.bind(this)}>Close</button>
                            <button onClick=${this.accept.bind(this)}>Save</button>
                        </div>
                    </div>
                </div>
      `;
    }
  }