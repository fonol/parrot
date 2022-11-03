import { html, Component } from '../preact-bundle.js'
import { createRef } from '../preact-10.7.js';

//
//  \x1b ESCAPE
//  [2K Erase current line
//  
//  \x1b[0m Reset color
//
window.TCOLORS = {
    OUT_DEFAULT: '\x1b[38;5;2m',
    PROMPT: '\x1b[38;5;180m',
    ERROR: '\x1b[38;5;167m',
    IMPORTANT: '\x1b[48;5;56m',
    // BG_FORM: '\x1b[48;5;8m'
    // BG_FORM: '\x1b[48;5;52m',
    // BG_FORM: '\x1b[48;5;203m',
    BG_FORM: '\x1b[48;5;180m',
}

export class REPL extends Component {
    constructor(props) {
      super(props);
      this.state = { 
        termInput: '',
      };
      this.term = null;
      this.termPrompt = 'CL-USER>';
      this.terminalWrapper = createRef();
      this.elevel = 0;

      if (typeof (this.props.onRestart) !== 'function') {
          console.warn("REPL: missing onRestart prop");
      }
    }
    componentDidMount() {
        this.initXTerm();
    }
    componentDidUpdate(prevProps) {
    }
    refresh() {
        if (this.termFitAddon) {
            this.termFitAddon.fit();
        }
    }
    initXTerm() {
        let self = this;
        let baseTheme = {
            foreground: 'hsl(34, 50%, 80%)',
            background: '#26211c',
            selection: '#5DA5D533',
            black: '#1E1E1D',
            brightBlack: '#262625',
            red: '#CE5C5C',
            brightRed: '#FF7272',
            green: '#5BCC5B',
            brightGreen: '#72FF72',
            yellow: '#CCCC5B',
            brightYellow: '#FFFF72',
            blue: '#5D5DD3',
            brightBlue: '#7279FF',
            magenta: '#BC5ED1',
            brightMagenta: '#E572FF',
            cyan: '#5DA5D5',
            brightCyan: '#72F0FF',
            white: '#F8F8F8',
            brightWhite: '#FFFFFF'
        };
        this.setState({ termInput: '' });
        this.term = new Terminal({
            fontFamily: '"Cascadia Code", Menlo, monospace',
            fontSize: 18,
            name: 'terminal',
            theme: baseTheme,
            convertEol: true,
            cursorBlink: true,
            cursorWidth: 2,
            cursorStyle: 'bar'
        });

        this.term.open(this.terminalWrapper.current);
        this.term.onKey(function (ev) {
            var printable = (
              !ev.domEvent.altKey && !ev.domEvent.altGraphKey && !ev.domEvent.ctrlKey && !ev.domEvent.metaKey
            );
            let x = self.term._core.buffer.x;
            let xCleaned = x - self.promptLen()- 1;
            let hasInput = self.state.termInput.length > 0;
            if (ev.key === '\r') {
                if (self.state.termInput && self.state.termInput.trim().length > 0) {
                    window.backend.replEval(self.state.termInput);
                }
                self.setState({ termInput: '' });
                // self.term.write('\r\n');
                self.term.prompt();
            }
            // arrow left
            else if (ev.domEvent.key === 'ArrowLeft') {
                let x = self.term._core.buffer.x;
                if (x <= self.promptLen() + 1) {
                    // don't allow going further left than the prompt
                    return true;
                } 
                self.term.write(ev.key);
            }
            else if (ev.domEvent.key === 'ArrowRight') {
                let x = self.term._core.buffer.x;
                if (x >= self.promptLen() + 1 + self.state.termInput.length) {
                    // don't allow going further right than the end of the input
                    return true;
                } 
                self.term.write(ev.key);
            }
            else if (ev.domEvent.key === 'ArrowUp') {
                // todo: command history
                return true;
            }
            else if (ev.domEvent.key === 'ArrowDown') {
                // todo: command history
                return true;
            }
            // del
            else if (ev.domEvent.key === 'Delete') {
                if (hasInput) {
                    let xBef = x;
                    self.term.write('\x9B1P');
                    self.term.write('\x9B' + (self.promptLen() + self.state.termInput.length + 2) + 'G');
                    self.term.write('\b \b');
                    self.term.write('\x9B1P');
                    self.term.write('\x9B' + (xBef+1) + 'G');
                    let newInp = [self.state.termInput.slice(0, xCleaned), self.state.termInput.slice(xCleaned+1)].join('');
                    self.setState({ termInput: newInp });
                }
            }
          
            // backspace
            else if (ev.key === '\u007F') {
                if (xCleaned > 0) {
                    let newInp = [self.state.termInput.slice(0, xCleaned-1), self.state.termInput.slice(xCleaned)].join('');
                    self.setState({ termInput: newInp });
                    self.term.write('\b \b');
                    self.term.write('\x9B1P');
                }
            } else {
              if (printable) {
                let newInp = [self.state.termInput.slice(0, x), ev.key, self.state.termInput.slice(x)].join('');
                self.term.write('\x9B1@');
                self.setState({ termInput: newInp });
                self.term.write(ev.key);
              }
            }
          });
          
        this.term.prompt = function () {
            if (self.elevel > 0) {
                self.term.write(`\r\n${TCOLORS.ERROR}[${self.elevel}]\x1b[0m ${TCOLORS.PROMPT}${self.termPrompt}\x1b[0m `);
            } else {
                self.term.write(`\r\n${TCOLORS.PROMPT}${self.termPrompt}\x1b[0m `);
            }
        };
        this.printWelcome();
        this.term.write(`${TCOLORS.PROMPT}${self.termPrompt}\x1b[0m `);
        this.termFitAddon = new FitAddon.FitAddon();
        this.term.loadAddon(this.termFitAddon);
        this.termFitAddon.fit();
    }
    promptLen() {
        if (this.elevel > 0) {
            return this.elevel.toString().length + 3 + this.termPrompt.length;
        }
        return this.termPrompt.length;
    }
    write(text) {
        if (!text || !text.length) {
            return;
        }
        text = text
            .replace(/^\n|\n$/g, '')
        this.clearCurrentLine();
        let lines = text.split(/\n/g); 
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            this.term.write(`${TCOLORS.OUT_DEFAULT}${line}`);
            if (i < lines.length - 1) {
                this.term.write('\r\n');
            } 
        }
        // display prompt on new line
        this.term.prompt();
        // todo: not working yet
        // if (this.hasUnsentInput()) {
        //     let self = this;
        //     requestAnimationFrame(() => { 
        //         self.term.write(self.state.termInput);
        //     });
        // }
    }
    writeError(text) {
        this.term.write(`\x1b[2K\r\x1b[48;5;57m${text}\x1b[0m`);
        this.term.prompt();
    }
    hasUnsentInput() {
        return this.state.termInput && this.state.termInput.length > 0;
    }
    clearCurrentLine() {
        // erase the current line (to remove the prompt), set cursor at the beginning of the line
        this.term.write('\x1b[2K\r');
    }
    printLogo() {
        this.term.write(`
\x1b[38;2;201;27;22;49m▄\x1b[38;2;231;42;38;48;2;217;48;35m▄\x1b[38;2;223;29;28;48;2;209;27;15m▄\x1b[38;2;224;34;29;48;2;217;48;35m▄\x1b[38;2;223;35;26;48;2;216;23;16m▄\x1b[38;2;223;33;26;48;2;198;62;51m▄\x1b[38;2;226;34;28;48;2;235;37;29m▄\x1b[38;2;84;143;46;49m▄\x1b[38;2;98;150;59;49m▄\x1b[49m      \x1b[m
\x1b[38;2;62;56;49;48;2;150;2;11m▄\x1b[38;2;71;61;48;48;2;150;6;13m▄\x1b[38;2;1;1;2;48;2;223;21;21m▄\x1b[38;2;14;2;2;48;2;222;30;25m▄\x1b[38;2;66;5;8;48;2;221;28;20m▄\x1b[38;2;4;4;4;48;2;217;31;25m▄\x1b[38;2;18;18;22;48;2;167;20;17m▄\x1b[38;2;0;1;1;48;2;126;109;44m▄\x1b[38;2;79;134;44;48;2;84;143;46m▄\x1b[38;2;84;143;46;48;2;92;137;54m▄\x1b[38;2;83;141;45;48;2;90;135;45m▄\x1b[49m    \x1b[m
\x1b[38;2;1;1;1;48;2;196;166;131m▄\x1b[38;2;27;24;19;48;2;249;212;168m▄\x1b[38;2;249;211;165;48;2;154;134;107m▄\x1b[38;2;193;163;125;48;2;0;0;0m▄\x1b[38;2;27;23;17;48;2;0;0;0m▄\x1b[38;2;11;20;7;48;2;35;46;26m▄\x1b[38;2;84;143;46;48;2;7;5;7m▄\x1b[38;2;84;143;46;48;2;26;44;24m▄\x1b[48;2;84;143;46m   \x1b[38;2;84;143;46;48;2;85;136;42m▄\x1b[49m   \x1b[m
\x1b[38;2;0;0;0;48;2;8;7;6m▄\x1b[38;2;98;82;62;48;2;96;81;62m▄\x1b[38;2;246;207;163;48;2;251;216;171m▄\x1b[38;2;247;189;124;48;2;246;211;164m▄\x1b[38;2;253;213;162;48;2;204;169;127m▄\x1b[38;2;12;19;6;48;2;11;19;6m▄\x1b[48;2;84;143;46m      \x1b[38;2;84;143;46;48;2;87;139;47m▄\x1b[38;2;82;142;45;49m▄\x1b[49m \x1b[m
\x1b[49m \x1b[38;2;2;0;2;48;2;7;6;5m▄\x1b[38;2;29;27;22;48;2;78;65;57m▄\x1b[38;2;38;18;7;48;2;203;129;59m▄\x1b[38;2;3;0;0;48;2;202;136;72m▄\x1b[38;2;38;99;115;48;2;11;19;8m▄\x1b[48;2;84;143;46m        \x1b[38;2;85;139;45;49m▄\x1b[m
\x1b[49m  \x1b[49;38;2;6;12;18m▀\x1b[49m \x1b[38;2;38;97;145;48;2;33;105;160m▄\x1b[38;2;32;106;159;48;2;34;109;160m▄\x1b[38;2;34;109;158;48;2;85;142;47m▄\x1b[38;2;47;118;130;48;2;84;143;46m▄\x1b[38;2;82;142;52;48;2;84;143;46m▄\x1b[48;2;84;143;46m  \x1b[38;2;100;127;46;48;2;159;70;28m▄\x1b[38;2;180;49;23;48;2;84;143;46m▄\x1b[38;2;121;107;37;48;2;84;143;46m▄\x1b[48;2;84;143;46m \x1b[m
\x1b[49m    \x1b[38;2;38;102;166;48;2;44;101;149m▄\x1b[38;2;30;105;159;48;2;30;106;158m▄\x1b[38;2;34;108;163;48;2;30;105;160m▄\x1b[38;2;31;107;159;48;2;28;101;154m▄\x1b[38;2;32;106;156;48;2;85;138;57m▄\x1b[48;2;84;143;46m    \x1b[38;2;84;143;46;48;2;142;80;49m▄\x1b[38;2;131;96;36;48;2;128;102;42m▄\x1b[m
\x1b[49m     \x1b[49;38;2;46;96;137m▀\x1b[49;38;2;33;107;160m▀\x1b[49;38;2;33;106;157m▀\x1b[49;38;2;30;104;154m▀\x1b[49;38;2;54;122;110m▀\x1b[49;38;2;84;143;46m▀▀▀▀▀\x1b[m`)
    }
    printWelcome() {
        this.printLogo();
        this.term.write(`\r\n${TCOLORS.IMPORTANT} Parrot REPL started. \r\n\n\x1b[0m`);
    }
    printRestart() {
        this.clearCurrentLine();
        this.printLogo();
        this.term.write(`\r\n\x1b[2K\r${TCOLORS.IMPORTANT} Parrot REPL restarted. \r\n\n\x1b[0m`);
    }
    clearTerm() {
        this.setState({ termInput: '' });
        this.term.clear();
    }
    refreshTerm() {
        this.clearTerm();
        this.printRestart();
        this.props.onRestart();
        backend.replRestart().then(() => {
            notifications.show('REPL restarted.');
        });
    }
    setPrompt(prompt) {
        let newPrompt = prompt.prompt;
        if (prompt.condition && prompt.condition.length) {
            this.write(prompt.condition);
        }
        if (newPrompt + '>' === this.termPrompt && prompt.elevel === this.elevel) {
            return;
        }
        this.elevel = prompt.elevel;
        this.termPrompt = newPrompt.trim() + ">";
        this.term.write('\x1b[2K\r');
        this.term.prompt();
    }



    render() {
        let i = this.state.debugInfo;
        return html`
            <div class="flex-col flex-1">
                <div class="flex-row flex-right p-5 term-col__top">
                    <div class="btn-icon icon-only mr-5" onClick=${this.clearTerm.bind(this)} title="Clear REPL">
                        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-9.414l2.828-2.829 1.415 1.415L13.414 12l2.829 2.828-1.415 1.415L12 13.414l-2.828 2.829-1.415-1.415L10.586 12 7.757 9.172l1.415-1.415L12 10.586z"/></svg>
                    </div>
                    <div class="btn-icon icon-only" onClick=${this.refreshTerm.bind(this)} title="Restart REPL">
                        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M18.537 19.567A9.961 9.961 0 0 1 12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10c0 2.136-.67 4.116-1.81 5.74L17 12h3a8 8 0 1 0-2.46 5.772l.997 1.795z"/></svg>
                    </div>
                </div>
                <div class="term-wrapper flex-1">
                    <div ref=${this.terminalWrapper} class="h-100"></div>
                </div>
            </div>
        `;
    }
  }