const Failure = require('./Failure.js');
const assist = require('./assist.js');
const Rectangle = require('./Rectangle.js');
const RBush = require('rbush');
const path = require('path');
const settings = require('../settings.js');
const tolerance = settings.tolerance;
const FailureType = assist.FailureType;
class CollisionFailure extends Failure {
    /**
     * Create an element collision failure.
     * @param {RLGNode} node The node in collision.
     * @param {RLGNode} sibling The sibling node in collision.
     * @param {RLGNode} parent The parent node in collision.
     * @param {Range} range The ranges of the collision.
     */
    constructor(node, sibling, parent, range, outputDirectory, webpage, run) {
        super(webpage, run);
        this.node = node;
        this.sibling = sibling;
        this.parent = parent;
        this.range = range;
        this.type = FailureType.COLLISION;
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
        xpaths.push(this.sibling.xpath);
        return xpaths;
    }
    /**
     * Get CSS Selectors of this failure e.g. for finding and highlighting in screenshots.
     */
    getSelectors() {
        let selectors = [];
        selectors.push(this.node.getSelector());
        selectors.push(this.sibling.getSelector());
        return selectors;
    }
    /**
     * Return true if there is an overlap between two nodes.
     * @param {Driver} driver The browser driver.
     * @param {Number} viewport The viewport.
     * @param {Path} file The output file.
     * @param {Range} range The range of the failure where viewport is derived from.
     */
    async isFailing(driver, viewport = undefined, file = undefined, range = undefined) {
        let node = await driver.getElementBySelector(this.node.getSelector());
        let sibling = await driver.getElementBySelector(this.sibling.getSelector());


        let nodeRect = new Rectangle(await driver.getRectangle(node));
        let siblingRect = new Rectangle(await driver.getRectangle(sibling));
        if (nodeRect.visible === false || nodeRect.validSize === false || nodeRect.positiveCoordinates == false)
            return false;
        if (siblingRect.visible === false || siblingRect.validSize === false || siblingRect.positiveCoordinates == false)
            return false;

        let collisionRBush = new RBush();

        nodeRect.minX += tolerance.collision;
        nodeRect.maxX -= tolerance.collision;
        nodeRect.minY += tolerance.collision;
        nodeRect.maxY -= tolerance.collision;


        collisionRBush.insert(siblingRect);
        let overlappingRectangles = collisionRBush.search(nodeRect);
        let result = overlappingRectangles.length > 0;


        let collision = this.calculateOverlap(siblingRect, nodeRect);
        //let result = (collision.xToClear > tolerance.collision && collision.yToClear > tolerance.collision);
        if (file !== undefined) {
            let classification = result ? 'TP' : 'FP';
            let text = 'ID: ' + this.ID + ' Type: ' + this.type + ' Range:' + range + ' Viewport:' + viewport + ' Classification: ' + classification;
            assist.printToFile(file, text);
            text = '|  |--[ Overlap-X: ' + collision.xToClear + ' Overlap-Y: ' + collision.yToClear + ' ]';
            assist.printToFile(file, text);
            text = '|--[ Node: ' + this.node.xpath + ' ]';
            assist.printToFile(file, text);
            text = '|  |--[ minX: ' + nodeRect.minX + ' maxX: ' + nodeRect.maxX + ' minY: ' + nodeRect.minY + ' maxY: ' + nodeRect.maxY + ' ]';
            assist.printToFile(file, text);
            text = '|--[ Sibling: ' + this.sibling.xpath + ' ]';
            assist.printToFile(file, text);
            text = '|  |--[ minX: ' + siblingRect.minX + ' maxX: ' + siblingRect.maxX + ' minY: ' + siblingRect.minY + ' maxY: ' + siblingRect.maxY + ' ]';
            assist.printToFile(file, text);
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
        let nodeElement = await driver.getElementBySelector(this.node.getSelector());
        let nodeRect = new Rectangle(await driver.getRectangle(nodeElement));

        let siblingElement = await driver.getElementBySelector(this.sibling.getSelector());
        let siblingRect = new Rectangle(await driver.getRectangle(siblingElement));

        let parent = await driver.getElementBySelector(this.parent.getSelector());
        let parentRect = new Rectangle(await driver.getRectangle(parent));

        let collision = this.calculateOverlap(siblingRect, nodeRect);
        if ((collision.xToClear > tolerance.collision && collision.yToClear > tolerance.collision)) {
            if (this.repairCSS === undefined)
                this.repairCSS = '';
            this.repairCSS +=
                "   " + this.parent.getSelector() + "{\n";
            if (collision.xToClear > tolerance.collision)
                this.repairCSS +=
                    "      " + "min-width: " + Math.min((parentRect.width + collision.xToClear), this.range.getMinimum()) + "px !important;\n";
            if (collision.yToClear > tolerance.collision)
                this.repairCSS +=
                    "      " + "min-height: " + (parentRect.height + collision.yToClear) + "px !important;\n";
            this.repairCSS += "   " + "}\n";
        }
    }
    //TODO: test this function.
    /**
     * Pixel patch the collision.
     * @param {Driver} driver The browser driver.
     * @param {number} viewport The viewport to use.
     */
    async pushApart(driver, viewport) {
        if (viewport === undefined)
            viewport = this.range.getMinimum();
        if (driver.currentViewport !== viewport)
            await driver.setViewport(viewport, settings.testingHeight);
        let node = await driver.getElementBySelector(this.node.getSelector());
        let sibling = await driver.getElementBySelector(this.sibling.getSelector());
        let nodeRect = new Rectangle(await driver.getRectangle(node));
        let siblingRect = new Rectangle(await driver.getRectangle(sibling));
        let collision = this.calculateOverlap(siblingRect, nodeRect);
        if ((collision.xToClear > tolerance.collision && collision.yToClear > tolerance.collision)) {
            let nodeToBeCleared = undefined;
            let rlgNodeToClear = undefined;
            if (collision.nodeRectToBeCleared === this.node.xpath) {
                nodeToBeCleared = node;
                rlgNodeToClear = this.node;
            } else {
                nodeToBeCleared = sibling;
                rlgNodeToClear = this.sibling;
            }
            if (collision.xToClear <= collision.yToClear) {
                //push on x
                let originalMarginLeft = await driver.getMarginLeft(nodeToBeCleared);
                let marginLeft = 0;
                if (originalMarginLeft.includes('px')) {
                    marginLeft = Number(originalMarginLeft.replace('px', '').trim());
                }
                marginLeft = (marginLeft + Math.ceil(collision.xToClear));
                //marginLeft = (marginLeft + collision.xToClear) + 'px';
                //console.log('Original-Margin-Left: '+ originalMarginLeft + ' + Injecting: ' + marginLeft);
                //await driver.setMarginLeft(nodeToBeCleared, marginLeft);
                this.pushUsingMarginLeftCSS(rlgNodeToClear, marginLeft);
            } else {
                //push on y
                let originalMarginTop = await driver.getMarginTop(nodeToBeCleared);
                let marginTop = 0;
                if (originalMarginTop.includes('px')) {
                    marginTop = Number(originalMarginTop.replace('px', '').trim());
                }
                //marginTop = (marginTop + collision.yToClear) + 'px';
                marginTop = (marginTop + Math.ceil(collision.yToClear));
                //console.log('Original-Margin-Top: '+ originalMarginTop + ' + Injecting: ' + marginTop);
                //await driver.setMarginTop(nodeToBeCleared, marginTop);
                this.pushUsingMarginTopCSS(rlgNodeToClear, marginTop);
            }
            // await assist.resolveAfterSeconds(assist.settings.repairDelay);
            // nodeRect = new Rectangle(await driver.getRectangle(node[0]));
            // siblingRect = new Rectangle(await driver.getRectangle(sibling[0]));
            // collision = this.calculateOverlap(nodeRect, siblingRect);
            // if (collision.xToClear > tolerance.collision && collision.yToClear > tolerance.collision) {
            //     console.log(this.type + ' ID:' + this.ID + ' Viewport: ' + viewport + ' Range: ' + this.range.toString() + ' NOT FULLY REPAIRED');
            // }
            //console.log(collision);
            //await assist.pause("Pause after patch..");
        } else {
            //await assist.pause("False positive pause..");
        }
    }
    /**
     * CSS to set the margin-left of node.
     * @param {RLGNode} node The rlgNode to set the margin for.
     * @param {number} margin The number of pixels to set margin to.
     */
    pushUsingMarginLeftCSS(node, margin) {
        if (this.repairCSS == undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + node.getSelector() + "{\n" +
            "      " + "margin-left: " + margin + "px !important;\n" +
            "   }\n";
    }

    /**
     * CSS to set the margin-left of node.
     * @param {RLGNode} node The rlgNode to set the margin for.
     * @param {number} margin The number of pixels to set margin to.
     */
    pushUsingMarginTopCSS(node, margin) {
        if (this.repairCSS == undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + node.getSelector() + "{\n" +
            "      " + "margin-top: " + margin + "px !important;\n" +
            "   }\n";
    }
    /**
     * checks if failure xpaths and type are equal.
     * @param {Failure} otherFailure The other failure to compare.
     */
    equals(otherFailure) {
        if(this.type !== otherFailure.type)
            return false;
        let equalNodes = (this.node.xpath === otherFailure.node.xpath && this.sibling.xpath === otherFailure.sibling.xpath) ||
            (this.sibling.xpath === otherFailure.node.xpath && this.node.xpath === otherFailure.sibling.xpath)
        return equalNodes;
    }
    /**
     * Check to see if the passed in failure resembles this failure.
     * @param {Failure} otherFailure the other failure to compare to this failure.
     */
    isEquivalent(otherFailure) {
        if (otherFailure.type === FailureType.VIEWPORT) {
            return false;
        } else if (otherFailure.type === FailureType.PROTRUSION) {
            return false;
        } else if (otherFailure.type === FailureType.COLLISION) {
            return this.equals(otherFailure);
        } else {
            return undefined;
        }
    }
    print(file) {
        let text = '|  |--[ ' + this.type + ' (' + this.ID + '): ' + this.range.toString() + ' ]';
        assist.printToFile(file, text);
        text = '|  |  |--[ Sibling: ' + this.sibling.xpath + ' ]';
        assist.printToFile(file, text);
    }
    printClassified(file) {
        let text = '|  |--[ ' + this.type + ' (' + this.ID + '): ' + this.range.toClassifiedString() + ' ]';
        assist.printToFile(file, text);
        text = '|  |  |--[ Sibling: ' + this.sibling.xpath + ' ]';
        assist.printToFile(file, text);
    }

}
module.exports = CollisionFailure;