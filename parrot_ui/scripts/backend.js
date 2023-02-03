if (typeof(window.__TAURI__) === 'undefined') {
    alert('__TAURI__ not defined.');
}
window.backend = new function() {

    var invoke = window.__TAURI__.invoke;
    var pending = {};

    var cont = () => {
        let min = Math.ceil(0);
        let max = Number.MAX_SAFE_INTEGER;
        return Math.floor(Math.random() * (max - min) + min); 
    }
    this.resolvePending = (continuation, jsonAnswer) => {
        pending[continuation](jsonAnswer);
        delete pending[continuation];
    }
    var createPendingPromise = (continuation) => {
     
        let contPromise = new Promise(function(resolve, reject) {
            pending[continuation] = resolve;
        });
        return contPromise;
    }
    var invokeWithCont = (endpoint, args) => {
        let continuation = cont();
        invoke(endpoint, { continuation: continuation, ...args });
        return createPendingPromise(continuation);
    }


    this.checkConfig = () => invoke('check_config');
    this.initRepl = () => invoke('init_repl');
    this.folderOpened = (folder) => invoke('folder_opened', { folder: folder });
    this.getFileTree = (folder) => invoke('get_file_tree', { folder: folder });

    //
    // REPL
    //
    this.replRestart = () => invoke('repl_restart');
    this.replEval = (input) => invoke('repl_eval', { input: input });
    this.replCompileForm = (form, buffer, position, filename) => invoke('repl_compile_form', { form: form, buffer: buffer, position: position, filename: filename });
    this.replCompileAndLoadFile = (path) => invoke('repl_compile_and_load_file', { path: path });
    this.replInvokeNthRestart = (level, n, thread) => invoke('repl_invoke_nth_restart', { level: level, n: n, thread: thread });
    this.replEmacsReturn = (form, thread, tag) => invoke('repl_emacs_return', { form: form, thread: thread, tag: tag });
    this.interactiveEvalForm = (form) => invoke('interactive_eval_form', { form: form });
    this.findDefinition = (symbol) => invoke('find_definition', { symbol: symbol });

    //
    // SBCL
    //
    this.getSbclProcessStdoutStderr = () => invoke('get_sbcl_process_stdout_stderr');

    //
    // file
    //
    this.getFileContent = (path) => invoke('get_file_content', { path: path });
    this.saveFileContent = (path, content) => invoke('save_file_content', { path: path, content: content });
    this.addLispFile = (folder, name) => invoke('add_lisp_file', { folder: folder, name: name });
    this.deleteFile = (path) => invoke('delete_file', { path: path });
    this.renameFileOrFolder = (oldPath, newName) => invoke('rename_file_or_folder', { oldPath: oldPath, newName: newName });
    this.fileExists = (path) => invoke('file_exists', { path: path });

    //
    // folders
    //
    this.createSubdir = (parent, name) => invoke('create_subdir', { parent: parent, name: name });
    this.deleteDir = (path) => invoke('delete_dir', { path: path });
    this.dirIsEmpty = (path) => invoke('dir_is_empty', { path: path });
    this.isDir = (path) => invoke('is_dir', { path: path });

    //
    // search
    //
    this.searchSourceFiles = (query, ignoreCase, isRegex) => invoke('search_source_files', { query: query, ignoreCase: ignoreCase, isRegex: isRegex });

    //
    // package browser
    //
    this.getAllPackages = () => invokeWithCont('get_all_packages', {});
    this.getSymbolsInPackage = (package, vars, functions, classes, macros) => invokeWithCont('get_symbols_in_package', { package: package, vars: vars, functions: functions, classes: classes, macros: macros });

    //
    // others
    //
    this.getDescribe = (symbol) => invokeWithCont('describe_symbol', { symbol: symbol });
    this.getApropos = (symbol) => invokeWithCont('apropos_symbol', { symbol: symbol });

    this.getSymbolInfo = (symbol) => {
        let continuation = cont();
        invoke('describe_symbol', { symbol: symbol, continuation: continuation });
        let p1 = createPendingPromise(continuation);
        continuation = cont();
        invoke('apropos_symbol', { symbol: symbol, continuation: continuation });
        let p2 = createPendingPromise(continuation);
        return Promise.all([p1, p2]);
    };
    this.frameLocals = (ix, thread) => invokeWithCont('frame_locals', { ix: ix, thread: thread });
    this.getFlexCompletions = (text) => invokeWithCont('flex_completions', { text: text });

    //
    // state
    //
    this.loadState = () => invoke('get_state');
    this.setStateValue = (key, val) => {
        if (typeof(val) !== 'string') {
            val = JSON.stringify(val);
        }
        invoke('set_state_value', {key: key, val: val});
    };
    this.getStateValue = (key) => invoke('get_state_value', {key: key});

    //
    // config
    //
    this.loadConfig = () => invoke('get_config');
    this.writeConfig = (config) => invoke('write_config', {config: config});

};
window.__TAURI__.event.listen('resolve-pending', (event) => {
    backend.resolvePending(event.payload.continuation, event.payload.data);
});
window.__TAURI__.event.listen('term-write', (event) => {
    window.app.writeToREPL(event.payload.text);
});
window.__TAURI__.event.listen('term-error', (event) => {
    window.app.writeToREPLError(event.payload.text);
});
window.__TAURI__.event.listen('term-init-error', (event) => {
    window.app.replFailedToInit(event.payload.text);
});
window.__TAURI__.event.listen('set-prompt', (event) => {
    if (event.payload.Prompt) {
        window.app.setPrompt(event.payload.Prompt);
    }
});
window.__TAURI__.event.listen('found-definitions', (event) => {
    console.log(event);
    window.app.handleFoundDefinitions(event.payload.ReturnFindDefinitionResult);
});
window.__TAURI__.event.listen('notify-success', (event) => {
    window.notifications.show(event.payload.text);
});
window.__TAURI__.event.listen('notify-error', (event) => {
    window.notifications.error(event.payload.text);
});

// show the debug dialog
window.__TAURI__.event.listen('debug', (event) => {
    window.app.debug(event.payload);
});
window.__TAURI__.event.listen('debug-return', (event) => {
    window.app.debugReturn(event.payload);
});
window.__TAURI__.event.listen('read-input', (event) => {
    window.app.readInput(event.payload.ReadFromMinibuffer);
});


//
// js state API
// 
window.state = new function() {

    var state = {};

    this.init = () => {
        return window.backend.loadState()
            .then(st => {
                state = st;
                for(let [key, val] of Object.entries(state)) {
                    if (typeof(val) === 'string') {
                        try {
                            let json = JSON.parse(val);
                            state[key] = json;
                        } catch (e) {
                            continue;
                        }
                    }
                }
            });
    };

    this.set = (key, val) => {
        state[key] = val;
        window.backend.setStateValue(key, val);
    };
    this.get = (key) => {
        if (key in state) {
            return state[key];
        }
        return null;
    };
    this.getOrDefault = (key, defaultValue) => {
        if (key in state) {
            return state[key];
        }
        return defaultValue;
    }
}


window.config = new function () {

    var config = null;

    this.init = () => {
        return window.backend.loadConfig()
            .then(st => {
                config = st;
                for(let [key, val] of Object.entries(config)) {
                    if (typeof(val) === 'string') {
                        try {
                            let json = JSON.parse(val);
                            config[key] = json;
                        } catch (e) {
                            continue;
                        }
                    }
                }
       });
    };
    this.set = (key, val) => {
        config[key] = val;
    };
    this.write = () => window.backend.writeConfig(config);
    this.get = (key) => {
        if (key in config) {
            return config[key];
        }
        return null;
    };
}