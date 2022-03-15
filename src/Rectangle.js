const assist = require("./assist");
const settings = require("../settings.js");
const tolerance = settings.tolerance;

/**
 * Data structure to capture a DOM node.
 */
class Rectangle {
    /**
     * Constructor to create rectangle.
     * @param {object} rectangle object with left, top, right, bottom properties.
     */
    constructor(rectangle) {
        if (rectangle === null || rectangle === undefined) {
            this.visible = false;
            this.validSize = false;
            this.positiveCoordinates = false;
        } else {
            if (settings.tolerance.ignoreFractions) {
                let temp =
                {
                    x: Math.floor(rectangle.x),
                    y: Math.floor(rectangle.y),

                    //preserve fraction to get x2 (maxX) and y2 (maxY)
                    width: Math.floor(rectangle.x + rectangle.width) - Math.floor(rectangle.x),
                    height: Math.floor(rectangle.y + rectangle.height) - Math.floor(rectangle.y),
                    xpath: rectangle.xpath
                }
                rectangle = temp;
            }
            this.x = rectangle.x;
            this.y = rectangle.y;
            this.width = rectangle.width;
            this.height = rectangle.height;

            this.left = this.x;
            this.top = this.y;
            this.right = this.x + this.width;
            this.bottom = this.y + this.height;

            //Aliases using RBush property names. 
            //Removes fraction by tightening the container.
            // this.minX = Math.ceil(this.left);
            // this.maxX = Math.floor(this.right);
            // this.minY = Math.ceil(this.top);
            // this.maxY = Math.floor(this.bottom);
            this.minX = this.left;
            this.maxX = this.right;
            this.minY = this.top;
            this.maxY = this.bottom;

            //copy xpath if it exists.
            this.xpath = rectangle.xpath;

            this.validSize = this.hasValidSize();
            this.positiveCoordinates = this.hasPositiveCoordinates();
        }

    }
    /**
     * Checks to see if coordinates are undefined or null. Does not look at width or height properties.
     */
    isMissingValues(){
        return (this.minX === undefined || this.minY === undefined || this.maxX === undefined || this.maxY === undefined ||
            this.minX === null || this.minY === null || this.maxX === null || this.maxY === null)
    }
    /**
     * Does this node have a positive coordinates and hence could be scrollable.
     */
    hasPositiveCoordinates() {
        return (this.maxX >= 0 && this.maxY >= 0);
    }
    /**
     * Does this node have a width and height of greater than zero.
     */
    hasValidSize() {
        return ((this.width > 0) && (this.height > 0));
    }
    toString(printXPath = true) {
        let data = '';
        if (printXPath && this.xpath !== undefined)
            data = this.xpath + "\n";
        data += "minX:" + this.minX + " maxX:" + this.maxX + " minY:" + this.minY + " maxY:" + this.maxY + " width:" + this.width + " height:" + this.height;
        return data;
    }
    toConsole(printXPath = true) {
        if (printXPath)
            console.log(this.xpath)
        console.log("minX:" + this.minX + " maxX:" + this.maxX + " minY:" + this.minY + " maxY:" + this.maxY + " width:" + this.width + " height:" + this.height);
    }
    /**
     * Returns true if the other rectangle is above me.
     * @param {Rectangle} other The other rectangle to compare.
     * @param {Number} tol The tolerance.
     */
    isAboveMe(other, tol = tolerance.smallrange) {
        if (other.maxY - tol <= this.minY) //is other above me
            return true;
        return false;
    }
    /**
     * Returns true if the other rectangle is below me.
     * @param {Rectangle} other The other rectangle to compare.
     * @param {Number} tol The tolerance.
     */
    isBelowMe(other, tol = tolerance.smallrange) {
        if (other.minY + tol >= this.maxY) //is other below me
            return true;
        return false;
    }
    /**
     * Returns true if the other rectangle is to my right.
     * @param {Rectangle} other The other rectangle to compare.
     * @param {Number} tol The tolerance.
     */
    isToMyRight(other, tol = tolerance.smallrange) {
        if (other.minX + tol >= this.maxX) //is other to the right of me
            return true;
        return false;
    }
    /**
     * Returns true if other rectangle is to the left of me.
     * @param {Rectangle} other The other rectangle to compare.
     * @param {Number} tol The tolerance.
     */
    isToMyLeft(other, tol = tolerance.smallrange) {
        if (other.maxX - tol <= this.minX) //is other to the left of me
            return true;
        return false;
    }
    /**
     * Returns true if overlapping.
     * @param {Rectangle} other The other rectangle to compare.
     * @param {Number} tol The tolerance.
     */
    isOverlapping(other, tol = tolerance.collision) {
        //check if one is on right of the other
        if (this.isToMyRight(other, tol) || other.isToMyRight(this, tol))
            return false;
        //check if one is bellow the other
        if (this.isBelowMe(other, tol) || other.isBelowMe(this, tol))
            return false;
        //they are overlapping
        return true;
    }
}
module.exports = Rectangle;