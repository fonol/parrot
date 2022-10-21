import { html, Component } from '../../preact-bundle.js'
import { createRef } from '../../preact-10.7.js';

export class FolderInput extends Component {
    constructor(props) {
      super(props);
      this.state = { input: props.value || '' };

      this.inp = createRef();
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
         <div class="folder-input-outer">
            <svg height="20" class="folder-input-icn" viewBox="0 0 512 512"><path d="M440 432H72a40 40 0 01-40-40V120a40 40 0 0140-40h75.89a40 40 0 0122.19 6.72l27.84 18.56a40 40 0 0022.19 6.72H440a40 40 0 0140 40v240a40 40 0 01-40 40zM32 192h448" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>
            <input class="w-100" 
                ref=${this.inp} 
                type="text" 
                value=${this.state.input} 
                onInput=${(e) => this.onInputChange(e)}
                placeholder="Folder path"/>

            ${this.state.input && this.state.input.length && html`
                <svg onClick=${this.clear.bind(this)} height="20" 
                class="folder-clear-icn" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>
            `}
        </div>
      `;
    }
  }