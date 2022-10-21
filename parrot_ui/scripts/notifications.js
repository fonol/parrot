var notifications = new function() {

    var _wrapper = null;

    var maybeInitWrapper = () => {
        if (!_wrapper) {
            let wrapper = document.createElement('div');
            wrapper.classList.add('notification-wrapper');
            document.body.appendChild(wrapper);
            _wrapper = wrapper;
        }

    }

    var createNotificationElement = (nclass, message) => {
        let el = document.createElement('div');
        el.classList.add('notification');
        el.classList.add('notification--'+nclass);
        el.innerText = message;
        return el;
    }

    var showForType = (type, message) => {
        maybeInitWrapper();
        let el = createNotificationElement(type, message);
        _wrapper.appendChild(el);
        setTimeout(() => {
            el.style.transition = '0.8s';
            el.style.opacity = 0;
            setTimeout(() => { el.remove(); }, 1000);
        }, 3000);

    }

    this.show = (message) => {
        showForType('default', message);
    }
    this.error = (message) => {
        showForType('error', message);
    }

    this.showFromList = (messageList, breakInMs) =>  {
        let m = messageList.shift();
        this.show(m);
        if (messageList.length) {
            let self = this;
            setTimeout(() => { self.showFromList(messageList, breakInMs) }, breakInMs);
        }
    }
}