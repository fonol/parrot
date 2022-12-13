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
            this.props.onReplace(this.state.search, this.state.replace, this.state.regex, this.state.ignoreCase);
        } else if (e.key == 'Escape') {
            this.props.onClose();
        }
    }
    onReplaceClicked() {
        if (this.state.search.length > 0) {
            this.props.onReplace(this.state.search, this.state.replace, this.state.regex, this.state.ignoreCase);
        }
    }
    onReplaceAllClicked() {
        if (this.state.search.length > 0) {
            this.props.onReplaceAll(this.state.search, this.state.replace, this.state.regex, this.state.ignoreCase);
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
                        <div class="flex-row mt-5">
                            <input
                            autocomplete="off"
                            spellcheck="false"
                            onKeyDown=${this.onReplaceKeyDown.bind(this)}
                            value=${this.state.replace} onInput=${e => this.setState({ replace: e.target.value })} placeholder="Replace"/>
                            <div class="search-pane__search-option-btn ml-10" title="Replace" onClick=${this.onReplaceClicked.bind(this)}>
                                <svg height="20" width="20" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zM16.659 9A6 6 0 0 0 11 5c-3.315 0-6 2.685-6 6h2a4.001 4.001 0 0 1 5.91-3.515L12 9h4.659zM17 11h-2a4.001 4.001 0 0 1-5.91 3.515L10 13H5.341A6 6 0 0 0 11 17c3.315 0 6-2.685 6-6z"/></svg>
                            </div>
                            <div class="search-pane__search-option-btn ml-5" title="Replace All" onClick=${this.onReplaceAllClicked.bind(this)}>
                                <svg height="20" width="20" class="mr-5" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zM16.659 9A6 6 0 0 0 11 5c-3.315 0-6 2.685-6 6h2a4.001 4.001 0 0 1 5.91-3.515L12 9h4.659zM17 11h-2a4.001 4.001 0 0 1-5.91 3.515L10 13H5.341A6 6 0 0 0 11 17c3.315 0 6-2.685 6-6z"/></svg>
                                all
                            </div>
                        </div>
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