import { html, Component } from '../preact-bundle.js'
import { LispFileNameInput } from './common/LispFileNameInput.js';
import { createRef } from '../preact-10.7.js';
import { fileNameIsValid } from '../scripts/utils.js';

export class NewLispFileDialog extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        path: props.path,
        name: ''
      };
      if (!props.path) {
        console.warn("NewFileDialog: 'path' prop missing.");
      }
      if (!props.accept) {
        console.warn("NewFileDialog: 'accept' prop missing.");
      }
      if (!props.hide) {
        console.warn("NewFileDialog: 'hide' prop missing.");
      }
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
        window.backend.addLispFile(this.state.path, this.state.name)
            .then(function(path) {
                if (self.props.accept) {
                    self.props.accept(path);
                }
                window.notifications.show('File created.');
                self.cancel();
            })
            .catch(function(errMessage) {
                window.notifications.error(errMessage);
                console.log(errMessage);
            })
    }
    canAccept() {
        return this.state.path && this.state.path.length && this.fileNameIsValid();
    }
    fileNameIsValid() {
        return fileNameIsValid(this.state.name);
    }
   
    render() {
      return html`
            <div class="modal-bg">
                    <div class="modal" >
                        <div class="modal-header">
                            New file
                        </div>
                        <div class="modal-body overflow-hidden flex-col" style="">
                            <${LispFileNameInput}
                                ref=${this.nameInp}
                                value=${this.state.name}
                                onChange=${(newVal) => this.setState({name: newVal})}
                            ></${LispFileNameInput}>
                        </div>
                        <div class="modal-footer flex-row flex-between flex-center">
                            <button class="mr-5 secondary" onClick=${this.cancel.bind(this)}>Close</button>
                            <button className=${this.canAccept() ? '': 'disabled'} onClick=${this.accept.bind(this)}>Create</button>
                        </div>
                    </div>
                </div>
      `;
    }
  }