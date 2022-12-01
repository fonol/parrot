import { html, Component } from '../preact-bundle.js'

export class DebugOverlay extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        debugInfo: props.info.Debug,
      };
    }
    componentDidMount() { }
    componentDidUpdate(prevProps) {
      if (prevProps.info != this.props.info) {
        this.setState({ debugInfo: this.props.info.Debug });
      }
    }
    invokeNthRestart(n) {
      backend.replInvokeNthRestart(this.state.debugInfo.level, n, this.state.debugInfo.thread);
    }
    toggleFrameLocals(ix) {
      let self = this;
      backend.frameLocals(ix, self.state.debugInfo.thread)
        .then(l => {
          self.setState(s => {
            s.debugInfo.frames[ix].frameLocals = JSON.parse(l);
            return s;
          })
        });

    }


    /**
     * Private
     */

    render() {
        let i = this.state.debugInfo;
        return html`
            <div class="debug-overlay">
                <div class="flex-row flex-middle">
                  <img src="assets/logo_error.png" height="40" width="40" class="mr-10"/>
                  <div>
                    <h4 class="mt-0 mb-0 text-danger">${i.condition.desc}</h4>
                    <small class="text-secondary">${i.condition.ctype}</small>
                  </div>
                </div>
                <h4 class="text-secondary">Restarts:</h4>
                ${(i.restarts||[]).map((r, ix) => html`
                    <div class="debug-overlay__restart" onClick=${() => this.invokeNthRestart(ix)}>
                      <div>${ix}</div>
                      <div>${r.short}</div>
                      <div>${r.desc}</div>
                    </div>
                `)}
                <h4 class="text-secondary">Backtrace:</h4>
                ${(i.frames||[]).map((f) => html`
                    <div class="debug-overlay__frame" onClick=${() => this.toggleFrameLocals(f.ix)}>
                      <div>${f.ix}</div>
                      <div>
                        ${f.label}
                        ${f.frameLocals && f.frameLocals.length > 0 && html`
                          <h5 class="mt-10 mb-5 text-secondary">Frame Locals:</h5>
                          <div class="overflow-auto mh-200px">
                            ${f.frameLocals.map(l => html`
                              <div class="flex-row flex-middle">
                                <div>
                                  ${l.name}
                                </div>
                                <div class="ml-5">
                                  = <span class="text-active">${l.value}</span>
                                </div>
                              </div>
                            `)}
                          </div>
                        `}
                      </div>
                    </div>
                `)}


                <div class="debug-overlay__bottom-bar">Thread: ${i.thread}, Level: ${i.level}</div>
            </div>
        `;
    }
  }