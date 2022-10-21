import { html, Component } from '../../preact-bundle.js'
import { FolderSelect } from './FolderSelect.js';
import { createRef } from '../../preact-10.7.js';

export class FolderSelectDialog extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        selected: props.value || null
      };
    }
    componentDidMount() {
      
    }
    componentDidUpdate(prevProps) {
    }


    /**
     * Private
     */

    cancel() {
        this.props.hide();
    }
    accept() {
        this.props.accept(this.state.selected);
    }
    onSelected(fpath) {
        this.setState({selected: fpath});
    }
    canAccept() {
        return this.state.selected && this.state.selected.length;
    }
   
    render() {
      return html`
            <div class="modal-bg">
                <div class="modal" >
                    <div class="modal-header">
                        Select folder
                    </div>
                    <div class="modal-body flex-col overflow-hidden" style="height: 700px; min-width: 750px">
                        <${FolderSelect} selected=${this.state.selected} onSelected=${this.onSelected.bind(this)}></${FolderSelect}>
                    </div>
                    <div class="modal-footer flex-row flex-between flex-center">
                        <button class="mr-5 secondary" onClick=${this.cancel.bind(this)}>Close</button>
                        <button className=${this.canAccept() ? '': 'disabled'} onClick=${this.accept.bind(this)}>Select</button>
                    </div>
                </div>
            </div>
      `;
    }
  }