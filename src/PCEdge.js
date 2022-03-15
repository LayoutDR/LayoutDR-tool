const { Range, Ranges } = require('./Ranges.js');
const RLGEdge = require('./RLGEdge.js');
const assist = require('./assist.js');
const Difference = assist.Difference;

class PCEdge extends RLGEdge {
    constructor(parent, child) {
        super(parent, child);
        this.parent = this.node1;
        this.child = this.node2;

        //attributes of a parent-child edge;
        this.leftJustifiedRanges = new Ranges();
        this.rightJustifiedRanges = new Ranges();
        this.topJustifiedRanges = new Ranges();
        this.bottomJustifiedRanges = new Ranges();
        this.horizontallyCenterJustifiedRanges = new Ranges();
        this.verticallyCenterJustifiedRanges = new Ranges();

        //TODO: Do this a better way...
        //failure related
        this.firstProtrusionFailureRanges = undefined;
        this.firstProtrusionParentXPath = undefined;
        this.secondProtrusionFailureRanges = undefined;
        this.secondProtrusionParentXPath = undefined;
    }

    printVerticallyCenterJustifiedRange(prefix = '', postfix = '') {
        console.log('|  |  |--[ ' + prefix + ' Vertically Center Justified Range ' + postfix + ': ' + this.verticallyCenterJustifiedRanges.toString() + ' ]');
    }
    printHorizontallyCenterJustifiedRange(prefix = '', postfix = '') {
        console.log('|  |  |--[ ' + prefix + ' Horizontally Center Justified Range ' + postfix + ': ' + this.horizontallyCenterJustifiedRanges.toString() + ' ]');
    }
    printBottomJustifiedRange(prefix = '', postfix = '') {
        console.log('|  |  |--[ ' + prefix + ' Bottom Justified Range ' + postfix + ': ' + this.bottomJustifiedRanges.toString() + ' ]');
    }
    printTopJustifiedRange(prefix = '', postfix = '') {
        console.log('|  |  |--[ ' + prefix + ' Top Justified Range ' + postfix + ': ' + this.topJustifiedRanges.toString() + ' ]');
    }
    printLeftJustifiedRange(prefix = '', postfix = '') {
        console.log('|  |  |--[ ' + prefix + ' Left Justified Range ' + postfix + ': ' + this.leftJustifiedRanges.toString() + ' ]');
    }
    printRightJustifiedRange(prefix = '', postfix = '') {
        console.log('|  |  |--[ ' + prefix + ' Right Justified Range ' + postfix + ': ' + this.rightJustifiedRanges.toString() + ' ]');
    }
    /**
     * Sets the parent RLGNode.
     * @param {RLGNode} node The parent RLGNode.
     */
    setParent(node) {
        this.parent = node;
    }
    /**
     * Returns the parent of in this edge.
     */
    getParent() {
        return this.parent;
    }
    /**
     * Sets the child RLGNode.
     * @param {RLGNode} node The child RLGNode.
     */
    setChild(node) {
        this.child = node;
    }
    /**
     * Returns the child of this edge.
     */
    getChild() {
        return this.child;
    }
    /**
     * Prints the change in parent relationship.
     * @param {PCEdge} otherEdge The other edge to difference.
     */
    differenceParent(otherEdge) {
        let difference = false;
        let printedParent = false;
        difference = this.differenceFirstNode(otherEdge, 'Parent');
        if (difference)
            printedParent = true;
        //print any difference in alignment attributes.

        if (!this.leftJustifiedRanges.equals(otherEdge.leftJustifiedRanges)) {
            if (!printedParent) {
                printedParent = true;
                this.printParent();
            }
            if(this.leftJustifiedRanges.isEmpty()){
                otherEdge.printLeftJustifiedRange(Difference.NEW);
            }
            else if(otherEdge.leftJustifiedRanges.isEmpty()){
                this.printLeftJustifiedRange(Difference.MISSING);
            }else{
                this.printLeftJustifiedRange(Difference.CHANGED, Difference.FROM);
                otherEdge.printLeftJustifiedRange(Difference.CHANGED, Difference.TO);
            }
            difference = true;
        }
        if (!this.rightJustifiedRanges.equals(otherEdge.rightJustifiedRanges)) {
            if (!printedParent) {
                printedParent = true;
                this.printParent();
            }
            if(this.rightJustifiedRanges.isEmpty()){
                otherEdge.printRightJustifiedRange(Difference.NEW);
            }else if(otherEdge.rightJustifiedRanges.isEmpty()){
                this.printRightJustifiedRange(Difference.MISSING);
            }
            else{
                this.printRightJustifiedRange(Difference.CHANGED, Difference.FROM);
                otherEdge.printRightJustifiedRange(Difference.CHANGED, Difference.TO);
            }

            difference = true;
        }
        if (!this.topJustifiedRanges.equals(otherEdge.topJustifiedRanges)) {
            if (!printedParent) {
                printedParent = true;
                this.printParent();
            }
            if(this.topJustifiedRanges.isEmpty()){
                otherEdge.printTopJustifiedRange(Difference.NEW);
            }else if(otherEdge.topJustifiedRanges.isEmpty()){
                this.printTopJustifiedRange(Difference.MISSING);
            }else{
                this.printTopJustifiedRange(Difference.CHANGED, Difference.FROM);
                otherEdge.printTopJustifiedRange(Difference.CHANGED, Difference.TO);
            }
            difference = true;
        }
        if (!this.bottomJustifiedRanges.equals(otherEdge.bottomJustifiedRanges)) {
            if (!printedParent) {
                printedParent = true;
                this.printParent();
            }
            if(this.bottomJustifiedRanges.isEmpty()){
                otherEdge.printBottomJustifiedRange(Difference.NEW);
            }else if(otherEdge.bottomJustifiedRanges.isEmpty()){
                this.printBottomJustifiedRange(Difference.MISSING);
            }else{
                this.printBottomJustifiedRange(Difference.CHANGED, Difference.FROM);
                otherEdge.printBottomJustifiedRange(Difference.CHANGED, Difference.TO);
            }
            difference = true;
        }
        if (!this.horizontallyCenterJustifiedRanges.equals(otherEdge.horizontallyCenterJustifiedRanges)) {
            if (!printedParent) {
                printedParent = true;
                this.printParent();
            }
            if(this.horizontallyCenterJustifiedRanges.isEmpty()){
                otherEdge.printHorizontallyCenterJustifiedRange(Difference.NEW);
            }else if(otherEdge.horizontallyCenterJustifiedRanges.isEmpty()){
                this.printHorizontallyCenterJustifiedRange(Difference.MISSING);
            }else{
                this.printHorizontallyCenterJustifiedRange(Difference.CHANGED, Difference.FROM);
                otherEdge.printHorizontallyCenterJustifiedRange(Difference.CHANGED, Difference.TO);
            }
            difference = true;
        }
        if (!this.verticallyCenterJustifiedRanges.equals(otherEdge.verticallyCenterJustifiedRanges)) {
            if (!printedParent) {
                printedParent = true;
                this.printParent();
            }
            if(this.verticallyCenterJustifiedRanges.isEmpty()){
                otherEdge.printVerticallyCenterJustifiedRange(Difference.NEW);
            }else if(otherEdge.verticallyCenterJustifiedRanges.isEmpty()){
                this.printVerticallyCenterJustifiedRange(Difference.MISSING);
            }else{
                this.printVerticallyCenterJustifiedRange(Difference.CHANGED, Difference.FROM);
                otherEdge.printVerticallyCenterJustifiedRange(Difference.CHANGED, Difference.TO);
            }
            difference = true;
        }
        return difference;
    }
    /**
     * Prints the change in child relationship.
     * @param {PCEdge} otherEdge The other edge to difference.
     */
    differenceChild(otherEdge) {
        return this.differenceSecondNode(otherEdge, 'Child');
    }
    /**
     * Prints the parent and range of this edge.
     * @param {String} nodeLabel Prefix before printing the word Parent.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printParent(nodeLabel = '', rangeLabel = '') {
        return this.printFirstNode(nodeLabel, rangeLabel, 'Parent');
    }
    /**
     * Prints the child and range of this edge.
     * @param {String} nodeLabel Prefix before printing the word Child.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printChild(nodeLabel = '', rangeLabel = '') {
        return this.printSecondNode(nodeLabel, rangeLabel, 'Child');
    }
}
module.exports = PCEdge;