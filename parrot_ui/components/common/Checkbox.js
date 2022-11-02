import { html, Component } from '../../preact-bundle.js'

export class Checkbox extends Component {
    constructor(props) {
      super(props);
        if (typeof props.value !== 'boolean') {
            console.error("Checkbox: Received non-boolean value.");
        }
        this.state = {
            checked: props.value
        };
    }
    componentDidMount() { }
    componentDidUpdate(prevProps) {
        if (prevProps.value !== this.props.value) {
            if (typeof this.props.value !== 'boolean') {
                console.error("Checkbox: Received non-boolean value.");
            }
           this.setState({checked: this.props.value});
        }
    }
    toggle() {
        let self = this;
        this.setState({ checked: !this.state.checked }, () => {
            if (self.props.onChange) {
                self.props.onChange(self.state.checked);
            }
        });
    }
    render() {
        if (this.state.checked) {
            return html`
                <svg height="20" width="20" style="cursor: pointer" onClick=${this.toggle.bind(this)} viewBox="0 0 512 512"><path fill="none" stroke="var(--active-primary-color)" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M352 176L217.6 336 160 272"/><rect x="64" y="64" width="384" height="384" rx="48" ry="48" fill="none" stroke="var(--active-primary-color)" stroke-linejoin="round" stroke-width="32"/></svg>
            `;
        } 
        return html`
            <svg  height="20" width="20" style="cursor: pointer" onClick=${this.toggle.bind(this)} viewBox="0 0 512 512"><path d="M416 448H96a32.09 32.09 0 01-32-32V96a32.09 32.09 0 0132-32h320a32.09 32.09 0 0132 32v320a32.09 32.09 0 01-32 32z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>
        `;
    }
  }


