### An editor for Common Lisp, written in Rust

This is a hobby project started in Summer 2022.
It aims to be an editor for Common Lisp (SBCL), that mostly works out of the box.

#### Technologies used
- Rust
- [Tauri](https://tauri.app/)
- [Preact](https://preactjs.com/) + [htm](https://github.com/developit/htm)
- [CodeMirror](https://codemirror.net/)
- [Sly/Slynk](https://github.com/joaotavora/sly)
- [xterm.js](https://xtermjs.org/)

#### About the technology stack

- Why Rust?
I like Rust and want to get better at it. 
- Why Tauri (and not a native GUI toolkit)?
Tauri is a very nice framework that can be used for cross-platform applications. Also, I am familiar with web-based technologies, but not with native GUIs.
- Why Preact?
Simply because it's lightweight, fast enough, and in combination with htm, I don't have to use any build pipeline.

The colors are heavily inspired by my favorite Obsidan.md theme: [Primary](https://github.com/ceciliamay/obsidianmd-theme-primary)

#### Can I already use this?

No. The absolute basics are implemented, but you will probably run into unimplemented stuff or bugs pretty fast.
Plus, it is untested on Linux and Mac (I will move to Linux for development at some point, but atm, it's Windows for development and testing). 

---
#### Some more or less current screenshots

<img src="/devlog/ui.jpg" width="1000">
<img src="/devlog/search.jpg" width="1000">
<img src="/devlog/load-file-debug-dialog.jpg" width="1000">
<img src="/devlog/settings-dialog.jpg" width="600">



---

#### Roadmap

(not exhaustive!)

##### Terminal

- [x] get a working prompt
- [x] basic coloring
- [x] make backspace & del work
- [x] evaluate lisp expressions
- [ ] command history with arrow buttons
- [x] restart & empty  
- [ ] properly implement resizing
- [ ] define a proper color scheme

##### REPL

- [x] Start a Slynk server at application startup
- [x] Basic communication with Slynk server
- [x] Restart Slynk server
- [x] Capture stdout & stderr from SBCL process
- [x] Debug dialog
	- [x] aborts
	- [x] set value / use value
	- [x] retry
	- [ ] display stacktrace
	- [ ] shortcuts to choose debug actions

#### File tree

- [x] refresh
- [x] add folder
- [x] add file
- [ ] search
- [ ] move files/folder by drag&drop
- [ ] context menu: move file
- [x] context menu: rename file

#### Search in Source Files

- [x] basic UI
- [x] option: regex mode
- [x] option: match case
- [x] highlight matches
- [x] jump to source file location

##### Editor:

- [x] tabs, scratch buffer
- [x] basic vim mode
- [x] basic syntax highlighting
- [x] make shortcuts from settings work
- [ ] autocomplete / suggestions
- [ ] jump to definition
	- [x] jump to position
	- [ ] handle multiple definitions found: show overlay/modal to pick one
	- [ ] handle definition outside current source files (e.g. built-in functions)
- [ ] structured editing a la paredit
- [ ] shortcut to jump between repl and source file
- [ ] search and replace in file
- [ ] search in file
- [ ] optional rainbow parentheses?
- [ ] look up function definition
- [ ] disassemble functions

#### Lisp code evaluation / compilation

- [x] compile and load file (C-c C-k in emacs)
 	- [ ] autosave before executing shortcut?
- [x] compile top-level expression around cursor (C-c C-c in emacs)
- [x] evaluate expression before cursor (C-x C-e in emacs)
- [ ] macro expansion


#### Settings

- [x] Settings dialog
- [ ] setting: Slynk socket
- [x] setting: Path to SBCL
- [ ] settting: .fasl file directory
- [x] setting: toggle line numbers
- [x] setting: enable/disable vim mode
- [x] setting: vim mode: set shortcut to toggle normal mode/insert mode
- [x] setting: shortcut - compile and load file
- [x] setting: shortcut - compile top-level expression
- [x] setting: shortuct - evaluate expression before cursor
- [ ] setting: file types to show in the file tree
- [ ] setting: editor font size
- [ ] setting: editor font family
- [ ] alternative themes
	- [ ] would require some theming mechanism, e.g. more consistently using css vars everywhere

#### Missing UI elements

- [ ] would be cool: optional pane with defined functions / variables in current file
- [ ] package & symbol browser
	- [x] list all packages
	- [x] list all symbols for package
	- [ ] fetch symbol's type info in lisp lambda
		- [ ] filter symbols by type (function/class/...)
		- [ ] display symbol's type in UI
	- [ ] retrieve information about symbol on click/hover 
	- [ ] jump to symbol if possible
	- [ ] refresh button

- in menubar:
	- [ ] close all tabs 
	- [ ] undo
	- [ ] "about" dialog


#### Other IDE functions

- [x] troubleshooting dialog, if SBCL/Slynk not found at startup
- [ ] loading quicklisp libraries
- [ ] browsing the hyperspec
- [ ] save lisp image
- [ ] loading asdf systems
- [ ] global search shortcut to find files
- [x] global search for file contents
- [ ] global search and replace

#### Far away 

- [ ] multiple REPLs
- [ ] Split editor tabs vertically / horizontally
