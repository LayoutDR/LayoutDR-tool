const Failure = require('./Failure.js');
const assist = require('./assist.js');
const Rectangle = require('./Rectangle.js');
const path = require('path');
const settings = require('../settings.js');
const FailureType = assist.FailureType;
const tolerance = settings.tolerance;

class WrappingFailure extends Failure {
    /**
     * Create a viewport protrusion failure.
     * @param {RLGNode} node The node protruding the body element.
     * @param {[RLGNode]} row The row of elements.
     * @param {Range} range The set of ranges where the failure is observed.
     */
    constructor(node, row, range, outputDirectory, webpage, run) {
        super(webpage, run);
        this.node = node;
        this.row = row;
        this.range = range;
        this.type = FailureType.WRAPPING;
        this.outputDirectory = outputDirectory;
        if (settings.humanStudy === true)
            this.setupHumanStudyData();
    }
    /**
     * Get xpaths of this failure e.g. for finding and highlighting in screenshots.
     */
    getXPaths() {
        let xpaths = [];
        xpaths.push(this.node.xpath);
        for (let rowElement of this.row)
            xpaths.push(rowElement.xpath);
        return xpaths;
    }
    /**
     * Get selectors of this failure e.g. for finding and highlighting in screenshots.
     */
    getSelectors() {
        let selectors = [];
        selectors.push(this.node.getSelector());
        for (let rowElement of this.row)
            selectors.push(rowElement.getSelector());
        return selectors;
    }
    print(file) {
        let text = '|  |--[ ' + this.type + ' (' + this.ID + '): ' + this.range.toString() + ' ]';
        assist.printToFile(file, text);
        for (let i = 0; i < this.row.length; i++) {
            text = '|  |  |--[ Row Element: ' + this.row[i].xpath + ' ]';
            assist.printToFile(file, text);
        }
    }
    printClassified(file) {
        let text = '|  |--[ ' + this.type + ' (' + this.ID + '): ' + this.range.toClassifiedString() + ' ]';
        assist.printToFile(file, text);
        for (let i = 0; i < this.row.length; i++) {
            text = '|  |  |--[ Row Element: ' + this.row[i].xpath + ' ]';
            assist.printToFile(file, text);
        }
    }
    /**
     * Return true if the wrapped element is not below all row elements.
     * @param {Driver} driver The browser driver.
     * @param {Number} viewport The viewport.
     * @param {Path} file The output file.
     */
    async isFailing(driver, viewport, file) {
        if (this.row.length < settings.rowThreshold)
            return true;
        let rowXPaths = [];
        for (let rowElement of this.row)
            rowXPaths.push(rowElement.xpath);
        let rowSelectors = [];
        for (let rowElement of this.row)
            rowSelectors.push(rowElement.getSelector());

        let wrappedElement = await driver.getElementBySelector(this.node.getSelector());
        let rowElements = [];
        for (let rowSelector of rowSelectors)
            rowElements.push(await driver.getElementBySelector(rowSelector));
        let wrappedRect = new Rectangle(await driver.getRectangle(wrappedElement));
        let rowRectangles = [];
        for (let rowElement of rowElements)
            rowRectangles.push(new Rectangle(await driver.getRectangle(rowElement)));
        let result = undefined;
        if (wrappedRect.visible === false || wrappedRect.validSize === false || wrappedRect.positiveCoordinates == false)
            result = false;
        let ok = [];
        for (let rowRect of rowRectangles) {
            if (rowRect.visible === false || rowRect.validSize === false || rowRect.positiveCoordinates == false)
                ok.push('no');
            else {
                ok.push('yes');
                break;
            }
        }
        if (!ok.includes('yes'))
            result = false;
        if (result === undefined)
            result = this.isBelowOrAboveRow(wrappedRect, rowRectangles);


        if (file !== undefined) {
            let classification = result ? 'TP' : 'FP';
            let text = 'ID: ' + this.ID + ' Type: ' + this.type + ' Range:' + this.range.toString() + ' Viewport:' + viewport + ' Classification: ' + classification;
            assist.printToFile(file, text);
            text = '|--[ Wrapped-Element: ' + this.node.xpath + ' ]';
            assist.printToFile(file, text);
            if (wrappedRect.visible === false || wrappedRect.validSize === false || wrappedRect.positiveCoordinates == false) {
                text = '|  |--[ Visible: ' + (wrappedRect.visible ? 'True' : 'False') + ' Valid-Size: ' + (wrappedRect.validSize ? 'True' : 'False') + ' Positive-Coordinates: ' + (wrappedRect.positiveCoordinates ? 'True' : 'False') + ' ]';
                assist.printToFile(file, text);
            }
            text = '|  |--[ minX: ' + wrappedRect.minX + ' maxX: ' + wrappedRect.maxX + ' minY: ' + wrappedRect.minY + ' maxY: ' + wrappedRect.maxY + ' width: ' + wrappedRect.width + ' height: ' + wrappedRect.height + ' ]';
            assist.printToFile(file, text);
            for (let i = 0; i < rowElements.length; i++) {
                let xpath = rowXPaths[i];
                let rowRect = rowRectangles[i];
                text = '|--[ Row Element: ' + xpath + ' ]';
                assist.printToFile(file, text);
                if (rowRect.visible === false || rowRect.validSize === false || rowRect.positiveCoordinates == false) {
                    text = '|  |--[ Visible: ' + (rowRect.visible ? 'True' : 'False') + ' Valid-Size: ' + (rowRect.validSize ? 'True' : 'False') + ' Positive-Coordinates: ' + (rowRect.positiveCoordinates ? 'True' : 'False') + ' ]';
                    assist.printToFile(file, text);
                }
                text = '|  |--[ minX: ' + rowRect.minX + ' maxX: ' + rowRect.maxX + ' minY: ' + rowRect.minY + ' maxY: ' + rowRect.maxY + ' width: ' + rowRect.width + ' height: ' + rowRect.height + ' ]';
                assist.printToFile(file, text);
            }

        }
        return result;
    }
    isBelowOrAboveRow(wrappedRectangle, rowRectangles) {
        for (let rowRectangle of rowRectangles) {
            if (wrappedRectangle.minY + tolerance.smallrange >= rowRectangle.maxY) //wrapped is below row rectangle
                return true;
            if (wrappedRectangle.maxY - tolerance.smallrange <= rowRectangle.minY) //wrapped is above row rectangle
                return true;
        }
        return false;
    }
    /**
     * checks if failure xpaths and type are equal.
     * @param {Failure} otherFailure The other failure to compare.
     */
    equals(otherFailure) {
        if (this.type !== otherFailure.type)
            return false;
        if (this.node.xpath === otherFailure.node.xpath)
            if (this.row.length === otherFailure.row.length) {
                let otherXPaths = otherFailure.getXPaths();
                for (let rowElement of this.row) {
                    if (!otherXPaths.includes(rowElement.xpath))
                        return false;
                }
                return true;
            }
        return false;
    }
    /**
     * Check to see if the passed in failure resembles this failure.
     * @param {Failure} otherFailure the other failure to compare to this failure.
     */
    isEquivalent(otherFailure) {
        if (otherFailure.type === FailureType.WRAPPING) {
            if ((this.node.xpath === otherFailure.node.xpath))
                return true
            let rlgDescendants = otherFailure.node.getDescendantRLGNodesAtViewport(otherFailure.range.getWider());
            for (let descendant of rlgDescendants)
                if (descendant.xpath === this.node.xpath)//Protruding node in mini-RLG is a descendant of the full-RLG(wider) protruding element.
                    return true;
        } else if (otherFailure.type === FailureType.COLLISION) {
            return (this.node.xpath === otherFailure.node.xpath || this.node.xpath === otherFailure.sibling.xpath)
        } else {
            return false;
        }
    }
}
module.exports = WrappingFailure;