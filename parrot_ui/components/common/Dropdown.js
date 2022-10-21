import { html, render, Component } from '../../preact-bundle.js'


export class Dropdown extends Component {
    constructor(props) {
        super(props);
        this.state = { 
            selected: props.value,
            showDropdown: false
        };
    }
    componentDidMount() {

    }
    componentDidUpdate(prevProps) {
    }
    select(option) {
        console.log("select " + option);
        this.setState(state => {
            state.selected =  option.id;
            state.showDropdown = false;
            return state;
        });
        this.props.onChange(option.id);
    }
    hideDropdown() {
        this.setState({ showDropdown: false});
    }
    toggleDropdown(event) {
        event.stopPropagation();
        event.preventDefault();
        if (!this.state.showDropdown) {
            document.addEventListener('click', this.hideDropdown.bind(this));
        } else {
            document.removeEventListener('click', this.hideDropdown.bind(this));
        }
        this.setState(state => {
            state.showDropdown = !state.showDropdown;
            return state;
        })
      }
    selectedName() {
        if (this.state.selected) {
            let f = this.props.options.find(o => o.id == this.state.selected);
            if (f) {
                return f.name;
            }
        }
        return '...';
    }
    render() {

        return html`
        <div class="dropdown-outer">
        <div class="option-display" 
               onClick=${this.toggleDropdown.bind(this)}>
                ${this.selectedName()}
            </div>
            ${this.state.showDropdown ? html`
                <div 
                class="options"
                hidden=${!this.state.showDropdown}
                >
                ${this.props.options.map(o => html`
                        <div 
                            className=${`option ${o.id === this.state.selected ? 'active': ''}`}
                            onClick=${() => {this.select(o)}}>
                            ${o.name}
                        </div>
                    `)}
                </div>
            
            `: ''}
       
        </div>
      `;
    }
}