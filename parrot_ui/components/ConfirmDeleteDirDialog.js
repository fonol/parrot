import { html, Component } from '../preact-bundle.js'

export class ConfirmDeleteDirDialog extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        confirm: false
      };
    }
    componentDidMount() { }
    componentDidUpdate() { }


    /**
     * Private
     */

    cancel() {
        this.setState({confirm: false});
        this.props.cancel();
    }
    accept() {
        this.setState({confirm: false});
        this.props.accept();
    }
    render() {
      let s = this.state;
      return html`
         <div class="modal-bg">
            <div class="modal">
                <div class="modal-header flex-row flex-center">
                    <svg height="17" class="mr-10" viewBox="0 0 512 512"><path d="M432 144l-28.67 275.74A32 32 0 01371.55 448H140.46a32 32 0 01-31.78-28.26L80 144" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><rect x="32" y="64" width="448" height="80" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M312 240L200 352M312 352L200 240"/></svg>
                    Confirm deletion of this directory
                </div>
                <div class="modal-body ta-center flex-col" style="align-items: center; padding: 20px;">
                    This will delete the directory and all its contents.<br/>Are you sure?
                    <button className=${'btn-square-100 mb-10 mt-20 ' + (s.confirm ? 'active':'')} onClick=${() => this.setState({confirm: !this.state.confirm})}>
                        Click to confirm
                    </button>
                </div>
                <div class="modal-footer flex-right">
                    <button class="mr-10 secondary" onClick=${this.cancel.bind(this)}>Cancel</button>
                    <button className=${s.confirm ? 'delete': 'disabled delete'} onClick=${this.accept.bind(this)}>Delete</button>
                </div>
            </div>
        </div>
        `;
        }
}
