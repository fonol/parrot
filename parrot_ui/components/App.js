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
                            console.log("after backend.initRepl.");
                        });
                } else {
                    self.setState({ configDiagnostics: diagnostics });
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
        this.setState({ folder: folder });
        if (folder && folder.length) {
            this.openFolder(folder);
        }
    }
    openFolder(folder) {

        let lastOpened = state.getOrDefault('lastOpenedFolders', []);
        lastOpened.push(folder);
        if (lastOpened.length > 10) {
            lastOpened.splice(0, lastOpened.length - 10);
        }
        this.setState({ lastOpenedFolders: lastOpened, folder: folder, loadingTree: true });
        state.set('lastOpenedFolders', lastOpened);
        let self = this;

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
        this.repl.current.writeError(message);
    }
    jumpTo(foundDefs) {
        if (!foundDefs.definitions.length) {
            window.notifications.error('Did not find any definitions.');
        } else if (foundDefs.definitions.length === 1) {
            this.tabs.current.openAtPosition(foundDefs.definitions[0].file, foundDefs.definitions[0].position);
        } else {
            // todo: show overlay asking for which file
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
        if (this.hResizeDebounce > 1) {
            this.termCol.current.style.flex = `0 0 ${this.hResizeInitialTermWidth - diff}px`;
            this.termFitAddon.fit();
            this.hResizeDebounce = 0;
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
        let self = this;
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
                        <div class="menu-bar__drop__item">Find in files ...</div>
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
                <div class="tree-pane">
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
                                <div mt-20>
                                    <h4 class="ta-center">Last opened:</h4>
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
                <div class="flex-col flex-1 overflow-hidden" style="position: relative">
                    <${EditorTabs}
                        ref=${this.tabs}
                    >
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

        </div>
      `;
    }

}