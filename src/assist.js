const { EOL } = require('os');
const fs = require('fs');
const readline = require('readline');


class assist {
    //override in main file tool.js, it is here for test-cases.
    static settings = {};
    static logFile;


    //Handle SVG tags
    static svg = {
        prefix: '[name()=\'',
        postfix: '\']'
    }
    static RepairStrategy = {
        BASIC: "basic",
        ORACLE_PARENT: "oracle-parent",
        SHRINK_ROW_SIBLINGS: "shrink-row-siblings",
        ANCESTOR_MAX_WIDTH_HEIGHT: "ancestor-max-width-height",
    };
    static RepairType = {
        maxViewportSize: 1,
        maxParent: 2,
        maxAncestors: 3,
        pushApart: 4,
        shrinkRowSiblings: 5,
        widerParentSize: 6,
        computedStyle: 7,
    };
    static AdditionalRepairs = {
        NONE: "None",
        COMBINATIONS: "Combinations",
        PERMUTATIONS: "Permutations"
    };
    static RepairConfirmed = {
        DOM: "DOM",
        RLG: "RLG",
        DOMRLG: "DOM and RLG"
    };
    static alignment = {
        RIGHT: "Right",
        LEFT: "Left",
        ABOVE: "Above",
        BELOW: "Below",
        OVERLAP: "Overlap"
    }

    static failureID = 0;
    static failureCount = 0;
    /**
     * Sorting function to sort objects with xpaths.
     * @param {object} a Object with xpath property.
     * @param {object} b Object with xpath property.
     */
    static compare(a, b) {
        let comparison = 0;
        if (a.xpath > b.xpath) {
            comparison = 1;
        } else if (a.xpath < b.xpath) {
            comparison = -1;
        }
        return comparison;
    }
    static getRandomNumber(not = [], min = 1, max = 300, ) {
        let number = undefined;
        let rangeSize = (max - min + 1);
        if (rangeSize <= 0)
            throw "getRandomNumber() does range size (" + rangeSize + ") is not acceptable";
        if (not.length >= rangeSize)
            throw "getRandomNumber() does not accept list not greater than size of range. length(" + not.length + ") " + "range-size(" + rangeSize + ")";
        let maxAttempts = 100000000;
        let attempts = 0;
        while (attempts <= maxAttempts) {
            number = Math.floor(Math.random() * rangeSize) + min;
            if (!not.includes(number))
                break;
            attempts++;
        }
        if (attempts > maxAttempts)
            throw "getRandomNumber() max attempts reached." + " Attempted(" + attempts + ")";
        return number;
    }
    /**
     * Creates min x and y and width and height from list of points as provided by
     * puppeteer getBoxModel function.
     * @param {[{x,y}]} points points making up a rectangle.
     */
    static getXYWidthHeightFromBox = function (points) {
        const x = Math.min(points[0].x, points[1].x, points[2].x, points[3].x);
        const y = Math.min(points[0].y, points[1].y, points[2].y, points[3].y);
        return {
            x: x,
            y: y,
            width: Math.max(points[0].x, points[1].x, points[2].x, points[3].x) - x,
            height: Math.max(points[0].y, points[1].y, points[2].y, points[3].y) - y
        };
    }
    static getNewFailureID() {
        this.failureID++;
        return this.failureID;
    }
    static resetFailureID() {
        this.failureID = 0;
    }
    static incrementFailureCount() {
        this.failureCount++;
    }
    static resetFailureCount() {
        this.failureCount = 0;
    }
    static highlightColors = ['red', 'yellow'];
    static Mode = {
        FULLSCREEN: "Fullscreen",
        MAXIMIZED: "Maximized",
        HEADLESS: "Headless"
    };
    static FailureType = {
        VIEWPORT: 'Viewport-Protrusion',
        PROTRUSION: 'Element-Protrusion',
        COLLISION: 'Element-Collision',
        SMALLRANGE: 'Small-Range',
        WRAPPING: 'Wrapping'
    };
    static Difference = {
        CHANGED: 'Changed',
        MISSING: 'Missing',
        NEW: 'New',
        FROM: 'From',
        TO: 'To',
        OK: 'OK'
    };
    static Run = {
        DIFFERENCING: "Differencing",
        DETECTION: "Detection",
        REPAIR: "Repair",
        MANUAL: "Manual",
        STATISTICS: "Statistics",
        RQ: "ResearchQuestion"
    };

