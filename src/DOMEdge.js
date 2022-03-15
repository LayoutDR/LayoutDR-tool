class DOMEdge {
    /**
     * Links two DOMNodes with this edge.
     * @param {DOMNode} domNode1 
     * @param {DOMNode} domNode2 
     */
    constructor(domNode1, domNode2) {
        this.domNode1 = domNode1;
        this.domNode2 = domNode2;
        this.ranges = new Ranges();
    }
}
module.exports = DOMEdge;