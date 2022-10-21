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
    onShowDeleteDirectoryDialog(path) {
      this.props.onShowDeleteDirectoryDialog(path);
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
      document.body.appendChild(menu);

      // so we can call methods on this node from the dynamic html
      window._tree_node_active = this;
      let type = event.target.dataset.type;
      menu.innerHTML = `<div class="context-menu-header">${event.target.dataset.oname}</div>`;
      if (type === 'dir') {
        let fileAdd = this.props.context === 'main' ? `
          <div onclick="window.app.openNewFileDialog('${event.target.dataset.path}')"> Add Source File </div>
        `: '';
        menu.innerHTML += `
          ${fileAdd}
          <div class="mt-5" onclick="window._tree_node_active.onShowSubdirectoryCreateDialog('${event.target.dataset.path}')">
            Add Folder
          </div>
          <div class="mt-5" onclick="window._tree_node_active.onShowDeleteDirectoryDialog('${event.target.dataset.path}')">
            Delete
          </div>
        `;

      } else if (type === 'lisp') {
        menu.innerHTML += `
          <div class="mt-5" onclick="window._tree_node_active.onShowFileRenameDialog('${event.target.dataset.path}')">
            Rename
          </div>
          <div class="mt-5" onclick="window._tree_node_active.onShowFileDeleteDialog('${event.target.dataset.path}')">
            Delete
          </div>
        `;
      } else if (type === 'pdf') {
        menu.innerHTML += `
          <div onclick="window.canvas.openPDF('${event.target.dataset.path.replace(/'/g, "\\'")}')">
            <svg height="18" width="18" class="mr-10" viewBox="0 0 512 512"><path d="M256 160c16-63.16 76.43-95.41 208-96a15.94 15.94 0 0116 16v288a16 16 0 01-16 16c-128 0-177.45 25.81-208 64-30.37-38-80-64-208-64-9.88 0-16-8.05-16-17.93V80a15.94 15.94 0 0116-16c131.57.59 192 32.84 208 96zM256 160v288" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>
            Open
          </div>
          <div class="mt-5" onclick="window.canvas.openFileRenameDialog('${event.target.dataset.path}')">
            <svg height="18" width="18" class="mr-10" viewBox="0 0 512 512"><path d="M384 224v184a40 40 0 01-40 40H104a40 40 0 01-40-40V168a40 40 0 0140-40h167.48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><path d="M459.94 53.25a16.06 16.06 0 00-23.22-.56L424.35 65a8 8 0 000 11.31l11.34 11.32a8 8 0 0011.34 0l12.06-12c6.1-6.09 6.67-16.01.85-22.38zM399.34 90L218.82 270.2a9 9 0 00-2.31 3.93L208.16 299a3.91 3.91 0 004.86 4.86l24.85-8.35a9 9 0 003.93-2.31L422 112.66a9 9 0 000-12.66l-9.95-10a9 9 0 00-12.71 0z" fill="currentColor"/></svg>
            Rename
          </div>
          <div class="mt-5" onclick="window.canvas.openFileDeleteDialog('${event.target.dataset.path}')">
            <svg height="18" class="mr-10 ionicon" viewBox="0 0 512 512"><path d="M432 144l-28.67 275.74A32 32 0 01371.55 448H140.46a32 32 0 01-31.78-28.26L80 144" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><rect x="32" y="64" width="448" height="80" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M312 240L200 352M312 352L200 240"/></svg>
            Delete
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
                  onShowDeleteDirectoryDialog=${this.onShowDeleteDirectoryDialog.bind(this)}
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