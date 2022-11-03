import { html, Component } from '../preact-bundle.js'
import { createRef } from '../preact-10.7.js';
import { EditorTabs } from './EditorTabs.js';
import { ConfigDiagnosticsDialog } from './ConfigDiagnosticsDialog.js';
import { FileFolderTree } from './FileFolderTree.js';
import { getLeafNameWithoutExtension } from '../scripts/utils.js';
import { NewLispFileDialog } from './NewLispFileDialog.js';
import { Settings } from './Settings.js';
import { DebugOverlay } from './DebugOverlay.js';
import { REPL } from './REPL.js';
import { ReadInputDialog } from './ReadInputDialog.js';
import { RenameDialog } from './RenameDialog.js';
import { ConfirmDeleteDirDialog } from './ConfirmDeleteDirDialog.js';
import { SBCLOutputDialog } from './SBCLOutputDialog.js';
import { SearchPane } from './SearchPane.js';
import { PackageBrowserPane } from './PackageBrowserPane.js';
import { FoundDefinitionsDialog } from './FoundDefinitionsDialog.js';

export class App extends Component {
    constructor(props) {
        super(props);

        let lastOpenedFolders = window.state.getOrDefault('lastOpenedFolders', []);
        this.state = {
            initialLoadFinished: false,
            folder: '',
            lastOpenedFolders: lastOpenedFolders,
            tree: null,
            loadingTree: false,
            navActive: 'tree',

            newFileDialog: {
                show: false,
                folder: null
            },
            renameDialog: {
                show: false,
                path: null
            },
            deleteDirDialog: {
                show: false,
                path: null
            },
            foundDefsDialog: {
                show: false,
                data: []
            },
            showSettings: false,
            configDiagnostics: null,
            debug: null,
            debugReadInfo: null,
            showSBCLOutputDialog: false


        };
        // refs
        window.app = this;

        this.repl = createRef();
        this.termCol = createRef();
        this.tabs = createRef();
        this.search = createRef();
        this.packages = createRef();
        this.initTermColW = window.state.getOrDefault('term-col-width', 700);

        window.$bus.on('show-rename', this.showRenameDialog.bind(this));
        window.$bus.on('show-new-file', this.showNewFileDialog.bind(this));
        window.$bus.on('show-delete-dir', this.showDeleteDirDialog.bind(this));
    }
    componentDidMount() {
        console.log('App::componentDidMount()');

        this.checkConfig();
    }
    checkConfig() {
        let self = this;
        backend.checkConfig()
            .then(diagnostics => {
                if (diagnostics.ok) {
                    backend.initRepl()
                        .then(() => {
                            self.setState({ initialLoadFinished: true });
                            console.log("after backend.initRepl.");
                        });
                } else {
                    self.setState({ configDiagnostics: diagnostics, initialLoadFinished: true });
                }
            })

    }
    refreshTree() {
        if (this.state.folder && this.state.folder.length) {
            let self = this;
            this.setState({ loadingTree: true });
            backend.getFileTree(this.state.folder)
            .then((tree) => {
                self.setState({ tree: JSON.parse(tree), loadingTree: false });
            })
            .catch(window.notifications.error);
        } else {
            this.setState({ tree: null });
        }
    }
    openFile(fpath) {
        this.tabs.current.open(fpath);
    }
    onTreeLeftClick(path) {
        this.openFile(path);
    }
    async showOpenFolderDialog() {
        var folder = await window.__TAURI__.dialog.open({
            directory: true,
            multiple: false,
            defaultPath: '~'
          });
        if (folder && folder.length) {
            this.setState({ folder: folder });
            this.openFolder(folder);
        }
    }
    hasOpenedFolder() {
        return this.state.folder && this.state.folder !== '';
    }
    openFolder(folder) {

        let lastOpened = state.getOrDefault('lastOpenedFolders', []);
        lastOpened.push(folder);
        if (lastOpened.length > 10) {
            lastOpened.splice(0, lastOpened.length - 10);
        }
        this.setState({ lastOpenedFolders: lastOpened, folder: folder, loadingTree: true });
        window.openedFolder = folder;
        state.set('lastOpenedFolders', lastOpened);
        let self = this;

        backend.folderOpened(folder);
        backend.getFileTree(folder)
        .then((tree) => {
            self.setState({ tree: JSON.parse(tree), loadingTree: false });
        })
        .catch(window.notifications.error);
    }
    showSettingsDialog() {
        this.setState({ showSettings: true });
    }
    onSettingsUpdated() {
        this.tabs.current.refresh();
        this.setState({ showSettings: false });
        notifications.show('Settings updated.');
    }
    showNewFileDialog(folderPath) {
        folderPath = folderPath || this.state.folder;
        this.setState(state => {
            state.newFileDialog.show = true;
            state.newFileDialog.folder = folderPath;
            return state;
        })
    } 
    setPrompt(newPrompt) {
        this.repl.current.setPrompt(newPrompt);
    }
    debug(debugInfo) {
        this.setState({ debug: debugInfo });
    }
    debugReturn() {
        this.setState({ debug: null });
    }
    onReplRestart() {
        this.setState({ debug: null });
    }
    readInput(info) {
        this.setState({ debugReadInfo: info });
    }
    onDebugReadValueAccept(value) {
        window.backend.replEmacsReturn(value, this.state.debugReadInfo.thread, this.state.debugReadInfo.tag);
        this.setState({ debugReadInfo: null });
    }
    writeToREPL(text) {
        this.repl.current.write(text);
    }
    writeToREPLError(text) {
        this.repl.current.writeError(text);
    }
    replFailedToInit(message) {
        console.log('App::replFailedToInit()')
        window.notifications.error(message);
        this.setState({ initialLoadFinished: true });
        this.repl.current.writeError(message);
    }
    handleFoundDefinitions(foundDefs) {
        let defs = foundDefs.definitions;
        if (!defs.length) {
            window.notifications.error('Did not find any definitions.');
        } else if (defs.length === 1) {
            if (defs[0].error) {
                notifications.error(defs[0].error);
            } else {
                this.tabs.current.openAtPosition(defs[0].file, defs[0].position);
            }
        } else {
            // show overlay asking for which file
            this.setState(s => {
                s.foundDefsDialog.show = true;
                s.foundDefsDialog.data = defs;
                return s;
            });
        }
    }
    onEditorTermSepMouseDown(e) {

        let termWidth = this.termCol.current.offsetWidth;
        this.hResizeStart = e.pageX;
        this.hResizeInitialTermWidth = termWidth;
        this.hResizeDebounce = 0;

        document.body.classList.add('resizing')
        document.onmouseup = this.onEditorTermResizeStop.bind(this);
        document.onmousemove = this.onEditorTermResize.bind(this);
    }
    onEditorTermResizeStop(e) {
        document.onmouseup = null;
        document.onmousemove = null;
        document.body.classList.remove('resizing')
        let diff = e.pageX - this.hResizeStart;
        let finalW = this.hResizeInitialTermWidth - diff;
        window.state.set('term-col-width', finalW);
    }
    onEditorTermResize(e) {
        let diff = e.pageX - this.hResizeStart;
        this.hResizeDebounce++;
        if (this.hResizeDebounce % 2 === 0) {
            this.termCol.current.style.flex = `0 0 ${this.hResizeInitialTermWidth - diff}px`;
            this.repl.current.refresh(); 
        }
    }
    onConfigDiagnosticsAccepted() {
        this.setState({ configDiagnostics: null }, this.checkConfig);
    }
    showSBCLOutputDialog() {
        this.setState({ showSBCLOutputDialog: true});
    }
    showRenameDialog(path) {
        this.setState(s => {
            s.renameDialog.show = true;
            s.renameDialog.path = path;
            return s;
        })
    }
    
