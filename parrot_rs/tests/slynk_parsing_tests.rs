use std::{assert};

use parrot_rs::{self, repl::SlynkAnswer};

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
        assert_eq!(Some(&String::from("path/to/testing.lisp")), definitions[0].file.as_ref());
    } else {
        panic!("Wrong enum variant")
    }
}