const Failure = require('./Failure.js');
const assist = require('./assist.js');
const Rectangle = require('./Rectangle.js');
const path = require('path');
const FailureType = assist.FailureType;
const { tolerance } = require('../settings.js');
const settings = require('../settings.js');


class SmallrangeFailure extends Failure {
    /**
     * Create an small-range failure.
     * @param {RLGNode} node The node reporting the failure.
     * @param {RLGNode} sibling The second node involved.
     * @param {Range} range Failures range.
     * @param {*} set The alignment constraints of the failure range.
     * @param {*} setNarrower The alignment constraints of the viewport narrower than the failure range.
     * @param {*} setWider The alignment constraints of the viewport wider than the failure range.
     */
    constructor(node, sibling, range, set, setNarrower, setWider, outputDirectory, webpage, run) {
        super(webpage, run);
        this.node = node;
        this.sibling = sibling;
        this.range = range;
        this.type = FailureType.SMALLRANGE;
        this.set = set.sort();
        this.setWider = setWider.sort();
        this.setNarrower = setNarrower.sort();
        this.outputDirectory = outputDirectory;
        if (settings.humanStudy === true)
            this.setupHumanStudyData();

        // assist.log("--------SM Failure " + this.ID + "--------")
        // assist.log("Failure node: " + this.node.xpath)
        // assist.log("Sibling node: " + this.sibling.xpath)
        // assist.log("Failure range: " + this.range.toString())
        // assist.log("Set: " + set);
        // assist.log("Set Wider: " + setWider);
        // assist.log("Set Narrower: " + setNarrower);
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
     * Get Selector of this failure e.g. for finding and highlighting in screenshots.
     */
    getSelectors() {
        let selectors = [];
        selectors.push(this.node.getSelector());
        selectors.push(this.sibling.getSelector());
        return selectors;
    }
    /**
     * checks if failure xpaths and type are equal. Does not include range.
     * @param {Failure} otherFailure The other failure to compare.
     */
    equals(otherFailure) {
        if (this.type !== otherFailure.type)
            return false;
        let equalNodes = (this.node.xpath === otherFailure.node.xpath && this.sibling.xpath === otherFailure.sibling.xpath) ||
            (this.sibling.xpath === otherFailure.node.xpath && this.node.xpath === otherFailure.sibling.xpath)
        return equalNodes;
    }
    printClassified(file) {
        let text = '|  |--[ ' + this.type + ' (' + this.ID + '): ' + this.range.toClassifiedString() + ' ]';
        assist.printToFile(file, text);
        text = '|  |  |--[ Sibling: ' + this.sibling.xpath + ' ]';
        assist.printToFile(file, text);
        text = '|  |  |  |--[ Alignments narrower: ' + this.setNarrower.toString() + ' ]';
        assist.printToFile(file, text);
        text = '|  |  |  |--[ Alignments: ' + this.set.toString() + ' ]';
        assist.printToFile(file, text);
        text = '|  |  |  |--[ Alignments wider: ' + this.setWider.toString() + ' ]';
        assist.printToFile(file, text);
    }
    /**
     * Return true if alignments of node are not equal to set-wider or set-narrower.
     * @param {Driver} driver The browser driver.
     * @param {Number} viewport The viewport.
     * @param {Path} file The output file.
     */
    async isFailing(driver, viewport, file) {
        //WARNING assumes setWider and setNarrower are already sorted.
        const alignment = assist.alignment;

        let element = await driver.getElementBySelector(this.node.getSelector());
        let siblingElement = await driver.getElementBySelector(this.sibling.getSelector());

        let nodeRect = new Rectangle(await driver.getRectangle(element));
        let siblingRect = new Rectangle(await driver.getRectangle(siblingElement));

        let alignments = [];
        if (nodeRect.isToMyRight(siblingRect))
            alignments.push(alignment.RIGHT)
        if (nodeRect.isToMyLeft(siblingRect))
            alignments.push(alignment.LEFT)
        if (nodeRect.isAboveMe(siblingRect))
            alignments.push(alignment.ABOVE)
        if (nodeRect.isBelowMe(siblingRect))
            alignments.push(alignment.BELOW)
        if (nodeRect.isOverlapping(siblingRect))
            alignments.push(alignment.OVERLAP)
        alignments.sort();
        let equalToWider = true;
        if (this.setWider.length !== alignments.length) {
            equalToWider = false;
        } else {
            for (let i = 0; i < alignments.length; i++)
                if (alignments[i] !== this.setWider[i]) {
                    equalToWider = false;
                    break;
                }
        }
        let equalToNarrower = true;
        if (this.setNarrower.length !== alignments.length) {
            equalToNarrower = false;
        } else {
            for (let i = 0; i < alignments.length; i++)
                if (alignments[i] !== this.setNarrower[i]) {
                    equalToNarrower = false;
                    break;
                }
        }

        let result = (!equalToWider && !equalToNarrower);
        if (file !== undefined) {
            let classification = result ? 'TP' : 'FP';
            let text = 'ID: ' + this.ID + ' Type: ' + this.type + ' Range:' + this.range.toString() + ' Viewport:' + viewport + ' Classification: ' + classification;
            assist.printToFile(file, text);
            text = '|  |--[ Current Alignments: ' + alignments + ' ]';
            assist.printToFile(file, text);
            text = '|  |--[ Set: ' + this.set + ' ]';
            assist.printToFile(file, text);
            text = '|  |--[ Set-Wider: ' + this.setWider + ' ]';
            assist.printToFile(file, text);
            text = '|  |--[ Set-Narrower: ' + this.setNarrower + ' ]';
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
     * Check to see if the passed in failure resembles this failure.
     * @param {Failure} otherFailure the other failure to compare to this failure.
     */
    isEquivalent(otherFailure) {
        if (otherFailure.type === FailureType.SMALLRANGE) {
            if ((this.node.xpath === otherFailure.node.xpath &&
                this.sibling.xpath === otherFailure.sibling.xpath))
                return true
            if ((this.node.xpath === otherFailure.sibling.xpath &&
                this.sibling.xpath === otherFailure.node.xpath))
                return true
        } else {
            return false;
        }
    }

}
module.exports = SmallrangeFailure;