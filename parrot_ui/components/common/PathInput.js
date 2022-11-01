import { html, Component } from '../../preact-bundle.js'
import { createRef } from '../../preact-10.7.js';

export class PathInput extends Component {
    constructor(props) {
      super(props);
      this.state = { input: props.value || '' };
      this.inp = createRef();
      if (!props.onChange) {
        console.warn("PathInput: 'onChange' prop missing.");
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
    render() {
      return html`
         <div class="name-input-outer">
            <svg height="20" class="name-input-icn" viewBox="0 0 512 512"><path d="M416 221.25V416a48 48 0 01-48 48H144a48 48 0 01-48-48V96a48 48 0 0148-48h98.75a32 32 0 0122.62 9.37l141.26 141.26a32 32 0 019.37 22.62z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"/><path d="M256 56v120a32 32 0 0032 32h120M176 288h160M176 368h160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>
            <input class="w-100"
                ref=${this.inp} 
                type="text" 
                value=${this.state.input} 
                onInput=${(e) => this.onInputChange(e)}
                placeholder=${this.props.placeholder || 'Path'}/>

            ${this.state.input && this.state.input.length && html`
                <svg onClick=${this.clear.bind(this)} 
                    height="20" 
                    class="name-clear-icn" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>
            `}
        </div>
      `;
    }
  }