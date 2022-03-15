const RLGEdge = require('./RLGEdge.js');

class SEdge extends RLGEdge {
    constructor(sibling1, sibling2) {
        super(sibling1, sibling2);
        this.sibling1 = this.node1;
        this.sibling2 = this.node2;

        //TODO: Do this a better way...
        //failure related
        this.collisionFailure = false;
    }
    /**
     * Gets the xpath of the other node in this edge (sibling).
     * @param {XPath} xpath The xpath of the current node.
     */
    getSiblingOf(xpath) {
        if (this.sibling1.xpath === xpath)
            return this.sibling2.xpath;
        else
            return this.sibling1.xpath;
    }
    print(){
        for (let aboveEdge of this.aboveMeEdges) {
            console.log('|  |--[ Above Me: ' + aboveEdge.getSiblingOf(this.xpath) + ' ]');
            console.log('|  |  |--[ Range: ' + aboveEdge.ranges.toString() + ' ]');
        }
        for (let belowEdge of this.belowMeEdges) {
            console.log('|  |--[ Below Me: ' + belowEdge.getSiblingOf(this.xpath) + ' ]');
            console.log('|  |  |--[ Range: ' + belowEdge.ranges.toString() + ' ]');
        }
        for (let rightEdge of this.toMyRightEdges) {
            console.log('|  |--[ Right of Me: ' + rightEdge.getSiblingOf(this.xpath) + ' ]');
            console.log('|  |  |--[ Range: ' + rightEdge.ranges.toString() + ' ]');
        }
        for (let leftEdge of this.toMyLeftEdges) {
            console.log('|  |--[ Left of Me: ' + leftEdge.getSiblingOf(this.xpath) + ' ]');
            console.log('|  |  |--[ Range: ' + leftEdge.ranges.toString() + ' ]');
        }
    }
}
module.exports = SEdge;