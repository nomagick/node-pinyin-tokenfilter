/**
 * Created by avastms on 15/10/28.
 */
var _ = require('lodash');
var fs = require('fs');

var defaultInstance = null;

var FLAG_FIRST_LETTER = parseInt('0001',2);
var FLAG_PHONETIC = parseInt('0010',2);
var FLAG_LETTERS = parseInt('0100',2);
var FLAG_LETTERS_WITH_TONE = parseInt('1000',2);
var FLAG_ALL = parseInt('1111',2);
var FLAG_MINT = FLAG_LETTERS | FLAG_FIRST_LETTER;

var MAP_PHONETIC_LETTER_AND_TONE = {
    "ā": "a1",
    "á": "a2",
    "ǎ": "a3",
    "à": "a4",
    "ē": "e1",
    "é": "e2",
    "ě": "e3",
    "è": "e4",
    "ō": "o1",
    "ó": "o2",
    "ǒ": "o3",
    "ò": "o4",
    "ī": "i1",
    "í": "i2",
    "ǐ": "i3",
    "ì": "i4",
    "ū": "u1",
    "ú": "u2",
    "ǔ": "u3",
    "ù": "u4",
    "ü": "v0",
    "ǖ": "v1",
    "ǘ": "v2",
    "ǚ": "v3",
    "ǜ": "v4",
    "ń": "n2",
    "ň": "n3",
    "": "m2"
};
var REVERSED_MAP_PHONETIC_LETTER_AND_TONE = _.invert(MAP_PHONETIC_LETTER_AND_TONE);

var MAP_PHONETIC_YU_PATCH = {
    "ü": "yu0",
    "ǖ": "yu1",
    "ǘ": "yu2",
    "ǚ": "yu3",
    "ǜ": "yu4"
};

var defaultOptions = {
    'polyphones': false,
    //'unknowns': true,
    //'mood': FLAG_MINT,
    //'patchYu': false,
    'separator': '',
    'characterDictPath': __dirname + '/../data/characters.txt',
    'tokenDictPath': __dirname + '/../data/tokens.txt'
};


