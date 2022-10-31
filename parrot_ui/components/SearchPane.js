import { html, Component } from '../preact-bundle.js'
import { SearchInput } from './common/SearchInput.js'

export class SearchPane extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        input: '',
        results: [],
        ignoreCase: true,
        regex: false,
        tooManyResults: false,
        matchCount: 0,
        fileCount: 0,

        noFolderOpened: !window.app.hasOpenedFolder()
      };
      $bus.on('file-saved', this.refresh.bind(this));
    } 
    refresh() {
        this.setState({
            noFolderOpened: !window.app.hasOpenedFolder(),
        }, this.fetchResults);
    }
    componentDidMount() {
    }
    componentDidUpdate(prevProps) {
     
    }
    onInputChange(newVal) {
        this.setState({ input: newVal }, this.fetchResults);

    }
    toggleIgnoreCase() {
        this.setState({ ignoreCase: !this.state.ignoreCase }, this.fetchResults);
    }
    toggleRegex() {
        this.setState({ regex: !this.state.regex }, this.fetchResults);
    }
    fetchResults() {
        if (this.state.input === '') {
            this.setState({
                results: [],
                tooManyResults: false,
                matchCount: 0,
                fileCount: 0
            });
            return;
        }
        let self = this;
        backend.searchSourceFiles(this.state.input, this.state.ignoreCase, this.state.regex)
            .then(sr => {
                self.setState({
                    results: sr.results,
                    tooManyResults: sr.too_many_results,
                    matchCount: sr.match_count,
                    fileCount: sr.file_match_count
                });
            })
            .catch(notifications.error);
    }
    mark(ctx, toMark, ix) {
        return ctx.substring(0, ix) + '<mark>' + toMark + '</mark>' + ctx.substring(ix+ toMark.length, ctx.length);
    }
    jumpTo(file, line, col) {
        $bus.trigger('jump', {file: file, line: line, col: col});
    }



   
    render() {
      return html`
            <div class="flex-col overflow-hidden">
                ${this.state.noFolderOpened && html`
                    <div class="flex-1 flex-center p-15">Please first open a folder to be able to use the search.</div>
                `}
                ${!this.state.noFolderOpened && html`
                    <div class="flex-row">
                        <${SearchInput}
                            debounce=${500}
                            onChange=${(newVal) => this.onInputChange(newVal)}
                            value=${this.state.input}
                        >
                        </${SearchInput}>
                        <div class="ml-10 flex-row flex-stretch">
                            <div title="Use Regular Expression" className=${'search-pane__search-option-btn ' + (this.state.regex ? 'active': '')} onClick=${this.toggleRegex.bind(this)}>
                                (.*)
                            </div>
                            <div title="Match Case" className=${'search-pane__search-option-btn ' + (this.state.ignoreCase ? '': 'active')} onClick=${this.toggleIgnoreCase.bind(this)}>
                                Aa 
                            </div>
                        </div>
                    </div>
                    ${this.state.results.length > 0 && html`
                        <div class="mb-10 mt-15 text-secondary">
                            ${this.state.matchCount} result${this.state.matchCount !== 1 ? 's' : ''} in ${this.state.fileCount} file${this.state.fileCount !== 1 ? 's' : ''}
                        </div>
                        ${this.state.tooManyResults && html`
                            <div class="mb-10 mt-5 text-danger">
                                Found too many results to display. Try to narrow down your search.
                            </div>
                        `}
                    `}
                    <div class="flex-1 overflow-auto">
                        ${this.state.input !== '' && this.state.results.length === 0 && html`
                            <div class="text-secondary mt-20">Found no results.</div>
                        `}
                        ${this.state.results.map(r => html`
                            <details class="search-result-group" open>
                                <summary>
                                    ${r.file_name}
                                </summary>
                                <div>
                                    ${r.matches.map(m => html`
                                        <div class="match"
                                        onClick=${()=>{this.jumpTo(r.path_to_file, m.line, m.col)}}
                                        dangerouslySetInnerHTML=${{ __html: this.mark(m.context, m.to_mark, m.col) }}>
                                        </div>
                                    `)}
                                </div>
                            </details>
                        `)}
                    </div>
                `}
            </div>
      `;
    }
  }