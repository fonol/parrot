import { html, Component } from '../preact-bundle.js'
import { NameInput } from './common/NameInput.js';
import { createRef } from '../preact-10.7.js';

export class DeleteFileDialog extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        path: props.path,
        confirm: ''
      };
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
           this.setState({path: this.props.path  });
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
        window.backend.deleteMdFileFromAbsPath(this.state.path)
            .then(function() {
                window.notifications.show('Note deleted.');
                self.props.ok();
            })
            .catch(function(errMessage) {
                window.notifications.show(errMessage);
                console.log(errMessage);
            })
    }
    canAccept() {
        return this.state.confirm === 'DELETE';
    }
   
    render() {
      return html`
            <div class="modal-bg">
                    <div class="modal" >
                        <div class="modal-header">
                            Delete file
                        </div>
                        <div class="modal-body overflow-hidden">
                            <div class="mb-10"><small>Type DELETE to confirm</small></div>
                            <${NameInput}
                                ref=${this.nameInp}
                                placeholder="Type DELETE to confirm"
                                value=${this.state.confirm}
                                onChange=${(newVal) => this.setState({confirm: newVal})}
                            ><//>
                        </div>
                        <div class="modal-footer flex-row flex-between flex-center">
                            <button class="mr-5 secondary" onClick=${this.cancel.bind(this)}>Close</button>
                            <button className=${this.canAccept() ? 'delete': 'disabled delete'} onClick=${this.accept.bind(this)}>Delete</button>
                        </div>
                    </div>
                </div>
      `;
    }
  }