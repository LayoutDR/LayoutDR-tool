const { Range, Ranges } = require('./Ranges.js');
const assist = require('./assist.js');
const Difference = assist.Difference;

class RLGEdge {
    /**
     * Links two RLGNodes with this edge.
     * @param {RLGNode} node1 The first RLGNode.
     * @param {RLGNode} node2 The second RLGNode.
     */
    constructor(node1, node2) {
        this.node1 = node1;
        this.node2 = node2;
        this.ranges = new Ranges(); //Range of this edge

    }
    /**
     * Adds a viewport where this edge is observed.
     * @param {Number} viewport The viewport of observation.
     */
    addViewport(viewport) {
        this.ranges.addValue(viewport);
    }
    /**
     * Returns true if the this edge has the same nodes as the other.
     * @param {RLGEdge} otherEdge The edge to compare too.
     */
    hasTheSameNodes(otherEdge) {
        return (this.node1.xpath === otherEdge.node1.xpath && this.node2.xpath === otherEdge.node2.xpath)
            || (this.node1.xpath === otherEdge.node2.xpath && this.node2.xpath === otherEdge.node1.xpath);
    }
    /**
     * Returns true if the this edge has the same xpaths as the other.
     * @param {RLGEdge} otherEdge The edge to compare too.
     */
    sameAs(otherEdge) {
        return (this.node1.xpath === otherEdge.node1.xpath && this.node2.xpath === otherEdge.node2.xpath);
    }
    /**
     * Gets the xpath of the other node in this edge.
     * @param {XPath} xpath The xpath of the current node.
     */
    getOtherNode(xpath) {
        if (this.node1.xpath === xpath)
            return this.node2.xpath;
        else
            return this.node1.xpath;
    }
    /**
     * Prints the change in first node relationship.
     * @param {RLGEdge} otherEdge The other edge to difference.
     */
    differenceFirstNode(otherEdge, type = 'Node') {
        if (!this.ranges.equals(otherEdge.ranges)) {
            this.printFirstNode(Difference.CHANGED, Difference.FROM, type);
            otherEdge.printRange(Difference.TO);
            return true;
        }
        return false;
    }
    /**
     * Prints the change in second node relationship.
     * @param {RLGEdge} otherEdge The other edge to difference.
     */
    differenceSecondNode(otherEdge, type = 'Node') {
        if (!this.ranges.equals(otherEdge.ranges)) {
            this.printSecondNode(Difference.CHANGED, Difference.FROM, type);
            otherEdge.printRange(Difference.TO);
            return true;
        }
        return false;
    }
    /**
     * Prints the first node and range of this edge.
     * @param {String} nodeLabel Prefix before printing First Node Type.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printFirstNode(nodeLabel = '', rangeLabel = '', type = 'First Node') {
        if (nodeLabel === '')
            console.log('|  |--[ ' + type + ': ' + this.node1.xpath + ' ]');
        else
            console.log('|  |--[ ' + nodeLabel + ' ' + type + ': ' + this.node1.xpath + ' ]');
        this.printRange(rangeLabel);
        return true;
    }
    /**
     * Prints the second node and range of this edge.
     * @param {String} nodeLabel Prefix before printing Second Node Type.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printSecondNode(nodeLabel = '', rangeLabel = '', type = 'Second Node') {
        if (nodeLabel === '')
            console.log('|  |--[ ' + type + ': ' + this.node2.xpath + ' ]');
        else
            console.log('|  |--[ ' + nodeLabel + ' ' + type + ': ' + this.node2.xpath + ' ]');

        this.printRange(rangeLabel);
        return true;
    }
    /**
     * Prints the range of this edge.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printRange(rangeLabel = '') {
        console.log('|  |  |--[ ' + rangeLabel + 'Range: ' + this.ranges.toString() + ' ]');
        return true;
    }
}
module.exports = RLGEdge;