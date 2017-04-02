//   Copyright 2015 Yurii Lahodiuk (yura.lagodiuk@gmail.com)
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.

var tinynlp = (function(){


    /**
     * Constructor for Grammar class
     * Parses given rules
     * @param {Array} rules - example: ["LHS -> RHS | RHS | RHS", ...]
     * @constructor
     */
    function Grammar(rules) {
        this.lhsToRhsList = {};
        for (var i in rules) {
            var rule = rules[i];
            // "A -> B C | D" -> ["A ", " B C | D"]
            var parts = rule.split('->');
            // "A"
            var lhs = parts[0].trim();
            // "B C | D"
            var rhss = parts[1].trim();
            // "B C | D" -> ["B C", "D"]
            var rhssParts = rhss.split('|');
            if (!this.lhsToRhsList[lhs]) {
                this.lhsToRhsList[lhs] = [];
            }
            for (var j in rhssParts) {
                this.lhsToRhsList[lhs].push(rhssParts[j].trim().split(' '));
            }
            // now this.lhsToRhsList contains list of these rules:
            // {... "A": [["B", "C"], ["D"]] ...}
        }
    }
    Grammar.prototype.terminalSymbols = function(token) {
        return [];
    };

    /**
     * Returns right hand side of grammar rule
     * @param {String} leftHandSide - Left hand side of grammar rule
     * @return {Array} - example -> ["Sentences", ...]
     */
    Grammar.prototype.getRightHandSides = function(leftHandSide) {
            var rhss = this.lhsToRhsList[leftHandSide];
            if (rhss) {
                return rhss;
            }
            return null;
    };

    /**
     * Checks whether term produces epsilon(nothing)
     * @param {string} term - example -> "Sentences"
     * @return {boolean}
     */
    Grammar.prototype.isEpsilonProduction = function(term) {
        // This is needed for handling of epsilon (empty) productions
        // TODO: get rid of this hardcode name for epsilon productions
        return "_EPSILON_" == term;
    };
    
    //------------------------------------------------------------------------------------
    
    var loggingOn = false;
    function logging(allow) {
        loggingOn = allow;
    }

    /**
     * 
     * @param {Array} tokens
     * @constructor
     */
    function Chart(tokens) {
        this.idToState = {};
        this.currentId = 0;
        this.chart = [];
        for (var i = 0; i < tokens.length + 1; i++) {
            this.chart[i] = [];
        }
    }

    /**
     * Adds new State to Chart
     * @param {State} newState
     * @param {Number} position
     * @return {boolean}
     */
    Chart.prototype.addToChart = function(newState, position) {
        newState.setId(this.currentId);
        // TODO: use HashSet + LinkedList
        var chartColumn = this.chart[position];
        for (var x in chartColumn) {
            var chartState = chartColumn[x];
            if (newState.equals(chartState)) {
            
                var changed = false; // This is needed for handling of epsilon (empty) productions
                
                changed = chartState.appendRefsToChidStates(newState.getRefsToChidStates());
                return changed;
            }
        }
        chartColumn.push(newState);
        this.idToState[this.currentId] = newState;
        this.currentId++;
        
        var changed = true; // This is needed for handling of epsilon (empty) productions
        return changed;
    };

    /**
     * 
     * @param {Number} index - index of state in column
     * @return {State}
     */
    Chart.prototype.getStatesInColumn = function(index) {
        return this.chart[index];
    };
    /**
     *
     * @param {Number} index - index of state in column
     * @return {Number} - Number of States in column
     */
    Chart.prototype.countStatesInColumn = function(index) {
        return this.chart[index].length;
    };

    /**
     * Returns State specified by id
     * @param {Number} id
     * @return {State}
     */
    Chart.prototype.getState = function(id) {
        return this.idToState[id];
    };

    /**
     * Returns Array of completed parse trees or best incomplete parse tree
     * @param {string} rootRule - example -> "Story"
     * @return {Array}
     */
    Chart.prototype.getFinishedRoot = function( rootRule ) {
        var lastColumn = this.chart[this.chart.length - 1];
        for(var i in lastColumn) {
            var state = lastColumn[i];
            if(state.complete() && state.getLeftHandSide() == rootRule ) {
                // TODO: there might be more than one root rule in the end // Ak nie je completny strom, tak najdi taky co zacina v nultom charte a konci co najdalej(to je najvacsi mozny strom)
                // so, there is needed to return an array with all these roots
                return state;
            }
        }
        //////////////////////////////////////////////////
        var maxLength = -1;
        var bestRule = null;
        for(let chart of this.chart.reverse()) {
            for (let rule of chart) {
                //if (rule.left == 0 && maxLength < rule.right) {
                if (rule.getLeftHandSide() == rootRule && (rule.right - rule.left) > maxLength) {
                    //maxLength = rule.right;
                    maxLength = rule.right - rule.left;
                    bestRule = rule;
                }
            }

        }
        //console.log("NEUPLNY STROM");
        return bestRule;
        /////////////////////////////////////////////////
        //return null;
    };

    /**
     * If logging is on, prints charts of states to console
     * @param {Number} column
     */
    Chart.prototype.log = function(column) {
        if(loggingOn) {
            console.log('-------------------');
            console.log('Column: ' + column);
            console.log('-------------------');
            for (var j in this.chart[column]) {
                console.log(this.chart[column][j].toString())
            }
        }
    };
    
    //------------------------------------------------------------------------------------

    /**
     * Creates new State
     * @param {string} lhs - left hand side of rule
     * @param {Array} rhs - right hand side of rule
     * @param {Number} dot - position of "dot"
     * @param {Number} left
     * @param {Number} right
     * @constructor
     */
    function State(lhs, rhs, dot, left, right) {
        this.lhs = lhs;
        this.rhs = rhs;
        this.dot = dot;
        this.left = left;
        this.right = right;
        this.id = -1;
        this.ref = [];
        for (var i = 0; i < rhs.length; i++) {
            this.ref[i] = {};
        }
    }

    /**
     * Checks whether RHS is completed
     * @return {boolean}
     */
    State.prototype.complete = function() {
        return this.dot >= this.rhs.length;
    };

    State.prototype.toString = function() {
        var builder = [];
        builder.push('(id: ' + this.id + ')');
        builder.push(this.lhs);
        builder.push('→');
        for (var i = 0; i < this.rhs.length; i++) {
            if (i == this.dot) {
                builder.push('•');
            }
            builder.push(this.rhs[i]);
        }
        if (this.complete()) {
            builder.push('•');
        }
        builder.push('[' + this.left + ', ' + this.right + ']');
        builder.push(JSON.stringify(this.ref))
        return builder.join(' ');
    };
    /**
     * Checks whether non-terminal is expected
     * @param {Grammar} grammar
     * @return {boolean}
     */
    State.prototype.expectedNonTerminal = function(grammar) {
        var expected = this.rhs[this.dot];
        var rhss = grammar.getRightHandSides(expected);
        if (rhss !== null) {
            return true;
        }
        return false;
    };

    /**
     * Sets Id of State
     * @param {Number} id
     */
    State.prototype.setId = function(id) {
        this.id = id;
    };


    /**
     * Returns Id of State
     */
    State.prototype.getId = function() {
        return this.id;
    };

    /**
     * Checks whether this equals to otherState
     * @param {State} otherState
     * @return {boolean}
     */
    State.prototype.equals = function(otherState) {
        if (this.lhs === otherState.lhs && this.dot === otherState.dot && this.left === otherState.left && this.right === otherState.right && JSON.stringify(this.rhs) === JSON.stringify(otherState.rhs)) {
            return true;
        }
        return false;
    };

    /**
     * Returns Array of references to child States of this
     * @return {Array} - Array of references to child States
     */
    State.prototype.getRefsToChidStates = function() {
        return this.ref;
    };

    /**
     * @param {Array} refs - Array of references to States
     * @return {boolean}
     */
    State.prototype.appendRefsToChidStates = function(refs) {
    
        var changed = false; // This is needed for handling of epsilon (empty) productions
        
        for (var i = 0; i < refs.length; i++) {
            if (refs[i]) {
                for (var j in refs[i]) {
                    if(this.ref[i][j] != refs[i][j]) {
                    	changed = true;
                    }
                    this.ref[i][j] = refs[i][j];
                }
            }
        }
        return changed;
    };

    /**
     * Performs prediction step of parser
     * There is a non-terminal to the right of Dot. We add rule of this non-terminal to current State set
     * @param {Grammar} grammar
     * @param {Chart} chart
     * @return {boolean}
     */
    State.prototype.predictor = function(grammar, chart) {
        var nonTerm = this.rhs[this.dot];
        var rhss = grammar.getRightHandSides(nonTerm);
        var changed = false; // This is needed for handling of epsilon (empty) productions
        for (var i in rhss) {
            var rhs = rhss[i];
            
            // This is needed for handling of epsilon (empty) productions
            // Just skipping over epsilon productions in right hand side
            // However, this approach might lead to the smaller amount of parsing tree variants
            var dotPos = 0;
            while(rhs && (dotPos < rhs.length) && (grammar.isEpsilonProduction(rhs[dotPos]))) {
            	dotPos++;
            }
            
            var newState = new State(nonTerm, rhs, dotPos, this.right, this.right);
            changed |= chart.addToChart(newState, this.right);
        }
        return changed;
    };

    /**
     * Performs scanning step of parser.
     * There is terminal to the right of a Dot. Checks whether token equals to terminal, if so,
     * adds this State advanced by one to next State set
     * @param {Grammar} grammar
     * @param {Chart} chart
     * @param {string} token
     * @return {boolean}
     */
    State.prototype.scanner = function(grammar, chart, token) {
        var term = this.rhs[this.dot];
        
        var changed = false; // This is needed for handling of epsilon (empty) productions
        
        var tokenTerminals = token ? grammar.terminalSymbols(token) : [];
        if(!tokenTerminals) {
            // in case if grammar.terminalSymbols(token) returned 'undefined' or null
            tokenTerminals = [];
        }
        tokenTerminals.push(token);
        for (var i in tokenTerminals) {
            if (term == tokenTerminals[i]) {
                var newState = new State(term, [token], 1, this.right, this.right + 1);
                changed |= chart.addToChart(newState, this.right + 1);
                break;
            }
        }
        
        return changed;
    };

    /**
     * Performs completion step of parser.
     * There is nothing to the right of Dot. We add parent of this State, advanced by one, to current State set
     * @param {Grammar} grammar
     * @param {Chart} chart
     * @return {boolean}
     */
    State.prototype.completer = function(grammar, chart) {
    
        var changed = false; // This is needed for handling of epsilon (empty) productions
        
        var statesInColumn = chart.getStatesInColumn(this.left);
        for (var i in statesInColumn) {
            var existingState = statesInColumn[i];
            if (existingState.rhs[existingState.dot] == this.lhs) {
            
                // This is needed for handling of epsilon (empty) productions
                // Just skipping over epsilon productions in right hand side
                // However, this approach might lead to the smaller amount of parsing tree variants
                var dotPos = existingState.dot + 1;
                while(existingState.rhs && (dotPos < existingState.rhs.length) && (grammar.isEpsilonProduction(existingState.rhs[dotPos]))) {
                  dotPos++;
                }
                
                var newState = new State(existingState.lhs, existingState.rhs, dotPos, existingState.left, this.right);
                // copy existing refs to new state
                newState.appendRefsToChidStates(existingState.ref);
                // add ref to current state
                var rf = new Array(existingState.rhs.length);
                rf[existingState.dot] = {};
                rf[existingState.dot][this.id] = this;
                newState.appendRefsToChidStates(rf)
                changed |= chart.addToChart(newState, this.right);
            }
        }
        
        return changed;
    };
    
    //------------------------------------------------------------------------------------
    
    // Returning all possible correct parse trees
    // Possible exponential complexity and memory consumption!
    // Take care of your grammar!
    // TODO: instead of returning all possible parse trees - provide iterator + callback
    /**
     * Returns Array of parse trees
     * @param {State} parent
     * @param  {string} rootRule
     * @return {Array}
     */
    State.prototype.traverse = function(parent, rootRule) {
        try {
            if (this.ref.length == 1 && Object.keys(this.ref[0]).length == 0) {
                // This is last production in parse tree (leaf)
                var subtrees = [];
                if (this.lhs != this.rhs) {
                    // prettify leafs of parse tree
                    subtrees.push({
                        root: this.rhs,
                        left: this.left,
                        right: this.right,
                        parent: {
                            root: parent.lhs,
                            left: parent.left,
                            right: parent.right,
                            subtrees: []
                        }
                    });
                }
                return [{
                    root: this.lhs,
                    left: this.left,
                    right: this.right,
                    parent: {
                        root: parent.lhs,
                        left: parent.left,
                        right: parent.right,
                        subtrees: []
                    },
                    subtrees: subtrees
                }];
            }
            var rhsSubTrees = [];
            for (var i = 0; i < this.ref.length; i++) {
                rhsSubTrees[i] = [];
                for (var j in this.ref[i]) {
                    rhsSubTrees[i] = rhsSubTrees[i].concat(this.ref[i][j].traverse(this, rootRule));
                }
            }
            var possibleSubTrees = [];
            combinations(rhsSubTrees, 0, [], possibleSubTrees);
            var result = [];
            if (parent == undefined) {
                for (var i in possibleSubTrees) {
                    result.push({
                        root: this.lhs,
                        left: this.left,
                        right: this.right,
                        parent: {},
                        subtrees: possibleSubTrees[i]
                    })
                }
            }
            else {
                for (var i in possibleSubTrees) {
                    result.push({
                        root: this.lhs,
                        left: this.left,
                        right: this.right,
                        parent: {
                            root: parent.lhs,
                            left: parent.left,
                            right: parent.right,
                            subtrees: parent.subtrees
                        },
                        subtrees: possibleSubTrees[i]
                    })
                }
            }

            return result;
        } catch (e) {
            return [{
                root: rootRule,
                left: 0,
                right: 0,
                parent: {},
                subtrees: []
            }];
        }
    };
    


    /**
     * Generating array of all possible combinations, e.g.:
     * @example
     * input: [[1, 2, 3], [4, 5]]
     * output: [[1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]]
     *
     * Empty subarrays will be ignored. E.g.:
     * input: [[1, 2, 3], []]
     * output: [[1], [2], [3]]
     * @param {Array} arrOfArr
     * @param {Number} i
     * @param {Array} stack
     * @param {Array} result
     */
    function combinations(arrOfArr, i, stack, result) {
        if (i == arrOfArr.length) {
            result.push(stack.slice());
            return;
        }
        if(arrOfArr[i].length == 0) {
            combinations(arrOfArr, i + 1, stack, result);
        } else {
            for (var j in arrOfArr[i]) {
                if(stack.length == 0 || stack[stack.length - 1].right == arrOfArr[i][j].left) {
                    stack.push(arrOfArr[i][j]);
                    combinations(arrOfArr, i + 1, stack, result);
                    stack.pop();
                }
            }
        }
    }
    
    //------------------------------------------------------------------------------------

    /**
     * Returns LHS of this State(rule)
     * @return {string}
     */
    State.prototype.getLeftHandSide = function() {
        return this.lhs;
    };
            
    //------------------------------------------------------------------------------------

    /**
     * Parses input tokens using provided Grammar
     * @param {Array} tokens
     * @param {Grammar} grammar
     * @param {string} rootRule
     * @return {Chart}
     */
    function parse(tokens, grammar, rootRule) {
        var chart = new Chart(tokens);
        var rootRuleRhss = grammar.getRightHandSides(rootRule);
        for (var i in rootRuleRhss) {
            var rhs = rootRuleRhss[i];
            var initialState = new State(rootRule, rhs, 0, 0, 0);
            chart.addToChart(initialState, 0);
        }
        for (var i = 0; i < tokens.length + 1; i++) {
        
            var changed = true; // This is needed for handling of epsilon (empty) productions
            
            while(changed) {
                changed = false;
                j = 0;
                while (j < chart.countStatesInColumn(i)) {
                    var state = chart.getStatesInColumn(i)[j];
                    if (!state.complete()) {
                        if (state.expectedNonTerminal(grammar)) {
                            changed |= state.predictor(grammar, chart);
                        } else {
                            changed |= state.scanner(grammar, chart, tokens[i]);
                        }
                    } else {
                        changed |= state.completer(grammar, chart);
                    }
                    j++;
                }
            }
            chart.log(i)
        }
        return chart;
    }    
    
    var exports = {};
    exports.Grammar = Grammar;
    exports.State = State;
    exports.Chart = Chart;
    exports.parse = parse;
    exports.logging = logging;
    return exports;
})();

