//regex = /([0-9]+(st|nd|rd|th))|(-?\d+(\.\d+)?)|[a-zA-Z-\(\)]+|[\.,;:"\?!'/]|(<([^>]+)>)|[]/g; //Note: nechyti radove cislovky(iba anglicke), Todo:  lomitka? anglicke radove c.? spojovnik v skratkach?
//regex = /(-?\d+(\.\d+)?)|[a-zA-Z-]+|[\.,;:"„“\(\)\?!'/]|(<([^>]+)>)/g; // TODO: mozno bude treba nahradit za &#60; (< &lt;) a &#62; (> &gt;)

class Tokenizer {
    /**
     *
     * @param {string} text - input text being tokenized
     * @param {param} path - path to file containing terminalRules
     * @param {Map} config
     * @param {string} grammarLanguage
     */
    constructor(text, path, config, grammarLanguage) {
        this.language = grammarLanguage;
        this.text = text;
        this.regex = config["splittingRegex"];
        this.path = path;
        //this.tokens = this.split(this.text);
        this.HTMLRegex = config["HTMLRegex"]; ///(^<([^>]+)>$)/g; // TODO: mozno bude treba nahradit za &#60; (< &lt;) a &#62; (> &gt;)
        this.HTMLTagsPositions = new Map();//this.getTagsPositions(this.tokens);
        this.rules = new Map();
        //this.loadRules(path);
        this.tokens = [];//this.getSubstitutedTerminals(this.removeTags(this.tokens), this.rules);

    }

    /**
     * Splits input text using this.regex
     * @param {string} text
     * @return {Array} - Array of unprocessed tokens split by this.regex
     */
    split(text) {
        return text.match(this.regex);
    };

    /**
     * returns array of tokens without HTML tags
     * @param {Array} tokens - example -> ["<small>", "Toto", "je", "jednoducha", "veta", ",", "s", "html", "tagmi", ".", "</small>"]
     * @return {Array}
     */
    removeTags(tokens) {
        var result = [];
        for (let token of tokens) {
            if (!token.match(this.HTMLRegex)) {
                //result[index] = token;
                result.push(token);
            }
        }
        return result;
    };

    /**
     * used to fill this.HTMLTagsPositions with positions of HTML tags in tokens array
     * @param {Array} tokens - example -> ["<HTML>", "Toto", "je", "jednoducha", "veta", ",", "s", "html", "tagmi", ".", "</HTML>"]
     * @return {Map} - Map in form: index:HTML token
     */
    getTagsPositions(tokens) {
        let result = new Map();
        let index = 0;
        for (let token of tokens) {
            if (token.match(this.HTMLRegex)) {
                //result[index] = token;
                result.set(index, token.toLowerCase());
            }
            index++;
        }
        return result;
    };

    /**
     * @param {Array} tokens - ["Toto", "je", "jednoducha", "veta", ",", "s", "html", "tagmi", "."]
     * @param {Map} rules - this.rules(need to load rules first -> this.loadRules())
     * @return {Array} - array of terminals substituted by corresponding rule names
     */
    getSubstitutedTerminals(tokens, rules) {
        var result = [];
        for (let token of tokens) {
            var found = false;
            for (let rule of rules.keys()) {
                var currRule = new RegExp("^"+rule+"$");
                if (currRule.test(token)) {
                    result.push(rules.get(rule));
                    found = true;
                    break;
                }
            }
            if (!found) {
                throw new UnknownTokenException(token + " cant be matched.");
            }
        }
        return result;
    };

    /**
     * fills this.rules with rules used for substitution from this.path
     * @return void
     */
    loadRules() {
        var fs = require("fs");
        var temp = JSON.parse(fs.readFileSync(this.path).toString());
        Object.keys(temp).forEach(key => {
            this.rules.set(key, temp[key]);
        });
    };

    substituteQuotesTokens() {
        var ENQuoteRegex = /^"$/g;
        var next = "„";
        for (var i = 0; i < this.tokens.length; i++) {
            if (ENQuoteRegex.test(this.tokens[i])) {
                this.tokens[i] = next;
                if (next === "„") {
                    next = "“";
                }
                else {
                    next = "„";
                }
            }
        }
    }

    /**
     * Substitutes quotes("") for slovak quotes(„“)
     */
    substituteQuotes() { // TODO: not tested
        var next = "„";
        for (var i = 0; i < this.tokens.length; i++) {
            this.HTMLRegex.lastIndex = 0;
            if (!this.HTMLRegex.test(this.tokens[i])) {
                for (var j = 0; j < this.tokens[i].length; j++)
                if (this.tokens[i][j] === "\"") {
                    this.tokens[i] = this.tokens[i].slice(0, j) + next + this.tokens[i].slice(j+1);
                    if (next === "„") {
                        next = "“";
                    }
                    else {
                        next = "„";
                    }
                }
            }
        }
    }

    /**
     * Initializes necessary attributes for Tokenizer instance
     */
    init() { // TODO: otestovat
        this.tokens = this.split(this.text);
        if (this.language === "SK") {
            this.substituteQuotes();
        }
        this.HTMLTagsPositions = this.getTagsPositions(this.tokens);
        this.loadRules();
        this.originalTokens = this.removeTags(this.tokens);
        this.tokens = this.getSubstitutedTerminals(this.removeTags(this.tokens), this.rules);

    }
}

/**
 * class for custom exception used when unknown token is found in input
 * @class
 */
class UnknownTokenException {
    /**
     * @constructor
     * @param {string} message
     */
    constructor (message) {
        this.message = message;
        this.name = "UnknownTokenException";
    }
}

// t = new Tokenizer("Toto je jednoducha veta.", 'C:/Users/MH/Desktop/parser/app/res/terminalRules.json');
// t.init();
// console.log(t.rules);
// console.log(t.tokens);

module.exports = Tokenizer;