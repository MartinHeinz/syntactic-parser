Tokenizer = require('../app/tokenizer');
Earley = require('../app/earley-oop');
var fs = require("fs");

// Earley Parser

class Parser {

    /**
     * @constructor
     * @example //new Parser("- Nieco, - nieco dalsie... - pokracovanie.", "SK")
     * @param {string} text
     * @param {string} grammarLanguage
     */
    constructor(text, grammarLanguage) {
        this.config = this.setUpConfig("../app/res/configs/"+ grammarLanguage + ".json");
        this.tokenizer = new Tokenizer(text, "../app/res/terminalRules/"+grammarLanguage+".json", this.config, grammarLanguage);
        this.tokenizer.init();
        this.grammar = new Earley.tinynlp.Grammar(this.loadGrammar("../app/res/grammars/"+grammarLanguage+".json"));
        this.grammar.terminalSymbols = function(token) {
            return[token];
        };
        this.chart = Earley.tinynlp.parse(this.tokenizer.tokens, this.grammar, this.config["rootRule"]);
        var temp = this.chart.getFinishedRoot(this.config["rootRule"]);
        this.trees =  temp.traverse(undefined, this.config["rootRule"]);
        this.words = [];
        this.tree = this.chooseTree(); //this.trees[0];
    }

    /**
     *
     * @return {Object} bestTree - "best" parse tree in this.trees
     */
    chooseTree() {
        var bestTree = null;
        var bestCount = 0;
        var currCount = 0;
        function traverse(t, fullTree, self) {
            for (let node of t.subtrees) {
                if (self.config["sentenceRule"].includes(node.root)) {
                    var parent = Parser.findParent(fullTree, node.parent.left, node.parent.right, node.parent.root);
                    if (!(parent.subtrees.length == 1 && self.config["sentenceRule"].includes(parent.root))) {
                        currCount++;
                    }
                }
                traverse(node, fullTree, self);
            }
        }
        var max = 200;
        var start = 0;
        if (this.trees.length > max) {
            start = this.trees.length - max;
        }
        for (var i = start; i < this.trees.length; i++) {
            currCount = 0;
            traverse(this.trees[i], this.trees[i], this);
            if (currCount > bestCount) {
                bestCount = currCount;
                bestTree = this.trees[i];
            }
        }
        if (bestTree == null) {
            return this.trees[0];
        }
        return bestTree;
    }