// function loadGrammar(path) {
//     var rules = [];
//     var fs = require("fs");
//     var temp = JSON.parse(fs.readFileSync(path).toString());
//     Object.keys(temp).forEach(key => {
//         rules.push(key + " -> " + temp[key]);
//     });
//     return rules;
// }

// Define grammar
// var grammar = new tinynlp.Grammar([
//     'R -> N',
//     'S -> S add_sub M | M',
//     'M -> M mul_div T | T',
//     'N -> S lt_gt S | S',
//     'T -> num | ( S )',
// ]);
//
//
// grammar.terminalSymbols = function(token) {
//     if ('<' === token || '>' === token) return ['lt_gt'];
//     if ('+' === token || '-' === token) return ['add_sub'];
//     if ('*' === token || '/' === token) return ['mul_div'];
//     if ('(' === token) return ['('];
//     if (')' === token) return [')'];
//     // Otherwise - token considered as a number:
//     return ['num'];
// };
//
// // You have to tokenize input by yourself!
// // Creating array of tokens
// var tokens = '7 - 5 * 3'.split(' ');
//
// // Parsing
// var rootRule = 'R';

///////////////////////////////////////////////////////////////////////////////////////////////////////////
// var grammar = new tinynlp.Grammar(loadGrammar('C:/Users/MH/Desktop/parser/app/res/Grammar.json'));
// grammar.terminalSymbols = function(token) {
//     return[token];
// };
// var tokens = 'WordStart Word WordLower .'.split(' ');
// var rootRule = 'Story';
// var chart = tinynlp.parse(tokens, grammar, rootRule);
//
// // Get array with all parsed trees
// // In case of ambiguous grammar - there might be more than 1 parsing tree
// var trees =  chart.getFinishedRoot(rootRule).traverse();
//
// // Iterate over all parsed trees and display them on HTML page
// for (var i in trees) {
//     console.log(JSON.stringify(trees[i]))
// }
//////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.tinynlp = tinynlp;
//module.exports = {
//    Earley: new tinynlp()
//};

