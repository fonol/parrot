import { html, Component } from '../../preact-bundle.js'
import { createRef } from '../../preact-10.7.js';
import { SearchInput } from '../common/SearchInput.js';
import { getLeafNameWithExtension } from '../../scripts/utils.js';

export class FileSearchBox extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        input: '', 
        searchResults: [],
        suggestions: []
    };

      this.inp = createRef();
    }
    componentDidMount() {
        this.onInputChange('');
    }
    componentDidUpdate() { }

    onInputChange(newVal) {
        this.setState({input: newVal });
        if (!newVal || !newVal.trim().length) {
            this.setState(st => {
                st.searchResults = [];

                let lastOpened = window.state.getOrDefault('last-opened', []);
                st.suggestions = lastOpened.map(fpath => { return { full_path: fpath, leaf_name: getLeafNameWithExtension(fpath) }; })
                return st;
            
            });


            return;
        } 
        window.backend.searchPDFAndMD(newVal, 30)
            .then((r) => {
                this.setState({searchResults: r, suggestions: null});
        });
    }
    focus() {
        if (this.inp.current) {
            this.inp.current.focus();
        }
    }
    onChosen(full_path) {
        this.props.onChosen(full_path);
    }

    clear() {
        this.setState({input : ''});
    }
    render() {
      return html`
        <div class="flex-col h-100">
            <${SearchInput} ref=${this.inp} onChange=${(v) => this.onInputChange(v)} value=${this.state.input}></>
            ${this.state.searchResults.length > 0 && html`
                <div class="flex-1 oflow-y-auto oflow-x-hidden mt-10">
                    ${this.state.searchResults.map(f => html`
                        <div class="menu-item search-result" onClick=${() =>this.onChosen(f.full_path)}>${f.leaf_name}</div>
                    `)}
                </div>                                        
            `}
            ${this.state.input.trim().length === 0 && html`
                <div class="flex-1 oflow-y-auto oflow-x-hidden mt-10">
                    ${this.state.suggestions.map(f => html`
                        <div class="menu-item search-result" onClick=${() =>this.onChosen(f.full_path)}>${f.leaf_name}</div>
                    `)}
                </div>                                        
            `}
        </div>
      `;
    }
  }


