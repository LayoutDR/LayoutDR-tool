

class Range {
    /**
     * Constructs a new range object given a start and end values.
     * @param {number} min Start of the new range.
     * @param {number} max End of the new range.
     */
    constructor(min, max) {
        this.min = min;
        this.max = max;

        this.minClassification = '-';
        this.midClassification = '-';
        this.maxClassification = '-';
        this.narrowerClassification = '-';
        this.widerClassification = '-';

        this.minRepaired = undefined;
    }
    //TODO: Test this function.
    /**
     * Returns the classification (predetermined) for the viewport.
     * @param {Number} viewport The viewport width.
     */
    getClassificationOfViewport(viewport) {
        if (viewport === this.getMinimum())
            return this.minClassification;
        else if (viewport === this.getMiddle())
            return this.midClassification;
        else if (viewport === this.getMaximum())
            return this.maxClassification;
        else if (viewport === this.getNarrower())
            return this.narrowerClassification;
        else if (viewport === this.getWider())
            return this.widerClassification;
        else
            return "-";
    }
    /**
     * The number of values in the range. Max - Min.
     */
    length() {//TODO: Test this.
        return this.max - this.min + 1;
    }
    /**     
     * Returns the maximum value from the range.
     */
    getMaximum() {
        return this.max;
    }
    /**
     * Returns the minimum value from the range or undefined.
     */
    getMinimum() {
        return this.min;
    }
    /**
     * Returns the middle value from the range or undefined.
     */
    getMiddle() {
        return Math.floor((this.min + this.max) / 2);
    }
    /**
     * Returns the minimum-1 value from the range or undefined.
     */
    getNarrower() {
        return this.min - 1;
    }
    /**
     * Returns the maximum+1 value from the range or undefined.
     */
    getWider() {
        return this.max + 1;
    }
    /**
     * Get min-1, min, and max+1 points of each range in the set of ranges. 
     * @returns An array of viewports in the min-1, min, and max+1 of each range in the set of ranges.
     */
    getMinNarrowerWiderOfRanges() {
        let points = [];
        let viewport = this.min;
        points.push(viewport - 1);
        points.push(viewport);
        viewport = this.max;
        points.push(viewport + 1);
        return points;
    }
    /**
     * Get min, and max+1 points of the range. 
     * @returns An array of viewports in the min-1, min, and max+1 of each range in the set of ranges.
     */
    getMinWiderViewportsOfRange() {
        let points = [];
        points.push(this.min);
        points.push(this.max + 1);
        return points;
    }
    /**
     * Returns true if the passed in Range object is within the boundaries
     * of 'this' Range object. Meaning that the passed in Range has a 
     * start and end values smaller than the start and end of 'this' Range 
     * object.
     * @param {Range} otherRange The Range object to compare with.
     */
    isContaining(otherRange) {
        return (this.min <= otherRange.min && this.max >= otherRange.max);
    }
    /**
     * Returns true if the passed in Range object overlaps with 
     * 'this' Range object. 
     * @param {number} otherRange The Range object to compare with.
     */
    isOverlappingWith(otherRange) {
        return (this.inRange(otherRange.max) || this.inRange(otherRange.min)
            || otherRange.inRange(this.max) || otherRange.inRange(this.min));
    }
    /**
     * True if passed in value is within this Range.
     * @param {Number} value Any number.
     */
    inRange(value) {
        return (this.min <= value && this.max >= value);
    }
    /**
     * Returns true if the passed in range can be merged with this
     * Range. Two ranges are mergeable if any of its value overlap 
     * or if they immediately border (continue) each other.
     * @param {Number} otherRange The Range object to compare with.
     */
    areMergeable(otherRange) {
        if (this.isOverlappingWith(otherRange))
            return true;
        else
            return ((this.min - 1 === otherRange.max || this.max + 1 === otherRange.min) ||
                (otherRange.min - 1 === this.max || otherRange.max + 1 === this.min));
    }
    /**
     * Get a new Range consisting with start and end values set to overlapping
     * range. Returns undefined if the two ranges do not overlap.
     * @param {Range} otherRange The Range object to compare with.
     * @returns {Range} A new range from start and end value of the overlap 
     * of the two Ranges.
     */
    getOverlappingRange(otherRange) {
        if (this.isOverlappingWith(otherRange)) {
            let overlap = new Range(Math.max(this.min, otherRange.min), Math.min(this.max, otherRange.max));
            return overlap;
        }
        return undefined;
    }
    /**
     * Returns the ranges that do not overlap. If non overlapping
     * ranges are compared, then the two ranges will both be returned
     * in a new Ranges object. In perfect overlap, undefined is returned.
     * @param {Range} otherRange The Range object to compare with.
     * @returns {Ranges} The Ranges object of non-overlapping ranges.
     */
    getNonOverlappingRanges(otherRange) {
        let nonOverlappingRanges = new Ranges();
        if (this.isOverlappingWith(otherRange)) {
            if (this.min !== otherRange.min)
                nonOverlappingRanges.addRange(new Range(Math.min(this.min, otherRange.min), Math.max(this.min - 1, otherRange.min - 1)));
            if (this.max !== otherRange.max)
                nonOverlappingRanges.addRange(new Range(Math.min(this.max + 1, otherRange.max + 1), Math.max(this.max, otherRange.max)));
            return nonOverlappingRanges.list.length > 0 ? nonOverlappingRanges : undefined;
        } else {
            nonOverlappingRanges.addRange(this);
            nonOverlappingRanges.addRange(otherRange);
            return nonOverlappingRanges;
        }
    }
    /**
     * Returns a new range after merging the two ranges. If the two ranges are
     * not mergeable, undefined is returned. 
     * @param {Range} otherRange The Range object to compare with.
     * @returns {Range} The merged range or undefined.
     */
    getMergedRange(otherRange) {
        if (this.areMergeable(otherRange))
            return new Range(Math.min(this.min, otherRange.min), Math.max(this.max, otherRange.max));
        else
            undefined;
    }
    /**
     * Returns true if two Range objects have equal start and end values.
     * @param {Range} otherRange The Range object to compare with.
     */
    equals(otherRange) {
        return (this.min === otherRange.min && this.max === otherRange.max);
    }
    /**
     * Get a new range object with copied values.
     * @returns {Range} A new range object with duplicate start and end values.
     */
    getCopy() {
        return new Range(this.min, this.max);
    }
    /**
     * Return string range in the form 'start-end'.
     */
    toString() {
        return this.min + "-" + this.max;
    }
    /**
     * Return string range in the form 'start-end'.
     */
    toShortString() {
        return this.toString();
    }
    /**
     * Return string range in the form 'start-end'.
     */
    toClassifiedString() {
        return this.toString() + '(' + this.narrowerClassification + ',' + this.minClassification + ',' + this.midClassification + ',' + this.maxClassification + ',' + this.widerClassification + ')';
    }
}

