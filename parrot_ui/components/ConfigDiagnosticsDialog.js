import { html, Component } from '../preact-bundle.js'
import { createRef } from '../preact-10.7.js';
import { PathInput } from './common/PathInput.js'

export class ConfigDiagnosticsDialog extends Component {
    constructor(props) {
      super(props);
      let d = props.diagnostics;
      let path_to_sbcl = '';
      if (typeof d.path_to_sbcl === 'object') {
        if ('ValueInvalid' in d.path_to_sbcl) {
            path_to_sbcl = d.path_to_sbcl.ValueInvalid;
        }
        else if ('Ok' in d.path_to_sbcl) {
            path_to_sbcl = d.path_to_sbcl.Ok;
        }
      }
      let path_to_core = '';
      if (typeof d.path_to_core === 'object') {
        if ('ValueInvalid' in d.path_to_core) {
            path_to_core = d.path_to_core.ValueInvalid;
        }
        else if ('Ok' in d.path_to_core) {
            path_to_core = d.path_to_core.Ok;
        }
      }
        let slynk_socket = '';
      if (typeof d.slynk_socket === 'object') {
        if ('ValueInvalid' in d.slynk_socket) {
            slynk_socket = d.slynk_socket.ValueInvalid;
        }
        else if ('Ok' in d.slynk_socket) {
            slynk_socket = d.slynk_socket.Ok;
        }
      }
      this.state = { 
        diagnostics: props.diagnostics,
        path_to_sbcl: path_to_sbcl,
        path_to_core: path_to_core,
        slynk_socket: slynk_socket,
      };
      this.nameInp = createRef();
    }
    componentDidMount() {
    }
    componentDidUpdate(prevProps) {
    }


    /**
     * Private
     */

    accept() {
        window.config.set('path_to_core', this.state.path_to_core);
        window.config.set('path_to_sbcl', this.state.path_to_sbcl);
        window.config.set('slynk_socket', this.state.slynk_socket);
        let self = this;
        window.config.write()
            .then(() => {
                notifications.show('Updated configuration.');
                self.props.accept();
            });
    }
    canAccept() {
        return this.state.path_to_core && this.state.path_to_core.trim().length > 0
            && this.state.path_to_sbcl && this.state.path_to_sbcl.trim().length > 0
            && this.state.slynk_socket && this.state.slynk_socket.trim().length > 0;
    }
   
    render() {
        let d = this.state.diagnostics;
        return html`
            <div class="modal-bg">
                    <div class="modal" style="min-width: 700px">
                        <div class="modal-header">
                            Please update your config!
                        </div>
                        <div class="modal-body overflow-hidden">
                            <div class="settings-item">
                                <h4 class="mt-0 mb-10">Path to SBCL executable</h4>
                                <small>E.g. C:/Program Files/Steel Bank Common Lisp/sbcl.exe</small>
                                ${d.path_to_sbcl === 'ValueMissing' && html`
                                    <div>
                                        <div class="text-danger mt-10 mb-10">Value Missing</div>
                                        <${PathInput} placeholder="Path" onChange=${(v) => this.setState({ path_to_sbcl: v })}><//${PathInput}>
                                    </div>
                                `}
                                ${typeof(d.path_to_sbcl)  === 'object' && 'ValueInvalid' in d.path_to_sbcl && html`
                                    <div>
                                        <div class="text-danger mt-10 mb-10">Value Invalid</div>
                                        <${PathInput} placeholder="Path" value=${this.state.path_to_sbcl} onChange=${(v) => this.setState({ path_to_sbcl: v })}><//${PathInput}>
                                    </div>
                                `}
                                ${typeof(d.path_to_sbcl) === 'object' && 'Ok' in d.path_to_sbcl && html`
                                    <div>
                                        <div class="text-active mt-10 mb-10">Ok</div>
                                        <${PathInput} placeholder="Path" value=${this.state.path_to_sbcl} onChange=${(v) => this.setState({ path_to_sbcl: v })}><//${PathInput}>
                                    </div>
                                `}
                            </div>
                            <div class="settings-item">
                                <h4 class="mt-0 mb-10">Path to SBCL core file</h4>
                                <small>E.g. C:/Program Files/Steel Bank Common Lisp/sbcl.core</small>
                                ${d.path_to_core === 'ValueMissing' && html`
                                    <div>
                                        <div class="text-danger mt-10 mb-10">Value Missing</div>
                                        <${PathInput} placeholder="Path" onChange=${(v) => this.setState({ path_to_core: v })}><//${PathInput}>
                                    </div>
                                `}
                                ${typeof(d.path_to_core)  === 'object' && 'ValueInvalid' in d.path_to_core && html`
                                    <div>
                                        <div class="text-danger mt-10 mb-10">Value Invalid</div>
                                        <${PathInput} placeholder="Path" value=${this.state.path_to_core} onChange=${(v) => this.setState({ path_to_core: v })}><//${PathInput}>
                                    </div>
                                `}
                                ${typeof(d.path_to_core) === 'object' && 'Ok' in d.path_to_core && html`
                                    <div>
                                        <div class="text-active mt-10 mb-10">Ok</div>
                                        <${PathInput} placeholder="Path" value=${this.state.path_to_core} onChange=${(v) => this.setState({ path_to_core: v })}><//${PathInput}>
                                    </div>
                                `}
                            </div>
                            <div class="settings-item">
                                <h4 class="mt-0 mb-10">Swank server socket</h4>
                                <small>Default: 127.0.0.1:4005</small>
                                ${d.slynk_socket === 'ValueMissing' && html`
                                    <div>
                                        <div class="text-danger mt-10 mb-10">Value Missing</div>
                                        <input onChange=${(e) => this.setState({ slynk_socket: e.target.value })}></input>
                                    </div>
                                `}
                                ${typeof(d.slynk_socket)  === 'object' && 'ValueInvalid' in d.slynk_socket && html`
                                    <div>
                                        <div class="text-danger mt-10 mb-10">Value Invalid</div>
                                        <input value=${this.state.slynk_socket} onChange=${(e) => this.setState({ slynk_socket: e.target.value })}></input>
                                    </div>
                                `}
                                ${typeof(d.slynk_socket) === 'object' && 'Ok' in d.slynk_socket && html`
                                    <div>
                                        <div class="text-active mt-10 mb-10">Ok</div>
                                        <input value=${this.state.slynk_socket} onChange=${(e) => this.setState({ slynk_socket: e.target.value })}></input>
                                    </div>
                                `}
                            </div>
                        </div>
                        <div class="modal-footer flex-row flex-between flex-center">
                            <button className=${this.canAccept() ? '': 'disabled'} onClick=${this.accept.bind(this)}>Update config</button>
                        </div>
                    </div>
                </div>
      `;
    }
  }