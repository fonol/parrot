import { html, Component } from '../preact-bundle.js'
import { LispFileNameInput } from './common/LispFileNameInput.js';
import { FolderInput } from './common/FolderInput.js';
import { createRef } from '../preact-10.7.js';
import { fileNameIsValid, getLeafNameWithoutExtension } from '../scripts/utils.js';

export class RenameDialog extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        init: false,
        isDir: false,
        path: props.path,
        originalName: getLeafNameWithoutExtension(props.path),
        name: ''
      };
      if (!props.path) {
        console.warn("RenameDialog: 'path' prop missing.");
      }
      if (!props.accept) {
        console.warn("RenameDialog: 'accept' prop missing.");
      }
      if (!props.hide) {
        console.warn("RenameDialog: 'hide' prop missing.");
      }
      let self = this;
      backend.isDir(props.path)
        .then(v => {
            self.setState({ init: true, isDir: v });
      });
      this.nameInp = createRef();
    }
    componentDidMount() {
        let self = this;
        setTimeout(function(){
            if (self.nameInp.current) {
                self.nameInp.current.focus();
            }
        }, 100);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.path !== this.props.path) {
           this.setState({path: this.props.path, name: ''  });
        }
    }


    /**
     * Private
     */

    cancel() {
        this.props.hide();
    }
    accept() {
        let self = this;
        window.backend.renameFileOrFolder(this.state.path, this.state.name)
            .then(function(path) {
                $bus.trigger('file-renamed');
                if (self.props.accept) {
                    self.props.accept(path);
                }
                window.notifications.show(self.state.isDir ? 'Folder renamed.': 'File renamed.');
                self.cancel();
            }).catch(function(errMessage) {
                window.notifications.error(errMessage);
                console.log(errMessage);
            })
    }
    canAccept() {
        return this.state.path && this.state.path.length && this.nameIsValid();
    }
    nameIsValid() {
        return fileNameIsValid(this.state.name);
    }
   
    render() {
      return html`
            <div class="modal-bg">
                    <div class="modal" >
                        <div class="modal-header">
                            Rename ${!this.state.init ? '...': (this.state.isDir ? 'folder': 'file')} 
                        </div>
                        <div class="modal-body overflow-hidden flex-col" style="min-width: 200px">
                            <div class="text-secondary mb-5">Old name:</div>
                            ${this.state.init && this.state.isDir && html`
                                <div class="mb-20">
                                    <${FolderInput}
                                        disabled
                                        value=${this.state.originalName}
                                    ><//>
                                </div>
                                <div class="text-secondary mb-5">New name:</div>
                                <${FolderInput}
                                    ref=${this.nameInp}
                                    value=${this.state.name}
                                    placeholder="New folder name"
                                    onChange=${(newVal) => this.setState({name: newVal})}
                                ><//>
                            `}
                            ${this.state.init && !this.state.isDir && html`
                                <div class="mb-20">
                                    <${LispFileNameInput}
                                        disabled
                                        value=${this.state.originalName}
                                    ><//>
                                </div>
                                <div class="text-secondary mb-5">New name:</div>
                                <${LispFileNameInput}
                                    ref=${this.nameInp}
                                    value=${this.state.name}
                                    onChange=${(newVal) => this.setState({name: newVal})}
                                ></${LispFileNameInput}>
                            `}
                        </div>
                        <div class="modal-footer flex-row flex-between flex-center">
                            <button class="mr-5 secondary" onClick=${this.cancel.bind(this)}>Cancel</button>
                            <button className=${this.canAccept() ? '': 'disabled'} onClick=${this.accept.bind(this)}>Rename</button>
                        </div>
                    </div>
                </div>
      `;
    }
  }