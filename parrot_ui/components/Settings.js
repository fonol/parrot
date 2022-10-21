import { html, Component } from '../preact-bundle.js'
import { Checkbox } from './common/Checkbox.js';

export class Settings extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        cat: 1,

        vimMode: window.config.get('vim_mode'),
        vimEsc: window.config.get('vim_esc'),
        shortcutCompileAndLoadFile: window.config.get('shortcut_compile_and_load_file'),
        shortcutCompileToplevel: window.config.get('shortcut_compile_top_level'),
        shortcutEvalLastExpression: window.config.get('shortcut_eval_last_expression'),
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

    cancel() {
        this.props.hide();
    }
    accept() {
        window.config.set('vim_mode', this.state.vimMode);
        window.config.set('vim_esc', this.state.vimEsc);
        window.config.set('shortcut_compile_and_load_file', this.state.shortcutCompileAndLoadFile);
        window.config.set('show_line_numbers', this.state.showLineNumbers);
        window.config.set('shortcut_compile_top_level', this.state.shortcutCompileToplevel);
        window.config.set('shortcut_eval_last_expression', this.state.shortcutEvalLastExpression);
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
                        <div class="modal-body overflow-hidden flex-row" style="flex: 1 1 600px; min-width: 1000px">
                            <div class="settings-cats">
                                <div onClick=${() => this.setCat(1)} className=${this.state.cat === 1 ? 'active': ''}>General</div>
                                <div onClick=${() => this.setCat(2)} className=${this.state.cat === 2 ? 'active': ''}>Editor</div>
                            </div>
                            <div class="flex-1 overflow-auto" style="min-width: 500px">
                                ${this.state.cat === 1 && html`
                                    <h3 class="pl-10">General</h3>
                                
                                `}
                                ${this.state.cat === 2 && html`
                                    <h3 class="pl-10">Editor</h3>
                                    <div class="settings-item">
                                        <div>Compile and load current file</div>
                                        <div>Shortcut in CodeMirror syntax, e.g. "Shift-Ctrl-L", "Alt-L"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutCompileAndLoadFile} onChange=${e => this.setState({shortcutCompileAndLoadFile: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Compile top-level form</div>
                                        <div>Shortcut in CodeMirror syntax, e.g. "Shift-Ctrl-C", "Alt-C"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutCompileToplevel} onChange=${e => this.setState({shortcutCompileToplevel: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Evaluate last expression before cursor</div>
                                        <div>Shortcut in CodeMirror syntax, e.g. "Shift-Ctrl-E", "Alt-E"</div>
                                        <div>
                                            <input type="text" value=${this.state.shortcutEvalLastExpression} onChange=${e => this.setState({shortcutEvalLastExpression: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Show line numbers</div>
                                        <div>Show line numbers in the editor</div>
                                        <div>
                                            <${Checkbox} value=${this.state.showLineNumbers} onChange=${v => this.setState({showLineNumbers: v})}></${Checkbox}>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Use VIM mode</div>
                                        <div>Activate vim keybindings in the editor</div>
                                        <div>
                                            <${Checkbox} value=${this.state.vimMode} onChange=${v => this.setState({vimMode: v})}></${Checkbox}>
                                        </div>
                                    </div>
                                    <div class="settings-item">
                                        <div>Vim: Exit insert mode mapping</div>
                                        <div>Optional alternative mapping for Esc, e.g. jj, jk</div>
                                        <div>
                                            <input type="text" value=${this.state.vimEsc} onChange=${e => this.setState({vimEsc: e.target.value})}/>
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