    /**
     * Sets up config from file provided through path parameter
     * @param {string} path - path to config file
     * @return {Map} result - config with executeable regexes
     */
    setUpConfig(path) {
        var tempConfig = this.loadConfig(path);
        var result = new Map();
        for (let [key, value] of tempConfig) {
            if (key.includes("Regex")) { // value je regex, inak je to rule, path etc.
                result[key] = new RegExp(value, "g");
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }

    /**
     * Loads config file.
     * @param {string} path - path to config file
     * @return {Map} result - parsed JSON of config file
     */
    loadConfig(path) {
        var result = new Map();
        var temp = JSON.parse(fs.readFileSync(path).toString());
        Object.keys(temp).forEach(key => {
            result.set(key, temp[key]);
        });
        return result;
    }

    /**
     * Loads grammar from path parameter to be used in parsing input using Earley.tinynlp
     * @param {string} path - path to rules
     * @return {Array} - array of rules
     */
    loadGrammar(path) {
        var rules = [];
        var temp = JSON.parse(fs.readFileSync(path).toString());
        Object.keys(temp).forEach(key => {
            rules.push(key + " -> " + temp[key]);
        });
        return rules;
    }

    /**
     * returns Array of leafs from this.tree ordered from leftmost to rightmost.
     * @return {Array} - array of Nodes
     */
    static getLeaves(tree) {
        var leaves = [];

        function getLeavesHelper(tree) {
            for (let node of tree.subtrees) {
                if (node == undefined) {
                    return;
                }
                if (node.subtrees.length == 0) {
                    leaves.push(node);
                }
                getLeavesHelper(node);
            }
        }

        getLeavesHelper(tree);
        return leaves;
    }

    /**
     * finds and returns lowest common ancestor(ancestor of openingNode and closingNode that is farthest from root),
     * both openingTagNode and closingTagNode have to be in tree
     * @param {Object} tree - tree containing nodes
     * @param {Object} openingNode
     * @param {Object} closingNode
     * @return {Object} - lowest common ancestor(Node)
     */
    findLowestCommonAncestor(tree, openingNode, closingNode) {
        var node1Path = [];
        var node2Path = [];
        var n1 = openingNode;
        var n2 = closingNode;
        while (n1.root !== this.config["rootRule"]) {
            node1Path.push(n1);
            n1 = Parser.findParent(tree, n1.parent.left, n1.parent.right, n1.parent.root);
        }
        node1Path.push(n1);
        while (n2.root !== this.config["rootRule"]) {
            node2Path.push(n2);
            n2 = Parser.findParent(tree, n2.parent.left, n2.parent.right, n2.parent.root);
        }
        node2Path.push(n2);
        node1Path.reverse();
        node2Path.reverse();
        var i = 0;
        var ancestor = tree;
        while (node1Path[i].root === node2Path[i].root && node1Path[i].left == node2Path[i].left && node1Path[i].right == node2Path[i].right) {
            ancestor = node1Path[i];
            i++
        }
        return ancestor;
    }

    /**
     * returns parent of node with specified left, right and root value
     * @param {Object} tree - tree being searched
     * @param {Number} left - left attribute of tree node
     * @param {Number} right - right attribute of tree node
     * @param {string} root - root value of attribute of tree node
     * @return {Object} - parent Node
     */
    static findParent(tree, left, right, root) {
        var found = false;
        function find(tree, left, right, root) {
            for (let node of tree.subtrees) {
                if (node.left == left && node.right == right && node.root === root) {
                    found = true;
                    return node;
                }
                if (node.left <= left && node.right >= right) {
                    var res = find(node, left, right, root);
                    if (found) {
                        return res;
                    }
                }
            }
        }
        var result = find(tree, left, right, root);
        if (result == undefined) {
            return tree;
        }
        return result;
    }

    /**
     * finds tree node to which tag at tagIndex belongs(returns node AFTER tag)
     * @param {Object} tree - tree being searched
     * @param {Number} tagIndex - index of leaf to which tag belongs
     * @return {Object} - tree Node
     */
    static findNode(tree, tagIndex) {
        if (tree.subtrees.length == 0) {
            return tree;
        }
        else {
            for (let node of tree.subtrees) {
                if (node.left <= tagIndex && node.right > tagIndex) {
                    return Parser.findNode(node, tagIndex);
                }
            }
        }
    }

    /**
     * Checks if node is a leaf.
     * @param {Object} node
     * @return {boolean}
     */
    static isLeaf(node) {
        return node.subtrees.length == 0;
    }

    /**
     * Removes(and renames) some unnecessary attributes for readability purposes, cannot be used for parsing anymore
     * @param {Object} tree
     * @return {Object} - prettified tree
     */
    prettifyTree(tree) {
        var result = tree;
        function remove(subtree) {
            for (let node of subtree.subtrees) {
                delete node.parent;
                node.name = node.root;
                delete node.root;
                //node.size = node.right - node.left; // potrebne ak by sme chceli vizualivaciu pomocou D3
                delete node.left;
                delete node.right;
                if (node.subtrees.length == 0) {
                    delete node.subtrees;
                }
                else {
                    remove(node);
                    node.children = node.subtrees;
                    delete node.subtrees;
                }
            }
        }
        remove(result);
        delete result.parent;
        result.name = result.root;
        delete result.root;
        delete result.left;
        delete result.right;
        result.children = result.subtrees;
        delete result.subtrees;
        return result;
    }

    /**
     * Saves stringified JSON tree to file in path
     * @param {string} path - path to file in which JSON tree will be saved
     * @param {Object} tree
     */
    saveJSONTree(path, tree = this.tree) {
        var tempTree = JSON.parse(JSON.stringify(tree));
        this.unescapeTags(tempTree);
        var result = this.prettifyTree(tempTree);

        fs.truncateSync(path, 0);
        fs.writeFile(path, JSON.stringify(result, null, 2), function (err) {
            if (err) {
                return console.log(err);
            }
        });
    }


    /**
     * Stringifies tree provided by parameter
     * @param {Object} tree
     * @return {string} - stringified tree
     */
    stringifyTree(tree = this.tree) {
        var result = "";
        for (let leaf of Parser.getLeaves(tree)) {
            result = result.concat(leaf.root);
        }
        return result;
    }

    /**
     * Prints JSON representation of this.trees to console.
     * Those are trees created by earley-oop.js
     */
    printTrees() {
        for (let i in this.trees) {
            console.log(JSON.stringify(this.trees[i]));
        }
    }

    /**
     * Builds HTML tree without headers(this cannot be displayed yet)
     * @param {Object} tree - tree to be processed
     * @return {string}
     */
    createHTMLTree(tree = this.tree) {
        if (!tree.subtrees || tree.subtrees.length == 0) {
            return '<li><a href="#">' + tree.root + '</a></li>';
        }
        var builder = [];
        builder.push('<li><a href="#">');
        builder.push(tree.root);
        builder.push('</a>');
        builder.push('<ul>');
        for (let i in tree.subtrees) {
            builder.push(this.createHTMLTree(tree.subtrees[i]));
    }
        builder.push('</ul>');
        builder.push('</li>');
        return builder.join('');
    }

    /**
     * Creates HTML tree with all headers, that can be saved and displayed in browser.
     * @return {string} - displayable tree in HTML format
     */
    createHTMLTreeFile() {
        var start = '<html><head><link rel="stylesheet" type="text/css" href="tree.css"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><div id="dv"><div class="tree" id="displayTree"><ul>';
        var content = this.createHTMLTree();
        var end = '</ul></div></br></div></html>';

        return (start + content + end);
    }

    /**
     * Saves HTML tree to file specified by path
     * @param {string} path - path to file
     */
    saveHTMLTree(path) {
        this.escapeTags();
        var result = this.createHTMLTreeFile();
        fs.truncateSync(path, 0);
        fs.writeFile(path, result, function (err) {
            if (err) {
                return console.log(err);
            }
        });
    }

    /**
     * Escapes <(&lt;) and >(&gt;) for readability purposes when displaying HTML tree
     * @param {Object} tree
     */
    escapeTags(tree = this.tree) {
        for (let node of tree.subtrees) {
            var newValue = "";
            for (var i = 0; i < node.root.length; i++){
                if (node.root.charAt(i) === "<") {
                    newValue = newValue.concat("&lt;");
                }
                else if (node.root.charAt(i) === ">") {
                    newValue = newValue.concat("&gt;");
                }
                else {
                    newValue = newValue.concat(node.root.charAt(i));
                }
            }
            node.root = newValue;
            this.escapeTags(node);
        }
    }

    /**
     * Unescapes &lt;(<) and &gt;(>) for readability purposes when displaying D3 tree
     * @param {Object} tree
     */
    unescapeTags(tree) {
        for (let node of tree.subtrees) {
            node.root = node.root.replace(new RegExp("&lt;", 'g'), "<");
            node.root = node.root.replace(new RegExp("&gt;", 'g'), ">");
            this.unescapeTags(node);
        }
    }


    /**
     * Substitutes values in leafs of tree with their original values from this.tokenizer.originalTokens.
     * @param {Object} tree
     */
    substituteLeafs(tree = this.tree) {
        if (tree.subtrees.length == 0) {
            tree.root = this.tokenizer.originalTokens[tree.right - 1];
        }
        else {
            for (let node of tree.subtrees) {
                this.substituteLeafs(node);
            }
        }
    }

    /**
     * Adds all HTML tags from this.tokenizer.HTMLTagsPositions to this.tree except for paragraph tags
     */
    addHTMLTags() {
        var tags = this.tokenizer.HTMLTagsPositions;
        this.config["tagRegex"].lastIndex = 0;
        var realIndex = 0;
        var realIndexOfClosingTag = 0;
        for(let [key, tag] of tags) {
            if(tag === "<p>" || tag === "</p>" || /<\/\s*(\w+)\s*\S*\s*>/g.test(tag)) {
                realIndex++;
                continue;
            }
            this.config["tagRegex"].lastIndex = 0;
            var tagContent = this.config["tagRegex"].exec(tag);
            var closingTag = "</" + tagContent[1] + ">";
            if (this.findClosingTagPos(closingTag, key) == key + 1) {
                continue;
            }
            this.insertOpeningTag(this.tree, key - realIndex, tag);

            var sameTagsSeen = 0;

            realIndexOfClosingTag = 0;
            var tagName = tagContent[1];
            for(let [keyOfNextTag, nextTag] of tags) {
                this.config["tagRegex"].lastIndex = 0;
                var nextTagContent = this.config["tagRegex"].exec(nextTag);
                if (nextTagContent != null) {
                    if (keyOfNextTag > key && tagName === nextTagContent[1]) {
                        sameTagsSeen++;
                    }
                }
                if (keyOfNextTag > key && nextTag === closingTag) {
                    if (sameTagsSeen > 0) {
                        sameTagsSeen--;
                    }
                    else { // nasiel som prisluchajuci tag - prejdi od (key - realIndex) az po (keyOfNextTag - realIndex - 1) a skontroluj ci sa nepresekla veta, ak ano uzatvor a zase otvor tag
                        this.fixNestingErrors(key - realIndex, keyOfNextTag - realIndexOfClosingTag - 1, tag, closingTag);
                        this.insertClosingTag(this.tree, keyOfNextTag - realIndexOfClosingTag - 1, closingTag, true);
                        break;
                    }
                }
                realIndexOfClosingTag++;
            }
            realIndex++;
        }
    }

    /**
     *
     * @param {string} tag
     * @param {Number} startIndex - index of tag from which search starts
     * @return {Number} - position of closing tag or -1 when not found
     */
    findClosingTagPos(tag, startIndex) {
        var tags = this.tokenizer.HTMLTagsPositions;
        for(let [keyOfClosingTag, closingTag] of tags) {
            if (keyOfClosingTag > startIndex && tag === closingTag) {
                return keyOfClosingTag;
            }
        }
        return -1;
    }

    /**
     * Inserts opening tag into leaf of this.tree
     * @param {Object} tree - tree to search for insertion
     * @param {Number} key - index of leaf
     * @param {string} tag - tag to be inserted
     * @return void
     */
    insertOpeningTag(tree = this.tree, key, tag) {
        if (tree.subtrees.length == 0) {
            var node = Parser.findNode(this.tree, key);
            if (this.isNodeInSentence(node)) {
                var index = this.findInsertPosition(tree.root);
                tree.root = tree.root.slice(0, index) + tag + tree.root.slice(index);
            }
            return;
        }
        for (let node of tree.subtrees) {
            if (node.left <= key && node.right > key) {
                return this.insertOpeningTag(node, key, tag);
            }
        }
    }

    /**
     * Returns index at which opening formatting tag should be inserted inside leaf with nodeValue
     * @param {string} nodeValue - root value of tree Node
     * @return {Number} insertion index
     */
    findInsertPosition(nodeValue) {
        this.config["allTagsExceptForWRegex"].lastIndex = 0;
        var result = this.config["allTagsExceptForWRegex"].exec(nodeValue); // result.index + result[0].length = pozicia za sentence tagmi
        if (result == null) {
            return 0;
        }
        return result.index + result[0].length;
    }

    /**
     * Inserts closing tag specified by tag into leaf specified by index key.
     * @param {Object} tree - tree to search for insertion
     * @param {Number} key - index of leaf
     * @param {string} tag - tag to be inserted
     * @param {boolean} flag - whether to close tag at the end of sentence or not
     * @return void
     */
    insertClosingTag(tree = this.tree, key, tag, flag) {
        if (tree.subtrees.length == 0) {
            var node = Parser.findNode(this.tree, key);
            if (this.isNodeInSentence(node)) {

                this.config["tagsBeforeContentRegex"].lastIndex = 0;
                var tagsBeforeContent = this.config["tagsBeforeContentRegex"].exec(tree.root)[0];
                var contentAndClosingTags = tree.root.slice(tagsBeforeContent.length);
                this.config["wordRegex"].lastIndex = 0;
                this.config["formatRegex"].lastIndex = 0;
                this.config["sentenceEndMultipleRegex"].lastIndex = 0;
                this.config["sentenceEndTagSingleRegex"].lastIndex = 0;
                var alreadyContains = new RegExp(tag).test(tree.root);
                var isEndOfSentence = this.config["sentenceEndTagSingleRegex"].test(tree.root);
                if (!(alreadyContains && isEndOfSentence && flag)) {
                    if (this.config["wordRegex"].test(tree.root)) {
                        tree.root = tree.root.slice(0, this.config["wordRegex"].lastIndex) + tag + tree.root.slice(this.config["wordRegex"].lastIndex);
                    }
                    else if (this.config["formatRegex"].test(contentAndClosingTags)) {
                        this.config["formatRegex"].lastIndex = 0;
                        var pos2 = this.config["formatRegex"].exec(contentAndClosingTags).index;
                        tree.root = tree.root.slice(0, tagsBeforeContent.length + pos2) + tag + tree.root.slice(tagsBeforeContent.length + pos2);
                    }
                    else if (this.config["sentenceEndMultipleRegex"].test(contentAndClosingTags)) {
                        this.config["sentenceEndMultipleRegex"].lastIndex = 0;
                        var sentenceTags = this.config["sentenceEndMultipleRegex"].exec(contentAndClosingTags);
                        var pos3 = sentenceTags.index;
                        tree.root = tree.root.slice(0, tagsBeforeContent.length + pos3) + tag + tree.root.slice(tagsBeforeContent.length + pos3);
                    }
                    else {
                        tree.root += tag;
                    }
                }
            }
            return;
        }
        for (let node of tree.subtrees) {
            if (node.left <= key && node.right > key) {
                return this.insertClosingTag(node, key, tag, flag);
            }
        }
    }

    /**
     * Closes and opens openingTag(closingTag) on sentence ends(starts), to avoid nesting errors of this tag in its
     * range specified by openingTagIndex and closingTagIndex.
     * @param {Number} openingTagIndex - index position of opening tag
     * @param {Number} closingTagIndex - index position of closing tag
     * @param {string} openingTag(e.g. <strong>)
     * @param {string} closingTag(e.g. </strong>)
     */
    fixNestingErrors(openingTagIndex, closingTagIndex, openingTag, closingTag) { //TODO: otestovat
        this.config["sentenceEndTagSingleRegex"].lastIndex = 0;
        var leaves = Parser.getLeaves(this.tree);
        var openOnNext = false;
        var counter = 0;
        for (var leaf of leaves) {
            if (leaf.left > closingTagIndex) {
                return;
            }
            if (leaf.left > openingTagIndex && this.config["sentenceEndTagSingleRegex"].test(leaf.root)) { // v liste konci veta
                this.insertClosingTag(this.tree, leaf.left, closingTag, false);
                openOnNext = true;
                continue;
            }
            if (leaf.left > openingTagIndex && /^(<s id=\"s\d+\">)+/.test(leaf.root) && !openOnNext) {
                if (this.isNodeInSentence(leaves[counter-1])) {
                    if (leaves[counter-1].root.includes("</s>")) {
                        var pos = /<\/s>/.exec(leaves[counter-1].root).index;
                        leaves[counter-1].root = leaves[counter-1].root.slice(0, pos) + closingTag + leaves[counter-1].root.slice(pos);
                    }
                    else {
                        leaves[counter-1].root += closingTag;
                    }
                }
                openOnNext = true;
            }
            if (openOnNext && /^(<s id=\"s\d+\">)+/.test(leaf.root)) { //zaciatok dalsej vety
                var index = this.findInsertPosition(leaf.root);
                leaf.root = leaf.root.slice(0, index) + openingTag + leaf.root.slice(index);
                openOnNext = false;
            }
            counter++;
        }
    }



    /**
     * Adds <p> and </p> tags to this.tree, moving them as needed to avoid causing nesting errors, while
     * keeping structure of input text.
     * Requires sentence tags to be present in this.tree.
     */
    addParagraphTags() {
        var realIndex = 0;
        var nextTag = "<p>";
        var openingTagNode = null;
        var closingTagNode = null;
        for(let key of this.tokenizer.HTMLTagsPositions.keys()) {
            let tag = this.tokenizer.HTMLTagsPositions.get(key);
            if (tag === "<p>" && tag == nextTag) {
                openingTagNode = this.moveToBeginningOfSentence(this.tree, key - realIndex, key);
                if (openingTagNode == undefined) {
                    continue;
                }
                nextTag = "</p>"
            }
            else if (tag === "</p>" && tag === nextTag) {
                if (key - realIndex - 1 < 1) {
                    closingTagNode = Parser.findNode(this.tree, 1);
                }
                else {
                    closingTagNode = Parser.findNode(this.tree, key - realIndex - 1);
                }

                var ancestor = this.findLowestCommonAncestor(this.tree, openingTagNode, closingTagNode);
                this.moveToEndingOfSentence(ancestor);
                nextTag = "<p>"
            }
            realIndex++;
        }

    }

    /**
     * moves tag to beginning of sentence its in.
     * @param {Object} tree
     * @param {Number} tagIndex - index of leaf to which tag belongs
     * @param {Number} tagKey - key of tag from this.tokenizer.HTMLTagsPositions
     */
    moveToBeginningOfSentence(tree, tagIndex, tagKey) {
        let tag = this.tokenizer.HTMLTagsPositions.get(tagKey);
        let node = Parser.findNode(tree, tagIndex);

        if (node == undefined) {
            return;
        }

        while (!this.config["sentenceRule"].includes(node.root)) {
            node = Parser.findParent(tree, node.parent.left, node.parent.right, node.parent.root);
            if (node.root === this.config["rootRule"]) {
                throw new MissingSentenceTagException("Sentence not found in when adding <p> tag with tagIndex: " + tagIndex + " and tagKey: " + tagKey +
                 ". Check your config[\"sentenceRule\"] for missing rules.");
            }
        }
        while (node.subtrees.length != 0) {
            node = node.subtrees[0];
        }
        node.root = tag + node.root;
        return node;
    }

    /**
     * Adds </p> tag to end of sentence in which node is
     * @param {Object} node - tree node
     */
    moveToEndingOfSentence(node) {
        while (node.subtrees.length != 0) {
            node = node.subtrees[node.subtrees.length - 1];
        }
        node.root += "</p>";
    }


    /**
     * Adds tag specified by tagKey to leaf at index i.
     * @param {Object} tree
     * @param {Number} i - index of leaf
     * @param {Number} tagKey - key of HTML tag
     */
    replaceTokenAtIndex(tree = this.tree, i, tagKey) {

        if (tree.subtrees.length == 0) {
            let tag = this.tokenizer.HTMLTagsPositions.get(tagKey);
            if (this.isOpeningTag(tag)) {
                tree.root = tag + tree.root;
            }
            else {
                tree.root = tree.root + tag;
            }
        }
        else {
            for (let node of tree.subtrees) {
                if (node.left <= i && node.right > i) {
                    this.replaceTokenAtIndex(node, i, tagKey);
                }
            }
        }
    }

    /**
     * Checks if tag specified by parameter is opening tag.
     * @param {string} tag - HTML tag
     * @return {boolean}
     */
    isOpeningTag(tag) {
        return tag.indexOf("/") == -1;
    }

    /**
     * Adds all opening and closing <w> tags to tree.
     */
    addWordTags() {
        var counter = 1;
        function add(self, tree) {
            if (tree.subtrees.every(Parser.isLeaf) && !tree.subtrees.every(self.isPunctuation, self)) {
                tree.subtrees[0].root = '<w id="w'+ counter +'">' + tree.subtrees[0].root;
                tree.subtrees[tree.subtrees.length - 1].root += '</w>';
                counter += 1;
            }
            else {
                for (let node of tree.subtrees) {
                    add(self, node);
                }
            }
        }
        add(this, this.tree);
    }

    /**
     * Checks if node.root is punctuation based on punctuationRegex in config
     * @param {Object} node
     * @return {boolean}
     */
    isPunctuation(node) {
        this.config["punctuationRegex"].lastIndex = 0;
        return this.config["punctuationRegex"].test(node.root);
    }

    /**
     * Adds all opening and closing <s> tags to this.tree based on list of sentence rules from sentenceRule(config["sentenceRule"])
     */
    addSentenceTags(tree = this.tree) {
        var counter = 1;
        function add(self, t) {
            if (t != undefined) {
                for (let node of t.subtrees) {
                    if (self.config["sentenceRule"].includes(node.root)) {
                        if (self.checkParent(tree, node)) {
                            self.addOpeningSentenceTag(node, counter);
                            self.addClosingSentenceTag(node);
                            counter++;
                        }
                    }
                    add(self, node);
                }
            }
        }
        add(this, this.tree);
    }

    /**
     * Checks whether parents of node are tag-able as sentence based on config["sentenceRule"]
     * @param {Object} tree
     * @param {Object} node
     * @return {boolean}
     */
    checkParent(tree, node) {
        var parent = Parser.findParent(tree, node.parent.left, node.parent.right, node.parent.root);
        while (parent.subtrees.length == 1 && parent.root !== this.config["rootRule"]) {
            if (this.config["sentenceRule"].includes(parent.root)) {
                return false;
            }
            parent = Parser.findParent(tree, parent.parent.left, parent.parent.right, parent.parent.root);
        }
        return true;
    }

    /**
     * Add <s id="s i"> to specified node root
     * @param {Object} node
     * @param {Number} i - index of sentence
     */
    addOpeningSentenceTag(node, i) {
        var nextSentenceTagPosRegex = /((<s id="s\d+">)+)/g;
        nextSentenceTagPosRegex.lastIndex = 0;

        while (!Parser.isLeaf(node)) {
            node = node.subtrees[0]
        }
        var result = nextSentenceTagPosRegex.exec(node.root);
        var insertPosition = 0;
        if (result != null) {
            insertPosition = result.index + result[0].length;
        }
        node.root = node.root.slice(0, insertPosition) + '<s id="s'+ i +'">' + node.root.slice(insertPosition);
    }

    /**
     * Adds </s> tag to specified node(leaf)
     * @param {Object} node
     */
    addClosingSentenceTag(node) {
        while (!Parser.isLeaf(node)) {
            node = node.subtrees[node.subtrees.length - 1];
        }
        node.root += '</s>';
    }

    /**
     * Checks whether this.tree is complete based on number of leaves in tree and tokens in input.
     * @return {boolean}
     */
    isComplete() {
        var leaves = Parser.getLeaves(this.tree);
        if (leaves.length < this.tokenizer.tokens.length) {
            return false;
        }
        return true;
    }

    /**
     * Builds whole XML output from this.tree
     * @return {void}
     */
    buildXML() {

        if (!this.isComplete()) {
            this.finishIncompleteTree();
        }
        this.substituteLeafs();
        this.addWordTags();
        this.saveWords();
        this.addSentenceTags();
        this.addHTMLTags();
        this.addParagraphTags();
    }

    /**
     * Finishes(or builds whole) tree, that is not complete(parser could not parse whole input(or any)).
     */
    finishIncompleteTree() {
        var leaves = Parser.getLeaves(this.tree);
        if (this.tree.root !== this.config["rootRule"]) {
            this.tree = Parser.createNode(0, this.tree.right, this.config["rootRule"], null, this.tree);
        }
        var startNewSentence = null;
        if (leaves.length == 0) {
            startNewSentence = true;
        }
        else {
            startNewSentence = this.isSentenceFinished(leaves[leaves.length - 1]);
        }
        var sentence = null;
        if (startNewSentence) {
            sentence = Parser.createNode(this.tree.right, this.tokenizer.tokens.length, this.config["sentenceRule"][0], this.tree, null);
            this.tree.subtrees.push(sentence);
        }
        else { //moze toto nastat?
            var lastLeaf = leaves[leaves.length - 1];
            while (!this.config["sentenceRule"].includes(lastLeaf.root)) {
                lastLeaf = Parser.findParent(this.tree, lastLeaf.parent.left, lastLeaf.parent.right, lastLeaf.parent.root);
                if (lastLeaf.root === this.config["rootRule"]) {
                    break;
                }
            }
            sentence = lastLeaf;
        }
        for (var i = leaves.length; i < this.tokenizer.tokens.length; i++) {
            var HelperNode = Parser.createNode(i, i+1, "Helper", sentence, null);
            var newNode = Parser.createNode(i, i+1, this.tokenizer.tokens[i], HelperNode, null);

            sentence.subtrees.push(HelperNode);
            HelperNode.subtrees.push(newNode);
        }
        while (sentence.root !== this.config["rootRule"]) {
            sentence.right = this.tokenizer.tokens.length;
            var right = sentence.parent.right;
            sentence.parent.right = this.tokenizer.tokens.length;
            sentence = Parser.findParent(this.tree, sentence.parent.left, right, sentence.parent.root)
        }
        sentence.right = this.tokenizer.tokens.length;
    }

    /**
     * Checks whether sentence ends in node based of sentenceEndPunctuationRegex from config
     * @param {Object} node
     * @return {boolean}
     */
    isSentenceFinished(node) { //TODO: otestovat anglicku gramatiku
        this.config["sentenceEndPunctuationRegex"].lastIndex = 0;
        var isLastInSentence = this.config["sentenceEndPunctuationRegex"].test(node.root);
        var isInSentence = true;
        while (!this.config["sentenceRule"].includes(node.root)) {
            if (node.root === this.config["rootRule"]) {
                isInSentence = false;
                break;
            }
            node = Parser.findParent(this.tree, node.parent.left, node.parent.right, node.parent.root);
        }
        if (isLastInSentence) {
            return true;
        }
        else {
            return !isInSentence;
        }
    };

    /**
     * Creates and returns new Node with left, right, rootValue and values from parentNode
     * @param {Number} left
     * @param {Number} right
     * @param {string} rootValue
     * @param {Object} parentNode
     * @param {Object} subtrees
     * @return {{root: string, left: Number, right: Number, parent: ({root: string, left: Number, right: (Number, subtrees: Array}|null), subtrees: Array}}
     */
    static createNode(left, right, rootValue, parentNode, subtrees) {
        if (parentNode != null) {
            return {
                root: rootValue,
                left: left,
                right: right,
                parent: {
                    root: parentNode.root,
                    left: parentNode.left,
                    right: parentNode.right,
                    subtrees: []
                },
                subtrees: []
            };
        }
        return {
            root: rootValue,
            left: left,
            right: right,
            parent: {
                subtrees: []
            },
            subtrees: [subtrees]
        };
    }

    /**
     * Returns HTML representation of this.tree
     * @return {string} - HTML representation of this.tree
     */
    getHTMLTree() {
        this.escapeTags();
        return this.createHTMLTreeFile();
    }

    /**
     * Returns JSON representation of tree
     * @param {Object} tree
     * @return {Object}
     */
    getJSONTree(tree = this.tree) {
        var tempTree = JSON.parse(JSON.stringify(tree));
        this.unescapeTags(tempTree);
        return this.prettifyTree(tempTree);
    }

    /**
     * Retrieves words from tree and saves them into this.words
     * Used to get words without <w> tags before addition of remaining tags.
     * @param tree
     */
    saveWords(tree = this.tree) {
        var tokens = [];
        var concatWithNext = false;
        var leaves = Parser.getLeaves(tree);
        for (let i = 0; i < leaves.length; i++) {
            if (concatWithNext) {
                if (leaves[i].root.includes("</w>")) {
                    concatWithNext = false;
                }
                tokens[tokens.length-1] = tokens[tokens.length-1].concat(leaves[i].root);
            }
            else {
                if (/<w id="w\d+">/.test(leaves[i].root) && !leaves[i].root.includes("</w>")) {
                    concatWithNext = true;
                }
                tokens.push(leaves[i].root);
            }
        }
        for (let token of tokens) {
            if (/^<w id=\"w\d+\">(.+)<\/w>$/g.test(token)) {
                this.words.push(/^<w id=\"w\d+\">(.+)<\/w>$/g.exec(token)[1])
            }
        }
    }

    /**
     * Checks whether node is inside of a sentence based on this.config["sentenceRule"] and parent nodes
     * @param node - node being checked
     * @return {boolean}
     */
    isNodeInSentence(node) {
        var result = true;
        while (!this.config["sentenceRule"].includes(node.root)) {
            if (node.root === this.config["rootRule"]) {
                result = false;
                break;
            }
            node = Parser.findParent(this.tree, node.parent.left, node.parent.right, node.parent.root);
        }
        return result;
    }
}

/**
 * class for custom exception used when sentence is not found when adding paragraph tags back to tree
 * @class
 */
class MissingSentenceTagException {
    /**
     * @constructor
     * @param {string} message
     */
    constructor (message) {
        this.message = message;
        this.name = "MissingSentenceTagException";
    }
}

var p = new Parser("- Veta. Veta. Veta, - veta. Veta. Veta.", "SK");

p.buildXML(); // Prida vsetky tagy.
console.log(p.stringifyTree()); // Vysledne XML.
console.log(p.words); // Vsetky slova


// for (let tree of p.trees) {
//     p.getJSONTree(tree); // Vrati jenotlive stromy v citatelnej forme
// }

p.saveHTMLTree("../app/res/trees/tree.html"); // HTML reprezentacia pouziteho stromu pre debugovanie, da sa aj p.getHTMLTree()
p.saveJSONTree("../app/res/trees/tree.json"); // JSON reprezentacia pouziteho stromu, da sa aj p.getJSONTree()

module.exports = {Parser};

