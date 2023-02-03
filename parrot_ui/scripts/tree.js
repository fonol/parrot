export function initTreeNodeDragDrop(name, path) {
    // count drag events
    // this is a simple way to prevent very short accidental drags from
    // firing any drag&drop logic
    window._dragC = 0;
    // path of currently dragged item
    window._dragPath = path;
    createDragMarker(name);
    document.onmousemove = onTreeNodeDrag;
    document.onmouseup = onDragMouseUp;
}
/// Called while mouse is moved and pressed
export function onTreeNodeDrag(e) {
    window._dragC++;
    if (window._dragC === 3) {
        document.getElementById('file-folder-tree').classList.add('dragging');
    }
    positionDragMarker(e.pageX, e.pageY);
    let el = getElementDraggedOver(e);
    if (el) {
        if (window._previousDragTarget) {
            window._previousDragTarget.classList.remove('tree-node--drag-hovered');
        }
        el.classList.add('tree-node--drag-hovered');
        el.onmouseleave = (e) => { e.target.classList.remove('tree-node--drag-hovered'); };
        window._previousDragTarget = el;
    }
}
function createDragMarker(nodeName) {
    let marker = document.createElement('div');
    marker.classList.add('tree-drag-marker');
    marker.innerText = nodeName;
    window._dragmarker = marker;
    document.body.appendChild(marker);
}
/// called when mouse is released
function onDragMouseUp() {

    let target;
    if (window._previousDragTarget) {
        window._previousDragTarget.classList.remove('tree-node--drag-hovered');
        target = window._previousDragTarget.dataset.path;
    }
    destroyDragMarker();
    document.onmousemove = null;
    document.onmouseup = null;
    document.getElementById('file-folder-tree').classList.remove('dragging');

    // perform actual move
    let src = window._dragPath;
    if (window._dragC > 5 && target && target.length && src && src.length) {
        window.backend.moveToDir(src, target)
            .then(_ => {
                window.$bus.trigger('file-renamed', {});
            }).catch(notifications.error);
    }
    window._dragPath = null;
    window._dragC = 0;
}
function destroyDragMarker() {
    if (window._dragmarker) 
        window._dragmarker.remove();
}
function positionDragMarker(x, y) {
    if (!window._dragmarker) {
        return;
    }
    window._dragmarker.style.top = (y + 3) + 'px';
    window._dragmarker.style.left = (x + 3) + 'px';
}
function getElementDraggedOver(e) {
    let el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) {
        return null;
    }
    let isTarget = el && el.classList && el.classList.contains('tree-node--dir');
    while (!isTarget && el.parentNode) {
        el = el.parentNode;
        isTarget = el && el.classList && el.classList.contains('tree-node--dir');
    }
    if (isTarget) {
        return el;
    }
    return null;
} 