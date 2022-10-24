import { html, Component } from '../preact-bundle.js';
import { createRef } from '../preact-10.7.js';
import { getLeafNameWithoutExtension } from '../scripts/utils.js';
import { Editor } from './Editor.js';

export class EditorTabs extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        opened: [],
        active: null
      };
        this.editor = createRef();
    }
    componentDidMount() {
    }
    componentDidUpdate(prevProps) {
    }
    shouldComponentUpdate(nextProps, nextState) {
    }	
    /**
     * Public
     */
    open(filePath) {
        this.setState(state => {
            if (!state.opened.includes(filePath)) {
                state.opened.push(filePath);
            }
            state.active = filePath;
            return state;
        });
    }
    openAtPosition(filePath, pos) {
        this.setState(state => {
            if (!state.opened.includes(filePath)) {
                state.opened.push(filePath);
            }
            state.active = filePath;
            return state;
        }, () => { 
            this.editor.current.setCursorToPosition(pos);
        });
    }
    refresh() {
        console.log('EditorTabs:refresh()');
        this.editor.current.refresh();
    }

    /**
     * Private
     */
    remove(filePath) {
        let self = this;
        this.setState(state => {
            if (state.opened.includes(filePath)) {
                state.opened.splice(state.opened.indexOf(filePath), 1);
            }
            if (state.active === filePath) {
                if (state.opened.length > 0) {
                    state.active = state.opened[0];
                } else {
                    state.active = null;
                }
            }
            return state;
        }, self.forceUpdate);
    }
    setActive(filePath) {
        if (this.state.active !== filePath) {
            this.setState({ active: filePath });
        }
    }

    render() {
        return html`
            <div class="tab-wrapper">
                <div class="tabs">
                    ${this.state.opened.map(f => html`
                        <div className=${'tabs__header' + (f === this.state.active ? ' active' : '')}
                            onClick=${() => this.setActive(f)}
                        >${getLeafNameWithoutExtension(f)}
                            <svg onClick=${(e) => { e.stopPropagation(); this.remove(f) }}
                                height="20" width="20"
                                class="ml-15"
                                viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>
                        </div>
                    `)}
                    ${this.state.opened.length === 0 && html`
                        <div class="tabs__header active">Scratch</div>
                    `}
                </div>
                <div class="tab-content">
                    <${Editor}
                        path=${this.state.active}
                        ref=${this.editor}
                    >
                    </${Editor}>
                </div>
            </div>

        `;
    }
  }