    static pause(message = 'Paused.') {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise(resolve => rl.question(message, userInput => {
            rl.close();
            resolve(userInput);
        }))
    }
    /**
     * Print to file.
     * @param {String} file The path for file to print.
     * @param {String} text The text to be printed to file.
     * @param {boolean} lineBreak Optional lineBreak set to true by default.
     */
    static printToFile(file, text, lineBreak = true) {
        if (lineBreak)
            text = text + EOL;
        if (file !== undefined)
            fs.appendFileSync(file, text, function (err) {
                if (err) throw err;
            });
    }
    /**
     * Print to log file.
     * @param {String} text The text to be printed to file.
     * @param {boolean} lineBreak Optional lineBreak set to true by default.
     */
    static log(text, lineBreak = true) {
        if (lineBreak)
            text = text + EOL;
        if (this.logFile !== undefined)
            fs.appendFileSync(this.logFile, text, function (err) {
                if (err) throw err;
            });
    }
    /**
     * Checks to see if object is in array using xpath property.
     * @param {Object} object an object with XPath property.
     * @param {[Objects]} arrayOfObjects an array of objects each with an XPath.
     */
    static isObjectsXPathInArrayOfObjects(object, arrayOfObjects) {
        for (let obj of arrayOfObjects)
            if (obj.xpath === object.xpath)
                return true;
        return false;
    }
    /**
     * Returns true if overlapping.
     * @param {Rectangle} rectangle1 
     * @param {Rectangle} rectangle2 
     */
    static areOverlapping(rectangle1, rectangle2) {
        //check if one is on right of the other
        if (rectangle1.minX > rectangle2.maxX || rectangle2.minX > rectangle1.maxX)
            return false;
        //check if one is bellow the other
        if (rectangle1.minY > rectangle2.maxY || rectangle2.minY > rectangle1.maxY)
            return false;
        //they are overlapping
        return true;
    }
    /**
     * Returns a resolved promise after the number of seconds expires.
     * Use await with this function.
     * @param {number} seconds The number of seconds to wait.
     */
    static resolveAfterSeconds(seconds = 2) {
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve('done');
            }, seconds * 1000);
        });
    }
    /**
     * Creates an array for each element.
     * @param {Array} array the array to break into array of arrays.
     */
    static getArraysFromArray(array) {
        let arrays = [];
        for (let element of array) {
            arrays.push([element]);
        }
        return arrays;
    }
    /**
     * for each subset from one to maxSetSize, get permutations of given subset size
     * and combine as a result.
     * https://github.com/kota-yata/Percom/blob/master/index.js
     * @param {Array} array An array of elements.
     * @param {number} maxSubsetSize The maximum size of the subsets.
     */
    static getPermutationsOfSets(array, maxSubsetSize) {
        let result = [];
        for (let subsetSize = 1; subsetSize <= maxSubsetSize; subsetSize++) {
            let perms = assist.getPermutations(array, subsetSize);
            result = result.concat(perms);
        }
        return result;
    }
    /**
     * for each subset from one to maxSetSize, get combinations of given subset size
     * and combine as a result.
     * https://github.com/kota-yata/Percom/blob/master/index.js
     * @param {Array} array An array of elements.
     * @param {number} maxSubsetSize The maximum size of the subsets.
     */
    static getCombinationsOfSets(array, maxSubsetSize) {
        let result = [];
        for (let subsetSize = 1; subsetSize <= maxSubsetSize; subsetSize++) {
            let perms = assist.getCombinations(array, subsetSize);
            result = result.concat(perms);
        }
        return result;
    }
    /**
     * get combinations of given subset size.
     * https://github.com/kota-yata/Percom/blob/master/index.js
     * @param {Array} array An array of elements.
     * @param {number} subsetSize The size of the subset.
     */
    static getCombinations(array, subsetSize) {
        const last = assist.rec(array.length, subsetSize);
        const result = [];
        for (let ite = 0; ite < last.length; ite++) {
            const answer = [];
            for (let fin = 0; fin < last[ite].length; fin++) {
                answer.push(array[last[ite][fin]]);
            }
            result.push(answer);
        }
        return result;
    }
    /**
     * get combinations helper.
     * https://github.com/kota-yata/Percom/blob/master/index.js
     * @param {number} n An length of array of elements.
     * @param {number} k The size of the subset.
     */
    static rec(n, k) {
        if (k === 0) return [[]];
        const result = [];
        for (let i = 0; i < n; i++) {
            if (n - i - 1 < k - 1) continue;
            assist.rec(n - i - 1, k - 1).forEach((js) => {
                result.push([i, ...js.map((j) => j + i + 1)]);
            });
        }
        return result;
    }
    /**
     * get permutations of given subset size.
     * https://github.com/kota-yata/Percom/blob/master/index.js
     * @param {Array} array An array of elements.
     * @param {number} subsetSize The size of the subset.
     */
    static getPermutations(array, subsetSize) {
        const result = [];
        //Subset cannot be larger than the 
        if (array.length < subsetSize) {
            return [];
        }
        //Base subset size of 1.
        if (subsetSize === 1) {
            for (let i = 0; i < array.length; i++) {
                result[i] = [array[i]];
            }
        } else {
            for (let i = 0; i < array.length; i++) {
                const parts = array.slice(0);
                parts.splice(i, 1)[0];
                const row = assist.getPermutations(parts, subsetSize - 1);
                for (let j = 0; j < row.length; j++) {
                    result.push([array[i]].concat(row[j]));
                }
            }
        }
        return result;
    };
    static getPermutationsHeap(array, result, r = array.length) {
        if (r === 1) {
            return array;
        } else {
            for (var i = 1; i <= r; i++) {
                getPermutations(array, result, r - 1);
                if (r % 2) {
                    //swap first with last
                    [array[0], array[r - 1]] = [array[r - 1], array[0]];
                } else {
                    //swap iteration with last.
                    [array[i - 1], array[r - 1]] = [array[r - 1], array[i - 1]];
                }
            }
        }
    }

    /**
     * Returns DD-MM-YYYY-HH-MM-SS.
     * 
     *  */
    static getDateTimeString() {
        let date = new Date();
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();

        let hour = date.getHours();
        let min = date.getMinutes();
        let sec = date.getSeconds();

        day = (day < 10 ? "0" : "") + day;
        month = (month < 10 ? "0" : "") + month;

        hour = (hour < 10 ? "0" : "") + hour;
        min = (min < 10 ? "0" : "") + min;
        sec = (sec < 10 ? "0" : "") + sec;

        return year + "-" + month + "-" + day + "-" + hour + "-" + min + "-" + sec;
    }
    /**
     * Returns the new set of elements in first parameter set but not in
     * the second passed in parameter set.
     * @param {Array} allInSet array of possible elements to return.
     * @param {Array} notInSet the other set. 
     */
    static setDifference(allInSet, notInSet) { //TODO: test.
        let difference = [];
        for (let e of allInSet)
            if (!notInSet.includes(e))
                difference.push(e);
        return difference;
    }
    /**
     * Prints to consol the rectangle information including xpath if defined.
     * @param {Object} rectangle Object containing minX, maxX, minY, maxY.
     */
    static printRectangle(rectangle) {
        if (rectangle.width === undefined) {
            rectangle.width = rectangle.maxX - rectangle.minX;
            rectangle.height = rectangle.maxY - rectangle.minY;
        }
        if (rectangle.xpath)
            console.log(rectangle.xpath)
        console.log("minX:" + rectangle.minX + " maxX:" + rectangle.maxX + " minY:" + rectangle.minY + " maxY:" + rectangle.maxY + " width:" + rectangle.width + " height:" + rectangle.height);
    }

};

module.exports = assist;