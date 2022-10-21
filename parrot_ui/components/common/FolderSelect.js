import { html, render, Component } from '../../preact-bundle.js'
import { FileFolderTree } from '../FileFolderTree.js';
import { trimPrefix } from '../../scripts/utils.js';


export class FolderSelect extends Component {
    constructor(props) {
        super(props);
        this.state = { 
            loadingTree: false,
            tree: null,
            rootFolderPath: null,
            selected: props.selected || null
        };
        if (!props.onSelected) {
            console.warn("FolderSelect: 'onSelected' prop missing.");
        }
    }
    componentDidMount() {
        let self = this;
        window.backend.getRootFolder()
        .then((rootFolderPath) => {
            rootFolderPath = rootFolderPath.replace(/\\/g, '/');
            self.setState({ rootFolderPath: rootFolderPath});
        });
        this.loadTree();
    }
    componentDidUpdate(prevProps) {
    }

    loadTree() {
        this.setState({ loadingTree: true });
        window.backend.getFolderTree()
            .then(function (tree) {
                this.setState({ loadingTree: false, tree: JSON.parse(tree) });
            }.bind(this))
    }
    onNodeClicked(path) {
        this.setState({selected: path});
        this.props.onSelected(path);
    }

    render() {

        return html`

            <div class="h-100 w-100 flex-col">
                <div class="tile p-10 mb-5">
                    ${!this.state.rootFolderPath && '...'}
                    ${this.state.rootFolderPath && this.state.selected && trimPrefix(this.state.selected, this.state.rootFolderPath)}
                    ${this.state.rootFolderPath && !this.state.selected && html`<i>No folder selected</i>`}
                </div>
                <div class="flex-1 overflow-hidden">
                    ${this.state.tree !== null && html`
                        <${FileFolderTree} 
                        context="folder-sel"  
                        onSubdirectoryCreated=${this.loadTree.bind(this)} 
                        onLeftClicked=${this.onNodeClicked.bind(this)} 
                        tree=${this.state.tree}></${FileFolderTree}>
                    `}
                </div>
            </div>
            `;
    }
}