class Ranges {
    /**
     * Construct new Ranges object formed by a set of ranges.
     */
    constructor() {
        this.list = [];
    }
    /**
     * Return an the array of ranges.
     */
    getRangesList() {
        return this.list;
    }
    /**
     * Adds a value to the ranges.
     * @param {Number} value The value to be added to the ranges.
     */
    addValue(value) {
        this.addRange(new Range(value, value));
    }
    /**
     * Adds a range to the set of ranges that are not Mergeable.
     * @param {Range} otherRange The Range object to be added to this Ranges object.
     */
    addRangeWithoutMergeable(otherRange) {
        for (let range of this.list)
            if (range.areMergeable(otherRange))
                console.log('Warning: adding range that is mergeable without merging');
        this.list.push(otherRange);
    }
    /**
     * Adds a range to the set of ranges.
     * @param {Range} range The Range object to be added to this Ranges object.
     */
    addRange(range) {
        let newRanges = [];
        let merged = range;
        for (let i = 0; i < this.list.length; i++) {
            let newMerged = this.list[i].getMergedRange(merged);
            if (newMerged) //if mergeable store the new merged range.
                merged = newMerged;
            else
                newRanges.push(this.list[i]);
        }
        newRanges.push(merged);
        this.list = newRanges;
    }
    /**
     * Adds a range to the set of ranges.
     * @param {Ranges} otherRanges The Ranges object to be added to this Ranges object.
     */
    addRanges(otherRanges) {
        for (let range of otherRanges.list)
            this.addRange(range);
    }
    /**
     * Return a new Ranges object formed by merging the two set of ranges.
     * @param {Ranges} otherRanges The second set of ranges to merge.
     * @returns {Ranges} A new Ranges object of merged Ranges.
     */
    getMergedRanges(otherRanges) {
        let mergedRanges = this.getCopy();
        for (let i = 0; i < otherRanges.list.length; i++) {
            mergedRanges.addRange(otherRanges.list[i].getCopy());
        }
        return mergedRanges;
    }
    /**
     * Get a new set of ranges that has all values in 'this' set of ranges but not in 
     * the passed in set of ranges. 
     * @param {Ranges} notInTheseRanges The set of range that 'this' set of ranges should not conflict with.
     */
    butNotInRanges(notInTheseRanges) {
        let resultRanges = new Ranges();
        if (notInTheseRanges.isEmpty()) {
            return this.getCopy();
        }
        for (let range of this.list) {
            for (let i = range.min; i <= range.max; i++) {
                if (!notInTheseRanges.inRanges(i)) {
                    resultRanges.addValue(i);
                }
            }
        }
        return resultRanges;
    }
    /**     
     * Returns the maximum value from the set of ranges or undefined.
     */
    getMaximum() {
        let max = undefined;
        for (let range of this.list) {
            if (max === undefined)
                max = range.max;
            max = Math.max(max, range.max);
        }
        return max;
    }
    /**
     * Returns the minimum value from the set of ranges or undefined.
     */
    getMinimum() {
        let min = undefined;
        for (let range of this.list) {
            if (min === undefined)
                min = range.min;
            min = Math.min(min, range.min);
        }
        return min;
    }
    /**
     * Get a new set of ranges that has all values in 'this' set of ranges but not in 
     * the passed in range. 
     * @param {Range} notInRange The range that 'this' set of ranges should not conflict with.
     */
    butNotInRange(notInRange) {
        let resultRanges = new Ranges();
        for (let range of this.list) {
            for (let i = range.min; i <= range.max; i++) {
                if (!notInRange.inRange(i)) {
                    resultRanges.addValue(i);
                }
            }
        }
        return resultRanges;
    }
    /**
     * Returns a set of value that do not overlap with 'this' set of ranges. 
     * @param {Range} inputRange The range (not a set) to compare with.
     * @returns {Ranges} The set of non-overlapping ranges or an empty range.
     */
    getNonOverlappingRanges(inputRange) { //assumes the ranges are sorted and merged

        let resultRanges = new Ranges();
        for (let i = inputRange.min; i <= inputRange.max; i++) {
            if (!this.inRanges(i)) {
                resultRanges.addValue(i);
            }
        }
        for (let range of this.list) {
            for (let i = range.min; i <= range.max; i++) {
                if (!inputRange.inRange(i)) {
                    resultRanges.addValue(i);
                }
            }
        }
        return resultRanges;
    }
    /**
     * Returns true if there are ranges/values.
     */
    isEmpty() {
        if (this.list.length === 0)
            return true;
        return false;
    }
    /**
     * Returns true if the value is one of the ranges.
     * @param {number} value The number to check if in set of ranges.
     */
    inRanges(value) {
        for (let range of this.list) {
            if (range.inRange(value)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Returns true if the value is one of the ranges.
     * @param {number} value The number to check if in set of ranges.
     */
    inRange(value) {
        return this.inRanges(value);
    }
    /**
     * Returns a new set of ranges that overlap with passed in range.
     * @param {Range} range The Range object to compare with.
     * @returns {Ranges} New Ranges object of overlapping ranges.
     */
    getOverlappingRanges(range) {
        let overlappingRanges = new Ranges();
        for (let i = 0; i < this.list.length; i++) {
            let overlappingRange = this.list[i].getOverlappingRange(range);
            if (overlappingRange) {
                overlappingRanges.addRange(overlappingRange);
            }
        }
        if (overlappingRanges.list.length > 0)
            return overlappingRanges;
        else
            return undefined;
    }
    /**
     * Returns true if any range within the two sets overlap. 
     * @param {Ranges} otherRanges The set of ranges to compare with.
     */
    isOverlappingWithRanges(otherRanges) {
        for (let i = 0; i < this.list.length; i++) {
            let range = this.list[i];
            for (let z = 0; z < otherRanges.list.length; z++) {
                let otherRange = otherRanges.list[z];
                if (range.isOverlappingWith(otherRange))
                    return true;
            }
        }
        return false;
    }
    /**
     * Sorts the set of ranges in order.
     */
    sortRanges() {
        this.list.sort(function (a, b) {
            return a.min - b.min;
        });
        return this;
    }
    /**
     * Sorts the set of ranges in order.
     */
    sortRangesDecreasing() {
        this.list.sort(function (a, b) {
            return b.max - a.max;
        });
        return this;
    }
    /**
     * Returns true if the two set of ranges (two Ranges objects) are 
     * equal.
     * @param {Ranges} otherRanges The Ranges object to compare with.
     */
    equals(otherRanges) {
        if (this.list.length !== otherRanges.list.length) {
            return false;
        }
        for (let i = 0; i < this.list.length; i++) {
            let matched = false;
            for (let x = 0; x < otherRanges.list.length; x++) {
                if (this.list[i].equals(otherRanges.list[x])) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                return false;
            }
        }
        return true;
    }
    /**
     * Creates and returns a new Ranges object with a copy of this set of ranges.
     */
    getCopy() {
        let copy = new Ranges();
        for (let i = 0; i < this.list.length; i++) {
            copy.list.push(this.list[i].getCopy());
        }
        return copy;
    }
    /**
     * Returns the largest range in this set of ranges or undefined.
     */
    getLargestRange() {
        let result = undefined;
        for (let range of this.list) {
            if (result === undefined) {
                result = range;
            } else {
                if (result.getMaximum() < range.getMaximum()) {
                    result = range;
                }
            }
        }
        return result;
    }

    /**
     * Get all min, max+1 points of each range in the set of ranges. 
     * @returns An array of viewports [[min,max+1]] of each range in the set of ranges.
     */
    getPairedMinWiderViewportsOfRanges() {
        let points = [];
        for (let range of this.list)
            points.push(range.getMinWiderViewportsOfRange());
        return points;
    }
    /**
     * Get all min points of each range in the set of ranges. 
     * @returns An array of viewports in the min of each range in the set of ranges.
     */
    getMinOfRanges() {
        let points = [];
        for (let range of this.list) {
            let viewport = range.getMinimum();
            if (!points.includes(viewport))
                points.push(viewport);
        }
        return points;
    }
    /**
     * Get all three points of each range in the set of ranges. Returns an array of the minimum,
     * middle and maximum values of each range in the set of ranges.
     * @returns An array of viewports in the min, mid, max of each range in the set of ranges.
     */
    getMinMidMaxOfRanges() {
        let points = [];
        for (let range of this.list) {
            let viewport = range.getMinimum();
            if (!points.includes(viewport - 1))
                points.push(viewport - 1);
            if (!points.includes(viewport))
                points.push(viewport);
            viewport = range.getMiddle();
            if (!points.includes(viewport))
                points.push(viewport);
            viewport = range.getMaximum();
            if (!points.includes(viewport))
                points.push(viewport);
            if (!points.includes(viewport + 1))
                points.push(viewport + 1);
        }
        return points;
    }
    /**
     * Get min and max+1 points of each range in the set of ranges. 
     * @returns An array of viewports in the min and max+1 of each range in the set of ranges.
     */
    getMinWiderOfRanges() {
        let points = [];
        for (let range of this.list) {
            let viewport = range.getMinimum();
            if (!points.includes(viewport))
                points.push(viewport);
            viewport = range.getMaximum();
            if (!points.includes(viewport + 1))
                points.push(viewport + 1);
        }
        return points;
    }
    /**
     * Get min-1, min and max+1 points of each range in the set of ranges. 
     * @returns An array of viewports in the min-1, min and max+1 of each range in the set of ranges.
     */
    getMinNarrowerWiderOfRanges() {
        let points = [];
        for (let range of this.list) {
            let viewport = range.getMinimum();
            if (!points.includes(viewport - 1))
                points.push(viewport - 1);
            if (!points.includes(viewport))
                points.push(viewport);
            viewport = range.getMaximum();
            if (!points.includes(viewport + 1))
                points.push(viewport + 1);
        }
        return points;
    }
    /**
     * String showing set of ranges and their classifications.
     */
    toClassifiedString() {
        let ranges = "";
        for (let i = this.list.length - 1; i >= 0; i--) {
            ranges += this.list[i].toClassifiedString();
            if (i !== 0)
                ranges += " ";
        }
        return ranges === "" ? "Never" : ranges;
    }
    /**
     * returns a string of the set of ranges 'start-end start-end...'.
     * The word 'Never' is returned for an empty set of ranges.
     */
    toString() {
        let ranges = "";
        for (let i = this.list.length - 1; i >= 0; i--) {
            ranges += this.list[i].toString();
            if (i !== 0)
                ranges += " ";
        }
        return ranges === "" ? "Never" : ranges;
    }
    /**
     * returns a shorter string of the set of ranges 'start-end start-end...'.
     * The first and last range.
     * The word 'Never' is returned for an empty set of ranges.
     */
    toShortString() {
        let ranges = "";
        let maxRanges = 2;
        if (this.list.length > 0) {
            ranges += this.list[0].toString();
            let i = 1;
            for (; i < this.list.length && i < maxRanges; i++) {
                ranges += "_";
                ranges += this.list[i].toString();
            }
            if (this.list.length > maxRanges) {
                if (this.list.length === maxRanges + 1)
                    ranges += "_"
                else
                    ranges += "___";
                ranges += this.list[this.list.length - 1].toString();
            }
        }
        return ranges === "" ? "Never" : ranges;
    }
}
module.exports = { Range, Ranges };
