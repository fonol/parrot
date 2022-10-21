import { html, Component } from '../../preact-bundle.js'
import { createRef } from '../../preact-10.7.js';
import { fileNameIsValid } from '../../scripts/utils.js';

export class LispFileNameInput extends Component {
    constructor(props) {
      super(props);
      this.state = { input: props.value || '' };
      this.inp = createRef();
      if (!props.onChange) {
        console.warn("LispFileNameInput: 'onChange' prop missing.");
      }
    }
    componentDidMount() { }
    componentDidUpdate(prevProps) {
        if (prevProps.value !== this.props.value) {
           this.setState({input: this.props.value});
        }
    }
    onInputChange(event) {
        this.setState({input: event.target.value});
        this.props.onChange(event.target.value);
    }
    focus() {
        if (this.inp.current) {
            this.inp.current.focus();
        }
    }
    clear() {
        this.setState({input : ''});
        this.props.onChange('');
    }
    fileNameIsValid() {
        return fileNameIsValid(this.state.input);
    }
    render() {
      return html`
         <div class="lisp-file-name-input-outer">
            <div class="lisp-file-name-input-icn">
                λ 
            </div>
            <input className=${'w-100' + (!this.state.input || !this.state.input.length || this.fileNameIsValid() ? '': ' invalid')} 
                ref=${this.inp} 
                type="text" 
                value=${this.state.input} 
                onInput=${(e) => this.onInputChange(e)}
                placeholder="File name"/>

            ${this.state.input && this.state.input.length && html`
                <svg onClick=${this.clear.bind(this)} 
                    height="20" 
                    class="lisp-file-name-clear-icn" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>
            `}
        </div>
      `;
    }
  }