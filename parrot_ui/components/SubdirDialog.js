import { html, Component } from '../preact-bundle.js'
import { FolderInput } from './common/FolderInput.js';
import { createRef } from '../preact-10.7.js';

export class SubdirDialog extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        path: props.path,
        name: ''
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
        window.backend.createSubdir(this.state.path, this.state.name)
            .then(function() {
                window.notifications.show('Subdirectory created');
                self.cancel();
            })
            .catch(function(errMessage) {
                window.notifications.error(errMessage);
                console.log(errMessage);
            })
    }
    canAccept() {
        return this.dirNameIsValid();
    }
    dirNameIsValid() {
        // todo
        if (/^ *$/g.test(this.state.name)) {
            return false;
        }

        return !/[\/\\.*'"#]/g.test(this.state.name)
    }
   
    render() {
      return html`
            <div class="modal-bg">
                    <div class="modal" >
                        <div class="modal-header">
                            Create Subdirectory
                        </div>
                        <div class="modal-body overflow-hidden">
                            <${FolderInput}
                                ref=${this.nameInp}
                                value=${this.state.name}
                                onChange=${(newVal) => this.setState({name: newVal})}
                            ><//>
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