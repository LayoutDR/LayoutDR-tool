const RLGEdge = require('./RLGEdge.js');

class OverlapEdge extends RLGEdge {
    /**
     * Creates an RLG edge between overlapping siblings.
     * @param {RLGNode} sibling1 The first node.
     * @param {RLGNode} sibling2 The second node.
     */
    constructor(sibling1, sibling2) {
        super(sibling1, sibling2);
        this.sibling1 = this.node1;
        this.sibling2 = this.node2;

        //TODO: Do this a better way...
        //failure related
        this.collisionFailure = false;
        this.collisionFailureRanges = undefined;
        this.protrusionFailureRanges = undefined;
        this.siblingOneIsAProtrusion = false;
        this.siblingTwoIsAProtrusion = false;
    }
    /**
     * Prints the change in above relationship.
     * @param {OverlapEdge} otherEdge The other edge to difference.
     * @param {String} xpath The xpath of the current node.
     */
    differenceOtherNode(xpath, otherEdge) {
        let type = 'Overlaps';
        if (xpath === this.sibling1.xpath)
             return this.differenceSecondNode(otherEdge, type);
        else if (xpath === this.sibling2.xpath)
            return this.differenceFirstNode(otherEdge, type);
    }
    /**
     * Prints the other node and range of this edge.
     * @param {String} nodeLabel Prefix before printing the Node Type.
     * @param {String} rangeLabel Prefix before printing the word Range.
     * @param {String} xpath The xpath of the current node.
     */
    printOtherNode(xpath, nodeLabel = '', rangeLabel = '') {
        let type = 'Overlaps';
        if (xpath === this.sibling1.xpath)
            return this.printSecondNode(nodeLabel, rangeLabel, type);
        else if (xpath === this.sibling2.xpath)
            return this.printFirstNode(nodeLabel, rangeLabel, type);
    }

}
module.exports = OverlapEdge;