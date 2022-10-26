
use std::{assert};

use parrot_rs::parsing::*;

#[test]
fn parse_wellformed_sexp_should_not_fail() {
    assert!(clean_and_parse_sexp("(a)").is_ok());
    assert!(clean_and_parse_sexp("(a b)").is_ok());
    assert!(clean_and_parse_sexp("(a b)").is_ok());
}

#[test]
fn parse_wellformed_sexp_with_newlines_should_not_fail() {
    assert!(clean_and_parse_sexp("(a)\n").is_ok());
    assert!(clean_and_parse_sexp("\n(a b)").is_ok());
}

#[test]
fn parse_wellformed_sexp_with_tabs_should_not_fail() {
    assert!(clean_and_parse_sexp("(a b)\t").is_ok());
    assert!(clean_and_parse_sexp("\t(a b)").is_ok());
}

#[test]
fn parse_wellformed_sexp_with_strings_should_not_fail() {
    assert!(clean_and_parse_sexp("(a \"b\")").is_ok());
    assert!(clean_and_parse_sexp("(a \"b\" c)").is_ok());
}
#[test]
fn parse_wellformed_sexp_with_sexp_in_string() {
    assert!(clean_and_parse_sexp("(a \"(c)\")").is_ok());
    assert!(clean_and_parse_sexp("(a \"(b c)\")").is_ok());
    assert!(sexp_list_nth(&clean_and_parse_sexp("(a \"(b c)\")").unwrap(), 1).is_ok());
    assert!(clean_and_parse_sexp("(a \"(b\n c)\")").is_ok());
    assert!(sexp_list_nth(&clean_and_parse_sexp("(a \"(b\n c)\")").unwrap(), 1).is_ok());
}


#[test]
fn parse_wellformed_sexp_with_spaces_should_not_fail() {
    assert!(clean_and_parse_sexp("(a b) ").is_ok());
    assert!(clean_and_parse_sexp(" (a b)").is_ok());
    assert!(clean_and_parse_sexp("     (a b)").is_ok());
    assert!(clean_and_parse_sexp("     (a b)     ").is_ok());
    assert!(clean_and_parse_sexp("     (a   b  )     ").is_ok());
}

#[test]
fn test_sexp_list_nth_or_nil() {
    assert!(sexp_list_nth_or_nil(&clean_and_parse_sexp("(a b)").unwrap(), 1).is_ok());
    assert!(sexp_list_nth_or_nil(&clean_and_parse_sexp("(a)").unwrap(), 1).is_err());
    assert!(sexp_list_nth_or_nil(&clean_and_parse_sexp("(a nil)").unwrap(), 1).is_ok());
    assert!(sexp_list_nth_or_nil(&clean_and_parse_sexp("(a nil)").unwrap(), 1).unwrap().is_none());
    assert!(sexp_list_nth_or_nil(&clean_and_parse_sexp("(a b)").unwrap(), 1).unwrap().is_some());
    assert!(sexp_list_nth_or_nil(&clean_and_parse_sexp(r#"(:snippet "(defun post ()            (format t \"post\")) ")"#).unwrap(), 1).unwrap().is_some());
}

#[test]
fn test_sexp_list_nth_as_string() {
    assert_eq!(Some("b".to_string()), sexp_list_nth_as_string(&clean_and_parse_sexp("(a \"b\")").unwrap(), 1).ok());
    assert_eq!(Some("test".to_string()), sexp_list_nth_as_string(&clean_and_parse_sexp("(:list \"test\")").unwrap(), 1).ok());
    assert!(sexp_list_nth_as_string(&clean_and_parse_sexp(r#"(:snippet "(defun post ()
               (format t \"post\")) ")"#).unwrap(), 1).is_ok());
    assert_eq!(Some(r#"(defun post () (format t "post"))"#.to_string()), sexp_list_nth_as_string(&clean_and_parse_sexp(r#"(:snippet "(defun post () (format t \"post\"))")"#).unwrap(), 1).ok());
}

#[test]
fn parse_find_definition_results_should_not_fail() {
    assert!(clean_and_parse_sexp(r#"(:return (:ok (("(DEFUN MAKE-LIST)" (:location (:file "C:/sbcl-64/src/code/list.lisp") (:position 1) (:snippet "(defun MAKE-LIST "))) ("(:DEFINE-SOURCE-TRANSFORM MAKE-LIST)" (:location (:file "C:/sbcl-64/src/compiler/srctran.lisp") (:position 1) nil)) ("(DECLAIM MAKE-LIST
        SB-C:DEFKNOWN)" (:location (:file "C:/sbcl-64/src/compiler/fndb.lisp") (:position 1) nil)))) 3)"#).is_ok());

    assert!(clean_and_parse_sexp(r#"(("(DEFUN POST)" (:location (:file "path/to/testing.lisp") (:position 41) (:snippet "(defun post ()      

    (format t \"post\"))
"))))
        "#).is_ok());
}