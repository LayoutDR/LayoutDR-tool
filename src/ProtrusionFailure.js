const Failure = require('./Failure.js');
const assist = require('./assist.js');
const Rectangle = require('./Rectangle.js');
const path = require('path');
const settings = require('../settings.js');
const { tolerance } = require('../settings.js');
const FailureType = assist.FailureType;
class ProtrusionFailure extends Failure {
    /**
     * Create an element protrusion failure.
     * @param {RLGNode} node The child that is protruding.
     * @param {RLGNode} parent The parent/ancestor that is protruded.
     * @param {Range} range The range of this failures.
     * @param {RLGNode} newParent The new parent.
     */
    constructor(node, parent, range, newParent, outputDirectory, webpage, run) {
        super(webpage, run);
        this.node = node;
        this.parent = parent;
        this.newParent = newParent;
        this.range = range;
        this.type = FailureType.PROTRUSION;
        this.outputDirectory = outputDirectory;
        if (settings.humanStudy === true)
            this.setupHumanStudyData();
    }
    /**
     * checks if failure xpaths and type are equal.
     * @param {Failure} otherFailure The other failure to compare.
     */
    equals(otherFailure) {
        if (this.type !== otherFailure.type)
            return false;
        return this.node.xpath === otherFailure.node.xpath && this.parent.xpath === otherFailure.parent.xpath;
    }
    /**
     * Check to see if the passed in failure resembles this failure.
     * @param {Failure} otherFailure the other failure to compare to this failure.
     */
    isEquivalent(otherFailure) {
        if (otherFailure.type === FailureType.VIEWPORT) {
            return false;
        } else if (otherFailure.type === FailureType.PROTRUSION) {
            if (this.node.xpath === otherFailure.node.xpath)
                return true;
            let rlgDescendants = otherFailure.node.getDescendantRLGNodesAtViewport(otherFailure.range.getWider());
            for (let descendant of rlgDescendants)
                if (descendant.xpath === this.node.xpath)//Protruding node in mini-RLG is a descendant of the full-RLG(wider) protruding element.
                    return true;

            // let rlgAncestors = otherFailure.node.getAncestorsRLGNodesAtViewport(otherFailure.range.getWider());
            // for (let ancestor of rlgAncestors)
            //     if (ancestor.xpath === this.node.xpath)//Protruding node in mini-RLG is a descendant of the full-RLG(wider) protruding element.
            //         return true;

            // if (this.parent.xpath === otherFailure.node.xpath)//Protruding node in mini-RLG is an immediate child of the full-RLG(wider) protruding element.
            //     return true;
            // if (this.node.xpath.includes(otherFailure.node.xpath + "/")) //Protruding node is html descendent of original
            //     return true
        } else if (otherFailure.type === FailureType.COLLISION) {
            return (this.node.xpath === otherFailure.node.xpath || this.node.xpath === otherFailure.sibling.xpath)
        } else {
            return undefined;
        }
    }
    /**
     * Get xpaths of this failure e.g. for finding and highlighting in screenshots.
     */
    getXPaths() {
        let xpaths = [];
        xpaths.push(this.node.xpath);
        xpaths.push(this.parent.xpath);
        // if (this.newParent.xpath !== undefined && this.parent.xpath !== this.newParent.xpath)
        //     xpaths.push(this.newParent.xpath);
        return xpaths;
    }
    /**
     * Get Selectors of this failure e.g. for finding and highlighting in screenshots.
     */
    getSelectors() {
        let selectors = [];
        selectors.push(this.node.getSelector());
        selectors.push(this.parent.getSelector());
        return selectors;
    }
    print(file) {
        let text = '|  |--[ ' + this.type + ' (' + this.ID + '): ' + this.range.toString() + ' ]';
        assist.printToFile(file, text);
        text = '|  |  |--[ Parent: ' + this.parent.xpath + ' ]';
        assist.printToFile(file, text);
    }
    printClassified(file) {
        let text = '|  |--[ ' + this.type + ' (' + this.ID + '): ' + this.range.toClassifiedString() + ' ]';
        assist.printToFile(file, text);
        text = '|  |  |--[ Parent: ' + this.parent.xpath + ' ]';
        assist.printToFile(file, text);
    }
    /**
     * Return true if the child is protruding the parent.
     * @param {Driver} driver The browser driver.
     * @param {Number} viewport The viewport.
     * @param {Path} file The output file.
     * @param {Range} range The range of the failure where viewport is derived from.
     */
    async isFailing(driver, viewport, file, range) {
        let child = await driver.getElementBySelector(this.node.getSelector());
        let parent = await driver.getElementBySelector(this.parent.getSelector());
        let childRect = new Rectangle(await driver.getRectangle(child));
        let parentRect = new Rectangle(await driver.getRectangle(parent));
        if (parentRect.visible === false || parentRect.validSize === false || parentRect.positiveCoordinates == false)
            return false;
        if (childRect.visible === false || childRect.validSize === false || childRect.positiveCoordinates == false)
            return false;
        let newParentRect = undefined;
        let protruding = this.calculateProtrusion(parentRect, childRect);
        let tol = 0;
        if (tolerance.protrusion !== undefined && tolerance.protrusion > 0)
            tol = tolerance.protrusion;
        let result = (protruding.top > tol || protruding.bottom > tol || protruding.right > tol || protruding.left > tol);
        if (file !== undefined) {
            try {
                if (this.newParent.xpath !== undefined && this.node.xpath !== this.newParent.xpath) {
                    let newParent = await driver.getElementBySelector(this.newParent.getSelector());
                    newParentRect = new Rectangle(await driver.getRectangle(newParent));
                }
            }
            catch (e) {
                //no need to report missing new parent.
            }
            let classification = result ? 'TP' : 'FP';
            let text = 'ID: ' + this.ID + ' Type: ' + this.type + ' Range:' + range + ' Viewport:' + viewport + ' Classification: ' + classification;
            assist.printToFile(file, text);
            text = '|  |--[ Left-P: ' + protruding.left + ' Right-P: ' + protruding.right + ' Top-P: ' + protruding.top + ' Bottom-P: ' + protruding.bottom + ' ]';
            assist.printToFile(file, text);
            text = '|--[ Parent: ' + this.parent.xpath + ' ]';
            assist.printToFile(file, text);
            text = '|  |--[ minX: ' + parentRect.minX + ' maxX: ' + parentRect.maxX + ' minY: ' + parentRect.minY + ' maxY: ' + parentRect.maxY + ' width: ' + parentRect.width + ' height: ' + parentRect.height + ' ]';
            assist.printToFile(file, text);
            text = '|--[ Child: ' + this.node.xpath + ' ]';
            assist.printToFile(file, text);
            text = '|  |--[ minX: ' + childRect.minX + ' maxX: ' + childRect.maxX + ' minY: ' + childRect.minY + ' maxY: ' + childRect.maxY + ' width: ' + childRect.width + ' height: ' + childRect.height + ' ]';
            assist.printToFile(file, text);

            if (newParentRect !== undefined) {
                text = '|--[ New Parent: ' + this.newParent.xpath + ' ]';
                assist.printToFile(file, text);
                text = '|  |--[ minX: ' + newParentRect.minX + ' maxX: ' + newParentRect.maxX + ' minY: ' + newParentRect.minY + ' maxY: ' + newParentRect.maxY + ' width: ' + newParentRect.width + ' height: ' + newParentRect.height + ' ]';
                assist.printToFile(file, text);
            }
        }
        return result;
    }
    /**
     * expand parent width to accommodate protrusion or collision.
     * @param {Driver} driver The browser driver.
     */
    async expandParentCSS(driver) {
        let viewport = this.range.getMinimum();
        if (driver.currentViewport !== viewport)
            await driver.setViewport(viewport, settings.testingHeight);
        let child = await driver.getElementBySelector(this.node.getSelector());
        let parent = await driver.getElementBySelector(this.parent.getSelector());
        let childRect = new Rectangle(await driver.getRectangle(child));
        let parentRect = new Rectangle(await driver.getRectangle(parent));
        let protruding = this.calculateProtrusion(parentRect, childRect);
        if ((protruding.top + protruding.bottom + protruding.right + protruding.left) > 0) {
            if (this.repairCSS === undefined)
                this.repairCSS = '';
            this.repairCSS +=
                "   " + this.parent.getSelector() + "{\n";
            if ((protruding.right + protruding.left) > 0)
                this.repairCSS +=
                    "      " + "min-width: " + Math.min(((parentRect.width) + Math.ceil(protruding.right + protruding.left)), this.range.getMinimum()) + "px !important;\n";
            if ((protruding.top + protruding.bottom) > 0)
                this.repairCSS +=
                    "      " + "min-height: " + ((parentRect.height) + Math.ceil(protruding.top + protruding.bottom)) + "px !important;\n";
            this.repairCSS += "   " + "}\n";
        }
    }
    //TODO: test this function.
    /**
     * Pixel patch the protrusion.
     * @param {Driver} driver The browser driver.
     * @param {number} viewport The viewport to use.
     */
    async basicPatch(driver, viewport) {
        await driver.setViewport(viewport, settings.testingHeight);
        //console.log(this.type + ' ID:' + this.ID + ' Viewport: ' + viewport + ' Range: ' + this.range.toString());
        let child = await driver.getElementBySelector(this.node.getSelector());
        let parent = await driver.getElementByXpath(this.parent.xpath);
        let childRect = new Rectangle(await driver.getRectangle(child));
        let parentRect = new Rectangle(await driver.getRectangle(parent));
        let protruding = this.calculateProtrusion(parentRect, childRect);
        if ((protruding.top + protruding.bottom + protruding.right + protruding.left) > 0) {
            //console.log(protruding);
            //await assist.pause(" Pause before patch..");
            if ((protruding.right + protruding.left) > 0)
                await driver.setMinWidth(parent, ((parentRect.width) + protruding.right + protruding.left) + "px")
            if ((protruding.top + protruding.bottom) > 0)
                await driver.setMinHeight(parent, ((parentRect.height) + protruding.top + protruding.bottom) + "px")
            await assist.resolveAfterSeconds(settings.repairDelay);
            childRect = new Rectangle(await driver.getRectangle(child));
            parentRect = new Rectangle(await driver.getRectangle(parent));
            protruding = this.calculateProtrusion(parentRect, childRect);
            if ((protruding.top + protruding.bottom + protruding.right + protruding.left) > 0) {
                console.log(this.type + ' ID:' + this.ID + ' Viewport: ' + viewport + ' Range: ' + this.range.toString() + ' NOT FULLY REPAIRED');
            }
            //console.log(protruding);
            //await assist.pause("Pause after patch..");
        } else {
            //await assist.pause("False positive pause..");
        }
    }
}
module.exports = ProtrusionFailure;