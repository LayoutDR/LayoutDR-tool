const RLGEdge = require('./RLGEdge.js');

class AboveBelowEdge extends RLGEdge {
    /**
     * Creates an RLG edge between above and below node.
     * @param {RLGNode} above The node above.
     * @param {RLGNode} below The node below.
     */
    constructor(above, below) {
        super(above, below);
        this.above = this.node1;
        this.below = this.node2;
    }
   /**
     * Prints the change in above relationship.
     * @param {AboveBelowEdge} otherEdge The other edge to difference.
     */
    differenceAbove(otherEdge) {
        return this.differenceFirstNode(otherEdge, 'Above Me');
    }
    /**
     * Prints the change in below relationship.
     * @param {AboveBelowEdge} otherEdge The other edge to difference.
     */
    differenceBelow(otherEdge) {
        return this.differenceSecondNode(otherEdge, 'Below Me');
    }
    /**
     * Prints the node above and range of this edge.
     * @param {String} nodeLabel Prefix before printing the Node Type.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printAbove(nodeLabel = '', rangeLabel = '') {
        return this.printFirstNode(nodeLabel, rangeLabel, 'Above Me');
    }
    /**
     * Prints the node below and range of this edge.
     * @param {String} nodeLabel Prefix before printing the Node Type.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printBelow(nodeLabel = '', rangeLabel = '') {
        return this.printSecondNode(nodeLabel, rangeLabel, 'Below Me');
    }
}
module.exports = AboveBelowEdge;