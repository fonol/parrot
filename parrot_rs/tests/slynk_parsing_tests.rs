use std::{assert};

use parrot_rs::{self, repl::{SlynkAnswer, ChannelMethod}};

#[test]
fn parse_compilation_result_failed() {
    let parsed = SlynkAnswer::parse(r#"(:return (:ok (:compilation-result ((:message "undefined variable: COMMON-LISP-USER::X" :severity :warning :location (:location (:file "path/to/test.lisp") (:position 42) nil) :references nil)) nil 0.0061610001139342785 t "path/to/test.fasl")) 10)"#);
    assert!(matches!(parsed, SlynkAnswer::ReturnCompilationResult { .. }));

    if let SlynkAnswer::ReturnCompilationResult { fasl_file, .. } = parsed {
        assert_eq!(Some(&String::from("path/to/test.fasl")), fasl_file.as_ref());
    } else {
        panic!("Wrong enum variant")
    }
}
#[test]
fn parse_find_definition_result() {
    let parsed = SlynkAnswer::parse(r#"(:return (:ok (("(DEFUN POST)" (:location (:file "path/to/testing.lisp") (:position 41) (:snippet "(defun post ()       
    (format t \"post\"))
"))))) 3)"#);
    assert!(matches!(parsed, SlynkAnswer::ReturnFindDefinitionResult { .. }));

    if let SlynkAnswer::ReturnFindDefinitionResult {  definitions, .. } = parsed {
        assert!(definitions.len()==1);
        assert_eq!(String::from("path/to/testing.lisp"), definitions[0].file);
    } else {
        panic!("Wrong enum variant")
    }
}
//
// Finding the definition for "make-list" should return multiple results in SBCL code, 
// which should be correctly parsed as a list of found definitions.
//
#[test]
fn parse_find_definition_result_multiple() {
    let parsed = SlynkAnswer::parse(r#"(:return (:ok (("(DEFUN MAKE-LIST)" (:location (:file "C:/sbcl-64/src/code/list.lisp") (:position 1) (:snippet "(defun MAKE-LIST "))) ("(:DEFINE-SOURCE-TRANSFORM MAKE-LIST)" (:location (:file "C:/sbcl-64/src/compiler/srctran.lisp") (:position 1) nil)) ("(DECLAIM MAKE-LIST
        SB-C:DEFKNOWN)" (:location (:file "C:/sbcl-64/src/compiler/fndb.lisp") (:position 1) nil)))) 3)"#);
    assert!(matches!(parsed, SlynkAnswer::ReturnFindDefinitionResult { .. }));
    if let SlynkAnswer::ReturnFindDefinitionResult {  definitions, .. } = parsed {
        assert!(definitions.len()==3);
        assert_eq!(String::from("C:/sbcl-64/src/code/list.lisp"), definitions[0].file);
        assert_eq!(String::from("C:/sbcl-64/src/compiler/srctran.lisp"), definitions[1].file);
        assert_eq!(String::from("C:/sbcl-64/src/compiler/fndb.lisp"), definitions[2].file);
    } else {
        panic!("Wrong enum variant")
    }

}

///
/// This ist the returned value from slynk when evaluating (list-all-packages) in the REPL
#[test]
fn parse_write_values_list_all_packages() {
 let parsed = SlynkAnswer::parse(r#"(:channel-send 1 (:write-values (("(#<PACKAGE \"SLYNK-MATCH\"> #<PACKAGE \"SLYNK-TRACE-DIALOG\">         #<PACKAGE \"SB-ALIEN-INTERNALS\"> #<PACKAGE \"COMMON-LISP-USER\"> #<PACKAGE \"SB-DEBUG\"> #<PACKAGE \"SLYNK-BACKEND\"> #<PACKAGE \"SLYNK-SOURCE-PATH-PARSER\"> #<PACKAGE \"SLYNK-APROPOS\">
 #<PACKAGE \"COMMON-LISP\"> #<PACKAGE \"SB-DI\"> #<PACKAGE \"SB-CLTL2\">
 #<PACKAGE \"SB-WALKER\"> #<PACKAGE \"SB-PCL\"> #<PACKAGE \"SB-APROF\">
 #<PACKAGE \"SB-IMPL\"> #<PACKAGE \"SB-VM\"> #<PACKAGE \"SB-FORMAT\">
 #<PACKAGE \"SB-POSIX\"> #<PACKAGE \"SB-PRETTY\"> #<PACKAGE \"SB-LOCKLESS\">
 #<PACKAGE \"SB-ASSEM\"> #<PACKAGE \"SB-EVAL\"> #<PACKAGE \"SLYNK\">
 #<PACKAGE \"SLYNK-SOURCE-FILE-CACHE\"> #<PACKAGE \"SB-INTROSPECT\">
 #<PACKAGE \"SB-X86-64-ASM\"> #<PACKAGE \"SB-UNICODE\"> #<PACKAGE \"SLYNK-API\">
 #<PACKAGE \"SB-EXT\"> #<PACKAGE \"SLYNK-MOP\"> #<PACKAGE \"SB-SEQUENCE\">
 #<PACKAGE \"SLYNK-LOADER\"> #<PACKAGE \"SB-THREAD\"> #<PACKAGE \"SB-BSD-SOCKETS\">
 #<PACKAGE \"SB-FASL\"> #<PACKAGE \"SLYNK-IO-PACKAGE\"> #<PACKAGE \"SB-PROFILE\">
 #<PACKAGE \"SB-DISASSEM\"> #<PACKAGE \"SB-MOP\"> #<PACKAGE \"SLYNK-RPC\">
 #<PACKAGE \"SB-KERNEL\"> #<PACKAGE \"SB-WIN32\"> #<PACKAGE \"SB-INT\">
 #<PACKAGE \"SB-BSD-SOCKETS-INTERNAL\"> #<PACKAGE \"SB-SYS\">
 #<PACKAGE \"SLYNK-COMPLETION\"> #<PACKAGE \"SB-LOOP\"> #<PACKAGE \"SB-GRAY\"> #<PACKAGE \"SLYNK-GRAY\"> #<PACKAGE \"SB-C\"> #<PACKAGE \"SLYNK-STICKERS\">
 #<PACKAGE \"KEYWORD\"> #<PACKAGE \"SB-UNIX\"> #<PACKAGE \"SB-BIGNUM\">
 #<PACKAGE \"SLYNK-SBCL\"> #<PACKAGE \"SB-BROTHERTREE\">
 #<PACKAGE \"SLYNK-COMPLETION-LOCAL-NICKNAMES-TEST\"> #<PACKAGE \"SLYNK-MREPL\"> #<PACKAGE \"SB-REGALLOC\"> #<PACKAGE \"SB-ALIEN\">)" 0 nil))))"#);
assert!(matches!(parsed, SlynkAnswer::ChannelSend { .. }));
if let SlynkAnswer::ChannelSend {  method, .. } = parsed {
    assert!(matches!(method, ChannelMethod::WriteValues(..)));
} else {
    panic!("Wrong enum variant")
}
}