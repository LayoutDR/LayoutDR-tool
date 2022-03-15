const RLGEdge = require('./RLGEdge.js');

class RightLeftEdge extends RLGEdge {
    /**
     * Creates an RLG edge between right and left node.
     * @param {RLGNode} right The node right.
     * @param {RLGNode} left The node left.
     */
    constructor(right, left) {
        super(right, left);
        this.right = this.node1;
        this.left = this.node2;
    }
    /**
     * Prints the change in right relationship.
     * @param {RightLeftEdge} otherEdge The other edge to difference.
     */
    differenceRight(otherEdge) {
        return this.differenceFirstNode(otherEdge, 'To My Right');
    }
    /**
     * Prints the change in left relationship.
     * @param {RightLeftEdge} otherEdge The other edge to difference.
     */
    differenceLeft(otherEdge) {
        return this.differenceSecondNode(otherEdge, 'To My Left');
    }
    /**
     * Prints the right node and range of this edge.
     * @param {String} nodeLabel Prefix before printing the Node Type.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printRight(nodeLabel = '', rangeLabel = '') {
        return this.printFirstNode(nodeLabel, rangeLabel, 'To My Right');
    }
    /**
     * Prints the left node and range of this edge.
     * @param {String} nodeLabel Prefix before printing the Node Type.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printLeft(nodeLabel = '', rangeLabel = '') {
        return this.printSecondNode(nodeLabel, rangeLabel, 'To My Left');
    }
}
module.exports = RightLeftEdge;