    onRenameDialogAccepted(newFullPath) {
        this.setState(s => {
            s.renameDialog.show = false;
            s.renameDialog.path = null;
            return s;
        })
    }
    showDeleteDirDialog(path) {
        let self = this;
        backend.dirIsEmpty(path)
            .then((empty) => {
                if (empty) {
                    self.deleteDir(path);
                } else {
                    self.setState(state => {
                        state.deleteDirDialog.show = true;
                        state.deleteDirDialog.path = path;
                        return state;
                    })
                }
            })
    }
    deleteDir(path) {
        backend.deleteDir(path)
        .then(() => {
            window.notifications.show("Deleted directory.");
            $bus.trigger('dir-deleted');
        }).catch(window.notifications.error);
    }
    onDeleteDirAccept() {
        this.deleteDir(this.state.deleteDirDialog.path)
        this.setState(state => {
            state.deleteDirDialog.show = false;
            state.deleteDirDialog.path = null;
            return state;
        });
    }
    onNavClicked(navCat) {
        if (this.state.navActive === navCat) {
            this.setState({ navActive: null });
        } else {
            this.setState({ navActive: navCat });
            if (navCat === 'search') {
                this.search.current.refresh();
            }
            if (navCat === 'packages') {
                this.packages.current.refresh();
            }
        }
    }
    render() {
        return html`
        <div id="app">  
            <div class="menu-bar">
                <div class="menu-bar__item">
                    File
                    <div class="menu-bar__drop">
                        <div class="menu-bar__drop__item" onClick=${this.showOpenFolderDialog.bind(this)}>Open folder ...</div>
                        <div class="menu-bar__drop__item">Save image ...</div>
                        <div class="menu-bar__drop__item" onClick=${this.showSettingsDialog.bind(this)}>Settings ...</div>
                        ${this.state.lastOpenedFolders.length > 0 && html`
                            <hr/>
                            ${this.state.lastOpenedFolders.filter((v, i, a) => a.indexOf(v) === i).map(f => html`
                                <div class="menu-bar__drop__item" onClick=${() => this.openFolder(f)}>Open: ${getLeafNameWithoutExtension(f)}</div>
                            `)}
                        `}
                    </div>
                </div>
                <div class="menu-bar__item">
                    Edit
                    <div class="menu-bar__drop">
                        <div class="menu-bar__drop__item" onClick=${() => { this.setState({ navActive: 'search' }); this.search.current.refresh(); }}>Find in files ...</div>
                        <div class="menu-bar__drop__item">Replace in files ...</div>
                    </div>
                </div>
                <div class="menu-bar__item">
                    SBCL
                    <div class="menu-bar__drop">
                        <div class="menu-bar__drop__item" onClick=${this.showSBCLOutputDialog.bind(this)}>View SBCL process output</div>
                    </div>
                </div>

            </div>
            <div class="flex-row flex-1 overflow-hidden">
                <div class="nav-pane">
                    <svg className=${this.state.navActive === 'tree' ? 'active': ''} onClick=${() => this.onNavClicked('tree')}  height="25" width="25" viewBox="0 0 512 512"><path d="M384 80H128c-26 0-43 14-48 40L48 272v112a48.14 48.14 0 0048 48h320a48.14 48.14 0 0048-48V272l-32-152c-5-27-23-40-48-40z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M48 272h144M320 272h144M192 272a64 64 0 00128 0"/></svg>
                    <svg className=${this.state.navActive === 'search' ? 'active': ''} onClick=${() => this.onNavClicked('search')}  height="25" width="25" viewBox="0 0 512 512"><path d="M221.09 64a157.09 157.09 0 10157.09 157.09A157.1 157.1 0 00221.09 64z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M338.29 338.29L448 448"/></svg>
                    <svg className=${this.state.navActive === 'packages' ? 'active': ''} onClick=${() => this.onNavClicked('packages')}  height="25" width="25" viewBox="0 0 512 512"><path d="M448 341.37V170.61A32 32 0 00432.11 143l-152-88.46a47.94 47.94 0 00-48.24 0L79.89 143A32 32 0 0064 170.61v170.76A32 32 0 0079.89 369l152 88.46a48 48 0 0048.24 0l152-88.46A32 32 0 00448 341.37z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M69 153.99l187 110 187-110M256 463.99v-200"/></svg>
                </div>
                <div className=${'tree-pane ' + (this.state.navActive === 'tree' ? '': 'hidden')}>
                    ${this.state.tree !== null && html`
                        <${FileFolderTree}
                            context="main"
                            path=${this.state.folder}
                            tree=${this.state.tree}
                            onLeftClicked=${this.onTreeLeftClick.bind(this)}
                            onNeedRefresh=${this.refreshTree.bind(this)}
                            onSubdirectoryCreated=${this.refreshTree.bind(this)}
                        ></${FileFolderTree}>
                    `}
                    ${this.state.tree === null && html`
                        <div class="text-secondary flex-col flex-1 flex-center" style="align-items: center">
                            No folder selected yet.
                            ${this.state.lastOpenedFolders.length > 0 && html`
                                <div class="mt-15">
                                    <h4 class="ta-center mt-0 mb-10">Last opened:</h4>
                                    ${this.state.lastOpenedFolders
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .map(f => html`
                                        <div class="link-like" onClick=${() => this.openFolder(f)}>${f}</div>
                                    `)}
                                </div>
                            `}
                        </div>
                    `}
                    ${this.state.loadingTree && html`
                        <div class='overlay'>
                            <div class="lds-ripple">
                                <div></div>
                                <div></div>
                            </div>
                        </div>
                    `}
                </div>
                <div className=${'tree-pane ' + (this.state.navActive === 'search' ? '': 'hidden')}>
                    <${SearchPane} ref=${this.search}>
                    </${SearchPane}>
                </div>
                <div className=${'tree-pane p-0 ' + (this.state.navActive === 'packages' ? '': 'hidden')} style="flex: 0 0 420px">
                    <${PackageBrowserPane} ref=${this.packages}>
                    </${PackageBrowserPane}>
                </div>
                <div class="flex-col flex-1 overflow-hidden" style="position: relative">
                    <${EditorTabs} ref=${this.tabs}>
                    </${EditorTabs}>
                </div>
                <div class="editor-term-sep" 
                    onmousedown=${this.onEditorTermSepMouseDown.bind(this)} 
                ></div>
                <div class="flex-col term-col" style="flex: 0 0 ${this.initTermColW}px;" ref=${this.termCol}>
                    ${this.state.debug !== null && html`
                        <${DebugOverlay}
                            info=${this.state.debug}
                            ></${DebugOverlay}>
                    `}
                    <${REPL} ref=${this.repl}
                             onRestart=${this.onReplRestart.bind(this)}
                    ></${REPL}>
                </div>
            </div>
            ${this.state.newFileDialog.show && html`
                <${NewLispFileDialog}
                    path=${this.state.newFileDialog.folder}
                    accept=${() => { this.setState(s => { s.newFileDialog.show = false; return s; }); this.refreshTree(); }}
                    hide=${() => this.setState(s => { s.newFileDialog.show = false; return s; })}
                ></${NewLispFileDialog}>
            `}
            ${this.state.showSettings && html`
                <${Settings}
                    hide=${() => { this.setState({ showSettings: false }) }}
                    accept=${this.onSettingsUpdated.bind(this)}
                ></${Settings}>
            `}
            ${this.state.configDiagnostics !== null && html`
                <${ConfigDiagnosticsDialog}
                    diagnostics=${this.state.configDiagnostics}
                    accept=${this.onConfigDiagnosticsAccepted.bind(this)}
                ></${ConfigDiagnosticsDialog}>
            `}
            ${this.state.debugReadInfo !== null && html`
                <${ReadInputDialog}
                    info=${this.state.debugReadInfo}
                    accept=${this.onDebugReadValueAccept.bind(this)}
                ></${ReadInputDialog}>
            `}
            ${this.state.showSBCLOutputDialog && html`
                <${SBCLOutputDialog}
                    hide=${() => this.setState({ showSBCLOutputDialog: false })}
                ></${SBCLOutputDialog}>
            `}
            ${this.state.renameDialog.show && html`
                <${RenameDialog}
                    path=${this.state.renameDialog.path}
                    hide=${() => this.setState(s => { s.renameDialog.show = false; return s; })}
                    accept=${this.onRenameDialogAccepted.bind(this)}
                ></${RenameDialog}>
            `}
            ${this.state.deleteDirDialog.show && html`
                <${ConfirmDeleteDirDialog} 
                    accept=${this.onDeleteDirAccept.bind(this)}
                    cancel=${() => { this.setState(st => { st.deleteDirDialog.show = false; return st; })}}
                ></${ConfirmDeleteDirDialog}>
            `}
            ${this.state.foundDefsDialog.show && html`
                <${FoundDefinitionsDialog} 
                    definitions=${this.state.foundDefsDialog.data}
                    hide=${() => { this.setState(s => { s.foundDefsDialog.show = false; return s; })}}
                ></${FoundDefinitionsDialog}>
            `}

        </div>
      `;
    }

}