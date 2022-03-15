const { Range, Ranges } = require('./Ranges.js');
const RLGEdge = require('./RLGEdge.js');
const assist = require('./assist.js');

class ContainerEdge extends RLGEdge {
    constructor(contained, container) {
        super(contained, container);
        this.contained = this.node1;
        this.container = this.node2;
    }
}
module.exports = ContainerEdge;