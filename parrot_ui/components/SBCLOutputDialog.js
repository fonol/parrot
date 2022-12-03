import { html, Component } from '../preact-bundle.js'

export class SBCLOutputDialog extends Component {
    constructor(props) {
      super(props);
        this.state = {
          text: ''
       };
      if (!props.hide) {
        console.warn("SBCLOutputDialog: 'hide' prop missing.");
      }

    }
    componentDidMount() {
        this.loadText();
    }
    componentDidUpdate() { }


    /**
     * Private
     */

    cancel() {
        this.props.hide();
    }

    refresh() {
        this.loadText()
            .then(() => {
                window.notifications.show('Refreshed output.');
            })
    }
    
    loadText() {
        let self = this;
        return window.backend.getSbclProcessStdoutStderr()
            .then(text => {
                self.setState({ text: text });
            });
    }
  
   
    render() {
      return html`
            <div class="modal-bg">
                    <div class="modal" >
                        <div class="modal-header">
                           SBCL Process 
                        </div>
                        <div class="modal-body overflow-hidden flex-col" style="max-height: 700px; max-width: 1000px">
                            <div class="overflow-auto flex-1 p-10">
                                <pre class="m-0">${this.state.text}</pre>
                            </div>
                        </div>
                        <div class="modal-footer flex-row flex-between flex-center">
                            <button onClick=${this.refresh.bind(this)}>Refresh</button>
                            <button class="secondary" onClick=${this.cancel.bind(this)}>Close</button>
                        </div>
                    </div>
                </div>
      `;
    }
  }