#[cfg(test)]
mod tests {

    use crate::text::*;

    #[test]
    fn test_ngram_tokenize_no_of_bigrams_should_be_3() {
        assert_eq!(ngram_tokenize_lowercase("test", 2).len(), 3);
        assert_eq!(ngram_tokenize_lowercase("rest", 2).len(), 3);
        assert_eq!(ngram_tokenize_lowercase("res es", 2).len(), 3);
    }

    #[test]
    fn test_ngram_tokenize_no_of_bigrams_should_be_2() {
        assert_eq!(ngram_tokenize_lowercase("tes", 2).len(), 2);
        assert_eq!(ngram_tokenize_lowercase("res", 2).len(), 2);
    }

    #[test]
    fn test_ngram_tokenize_no_of_bigrams_should_be_1() {
        assert_eq!(ngram_tokenize_lowercase("te", 2).len(), 1);
        assert_eq!(ngram_tokenize_lowercase("re", 2).len(), 1);
    }

    #[test]
    fn test_ngram_tokenize_no_of_bigrams_should_be_0() {
        assert_eq!(ngram_tokenize_lowercase("t", 2).len(), 0);
        assert_eq!(ngram_tokenize_lowercase("r", 2).len(), 0);
        assert_eq!(ngram_tokenize_lowercase(" ", 2).len(), 0);
        assert_eq!(ngram_tokenize_lowercase("   ", 2).len(), 0);
        assert_eq!(ngram_tokenize_lowercase("r x w", 2).len(), 0);
        assert_eq!(ngram_tokenize_lowercase("r x w a b", 2).len(), 0);
    }

    #[test]
    fn test_ngram_tokenize_no_of_unigrams_should_be_0() {
        assert_eq!(ngram_tokenize_lowercase(".", 1).len(), 0);
        assert_eq!(ngram_tokenize_lowercase("+", 1).len(), 0);
        assert_eq!(ngram_tokenize_lowercase(" ", 1).len(), 0);
        assert_eq!(ngram_tokenize_lowercase(" + ", 1).len(), 0);
        assert_eq!(ngram_tokenize_lowercase(" / ", 1).len(), 0);
        assert_eq!(ngram_tokenize_lowercase(" -  - ", 1).len(), 0);
    }

    #[test]
    fn test_ngram_tokenize_no_of_unigrams_should_be_1() {
        assert_eq!(ngram_tokenize_lowercase("t", 1).len(), 1);
        assert_eq!(ngram_tokenize_lowercase("b", 1).len(), 1);
    }

    #[test]
    fn test_ngram_tokenize_no_of_unigrams_should_be_2() {
        assert_eq!(ngram_tokenize_lowercase("te", 1).len(), 2);
        assert_eq!(ngram_tokenize_lowercase("re", 1).len(), 2);
        assert_eq!(ngram_tokenize_lowercase(" re ", 1).len(), 2);
        assert_eq!(ngram_tokenize_lowercase(" r e ", 1).len(), 2);
    }

    #[test]
    fn test_ngram_tokenize_no_of_trigrams_should_be_2() {
        assert_eq!(ngram_tokenize_lowercase("test", 3).len(), 2);
        assert_eq!(ngram_tokenize_lowercase("rest", 3).len(), 2);
        assert_eq!(ngram_tokenize_lowercase(" rest ", 3).len(), 2);
        assert_eq!(ngram_tokenize_lowercase(" test te st ", 3).len(), 2);
    }

    #[test]
    fn test_ngram_tokenize_no_of_trigrams_should_be_1() {
        assert_eq!(ngram_tokenize_lowercase("tes", 3).len(), 1);
        assert_eq!(ngram_tokenize_lowercase("res", 3).len(), 1);
        assert_eq!(ngram_tokenize_lowercase(" ret ", 3).len(), 1);
        assert_eq!(ngram_tokenize_lowercase(" 123 12 12 ", 3).len(), 1);
    }

    #[test]
    fn test_ngram_tokenize_no_of_trigrams_should_be_0() {
        assert_eq!(ngram_tokenize_lowercase("12", 3).len(), 0);
        assert_eq!(ngram_tokenize_lowercase("", 3).len(), 0);
        assert_eq!(ngram_tokenize_lowercase("  ", 3).len(), 0);
        assert_eq!(ngram_tokenize_lowercase(" 12 12 ", 3).len(), 0);
        assert_eq!(ngram_tokenize_lowercase(" 12$$ 12.. ", 3).len(), 0);
    }

    #[test]
    fn test_ngram_tokenize_should_handle_umlauts() {
        assert_eq!(ngram_tokenize_lowercase("öäü", 1).len(), 3);
        assert_eq!(ngram_tokenize_lowercase("ß", 1).len(), 1);
    }
}
