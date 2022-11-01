import { html, Component } from '../preact-bundle.js'

export class FoundDefinitionsDialog extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        definitions: props.definitions,
      };
      if (!props.definitions || props.definitions.length === 0) {
        console.warn("[FoundDefinitionsDialog]: invalid 'definitions' prop.");
      }
    }
    componentDidMount() { }
    componentDidUpdate() {
        this.setState({definitions: this.props.definitions  });
    }
    tryOpen(fpath, pos) {
        $bus.trigger('jump-abs-pos', { filePath: fpath, pos: pos });
        this.cancel();
    }


    /**
     * Private
     */

    cancel() {
        this.props.hide();
    }
   
    render() {
      return html`
            <div class="modal-bg">
                    <div class="modal" >
                        <div class="modal-header">
                            Found multiple definitions 
                        </div>
                        <div class="modal-body overflow-hidden flex-col" style="min-width: 300px">
                            <div class="overflow-auto" style="max-height: 500px">
                                ${this.state.definitions.map(d => html`
                                    <div class="settings-item cursor-pointer" onClick=${() => this.tryOpen(d.file, d.pos)}>
                                        <h4 class="mt-0 mb-5">${d.label}</h4>
                                        <div class="text-secondary">${d.file||'Could not determine location'}</div>
                                    </div>
                                `)}
                            </div>
                        </div>
                        <div class="modal-footer flex-row flex-between flex-center">
                            <button class="mr-5 secondary" onClick=${this.cancel.bind(this)}>Close</button>
                        </div>
                    </div>
                </div>
      `;
    }
  }