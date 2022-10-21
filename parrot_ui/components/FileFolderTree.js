import { html, Component } from '../preact-bundle.js'
import { TreeNode } from './TreeNode.js';
import { SubdirDialog } from './SubdirDialog.js';
import { ConfirmDeleteDirDialog } from './ConfirmDeleteDirDialog.js';
import { ConfirmDeleteFileDialog } from './ConfirmDeleteFileDialog.js';

// 
// shown on startup if no folder selected
//

export class FileFolderTree extends Component {
    constructor(props) {
        super(props);
        if (!this.props.tree) {
            console.warn('FileFolderTree: tree prop missing.');
        }
        if (!this.props.context) {
            console.warn('FileFolderTree: context prop missing.');
        }
        if (!this.props.onSubdirectoryCreated) {
            console.warn('FileFolderTree: onSubdirectoryCreated prop missing.');
        }
        if (!this.props.onNeedRefresh) {
            console.warn('FileFolderTree: onNeedRefresh prop missing.');
        }
        if (!this.props.path) {
            console.warn('FileFolderTree: path prop missing.');
        }
        this.state = {
            subdir : {
                show: false,
                path: null
            },
            deleteDir: {
                show: false,
                path: null
            },
            deleteFile: {
                show: false,
                path: null
            },
            path: props.path
        }
    }
    componentDidMount() { }
    componentDidUpdate(prevProps) {
        if (this.props.path !== prevProps.path) {
            this.setState({ path: this.props.path });
        }
    }

    showSubdirDialog(path) {
        this.setState(state => {
            state.subdir.show = true;
            state.subdir.path = path;
            return state;
        })
    }
    showDeleteFileDialog(path) {
        let self = this;
        self.setState(state => {
            state.deleteFile.show = true;
            state.deleteFile.path = path;
            return state;
        })
    }
    onDeleteFileAccept() {
        this.deleteFile(this.state.deleteFile.path);
        this.setState(state => {
            state.deleteFile.show = false;
            state.deleteFile.path = null;
            return state;
        })
    }
    deleteFile(path) {
        let self = this;
        backend.deleteFile(path)
            .then(() => {
                self.props.onNeedRefresh();
                notifications.show("File deleted.");
            }).catch(notifications.error);
    }
    showDeleteDirDialog(path) {
        let self = this;
        backend.dirIsEmpty(path)
            .then((empty) => {
                if (empty) {
                    self.deleteDir(path);
                } else {
                    self.setState(state => {
                        state.deleteDir.show = true;
                        state.deleteDir.path = path;
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
            self.props.onNeedRefresh();
        }).catch(window.notifications.error);
    }
    onDeleteDirAccept() {
        this.deleteDir(this.state.deleteDir.path)
        this.setState(state => {
            state.deleteDir.show = false;
            state.deleteDir.path = null;
            return state;
        });
    }
    onSubdirDialogHide() {
        this.setState(state => {
            state.subdir.show = false;
            state.subdir.path = null;
            return state;
        });
        if (this.props.onSubdirectoryCreated) {
            this.props.onSubdirectoryCreated();
        }
    }

    /**
     * Private
     */

    render() {
        return html`
            <div class="tree-wrapper h-100">
                <div class="flex-row flex-right mb-5">
                    <div class="btn-icon icon-only" onClick=${() => this.props.onNeedRefresh() } title="Refresh">
                        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M18.537 19.567A9.961 9.961 0 0 1 12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10c0 2.136-.67 4.116-1.81 5.74L17 12h3a8 8 0 1 0-2.46 5.772l.997 1.795z"/></svg>
                    </div>
                    <div class="btn-icon icon-only" onClick=${()=> window.app.openNewFileDialog(null) } title="New File">
                        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M15 4H5v16h14V8h-4V4zM3 2.992C3 2.444 3.447 2 3.999 2H16l5 5v13.993A1 1 0 0 1 20.007 22H3.993A1 1 0 0 1 3 21.008V2.992zM11 11V8h2v3h3v2h-3v3h-2v-3H8v-2h3z"/></svg>
                    </div>
                    <div class="btn-icon icon-only" onClick=${()=> this.showSubdirDialog(this.state.path) } title="New Folder">
                        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M12.414 5H21a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7.414l2 2zM4 5v14h16V7h-8.414l-2-2H4zm7 7V9h2v3h3v2h-3v3h-2v-3H8v-2h3z"/></svg>
                    </div>

                </div>
                <div class="overflow-auto flex-1">
                    <ul class="mt-0">
                        ${this.props.tree.children.map(n => html`
                        <${TreeNode} 
                            onLeftClicked=${this.props.onLeftClicked ? this.props.onLeftClicked: null} 
                            onShowSubdirectoryCreateDialog=${this.showSubdirDialog.bind(this)} 
                            onShowDeleteDirectoryDialog=${this.showDeleteDirDialog.bind(this)} 
                            onShowFileDeleteDialog=${this.showDeleteFileDialog.bind(this)} 
                            context=${this.props.context} 
                            node=${n}></${TreeNode}>
                        `)}
                    </ul>
                </div>
                ${this.state.subdir.show && html`
                    <${SubdirDialog} path=${this.state.subdir.path} hide=${this.onSubdirDialogHide.bind(this)}
                    ></${SubdirDialog}>
                `}
                ${this.state.deleteDir.show && html`
                    <${ConfirmDeleteDirDialog} 
                        accept=${this.onDeleteDirAccept.bind(this)}
                        cancel=${() => { this.setState(st => { st.deleteDir.show = false; return st; })}}
                    ></${ConfirmDeleteDirDialog}>
                `}
                ${this.state.deleteFile.show && html`
                    <${ConfirmDeleteFileDialog} 
                        accept=${this.onDeleteFileAccept.bind(this)}
                        cancel=${() => { this.setState(st => { st.deleteFile.show = false; return st; })}}
                    ></${ConfirmDeleteFileDialog}>
                `}

            </div>`;
    }
}
