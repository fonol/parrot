import { createRef } from '../../preact-10.7.js';
import { html, Component } from '../../preact-bundle.js'

export class EditorSearchReplaceBox extends Component {
    constructor(props) {
      super(props);
        this.state = { 
            mode: props.initMode || 'search',
            regex: false,
            ignoreCase: true,
            search: '',
            replace: '',
            matches: 0,
            matchActive: 0
      };
      this.findInp = createRef();
        if (typeof (this.props.onSearch) !== 'function') {
            console.warn("[EditorSearchReplaceBox] missing prop onSearch");
        }
        if (typeof (this.props.onReplace) !== 'function') {
            console.warn("[EditorSearchReplaceBox] missing prop onReplace");
        }
        if (typeof (this.props.onSearchInputChanged) !== 'function') {
            console.warn("[EditorSearchReplaceBox] missing prop onSearchInputChanged");
        }
        if (typeof (this.props.onClose) !== 'function') {
            console.warn("[EditorSearchReplaceBox] missing prop onClose");
        }
        if (typeof (this.props.matches) !== 'number') {
            console.warn("[EditorSearchReplaceBox] missing prop matches");
        }
        if (typeof (this.props.matchActive) !== 'number') {
            console.warn("[EditorSearchReplaceBox] missing prop matchActive");
        }
    }
    componentDidMount() {
        this.findInp.current.focus();
    }
    componentDidUpdate(oldProps) {
        if (oldProps.matches !== this.props.matches) {
            this.setState({ matches: this.props.matches });
            this.forceUpdate();
        }
        if (oldProps.matchActive !== this.props.matchActive) {
            this.setState({ matchActive: this.props.matchActive });
            this.forceUpdate();
        }
    }
    toggleMode() {
        if (this.state.mode === 'search') {
            this.setState({ mode: 'replace' });
        } else {
            this.setState({ mode: 'search' });
        }
    }
    toggleRegex() {
        let self = this;
        this.setState({ regex: !this.state.regex }, () => {
            self.props.onSearchInputChanged(self.state.search, self.state.regex, self.state.ignoreCase);
        });
    }
    toggleIgnoreCase() {
        let self = this;
        this.setState({ ignoreCase: !this.state.ignoreCase }, () => {
            self.props.onSearchInputChanged(self.state.search, self.state.regex, self.state.ignoreCase);
        });
    }
    onFindKeyDown(e) {
        if (e.key === 'Enter') {
            if (this.state.search.length > 0) {
                this.props.onSearch(this.state.search, this.state.regex, this.state.ignoreCase);
            }
        } else if (e.key == 'Escape') {
            this.props.onClose();
        }
    }
    onSearchInput(e) {
        this.setState({ search: e.target.value });
        this.props.onSearchInputChanged(e.target.value, this.state.regex, this.state.ignoreCase);
    } 
    onReplaceKeyDown(e) {
        if (e.key === 'Enter' && this.state.search.length > 0) {
            this.props.onReplace(this.state.search, this.state.replace);
        } else if (e.key == 'Escape') {
            this.props.onClose();
        }
    }

    render() {
        return html`
            <div class="editor__search-replace-box">
                <div>
                    <button class="editor__search-replace-box__mode-btn" onClick=${this.toggleMode.bind(this)}>
                        ${this.state.mode === 'search' && html`
                            <svg data-icon="chevron-right" height="14" width="14" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>
                        `}
                        ${this.state.mode === 'replace' && html`
                            <svg data-icon="chevron-down" height="14" width="14" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M112 184l144 144 144-144"/></svg>
                        `}
                    </button>
                </div>
                <div class="flex-col">
                    <div class="flex-row">
                        <input placeholder="Find"
                            autocomplete="off"
                            spellcheck="false"
                            onKeyDown=${this.onFindKeyDown.bind(this)}
                            ref=${this.findInp}
                            value=${this.state.search} 
                            onInput=${this.onSearchInput.bind(this)}/>
                        <div class="ml-10 flex-row flex-stretch">
                            <div title="Use Regular Expression" className=${'search-pane__search-option-btn ' + (this.state.regex ? 'active': '')} onClick=${this.toggleRegex.bind(this)}>
                                (.*)
                            </div>
                            <div title="Match Case" className=${'search-pane__search-option-btn ' + (this.state.ignoreCase ? '': 'active')} onClick=${this.toggleIgnoreCase.bind(this)}>
                                Aa 
                            </div>
                        </div>
                        <div class="ml-5 flex-col flex-center ta-center" style="min-width: 100px">
                            ${this.state.search.length > 0 && this.state.matches === 0 && html`
                                <small class="text-danger">No results.</small>
                            `}
                            ${this.state.search.length === 0 && html`
                                <small class="text-muted">No results.</small>
                            `}
                            ${this.state.search.length > 0 && this.state.matches > 0 && html`
                                <small> ${this.state.matchActive} of ${this.state.matches}</small>
                            `}
                        </div>
                    </div>
                    ${this.state.mode === 'replace' && html`
                        <input
                         autocomplete="off"
                         spellcheck="false"
                         onKeyDown=${this.onReplaceKeyDown.bind(this)}
                         class="mt-5" value=${this.state.replace} onInput=${e => this.setState({ replace: e.target.value })} placeholder="Replace"/>
                    `}

                </div>
                <div>
                    <button class="editor__search-replace-box__mode-btn" onClick=${this.props.onClose}>
                        <svg height="20" width="20"  viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>
                    </button>
                </div>
            </div>
        `;
    }
  }