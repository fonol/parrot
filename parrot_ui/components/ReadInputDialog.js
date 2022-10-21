import { html, Component } from '../preact-bundle.js'
import { createRef } from '../preact-10.7.js';
import { LispValueInput } from './common/LispValueInput.js';

export class ReadInputDialog extends Component {
    constructor(props) {
      super(props);
      this.state = { 
          info: props.info,
          input: ''
      };
      this.inp = createRef();
        if (typeof props.accept !== 'function') {
            console.warn("ReadInputDialog: accept prop missing.");
      }
    }
    componentDidMount() {
        let self = this;
        setTimeout(function(){
            if (self.inp.current) {
                self.inp.current.focus();
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
        this.props.accept(this.state.input);
    }
    canAccept() {
        return this.state.input && this.state.input.length > 0;
    }
   
    render() {
      return html`
            <div class="modal-bg">
                    <div class="modal" >
                        <div class="modal-header">
                            Set value
                        </div>
                        <div class="modal-body overflow-hidden">
                            <div class="mb-10">${this.state.info.prompt}</div>
                            <${LispValueInput}
                                ref=${this.inp}
                                value=${this.state.input}
                                onChange=${(newVal) => this.setState({input: newVal})}
                            ><//>
                        </div>
                        <div class="modal-footer flex-row flex-between flex-center">
                            <button class="mr-5 secondary" onClick=${this.cancel.bind(this)}>Close</button>
                            <button className=${this.canAccept() ? '': 'disabled'} onClick=${this.accept.bind(this)}>Set value</button>
                        </div>
                    </div>
                </div>
      `;
    }
  }