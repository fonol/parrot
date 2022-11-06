import { html, Component } from '../preact-bundle.js'
import { SearchInput } from './common/SearchInput.js'
import { Checkbox } from './common/Checkbox.js'

export class PackageBrowserPane extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        loadingSymbols: false,
        loadingPackages: false,
        packageSearchInput: '',
        symbolSearchInput: '',
        activePackage: null,
        packages: [],
        symbols: [],
        incFunctions: true,
        incClasses: true,
        incMacros: true,
        incVars: true

      };
    } 
    refresh() {
        this.fetchPackages();
    }
    componentDidMount() {
    }
    componentDidUpdate(prevProps) {
     
    }
    onPackageSearchInputChange(newVal) {
        this.setState({ packageSearchInput: newVal });
    }
    onSymbolSearchInputChange(newVal) {
        this.setState({ symbolSearchInput: newVal });
    }
    fetchPackages() {
        let self = this;
        this.setState({ loadingPackages: true, packages: [] }, () => {
            backend.getAllPackages()
                .then((pjson) => {
                    let packageList = JSON.parse(pjson);
                    let newActivePackage = packageList.includes(self.state.activePackage) ? self.state.activePackage : null;
                    self.setState({ packages: JSON.parse(pjson), activePackage: newActivePackage, loadingPackages: false }, self.fetchSymbolsInPackage);
                });
        });
    }
    fetchSymbolsInPackage() {
        this.setState({ symbols: [] });
        if (!this.state.activePackage) {
            return;
        }
        this.setState({ loadingSymbols: true });
        let self = this;
        backend.getSymbolsInPackage(this.state.activePackage,
            this.state.incVars,
            this.state.incFunctions,
            this.state.incClasses,
            this.state.incMacros
        ).then(symbolList => {
            self.setState({ symbols: JSON.parse(symbolList), loadingSymbols: false });
        })
    }
    onPackageClick(packageName) {
        this.setState({ activePackage: packageName }, this.fetchSymbolsInPackage);
    }
    packagesFiltered() {
        if (this.state.packageSearchInput.trim() === '') {
            return this.state.packages;
        }
        return this.state.packages.filter(p => p.toLowerCase().includes(this.state.packageSearchInput.toLowerCase()));
    }
    symbolsFiltered() {
        if (this.state.symbolSearchInput.trim() === '') {
            return this.state.symbols;
        }
        return this.state.symbols.filter(p => p.toLowerCase().includes(this.state.symbolSearchInput.toLowerCase()));
    }
    toggleClasses() {
        this.setState({ incClasses: !this.state.incClasses }, this.fetchSymbolsInPackage);
    }
    toggleFunctions() {
        this.setState({ incFunctions: !this.state.incFunctions }, this.fetchSymbolsInPackage);
    }
    toggleVars() {
        this.setState({ incVars: !this.state.incVars }, this.fetchSymbolsInPackage);
    }
    toggleMacros() {
        this.setState({ incMacros: !this.state.incMacros }, this.fetchSymbolsInPackage);
    }
   
    render() {
        let packageFilterActive = this.state.packageSearchInput.trim().length > 0;
        let symbolFilterActive = this.state.symbolSearchInput.trim().length > 0;
        let hasPackageLoaded = this.state.activePackage !== null;
        return html`
            <div class="flex-col flex-1 overflow-hidden">
                <div class="overflow-hidden flex-col" style="flex: 1">
                    <div class="package-browser-section-header flex-row flex-center flex-between">
                        ${packageFilterActive && html`
                            <div>
                                ${this.packagesFiltered().length} packages matching your search 
                            </div>
                        `}
                        ${!packageFilterActive && html`
                            <div>
                                PACKAGES (${this.packagesFiltered().length})
                            </div>
                        `}
                        <div class="btn-icon icon-only" onClick=${this.refresh.bind(this)} title="Refresh">
                            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M18.537 19.567A9.961 9.961 0 0 1 12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10c0 2.136-.67 4.116-1.81 5.74L17 12h3a8 8 0 1 0-2.46 5.772l.997 1.795z"/></svg>
                        </div>
                    </div>
                    <div class="package-browser-section-body">
                        <${SearchInput}
                            small=${true}
                            debounce=${500}
                            onChange=${(newVal) => this.onPackageSearchInputChange(newVal)}
                            placeholder="Filter Packages"
                            value=${this.state.packageSearchInput}>
                        </${SearchInput}>
                        <div class="flex-1 mt-10 overflow-auto" style="position: relative">
                            ${this.state.loadingPackages && html`
                                <div class="overlay">
                                    <div class="lds-ripple">
                                        <div></div>
                                        <div></div>
                                    </div>
                                </div>
                            `}
                            ${this.packagesFiltered().map(p => html`
                                <div onClick=${() => this.onPackageClick(p)} className=${'link-like' + (this.state.activePackage === p ? ' text-active': '')}>${p}</div>
                            `)}
                        </div>
                    </div>
                </div>
                <div class="overflow-hidden flex-col" style="flex: 1">
                    ${hasPackageLoaded && symbolFilterActive && html`
                        <div class="package-browser-section-header">${this.symbolsFiltered().length} symbols matching in ${this.state.activePackage}</div>
                    `}
                    ${hasPackageLoaded && !symbolFilterActive && html`
                        <div class="package-browser-section-header">${this.symbolsFiltered().length} symbols in ${this.state.activePackage}</div>
                    `}
                    ${!hasPackageLoaded && html`
                        <div class="package-browser-section-header">Click a package to load its symbols</div>
                    `}
                    <div class="package-browser-section-body">
                        <${SearchInput}
                            small=${true}
                            debounce=${500}
                            onChange=${(newVal) => this.onSymbolSearchInputChange(newVal)}
                            placeholder="Filter Symbols"
                            value=${this.state.symbolSearchInput}>
                        </${SearchInput}>
                        <div class="flex-row text-secondary mt-5" style="justify-content: center">
                            <div class="cb-with-label mr-5" onClick=${this.toggleFunctions.bind(this)}>
                                <small>Functions</small>
                                <${Checkbox} value=${this.state.incFunctions}></${Checkbox}>
                            </div>
                            <div class="cb-with-label mr-5" onClick=${this.toggleMacros.bind(this)}>
                                <small>Macros</small>
                                <${Checkbox} value=${this.state.incMacros} ></${Checkbox}>
                            </div>
                            <div class="cb-with-label mr-5" onClick=${this.toggleClasses.bind(this)}>
                                <small>Classes</small>
                                <${Checkbox} value=${this.state.incClasses} ></${Checkbox}>
                            </div>
                            <div class="cb-with-label mr-5" onClick=${this.toggleVars.bind(this)}>
                                <small>Variables</small>
                                <${Checkbox} value=${this.state.incVars} ></${Checkbox}>
                            </div>
                        </div>
                        <div class="flex-1 mt-10 overflow-auto" style="position: relative">
                            ${this.state.loadingSymbols && html`
                                <div class="overlay">
                                    <div class="lds-ripple">
                                        <div></div>
                                        <div></div>
                                    </div>
                                </div>
                            `}
                            ${this.symbolsFiltered().map(s => html`
                                <div class="link-like">${s}</div>
                            `)}
                        </div>
                    </div>
                </div>
            </div>
      `;
    }
  }