var Pinyin = function(options){
    this.options = _.defaults(options || {}, defaultOptions);

    Pinyin.prototype._convertPhoneticForm = function(phoneticForm){
        var tone = 0;
        var toneOffset = 0;
        var letterForm;
        letterForm = _.map(phoneticForm, function(char, indx){
            var letterV = MAP_PHONETIC_LETTER_AND_TONE[char];
            if (letterV) {
                tone = parseInt(letterV[letterV.length-1]);
                toneOffset = indx;
                return letterV.substring(0, letterV.length-1);
            } else {
                return char
            }
        }).join('');

        return letterForm+tone+toneOffset.toString()

    };

    Pinyin.prototype.compileCharacterDict = function(){
        var compiledDict = [];
        var dictFile = fs.openSync(this.options.characterDictPath,'r');
        var buff = new Buffer(8*1024);
        //var rawDict = fs.readFileSync(this.options.characterDictPath,{encoding: 'utf-8'});
        var rawDict = '';
        var bytesRead = 0;
        var finalLineOffset = 0;
        var thisLineOffset = 0;
        var lastLineOffset = 0;
        var theLine = '';
        var dictVector = null;
        var self = this;
        var dropRRegexp = new RegExp('\r','g');

        bytesRead = fs.readSync(dictFile, buff, 0, buff.length);

        while (bytesRead) {
            rawDict += buff.toString('utf-8', 0, bytesRead);
            finalLineOffset = rawDict.lastIndexOf('\n');
            thisLineOffset = rawDict.indexOf('\n', 0);
            lastLineOffset = -1;

            while (thisLineOffset < finalLineOffset) {
                theLine = rawDict.substring(lastLineOffset + 1, thisLineOffset);
                if (theLine) {
                    theLine = theLine.replace(dropRRegexp,'');
                }
                dictVector = theLine.split(',');

                lastLineOffset = thisLineOffset;
                thisLineOffset = rawDict.indexOf('\n', lastLineOffset+1);

                if (dictVector.length <= 1) {
                    continue;
                } else {
                    compiledDict[parseInt(dictVector[0],16)] = _.foldl(dictVector.slice(1), function(final, phoneticForm){

                        final.push(self._convertPhoneticForm(phoneticForm));
                        return final
                    }, []).join(',');
                }
            }

            rawDict = rawDict.substring(finalLineOffset+1, rawDict.length);
            bytesRead = fs.readSync(dictFile, buff, 0, buff.length);
        }

        this.dict = compiledDict;
    };

    Pinyin.prototype.compileTokenDict = function () {
        var compiledDict = {};
        var dictFile = fs.openSync(this.options.tokenDictPath,'r');
        var buff = new Buffer(8*1024);
        //var rawDict = fs.readFileSync(this.options.tokenDictPath, {encoding: 'utf-8'});
        var rawDict = '';
        var bytesRead = 0;
        var finalLineOffset = 0;
        var thisLineOffset = 0;
        var lastLineOffset = 0;
        var self = this;
        var theLine = '';
        var dictVector = null;
        var dropRRegexp = new RegExp('\r','g');

        bytesRead = fs.readSync(dictFile, buff, 0, buff.length);

        while (bytesRead) {
            rawDict += buff.toString('utf-8', 0, bytesRead);
            finalLineOffset= rawDict.lastIndexOf('\n');
            thisLineOffset= rawDict.indexOf('\n', 0);
            lastLineOffset = -1;

            while (thisLineOffset < finalLineOffset) {
                theLine = rawDict.substring(lastLineOffset + 1, thisLineOffset);
                if (theLine) {
                    theLine = theLine.replace(dropRRegexp,'');
                }
                dictVector = theLine.split(',');

                lastLineOffset = thisLineOffset;
                thisLineOffset = rawDict.indexOf('\n', lastLineOffset+1);

                if (dictVector.length < 2) {
                    continue;
                } else {
                    compiledDict[dictVector[0]] = _.foldl(dictVector.slice(1), function(final, phoneticForm){
                        final.push(self._convertPhoneticForm(phoneticForm));
                        return final
                    }, []).join(',');
                }
            }

            rawDict = rawDict.substring(finalLineOffset+1, rawDict.length);
            bytesRead = fs.readSync(dictFile, buff, 0, buff.length);

        }
        this.tokenDict = compiledDict;
        delete rawDict
    };

    Pinyin.prototype._lookupChar = function (char) {
        if (!_.isString(char) || char.length !== 1) {
            return null;
        }
        var match = this.dict[char.charCodeAt(0)];
        if (match) {
            var wordVRaw = match.split(',');
            if (this.options.polyphones) {
                return wordVRaw
            } else {
                return [wordVRaw[0]]
            }
        } else {
            return null
        }
    };

    Pinyin.prototype._lookupToken = function (token) {
        var match = this.tokenDict[token];
        if (match) {
            return _.map(match.split(','), function(item){return [item]})
        } else {
            return _(token).map(this._lookupChar, this).compact().value();
        }
    };

    Pinyin.prototype._cartesianProduct = function (vectorOfVectors) {
        var self = this;
        var finalProduct = _.foldl(vectorOfVectors, function(acc, wordV, indx){
            var nextAcc = [];
            for (var i=0; i<acc.length; i++) {
                for (var j=0; j<wordV.length; j++) {
                    var newV = _.cloneDeep(acc[i]);
                    var rawV = wordV[j];
                    if (!rawV || !newV) {
                        return acc[i]
                    }
                    var letterForm = rawV.substring(0, rawV.length-2);
                    var specialOffset = parseInt(rawV[rawV.length-1]);
                    var specialLetter = REVERSED_MAP_PHONETIC_LETTER_AND_TONE[rawV[specialOffset] + rawV.substring(rawV.length-2, rawV.length-1)];
                    var phoneticForm = '';
                    var compoundForm = '';
                    if (specialLetter && !_.isNaN(specialOffset)) {
                        phoneticForm = rawV.substring(0, specialOffset) + specialLetter + rawV.substring(specialOffset+1, rawV.length-2);
                        compoundForm = rawV.substring(0, rawV.length-1);
                    } else {
                        phoneticForm = letterForm;
                        compoundForm = letterForm;
                    }
                    newV[0].push(rawV[0]);
                    newV[1].push(phoneticForm);
                    newV[2].push(letterForm);
                    newV[3].push();
                    nextAcc.push(newV);
                }
            }
            return nextAcc
        }, [[[],[],[],[]]]);
        return _.map(finalProduct, function(item){
            var firstLetters = item[0].join(self.options.separator);
            var phonetics = item[1].join(self.options.separator);
            var letters = item[2].join(self.options.separator);
            var lettersWithTones = item[3].join(self.options.separator);
            return [firstLetters, phonetics, letters, lettersWithTones]
        })
    };

    Pinyin.prototype._firstMatch = function (vectorOfVectors) {
        var self = this;
        var finalProduct = _.foldl(vectorOfVectors, function(acc, wordV, indx){
            var rawV = wordV[0];
            if (!rawV) {
                return acc
            }
            var letterForm = rawV.substring(0, rawV.length-2);
            var specialOffset = parseInt(rawV[rawV.length-1]);
            var specialLetter = REVERSED_MAP_PHONETIC_LETTER_AND_TONE[rawV[specialOffset] + rawV.substring(rawV.length-2, rawV.length-1)];
            var phoneticForm = '';
            var compoundForm = '';
            if (specialLetter && !_.isNaN(specialOffset)) {
                phoneticForm = rawV.substring(0, specialOffset) + specialLetter + rawV.substring(specialOffset+1, rawV.length-2);
                compoundForm = rawV.substring(0, rawV.length-1);
            } else {
                phoneticForm = letterForm;
                compoundForm = letterForm;
            }
            acc[0].push(rawV[0]);
            acc[1].push(phoneticForm);
            acc[2].push(letterForm);
            acc[3].push(compoundForm);
            return acc
        }, [[],[],[],[]]);
        return _.map(finalProduct, function(tokenV){
            return tokenV.join(self.options.separator);
        })
    };


    Pinyin.prototype.lookup = function (token) {
        var tokenVectors = null;
        if (!_.isString(token)) {
            return null
        }
        tokenVectors = this._lookupToken(token);
        if (this.options.polyphones) {
            return this._cartesianProduct(tokenVectors)
        } else {
            return this._firstMatch(tokenVectors)
        }
    };

    this.compileCharacterDict();
    this.compileTokenDict();
};

module.exports = Pinyin;
