import { html, Component } from '../../preact-bundle.js'
import { createRef } from '../../preact-10.7.js';

export class SearchInput extends Component {
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

        if (this.props.debounce) {
            if (this.timer) {
                clearTimeout(this.timer);
            }
            this.timer = setTimeout(() => {
                this.props.onChange(event.target.value);
            }, this.props.debounce);
        } else {
            this.props.onChange(event.target.value);
        }
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
         <div className=${'search-input-outer' + (this.props.small ? ' small': '')}>
            <svg height="20" class="search-input-icn" viewBox="0 0 512 512"><path d="M221.09 64a157.09 157.09 0 10157.09 157.09A157.1 157.1 0 00221.09 64z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M338.29 338.29L448 448"/></svg>
            <input class="w-100" 
                ref=${this.inp} 
                type="text" 
                value=${this.state.input} 
                onInput=${(e) => this.onInputChange(e)}
                placeholder=${this.props.placeholder || 'Search'}/>

            ${this.state.input && this.state.input.length && html`
                <svg onClick=${this.clear.bind(this)} 
                    height="20" 
                    class="search-clear-icn" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>
            `}
        </div>
      `;
    }
  }


