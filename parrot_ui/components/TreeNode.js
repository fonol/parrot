import { html, Component } from '../preact-bundle.js'

export class TreeNode extends Component {
    constructor(props) {
      super(props);
      this.state = { open: false };
    }
    componentDidMount() { }
    componentDidUpdate() { } 
    
    expClicked(event) {
      event.stopPropagation();
      this.setState(state => {
        state.open = !state.open;
        return state;
      });
    }
    onLeftClick() {
      console.log('onLeftClick()');
      this.props.onLeftClicked(this.props.node.path);
    }
    onShowSubdirectoryCreateDialog(path) {
      this.props.onShowSubdirectoryCreateDialog(path);
    }
    onShowFileDeleteDialog(path) {
      this.props.onShowFileDeleteDialog(path);
    }
    onRightClick(event) {

      let menu = document.createElement('div');
      menu.classList.add('context-menu');
      menu.style.left = (event.clientX - 5) + 'px';
      menu.style.top = (event.clientY - 5) + 'px';
      menu.id = 'context-menu';
      menu.setAttribute('onmouseleave', "this.remove()");
      menu.setAttribute('onclick', "this.remove()");
      document.body.appendChild(menu);

      // so we can call methods on this node from the dynamic html
      window._tree_node_active = this;
      let type = event.target.dataset.type;
      menu.innerHTML = `<div class="context-menu-header">${event.target.dataset.oname}</div>`;
      if (type === 'dir') {
        let fileAdd = this.props.context === 'main' ? `
          <div onclick="$bus.trigger('show-new-file', '${event.target.dataset.path}')"> Add Source File... </div>
        `: '';
        menu.innerHTML += `
          ${fileAdd}
          <div onclick="window._tree_node_active.onShowSubdirectoryCreateDialog('${event.target.dataset.path}')">
            Add Folder...
          </div>
          <div onclick="$bus.trigger('show-delete-dir', '${event.target.dataset.path}')">
            Delete...
          </div>
          <div onclick="$bus.trigger('show-rename', '${event.target.dataset.path}')">
            Rename...
          </div>
        `;

      } else if (type === 'lisp') {
        menu.innerHTML += `
          <div onclick="$bus.trigger('show-rename', '${event.target.dataset.path}')">
            Rename...
          </div>
          <div onclick="window._tree_node_active.onShowFileDeleteDialog('${event.target.dataset.path}')">
            Delete...
          </div>
        `;
      } 

      event.stopPropagation();
      event.preventDefault();
      return false;
    }
 
    render() {
      let node = this.props.node;
      let isMainContext = this.props.context.toLowerCase() === 'main';
      return html`
        <li
            class="tree-list-item"
            style="margin-left: 0">
            <div class="flex-row">
                ${node.children != null && node.children.length && html`
                    <span className=${'mr-10 exp fld' + (this.state.open ? ' open': ' closed')}
                        onClick=${(e) => this.expClicked(e)}></span>
                `}
                ${node.node_type === 'Lisp' && html`<span class="mr-10 fld tree-icon">λ</span>`}
                ${node.node_type === 'Pdf' && html`<span class="mr-10 fld tree-icon">PDF</span>`}
                ${node.node_type === 'Dir' && (!node.children || !node.children.length) && html`
                    <span class="mr-10 exp fld empty" style="cursor: default;" ></span>`}
                    <span 
                    class='tree-node' 
                    data-path=${node.path}
                    data-type=${node.node_type.toLowerCase()}
                    data-oname=${node.name}
                    onClick=${(e) => { if (node.node_type === 'Dir') { this.expClicked(e) } else { this.onLeftClick() } }}
                    onContextMenu=${(e) => this.onRightClick(e)}
                    >${node.name}</span>
            </div>
            ${this.state.open && node.children != null && node.children.length > 0 && html`
              <ul>
                ${node.children.map(n => (n.node_type === 'Dir' || isMainContext) && html`
                  <${TreeNode}
                  key=${n.path}
                  context=${this.props.context}
                  onShowSubdirectoryCreateDialog=${this.onShowSubdirectoryCreateDialog.bind(this)} 
                  onShowFileDeleteDialog=${this.onShowFileDeleteDialog.bind(this)}
                  onLeftClicked=${this.props.onLeftClicked}
                  node=${n}
                  ><//>
                `)}
              </ul>
            `}
        </li>`;
    }
  }