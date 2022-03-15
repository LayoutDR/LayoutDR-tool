const { Range, Ranges } = require('./Ranges.js');
const PCEdge = require('./PCEdge.js');
const ContainerEdge = require('./ContainerEdge.js');
const OverlapEdge = require('./OverlapEdge.js');
const AboveBelowEdge = require('./AboveBelowEdge.js');
const RightLeftEdge = require('./RightLeftEdge.js');
const CollisionFailure = require('./CollisionFailure.js');
const ProtrusionFailure = require('./ProtrusionFailure.js');
const SmallrangeFailure = require('./SmallrangeFailure.js');
const ViewportFailure = require('./ViewportFailure.js');
const assist = require('./assist.js');
const RepairStatistics = require('./RepairStatistics.js');
const ProgressBar = require('progress');
const path = require('path');
const settings = require('../settings.js');
const { FailureType } = require('./assist.js');
const WrappingFailure = require('./WrappingFailure.js');
const Difference = assist.Difference;


class RLGNode {
    /**
     * Constructor to create RLGNode from a Rectangle object retrieved from RBush.
     * The rectangle object must contain the XPath.
     * @param {Rectangle} rectangle The DOMNode to add to the RLG.
     * @param {RLG} rlgPointer pointer to the associated RLG.
     */
    constructor(rectangle, rlgPointer, outputDirectory, webpage, run) {
        if (rectangle === undefined || rectangle.xpath === undefined) {
            throw "Rectangle must take a defined rectangle with xpath.";
        }
        this.rlg = rlgPointer;
        this.outputDirectory = outputDirectory;
        this.webpage = webpage;
        this.run = run;
        this.parentEdges = []; //RLGEdges
        this.containerEdges = []; //Not for parent-child edges. Added to remove FP protrusions

        this.childrenEdges = [];
        this.overlapEdges = [];

        this.aboveMeEdges = [];
        this.belowMeEdges = [];
        this.toMyRightEdges = [];
        this.toMyLeftEdges = [];

        this.ranges = new Ranges();
        this.xpath = rectangle.xpath;

        this.elementCollisions = [];
        this.elementProtrusions = [];
        this.smallranges = [];
        this.wrappings = [];
        this.viewportProtrusions = [];

        this.collisionRepairStats = new RepairStatistics();
        this.protrusionRepairStats = new RepairStatistics();
        this.viewportRepairStats = new RepairStatistics();
    }
    /**
     * Detects wrapped element by determining all elements above this node that
     * share the same max of range. Then from those elements which ones are right
     * or left at wider(max+1). Then from those which ones are not bellow at wider.
     * Making sure that each set found is over the minimum threshold number of 
     * row elements.
     * @param {[RLGEdge]} edges below or above RLG edges.
     * @param {[RLGEdge]} oppositeEdges The opposite RLG edges of first parameter.
     */
    detectUnwrapping(edges, oppositeEdges, direction, oppositeDirection) {
        let viewportMaxVisited = [];
        for (let edge of edges) {
            for (let range of edge.ranges.list) {
                if (viewportMaxVisited.includes(range.getMaximum()))
                    continue;
                else
                    viewportMaxVisited.push(range.getMaximum());
                let inDirection = [edge[direction]];
                for (let otherEdge of edges) {
                    for (let otherRangeAboveMe of otherEdge.ranges.list) {
                        if (edge[direction].xpath === otherEdge[direction].xpath)//skip the same edge
                            continue;
                        if (range.getMaximum() === otherRangeAboveMe.getMaximum()) {
                            inDirection.push(otherEdge[direction])
                        }
                    }
                }
                if (inDirection.length >= settings.rowThreshold) {
                    let rightOrLeftOfMe = [];
                    for (let nodeInDirection of inDirection) {
                        let found = undefined;
                        for (let toMyRightEdge of this.toMyRightEdges) {
                            if (nodeInDirection.xpath === toMyRightEdge.right.xpath) {
                                if (toMyRightEdge.ranges.inRange(range.getWider()))
                                    found = true;
                                break;
                            }
                        }
                        if (found === true) {
                            rightOrLeftOfMe.push(nodeInDirection);
                            break;
                        }


                        for (let toMyLeftEdge of this.toMyLeftEdges) {
                            if (nodeInDirection.xpath === toMyLeftEdge.left.xpath) {
                                this.toMyLeftEdges.length
                                if (toMyLeftEdge.ranges.inRange(range.getWider()))
                                    rightOrLeftOfMe.push(nodeInDirection);
                                break;
                            }
                        }
                    }
                    if (rightOrLeftOfMe.length >= settings.rowThreshold) {
                        let row = [];

                        //make sure row is not bellowMe at wider..
                        for (let rightOrLeftNode of rightOrLeftOfMe) {
                            let isRowElementInOppositeDirection = false;
                            for (let oppositeDirectionEdge of oppositeEdges) {
                                if (rightOrLeftNode.xpath === oppositeDirectionEdge[oppositeDirection].xpath) {
                                    if (oppositeDirectionEdge.ranges.inRange(range.getWider())) {
                                        isRowElementInOppositeDirection = true;
                                        break;
                                    }
                                }
                            }
                            if (isRowElementInOppositeDirection === false)
                                row.push(rightOrLeftNode);
                        }
                        if (row.length >= settings.rowThreshold) {
                            //report this node failing
                            let wrapping = new WrappingFailure(this, row, range, this.outputDirectory, this.webpage, this.run)
                            this.wrappings.push(wrapping);
                        }
                    }

                }
            }
        }
    }
    /**
     * Detects wrapping by iterating over max of edges(above or below). Gets
     * the row at wider(max+1) then makes sure that the row is intact at max.
     * finds the minimum range of (above or below) between row and this node.
     * @param {[RLGEdge]} edges the above or below edges of this node.
     * @param {String} direction the directions of passed in edges 'above' or 'below'
     */
    detectWrapping(edges, direction) {
        let viewportInspected = [];
        for (let edge of edges)
            for (let range of edge.ranges.list) {
                if (viewportInspected.includes(range.getMaximum()))
                    continue;
                //Get row at max+1 of this edge.
                let row = this.getRowNodesAtViewport(range.getWider());
                //Is the node related to this edge part of the row at max+1.
                if (assist.isObjectsXPathInArrayOfObjects(edge[direction], row))
                    viewportInspected.push(range.getMaximum());
                else
                    continue;
                //Is number of elements in row at max+1 above minimum number of elements.
                if (row.length >= settings.rowThreshold) {
                    //Using the first row element from max+1
                    //Are they still the same number of nodes in the row.
                    let rowAfterWrapping = row[0].getRowNodesAtViewport(range.getMaximum());
                    rowAfterWrapping.unshift(row[0]);

                    if (rowAfterWrapping.length === row.length) {
                        let rowIntactPostWrapping = true;
                        for (let node of row) {
                            if (!assist.isObjectsXPathInArrayOfObjects(node, rowAfterWrapping)) {
                                rowIntactPostWrapping = false;
                                break;
                            }
                        }
                        if (rowIntactPostWrapping) {
                            let possibleRanges = [];
                            for (let edgeB of edges)
                                if (assist.isObjectsXPathInArrayOfObjects(edgeB[direction], row))
                                    for (let possibleRange of edgeB.ranges.list)
                                        if (range.getMaximum() === possibleRange.getMaximum())
                                            possibleRanges.push(possibleRange);
                            if (possibleRanges.length === row.length) {
                                let failureRange = undefined;
                                for (let fRange of possibleRanges)
                                    if (failureRange === undefined || failureRange.getMinimum() < fRange.getMinimum())
                                        failureRange = fRange;

                                let rowAtMinimum = row[0].getRowNodesAtViewport(range.getMinimum());
                                rowAtMinimum.unshift(row[0]);

                                if (row.length === rowAtMinimum.length) {
                                    let rowIntactPostWrappingAtMinimum = true;
                                    for (let node of row) {
                                        if (!assist.isObjectsXPathInArrayOfObjects(node, rowAtMinimum)) {
                                            rowIntactPostWrappingAtMinimum = false;
                                            break;
                                        }
                                    }
                                    if (rowIntactPostWrappingAtMinimum) {
                                        let wrapping = new WrappingFailure(this, row, failureRange, this.outputDirectory, this.webpage, this.run)
                                        this.wrappings.push(wrapping);
                                    }
                                }
                            }

                        }
                    }
                }
            }
    }
    getRowNodesAtViewport(viewport) {
        let aboveXPaths = [];
        let belowXPaths = [];
        let rowNodes = [];
        for (let aboveEdge of this.aboveMeEdges)
            if (aboveEdge.ranges.inRange(viewport))
                aboveXPaths.push(aboveEdge.above.xpath);
        for (let belowEdge of this.belowMeEdges)
            if (belowEdge.ranges.inRange(viewport))
                belowXPaths.push(belowEdge.below.xpath);
        for (let rightEdge of this.toMyRightEdges)
            if (rightEdge.ranges.inRange(viewport))
                if (!aboveXPaths.includes(rightEdge.right.xpath) && !belowXPaths.includes(rightEdge.right.xpath))
                    rowNodes.push(rightEdge.right);
        for (let leftEdge of this.toMyLeftEdges)
            if (leftEdge.ranges.inRange(viewport))
                if (!aboveXPaths.includes(leftEdge.left.xpath) && !belowXPaths.includes(leftEdge.left.xpath))
                    rowNodes.push(leftEdge.left);
        return rowNodes;
    }
    /**
     * Uses the XPath to generate a unique selector. Returns undefined for nodes with no xpath.
     */
    getSelector() {
        if (this.xpath === undefined || this.xpath === "")
            return undefined;
        let elements = this.xpath.split("/");
        let selector = ""
        for (let element of elements) {
            if (element === "") {
                continue;
            }
            else if (element.includes("[")) {
                if (element.includes(assist.svg.prefix)) {
                    element = element.replace(assist.svg.prefix, "");
                    element = element.replace(assist.svg.postfix, "");
                }
                if (element.includes("[")) {
                    element = element.replace("[", ":nth-of-type(");
                    element = element.replace("]", ")");
                } else {
                    element = element + ":nth-of-type(1)"
                }
            } else {
                element = element + ":nth-of-type(1)"
            }
            if (selector === "")
                selector = element.toLowerCase();
            else
                selector = selector + " > " + element.toLowerCase();
        }
        return selector;
    }
    /**
     * Returns true if element is involved in a responsive layout failure.
     */
    isFailing() {
        if (this.smallranges.length === 0 && this.elementCollisions.length === 0 && this.elementProtrusions.length === 0 && this.viewportProtrusions.length === 0 && this.wrappings === 0)
            return false;
        else
            return true;
    }
    /**
     * Takes two nodes that exist in both graphs and prints all the
     * differences between edges in the two graphs.
     * @param {RLGNode} otherNode The node to compare to.
     */
    difference(otherNode) {
        this.printNodeDeclaration();
        let parentsDiff = this.differenceParents(otherNode);
        let childrenDiff = this.differenceChildren(otherNode);
        let overlapDiff = this.differenceOverlap(otherNode);
        let leftDiff = this.differenceLeft(otherNode);
        let rightDiff = this.differenceRight(otherNode);
        let belowDiff = this.differenceBelow(otherNode);
        let aboveDiff = this.differenceAbove(otherNode);
        if (!parentsDiff && !childrenDiff && !overlapDiff && !leftDiff && !rightDiff && !belowDiff && !aboveDiff) {
            this.printOk();
        }
    }
    differenceAbove(otherNode) {
        let results = this.matchEdges(this.aboveMeEdges, otherNode.aboveMeEdges);
        let aboveMeEdges = results.matchedEdges;
        let missingEdges = results.missingEdges;
        let newEdges = results.newEdges;
        let difference = false;
        for (let missingEdge of missingEdges) {
            missingEdge.printAbove(Difference.MISSING);
            difference = true;
        }
        for (let newEdge of newEdges) {
            newEdge.printAbove(Difference.NEW);
            difference = true;
        }
        for (let i = 0; i < aboveMeEdges.length; i += 2) {
            let aboveEdge = aboveMeEdges[i];
            let otherAboveEdge = aboveMeEdges[i + 1];
            if (aboveEdge.differenceAbove(otherAboveEdge))
                difference = true;
        }
        return difference;
    }
    differenceBelow(otherNode) {
        let results = this.matchEdges(this.belowMeEdges, otherNode.belowMeEdges);
        let belowMeEdges = results.matchedEdges;
        let missingEdges = results.missingEdges;
        let newEdges = results.newEdges;
        let difference = false;
        for (let missingEdge of missingEdges) {
            missingEdge.printBelow(Difference.MISSING);
            difference = true;
        }
        for (let newEdge of newEdges) {
            newEdge.printBelow(Difference.NEW);
            difference = true;
        }
        for (let i = 0; i < belowMeEdges.length; i += 2) {
            let belowEdge = belowMeEdges[i];
            let otherBelowEdge = belowMeEdges[i + 1];
            if (belowEdge.differenceBelow(otherBelowEdge))
                difference = true;
        }
        return difference;
    }
    differenceRight(otherNode) {
        let results = this.matchEdges(this.toMyRightEdges, otherNode.toMyRightEdges);
        let toMyRightEdges = results.matchedEdges;
        let missingEdges = results.missingEdges;
        let newEdges = results.newEdges;
        let difference = false;
        for (let missingEdge of missingEdges) {
            missingEdge.printRight(Difference.MISSING);
            difference = true;
        }
        for (let newEdge of newEdges) {
            newEdge.printRight(Difference.NEW);
            difference = true;
        }
        for (let i = 0; i < toMyRightEdges.length; i += 2) {
            let rightEdge = toMyRightEdges[i];
            let otherRightEdge = toMyRightEdges[i + 1];
            if (rightEdge.differenceRight(otherRightEdge))
                difference = true;
        }
        return difference;
    }
    differenceLeft(otherNode) {
        let results = this.matchEdges(this.toMyLeftEdges, otherNode.toMyLeftEdges);
        let toMyLeftEdges = results.matchedEdges;
        let missingEdges = results.missingEdges;
        let newEdges = results.newEdges;
        let difference = false;
        for (let missingEdge of missingEdges) {
            missingEdge.printLeft(Difference.MISSING);
            difference = true;
        }
        for (let newEdge of newEdges) {
            newEdge.printLeft(Difference.NEW);
            difference = true;
        }
        for (let i = 0; i < toMyLeftEdges.length; i += 2) {
            let leftEdge = toMyLeftEdges[i];
            let otherLeftEdge = toMyLeftEdges[i + 1];
            if (leftEdge.differenceLeft(otherLeftEdge))
                difference = true;
        }
        return difference;
    }
    differenceOverlap(otherNode) {
        let results = this.matchEdges(this.overlapEdges, otherNode.overlapEdges);
        let overlappingEdges = results.matchedEdges;
        let missingEdges = results.missingEdges;
        let newEdges = results.newEdges;
        let difference = false;
        for (let missingEdge of missingEdges) {
            missingEdge.printOtherNode(this.xpath, Difference.MISSING);
            difference = true;
        }
        for (let newEdge of newEdges) {
            newEdge.printOtherNode(this.xpath, Difference.NEW);
            difference = true;
        }
        for (let i = 0; i < overlappingEdges.length; i += 2) {
            let overlappingEdge = overlappingEdges[i];
            let otherOverlappingEdge = overlappingEdges[i + 1];
            if (overlappingEdge.differenceOtherNode(otherOverlappingEdge, this.xpath))
                difference = true;
        }
        return difference;
    }
    differenceChildren(otherNode) {
        let results = this.matchEdges(this.childrenEdges, otherNode.childrenEdges);
        let childEdges = results.matchedEdges;
        let missingEdges = results.missingEdges;
        let newEdges = results.newEdges;
        let difference = false;
        for (let missingEdge of missingEdges) {
            missingEdge.printChild(Difference.MISSING);
            difference = true;
        }
        for (let newEdge of newEdges) {
            newEdge.printChild(Difference.NEW);
            difference = true;
        }
        for (let i = 0; i < childEdges.length; i += 2) {
            let childEdge = childEdges[i];
            let otherChildEdge = childEdges[i + 1];
            if (childEdge.differenceChild(otherChildEdge))
                difference = true;
        }
        return difference;
    }
    differenceParents(otherNode) {
        let results = this.matchEdges(this.parentEdges, otherNode.parentEdges);
        let parentEdges = results.matchedEdges;
        let missingEdges = results.missingEdges;
        let newEdges = results.newEdges;
        let difference = false;
        for (let missingEdge of missingEdges) {
            missingEdge.printParent(Difference.MISSING);
            difference = true;
        }
        for (let newEdge of newEdges) {
            newEdge.printParent(Difference.NEW);
            difference = true;
        }
        for (let i = 0; i < parentEdges.length; i += 2) {
            let parentEdge = parentEdges[i];
            let otherParentEdge = parentEdges[i + 1];
            if (parentEdge.differenceParent(otherParentEdge))
                difference = true;
        }
        return difference;
    }
    /**
     * Prints the xpath of this node.
     * @param {String} nodeLabel Prefix before printing the word Node.
     */
    printNodeDeclaration(nodeLabel = '') {
        if (nodeLabel === '')
            console.log('|--[ Node: ' + this.xpath + ' ]');
        else
            console.log('|--[ ' + nodeLabel + ' Node: ' + this.xpath + ' ]');

    }
    /**
     * Prints the message indicating no difference.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printOk() {
        console.log('|  |--[ ' + Difference.OK + ' ]');
    }
    /**
     * Prints the range of this node.
     * @param {File} file the output file.
     * @param {String} rangeLabel Prefix before printing the word Range.
     */
    printRange(file, rangeLabel = '') {
        assist.printToFile(file, '|  |--[ ' + rangeLabel + 'Range: ' + this.ranges.toString() + ' ]');
    }
    /**
     * Return an object with the array property matchedEdges which pairs edges consecutively,
     * the array property missingEdges, and newEdges.
     * @param {RLGEdge} edges the first set of edges to compare.
     * @param {RLGEdge} otherNode the second set of edges to compare to.
     */
    matchEdges(edges, otherEdges) {
        let results = {}
        results.matchedEdges = [];
        results.missingEdges = [];
        results.newEdges = [];
        for (let edge of edges) {
            let matched = false;
            for (let otherEdge of otherEdges) {
                if (edge.sameAs(otherEdge)) {
                    results.matchedEdges.push(edge);
                    results.matchedEdges.push(otherEdge);
                    matched = true;
                    break;
                }
            }
            if (!matched) { //missing
                results.missingEdges.push(edge);
            }
        }
        for (let otherEdge of otherEdges) {
            let matched = false;
            for (let edge of edges) {
                if (otherEdge.sameAs(edge)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) { //New
                results.newEdges.push(otherEdge);
            }
        }
        return results;
    }
    /**
     * Internally used to update a Failures in a collection of failures. 
     * @param {Failure} newFailure The other Failure related to this RLGNode.
     * @param {[Failure]} failures Collection of Failures objects.
     */
    addFailure(newFailure, failures) {
        let updated = false;
        for (let failure of failures) {
            if (failure.equals(newFailure)) {
                failure.addRanges(newFailure.ranges);
                updated = true;
            }
        }
        if (!updated) {
            newFailure.setID();
            failures.push(newFailure);
        }
    }
    /**
     * Internally used to update an RLGEdge in a collection of edges. Returns
     * the updated edge or undefined.
     * @param {RLGNode} node The other RLGNode related to this RLGNode.
     * @param {[RLGEdge]} edges Collection of RLGEdge objects.
     * @param {Number} viewport The viewport where the edge relationship is observed.
     * @param {Boolean} twoWay can the edge be treated either way (example overlap).
     */
    updateEdge(node, edges, viewport, twoWay = true, thisFirst = true) {
        for (let edge of edges) {
            if (twoWay === true) {
                if ((edge.node1.xpath === node.xpath && edge.node2.xpath === this.xpath)
                    || (edge.node1.xpath === this.xpath && edge.node2.xpath === node.xpath)) {
                    edge.addViewport(viewport);
                    return edge;
                }
            } else if (thisFirst === true) {
                if (edge.node1.xpath === this.xpath && edge.node2.xpath === node.xpath) {
                    edge.addViewport(viewport);
                    return edge;
                }
            } else if (thisFirst === false) {
                if (edge.node1.xpath === node.xpath && edge.node2.xpath === this.xpath) {
                    edge.addViewport(viewport);
                    return edge;
                }
            }

        }
        return undefined;
    }
    /**
     * Adds a width/viewport to RLGEdge or creates an RLGEdge between the two RLGNodes. 
     * @param {RLGNode} child The contained node to add.
     * @param {Number} viewport The viewport where the edge relationship is observed.
     */
    addChild(child, viewport) {
        let edge = this.updateEdge(child, this.childrenEdges, viewport, false, true);
        if (edge === undefined) {
            edge = new PCEdge(this, child);
            edge.addViewport(viewport);
            this.childrenEdges.push(edge);
            child.parentEdges.push(edge);
        }
        return edge;
    }
    /**
     * Adds a width/viewport to RLGEdge or creates an RLGEdge between the two RLGNodes. 
     * @param {RLGNode} container The contained node to add.
     * @param {Number} viewport The viewport where the edge relationship is observed.
     */
    addContainer(container, viewport) {
        let edge = this.updateEdge(container, this.containerEdges, viewport, false, true);
        if (edge === undefined) {
            edge = new ContainerEdge(this, container);
            edge.addViewport(viewport);
            this.containerEdges.push(edge);
        }
        return edge;
    }
    /**
     * Adds a width/viewport to overlap RLGEdge or creates an RLGEdge between the two RLGNodes. 
     * @param {RLGNode} sibling The contained node to add.
     * @param {Number} viewport The viewport where the edge relationship is observed.
     */
    addOverlap(sibling, viewport) {
        let edge = this.updateEdge(sibling, this.overlapEdges, viewport, true);
        if (edge === undefined) {
            edge = new OverlapEdge(this, sibling);
            edge.addViewport(viewport);
            this.overlapEdges.push(edge);
            sibling.overlapEdges.push(edge);
        }
    }
    /**
     * Adds a width/viewport to Above RLGEdge or creates an RLGEdge between the two RLGNodes. 
     * @param {RLGNode} sibling The sibling node to add.
     * @param {Number} viewport The viewport where the edge relationship is observed.
     */
    addAboveMe(sibling, viewport) {//TODO: test.
        let edge = this.updateEdge(sibling, this.aboveMeEdges, viewport, false, false);
        if (edge === undefined) {
            edge = new AboveBelowEdge(sibling, this);
            edge.addViewport(viewport);
            this.aboveMeEdges.push(edge);
            sibling.belowMeEdges.push(edge);
        }
    }
    /**
     * Adds a width/viewport to below RLGEdge or creates an RLGEdge between the two RLGNodes. 
     * @param {RLGNode} sibling The sibling node to add.
     * @param {Number} viewport The viewport where the edge relationship is observed.
     */
    addBelowMe(sibling, viewport) {//TODO: test.
        let edge = this.updateEdge(sibling, this.belowMeEdges, viewport, false, true);
        if (edge === undefined) {
            edge = new AboveBelowEdge(this, sibling);
            edge.addViewport(viewport);
            this.belowMeEdges.push(edge);
            sibling.aboveMeEdges.push(edge);
        }
    }
    /**
     * Adds a width/viewport to my right RLGEdge or creates an RLGEdge between the two RLGNodes. 
     * @param {RLGNode} sibling The sibling node to add.
     * @param {Number} viewport The viewport where the edge relationship is observed.
     */
    addToMyRight(sibling, viewport) {//TODO: test.
        let edge = this.updateEdge(sibling, this.toMyRightEdges, viewport, false, false);
        if (edge === undefined) {
            edge = new RightLeftEdge(sibling, this);
            edge.addViewport(viewport);
            this.toMyRightEdges.push(edge);
            sibling.toMyLeftEdges.push(edge);
        }
    }
    /**
     * Adds a width/viewport to my left RLGEdge or creates an RLGEdge between the two RLGNodes. 
     * @param {RLGNode} sibling The contained node to add.
     * @param {Number} viewport The viewport where the edge relationship is observed.
     */
    addToMyLeft(sibling, viewport) {//TODO: test.
        let edge = this.updateEdge(sibling, this.toMyLeftEdges, viewport, false, true);
        if (edge === undefined) {
            edge = new RightLeftEdge(this, sibling);
            edge.addViewport(viewport);
            this.toMyLeftEdges.push(edge);
            sibling.toMyRightEdges.push(edge);
        }
    }
    /**
     * Adds a viewport where this node is observed.
     * @param {Number} viewport The viewport of observation.
     */
    addViewport(viewport) {
        this.ranges.addValue(viewport);
    }
    /**
     * Returns the the parent node at the passed in viewport. Undefined if no parent.
     * @param {number} viewport The viewport to find a parent xpath in.
     */
    getParentAtViewport(viewport) {
        for (let parentEdge of this.parentEdges) {
            let parent = parentEdge.getParent();
            if (parentEdge.ranges.inRanges(viewport)) {
                return parent;
            }
        }
        return undefined;
    }
    /**
     * Returns the the top level parent node at the passed in viewport. Undefined if no parent.
     * @param {number} viewport The viewport to find a parent xpath in.
     */
    getTopParentAtViewport(viewport) {
        let parent = undefined;
        for (let parentEdge of this.parentEdges) {
            parent = parentEdge.getParent();
            if (parentEdge.ranges.inRanges(viewport)) {
                let grandparent = parent.getTopParentAtViewport(viewport);
                if (grandparent === undefined)
                    return parent;
                else
                    return grandparent;
            }
        }
        return parent;
    }
    /**
     * Returns a list of parents at the passed in viewport. [empty] in none.
     * @param {number} viewport The viewport to find a parent xpath in.
     * @returns The RLGNode parent xpaths.
     */
    getAncestorsAtViewport(viewport) {
        if (this.parentEdges.length === 0) {
            return [];
        } else {
            for (let parentEdge of this.parentEdges) {
                let parent = parentEdge.getParent();
                if (parentEdge.ranges.inRanges(viewport)) {
                    let myAncestors = parent.getAncestorsAtViewport(viewport);
                    myAncestors.push(parent.xpath);
                    return myAncestors
                }
            }
            return [];
        }
    }
    /**
     * Returns a list of parents at the passed in viewport. [empty] in none.
     * @param {number} viewport The viewport to find a ancestors in.
     * @returns The [RLGNode] parents.
     */
    getAncestorsRLGNodesAtViewport(viewport) {
        if (this.parentEdges.length === 0) {
            return [];
        } else {
            for (let parentEdge of this.parentEdges) {
                let parent = parentEdge.getParent();
                if (parentEdge.ranges.inRanges(viewport)) {
                    let myAncestors = parent.getAncestorsRLGNodesAtViewport(viewport);
                    myAncestors.push(parent);
                    return myAncestors
                }
            }
            return [];
        }
    }
    /**
     * Returns a list of descendant RLG nodes at the passed in viewport. [empty] if none.
     * @param {number} viewport The viewport to find a descendant in.
     * @returns The [RLGNode] descendants.
     */
    getDescendantRLGNodesAtViewport(viewport) {
        let descendants = []
        descendants.push(this);
        if (this.childrenEdges.length === 0) {
            return descendants;
        } else {
            for (let childEdge of this.childrenEdges) {
                let child = childEdge.getChild();
                if (childEdge.ranges.inRanges(viewport)) {
                    let myDescendants = child.getDescendantRLGNodesAtViewport(viewport);
                    descendants.push(...myDescendants);
                }
            }
            return descendants
        }
    }
    /**
     * Returns the the parent at passed in viewport. Undefined if no parent.
     * @param {number} viewport The viewport to find a parent xpath in.
     * @returns The RLGNode parent.
     */
    getParentInViewport(viewport) {
        for (let parentEdge of this.parentEdges) {
            let parent = parentEdge.getParent();
            if (parentEdge.ranges.inRanges(viewport)) {
                return parent;
            }
        }
        return undefined;
    }
    /**
     * Returns the the children at passed in viewport.
     * @param {number} viewport The viewport to find a child in.
     * @returns The [RLGNode] children.
     */
    getChildrenAtViewport(viewport) {//TODO: Test this function.
        let children = []
        for (let childEdge of this.childrenEdges) {
            if (childEdge.ranges.inRanges(viewport)) {
                children.push(childEdge.getChild());
            }
        }
        return children;
    }
    detectSmallRange() {
        const alignment = assist.alignment;

        let siblingAlignments = [this.aboveMeEdges, this.belowMeEdges, this.toMyLeftEdges, this.toMyRightEdges, this.overlapEdges];
        let names = [alignment.ABOVE, alignment.BELOW, alignment.LEFT, alignment.RIGHT, alignment.OVERLAP];

        for (let i = 0; i < siblingAlignments.length; i++) {
            let checkingAlignment = siblingAlignments[i];
            let name = names[i];
            let otherAlignments = [];
            let otherNames = [];

            for (let x = 0; x < siblingAlignments.length; x++) {
                if (x != i) {
                    otherAlignments.push(siblingAlignments[x]);
                    otherNames.push(names[x]);
                }
            }

            for (let edge of checkingAlignment) {
                if (edge.node1.xpath === this.xpath) { //to avoid duplicate reporting.
                    for (let range of edge.ranges.list) {
                        let set = []
                        let setWider = [];
                        let setNarrower = [];
                        let possibleFailureRange = undefined;
                        if (range.length() <= settings.smallrangeThreshold) {
                            possibleFailureRange = range;
                            set.push(name);
                            for (let x = 0; x < otherAlignments.length; x++) {
                                let otherAlignment = otherAlignments[x];
                                let otherName = otherNames[x];
                                for (let otherEdge of otherAlignment)
                                    if (edge.hasTheSameNodes(otherEdge)) {
                                        for (let otherEdgeRange of otherEdge.ranges.list) {
                                            if (otherEdgeRange.isOverlappingWith(possibleFailureRange))
                                                set.push(otherName);
                                            if (otherEdgeRange.inRange(possibleFailureRange.min - 1))  //alignment exists at narrower viewport
                                                setNarrower.push(otherName);
                                            if (otherEdgeRange.inRange(possibleFailureRange.max + 1))   //alignment exists at wider viewport
                                                setWider.push(otherName);
                                        }
                                    }
                            }
                        }
                        if (setWider.length > 0 && setNarrower.length > 0) {
                            let prevDiff = assist.setDifference(setNarrower, set);
                            let diffPrev = assist.setDifference(set, setNarrower);
                            let nextDiff = assist.setDifference(setWider, set);
                            let diffNext = assist.setDifference(set, setWider);

                            if ((prevDiff.length + diffPrev.length) >= 2 && (nextDiff.length + diffNext.length) >= 2) {
                                if (!this.isSmallRangeReported(edge.node1, edge.node2, possibleFailureRange)) {
                                    let failure = undefined;
                                    if (edge.node1.xpath === this.xpath)
                                        failure = new SmallrangeFailure(edge.node1, edge.node2, possibleFailureRange, set, setNarrower, setWider, this.outputDirectory, this.webpage, this.run);
                                    else
                                        failure = new SmallrangeFailure(edge.node2, edge.node1, possibleFailureRange, set, setNarrower, setWider, this.outputDirectory, this.webpage, this.run);
                                    this.smallranges.push(failure);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    /**
     * traverses already created small range failures if already exists.
     * @param {RLGNode} node an rlg node involved.
     * @param {RLGNode} otherNode an rlg node involved.
     * @param {Range} range The failure range
     */
    isSmallRangeReported(node, otherNode, range) {
        for (let sr of this.smallranges) {
            if (sr.range.getMinimum() == range.getMinimum() && sr.range.getMaximum() == range.getMaximum() &&
                ((sr.node.xpath === node.xpath && sr.sibling.xpath === otherNode.xpath) ||
                    (sr.node.xpath === otherNode.xpath && sr.sibling.xpath === node.xpath))) {
                return true;
            }
        }
        return false;
    }
    getHumanStudyData() {
        let failures = [];
        for (let viewportProtrusion of this.viewportProtrusions) {
            let f = viewportProtrusion.getHumanStudyData();
            if (f !== undefined)
                failures.push(f);
        }

        for (let protrusion of this.elementProtrusions) {
            let f = protrusion.getHumanStudyData();
            if (f !== undefined)
                failures.push(f);
        }

        for (let collision of this.elementCollisions) {
            let f = collision.getHumanStudyData();
            if (f !== undefined)
                failures.push(f);
        }

        for (let wrapping of this.wrappings) {
            let f = wrapping.getHumanStudyData();
            if (f !== undefined)
                failures.push(f);
        }

        for (let smallrange of this.smallranges) {
            let f = smallrange.getHumanStudyData();
            if (f !== undefined)
                failures.push(f);
        }
        return failures;

    }
    printHumanStudyDataCSV(file) {
        for (let viewportProtrusion of this.viewportProtrusions)
            viewportProtrusion.printHumanStudyDataCSV(file);
        for (let protrusion of this.elementProtrusions)
            protrusion.printHumanStudyDataCSV(file);
        for (let collision of this.elementCollisions)
            collision.printHumanStudyDataCSV(file);
        for (let wrapping of this.wrappings)
            wrapping.printHumanStudyDataCSV(file);
        for (let smallrange of this.smallranges)
            smallrange.printHumanStudyDataCSV(file);
    }
    //TODO: test this function.
    /**
     * Repair each failure of this node.
     * @param {Driver} driver Browser driver.
     * @param {Path} directory output directory.
     * @param {ProgressBar} bar Bar to update progress.
     * @param {String} webpage The name of the webpage.
     * @param {Number} run The current run number. 
     */
    async repairFailures(driver, directory, bar, webpage, run) {
        let repairCSSFile = path.join(directory, "repairs.css");
        for (let viewportProtrusion of this.viewportProtrusions)
            await viewportProtrusion.repair(driver, directory, bar, webpage, run);
        for (let protrusion of this.elementProtrusions)
            await protrusion.repair(driver, directory, bar, webpage, run);
        for (let collision of this.elementCollisions)
            await collision.repair(driver, directory, bar, webpage, run);
        for (let wrapping of this.wrappings)
            await wrapping.repair(driver, directory, bar, webpage, run);
        for (let smallrange of this.smallranges)
            await smallrange.repair(driver, directory, bar, webpage, run);

        for (let viewportProtrusion of this.viewportProtrusions) {
            await viewportProtrusion.checkForLaterRepair(driver, directory, bar);
            this.viewportRepairStats.addValuesFrom(viewportProtrusion.repairStats);
            viewportProtrusion.saveRepairToFile(repairCSSFile);
        }
        for (let protrusion of this.elementProtrusions) {
            await protrusion.checkForLaterRepair(driver, directory, bar);
            this.protrusionRepairStats.addValuesFrom(protrusion.repairStats);
            protrusion.saveRepairToFile(repairCSSFile);
        }
        for (let collision of this.elementCollisions) {
            await collision.checkForLaterRepair(driver, directory, bar);
            this.collisionRepairStats.addValuesFrom(collision.repairStats);
            collision.saveRepairToFile(repairCSSFile);
        }
        for (let wrapping of this.wrappings) {
            await wrapping.checkForLaterRepair(driver, directory, bar);
            wrapping.saveRepairToFile(repairCSSFile);
        }
        for (let smallrange of this.smallranges) {
            await smallrange.checkForLaterRepair(driver, directory, bar);
            smallrange.saveRepairToFile(repairCSSFile);
        }
    }
    //TODO: test this function.
    /**
     * Classify each failure of this node.
     * @param {Driver} driver Browser driver.
     * @param {Path} classificationFile the classification output file.
     * @param {Path} snapshotDirectory the snapshot output directory.
     * @param {ProgressBar} bar Bar to update progress.
     */
    async classifyFailures(driver, classificationFile, snapshotDirectory, bar) {
        for (let viewportProtrusion of this.viewportProtrusions) {
            await viewportProtrusion.classify(driver, classificationFile, snapshotDirectory, bar);
        }
        for (let protrusion of this.elementProtrusions) {
            await protrusion.classify(driver, classificationFile, snapshotDirectory, bar);
        }
        for (let collision of this.elementCollisions) {
            await collision.classify(driver, classificationFile, snapshotDirectory, bar);
        }
        for (let wrapping of this.wrappings) {
            await wrapping.classify(driver, classificationFile, snapshotDirectory, bar);
        }
        for (let smallrange of this.smallranges) {
            await smallrange.classify(driver, classificationFile, snapshotDirectory, bar);
        }
    }
    /**
     * Returns true if an equal Failure is associated with this node.
     * @param {Failure} failure The failure match in this Node.
     */
    hasFailure(failure) {
        for (let viewportProtrusion of this.viewportProtrusions) {
            if (viewportProtrusion.equals(failure) === true)
                return true;
        }
        for (let protrusion of this.elementProtrusions) {
            if (protrusion.equals(failure) === true)
                return true;
        }
        for (let collision of this.elementCollisions) {
            if (collision.equals(failure) === true)
                return true;
        }
        for (let wrapping of this.wrappings) {
            if (wrapping.equals(failure) === true)
                return true;
        }
        for (let smallrange of this.smallranges) {
            if (smallrange.equals(failure) === true)
                return true;
        }
        return false;
    }
    /**
     * Prints the repairs attempted in CSV format.
     * @param {Path} file The file to print to.
     * @param {string} webpage The name of webpage.
     * @param {number} run The run number.
     */
    printWorkingRepairs(file, webpage, run) {
        for (let collision of this.elementCollisions) {
            collision.printWorkingRepairs(file, webpage, run);
        }
        for (let protrusion of this.elementProtrusions) {
            protrusion.printWorkingRepairs(file, webpage, run);
        }
        for (let viewportProtrusion of this.viewportProtrusions) {
            viewportProtrusion.printWorkingRepairs(file, webpage, run);
        }
        for (let wrapping of this.wrappings) {
            wrapping.printWorkingRepairs(file, webpage, run);
        }
        for (let smallrange of this.smallranges) {
            smallrange.printWorkingRepairs(file, webpage, run);
        }
    }
    //TODO: test this function.
    /**
     * Detects the failures of this RLG node.
     * @param {RLGNode} bodyNode The body RLG node.
     */
    detectFailures(bodyNode) {
        this.ranges.sortRangesDecreasing();
        if (settings.detectViewportProtrusion)
            this.detectViewportProtrusion(bodyNode);
        if (settings.detectElementCollision || settings.detectElementProtrusion)
            this.detectOverlapBasedFailures();
        if (settings.detectSmallrange)
            this.detectSmallRange();
        if (settings.detectWrapping) {
            this.detectWrapping(this.aboveMeEdges, 'above');
        }

    }
    /**
     * Entry algorithm for detecting collisions and protrusions of this node 
     * based on the overlap edges of this node.
     */
    detectOverlapBasedFailures() {
        for (let overlapEdge of this.overlapEdges) {
            for (let range of overlapEdge.ranges.list) {
                let maxViewport = range.getMaximum();
                let widerViewport = maxViewport + 1;
                let firstNodeParentAtWider = overlapEdge.node1.getParentAtViewport(widerViewport);
                let secondNodeParentAtWider = overlapEdge.node2.getParentAtViewport(widerViewport);
                let firstNodeParentAtMax = overlapEdge.node1.getParentAtViewport(maxViewport);
                let secondNodeParentAtMax = overlapEdge.node2.getParentAtViewport(maxViewport);
                if (firstNodeParentAtWider === undefined || secondNodeParentAtWider === undefined)
                    continue; //one of the elements is not contained in wider viewport.
                if (settings.detectElementProtrusion)
                    this.detectProtrusion(overlapEdge, maxViewport, firstNodeParentAtMax, firstNodeParentAtWider, secondNodeParentAtMax, secondNodeParentAtWider, range);
                if (settings.detectElementCollision)
                    this.detectCollision(firstNodeParentAtMax, firstNodeParentAtWider, secondNodeParentAtMax, secondNodeParentAtWider, overlapEdge, range);
            }
        }
    }
    /**
     * Checks at the maximum point of protrusion range is the assumed protruded parent still a container.
     * @param {RLGNode} rlgNodeContainer The element protruded and expected not to contain this node.
     * @param {Range} range The assumed protrusion range.
     */
    isOldParentStillAContainer(rlgNodeContainer, range) {
        for (let containerEdge of this.containerEdges) {
            if (containerEdge.container.xpath == rlgNodeContainer.xpath) {
                if (containerEdge.ranges.inRanges(range.getMaximum())) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Detect protrusion failures.
     * @param {OverlapEdge} overlapEdge The overlap edge in questions.
     * @param {number} maxViewport The maximum viewport of this edge.
     * @param {RLGNode} firstNodeParentAtMax The parent edge's first node at the max viewport.
     * @param {RLGNode} firstNodeParentAtWider The parent edge's first node at the wider viewport.
     * @param {RLGNode} secondNodeParentAtMax The parent of the edge's second node at max viewport.
     * @param {RLGNode} secondNodeParentAtWider The parent of the edge's second node at wider viewport.
     * @param {Range} range The current range of failure.
     */
    detectProtrusion(overlapEdge, maxViewport, firstNodeParentAtMax, firstNodeParentAtWider, secondNodeParentAtMax, secondNodeParentAtWider, range) {
        let ancestorsNode1 = overlapEdge.sibling1.getAncestorsAtViewport(maxViewport + 1);
        let ancestorsNode2 = overlapEdge.sibling2.getAncestorsAtViewport(maxViewport + 1);
        if (ancestorsNode2.includes(overlapEdge.sibling1.xpath)) {
            if (this.xpath === overlapEdge.sibling2.xpath) {
                //There must be a new parent to report protrusion (not just an overlap)
                if (secondNodeParentAtMax.xpath !== secondNodeParentAtWider.xpath) {
                    //Only report if old parent is not a container still.
                    if (!this.isOldParentStillAContainer(secondNodeParentAtWider, range)) {
                        let failure = new ProtrusionFailure(this, overlapEdge.sibling1, range, secondNodeParentAtMax, this.outputDirectory, this.webpage, this.run)
                        overlapEdge.sibling2.elementProtrusions.push(failure)
                    }

                }
            }
        }
        if (ancestorsNode1.includes(overlapEdge.sibling2.xpath)) {
            if (this.xpath === overlapEdge.sibling1.xpath) {
                //There must be a new parent to report protrusion (not just an overlap)
                if (firstNodeParentAtMax.xpath !== firstNodeParentAtWider.xpath) {
                    //Only report if old parent is not a container still.
                    if (!this.isOldParentStillAContainer(firstNodeParentAtWider, range)) {
                        let failure = new ProtrusionFailure(this, overlapEdge.sibling2, range, firstNodeParentAtMax, this.outputDirectory, this.webpage, this.run);
                        overlapEdge.sibling1.elementProtrusions.push(failure);
                    }

                }
            }
        }

    }
    /**
     * Detect collision in the passed in range.
     * @param {RLGNode} firstNodeParentAtMax The parent node at the maximum of range.
     * @param {RLGNode} firstNodeParentAtWider The parent node at immediately wider viewport of range.
     * @param {RLGNode} secondNodeParentAtMax The second-node parent-node at the maximum of range.  
     * @param {RLGNode} secondNodeParentAtWider The second-node parent-node at the immediately wider viewport of range.
     * @param {OverlapEdge} overlapEdge The overlapping edge.
     * @param {Range} range The current range of failure.
     */
    detectCollision(firstNodeParentAtMax, firstNodeParentAtWider, secondNodeParentAtMax, secondNodeParentAtWider, overlapEdge, range) {
        if (firstNodeParentAtWider.xpath === firstNodeParentAtMax.xpath
            && secondNodeParentAtWider.xpath === secondNodeParentAtMax.xpath) { //collision failure
            if (this.xpath === overlapEdge.sibling1.xpath) { //Attach failure to one node only.
                //this.addFailure(new CollisionFailure(this, overlapEdge.sibling2, firstNodeParentAtMax, range), this.elementCollisions);
                let alsoProtruding = false;
                for (let protrusion of this.elementProtrusions) {
                    if (protrusion.node.xpath === this.xpath ||
                        protrusion.node.xpath === overlapEdge.sibling2) {
                        if (protrusion.range.isContaining(range)) {
                            alsoProtruding = true;
                            break;
                        }
                    }
                }
                if (!alsoProtruding) {
                    let failure = new CollisionFailure(this, overlapEdge.sibling2, firstNodeParentAtMax, range, this.outputDirectory, this.webpage, this.run);
                    this.elementCollisions.push(failure);
                }

            }
        }
    }

    /**
     * Detect viewport protrusion of this node.
     * @param {RLGNode} bodyNode The body RLG node.
     */
    detectViewportProtrusion(bodyNode) {
        if (this.xpath === bodyNode.xpath)
            return;
        let containedRanges = new Ranges();
        for (let parentEdge of this.parentEdges) {
            for (let range of parentEdge.ranges.list)
                containedRanges.addRange(range);
        }
        if (!containedRanges.isEmpty()) {
            let nonContainedRanges = this.ranges.butNotInRanges(containedRanges);
            if (!nonContainedRanges.isEmpty()) {
                for (let range of nonContainedRanges.list) {
                    if (containedRanges.inRanges(range.getWider())) {
                        //the viewport immediately wider than the non-contained range is contained.
                        let topParent = this.getTopParentAtViewport(range.getWider());
                        if (topParent.xpath === bodyNode.xpath) {
                            let failure = new ViewportFailure(this, bodyNode, range, this.outputDirectory, this.webpage, this.run);
                            this.viewportProtrusions.push(failure);
                        }
                    }
                }
            }
            // if (!nonContainedRanges.isEmpty() && !containedRanges.isEmpty()) { //possible viewport failure.
            //     if (nonContainedRanges.getMinimum() < containedRanges.getMaximum()) { //viewport protrusion
            //         if (nonContainedRanges.getMaximum() >= containedRanges.getMaximum()) {
            //             let firstContainedRange = containedRanges.getLargestRange();
            //             let possibleVPRange = new Ranges();
            //             for (let range of nonContainedRanges.list) {
            //                 if (range.getMaximum() < firstContainedRange.getMinimum()) {
            //                     possibleVPRange.addRange(range);
            //                 }
            //             }
            //             this.viewportFailureRange = possibleVPRange;
            //         }
            //         else {
            //             this.viewportFailureRange = nonContainedRanges;
            //         }
            //         for (let range of this.viewportFailureRange.list) {
            //             let failure = new ViewportFailure(this, bodyNode, range, this.outputDirectory, this.webpage, this.run);
            //             this.viewportProtrusions.push(failure)
            //         }
            //     }
            // }
        }
    }
    /**
     * Take screenshots of the failures of each node.
     * @param {Driver} driver Browser driver.
     * @param {Path} classificationFile the classification output file.
     * @param {Path} snapshotDirectory the snapshot output directory.
     * @param {ProgressBar} bar Bar to update progress.
     */
    async screenshotFailures(driver, classificationFile, snapshotDirectory, bar) {
        for (let collision of this.elementCollisions)
            await collision.screenshotFailure(driver, classificationFile, snapshotDirectory, bar);
        for (let protrusion of this.elementProtrusions)
            await protrusion.screenshotFailure(driver, classificationFile, snapshotDirectory, bar);
        for (let smallrange of this.smallranges)
            await smallrange.screenshotFailure(driver, classificationFile, snapshotDirectory, bar);
        for (let viewportProtrusion of this.viewportProtrusions)
            await viewportProtrusion.screenshotFailure(driver, classificationFile, snapshotDirectory, bar);
    }
    //TODO: test this function.
    oldDetectFailures() {
        this.ranges.sortRangesDecreasing();
        //viewport protrusion
        let containedRanges = new Ranges();
        for (let parentEdge of this.parentEdges) {
            for (let range of parentEdge.ranges.list)
                containedRanges.addRange(range);
        }
        if (!containedRanges.isEmpty()) {
            let nonContainedRanges = this.ranges.butNotInRanges(containedRanges);
            if (!nonContainedRanges.isEmpty()) {//viewport failure.
                this.viewportFailureRange = nonContainedRanges;
            }
        }
        for (let overlapEdge of this.overlapEdges) {
            overlapEdge.protrusionFailureRanges = new Ranges();
            overlapEdge.collisionFailureRanges = new Ranges();
            let maxViewport = overlapEdge.ranges.getMaximum();
            let firstNodeParentXPathAtWider = overlapEdge.node1.getParentAtViewport(maxViewport + 1);
            let secondNodeParentXPathAtWider = overlapEdge.node2.getParentAtViewport(maxViewport + 1);
            let firstNodeParentXPathAtMax = overlapEdge.node1.getParentAtViewport(maxViewport);
            let secondNodeParentXPathAtMax = overlapEdge.node2.getParentAtViewport(maxViewport);
            if (firstNodeParentXPathAtWider === undefined || secondNodeParentXPathAtWider === undefined)
                continue; //one of the elements is not contained in wider viewport.
            if (firstNodeParentXPathAtWider === firstNodeParentXPathAtMax
                && secondNodeParentXPathAtWider === secondNodeParentXPathAtMax) {//collision failure
                overlapEdge.collisionFailure = true;
            }
            if (firstNodeParentXPathAtWider !== firstNodeParentXPathAtMax) {
                overlapEdge.siblingOneIsAProtrusion = true;
                overlapEdge.firstProtrusionParentXPath = firstNodeParentXPathAtWider;
            }
            if (secondNodeParentXPathAtWider !== secondNodeParentXPathAtMax) {
                overlapEdge.siblingTwoIsAProtrusion = true;
                overlapEdge.secondProtrusionParentXPath = secondNodeParentXPathAtWider;
            }
        }

    }

    /**
     * Prints the node information in a tree like output.
     * @param {file} file   The output file.
     * @param {boolean} printNode Print the xpath of this node?
     */
    print(file, printNode = true, printAlignment = false) {
        if (printNode)
            assist.printToFile(file, '|--[ Node: ' + this.xpath + ' ]');
        this.printRange(file);
        this.printFailures(file);
        for (let overlapEdge of this.overlapEdges) {
            assist.printToFile(file, '|  |--[ Overlap: ' + overlapEdge.getOtherNode(this.xpath) + ' ]');
            assist.printToFile(file, '|  |  |--[ Range: ' + overlapEdge.ranges.toString() + ' ]');
        }
        for (let parent of this.parentEdges) {
            assist.printToFile(file, '|  |--[ Parent: ' + parent.getParent(this.xpath).xpath + ' ]');
            assist.printToFile(file, '|  |  |--[ Range: ' + parent.ranges.toString() + ' ]');
            for (let sibling of parent.getParent().childrenEdges) {
                if (sibling.getChild().xpath !== this.xpath) {
                    assist.printToFile(file, '|  |  |--[ Sibling: ' + sibling.getChild().xpath + ' ]');
                    assist.printToFile(file, '|  |  |  |--[ Range: ' + sibling.ranges.toString() + ' ]');
                }
            }
        }
        for (let childEdge of this.childrenEdges) {
            assist.printToFile(file, '|  |--[ Child: ' + childEdge.getChild().xpath + ' ]');
            assist.printToFile(file, '|  |  |--[ Range: ' + childEdge.ranges.toString() + ' ]');
            if (printAlignment) {
                if (!childEdge.horizontallyCenterJustifiedRanges.isEmpty())
                    assist.printToFile(file, '|  |  |--[ Horizontally Center Justified: ' + childEdge.horizontallyCenterJustifiedRanges.toString() + ' ]');
                if (!childEdge.verticallyCenterJustifiedRanges.isEmpty())
                    assist.printToFile(file, '|  |  |--[ Vertically Center Justified: ' + childEdge.verticallyCenterJustifiedRanges.toString() + ' ]');
                if (!childEdge.leftJustifiedRanges.isEmpty())
                    assist.printToFile(file, '|  |  |--[ Left Justified: ' + childEdge.leftJustifiedRanges.toString() + ' ]');
                if (!childEdge.rightJustifiedRanges.isEmpty())
                    assist.printToFile(file, '|  |  |--[ Right Justified: ' + childEdge.rightJustifiedRanges.toString() + ' ]');
                if (!childEdge.topJustifiedRanges.isEmpty())
                    assist.printToFile(file, '|  |  |--[ Top Justified: ' + childEdge.topJustifiedRanges.toString() + ' ]');
                if (!childEdge.bottomJustifiedRanges.isEmpty())
                    assist.printToFile(file, '|  |  |--[ Bottom Justified: ' + childEdge.bottomJustifiedRanges.toString() + ' ]');
            }

        }


        if (printAlignment) {
            for (let aboveEdge of this.aboveMeEdges) {
                assist.printToFile(file, '|  |--[ Above Me: ' + aboveEdge.above.xpath + ' ]');
                assist.printToFile(file, '|  |  |--[ Range: ' + aboveEdge.ranges.toString() + ' ]');
            }
            for (let belowEdge of this.belowMeEdges) {
                assist.printToFile(file, '|  |--[ Below Me: ' + belowEdge.below.xpath + ' ]');
                assist.printToFile(file, '|  |  |--[ Range: ' + belowEdge.ranges.toString() + ' ]');
            }
            for (let rightEdge of this.toMyRightEdges) {
                assist.printToFile(file, '|  |--[ Right of Me: ' + rightEdge.right.xpath + ' ]');
                assist.printToFile(file, '|  |  |--[ Range: ' + rightEdge.ranges.toString() + ' ]');
            }
            for (let leftEdge of this.toMyLeftEdges) {
                assist.printToFile(file, '|  |--[ Left of Me: ' + leftEdge.left.xpath + ' ]');
                assist.printToFile(file, '|  |  |--[ Range: ' + leftEdge.ranges.toString() + ' ]');
            }
        }
    }
    /**
     * Prints the failures of the node to CSV.
     * @param {Path} file File to save to.
     * @param {String} webpage Name of webpage.
     * @param {Number} run The run number.
     * @param {String} repairApplied The repair applied  before extracting RLG.
     * @param {Number} repairAppliedTo The repair was applied to resolve the given failure-number/ID.
     */
    printFailuresCSV(file, webpage, run, repairApplied, repairAppliedTo) {
        if (this.isFailing()) {
            for (let collision of this.elementCollisions) {
                let xpaths = collision.node.xpath + ',' + collision.sibling.xpath;
                let text = webpage + "," + run + "," + collision.ID + "," + collision.type + "," + collision.range.getMinimum() + "," + collision.range.getMaximum() + "," + xpaths + "," + collision.range.narrowerClassification + "," + collision.range.minClassification + "," + collision.range.midClassification + "," + collision.range.maxClassification + "," + collision.range.widerClassification + "," + repairApplied + "," + repairAppliedTo;
                assist.printToFile(file, text);
            }
            for (let protrusion of this.elementProtrusions) {
                let xpaths = protrusion.node.xpath + ',' + protrusion.parent.xpath;
                let text = webpage + "," + run + "," + protrusion.ID + "," + protrusion.type + "," + protrusion.range.getMinimum() + "," + protrusion.range.getMaximum() + "," + xpaths + "," + protrusion.range.narrowerClassification + "," + protrusion.range.minClassification + "," + protrusion.range.midClassification + "," + protrusion.range.maxClassification + "," + protrusion.range.widerClassification + "," + repairApplied + "," + repairAppliedTo;
                assist.printToFile(file, text);
            }
            for (let viewportProtrusion of this.viewportProtrusions) {
                let xpaths = viewportProtrusion.node.xpath + ',' + viewportProtrusion.parent.xpath;
                let text = webpage + "," + run + "," + viewportProtrusion.ID + "," + viewportProtrusion.type + "," + viewportProtrusion.range.getMinimum() + "," + viewportProtrusion.range.getMaximum() + "," + xpaths + "," + viewportProtrusion.range.narrowerClassification + "," + viewportProtrusion.range.minClassification + "," + viewportProtrusion.range.midClassification + "," + viewportProtrusion.range.maxClassification + "," + viewportProtrusion.range.widerClassification + "," + repairApplied + "," + repairAppliedTo;
                assist.printToFile(file, text);
            }
            for (let smallrange of this.smallranges) {
                let xpaths = smallrange.node.xpath + ',' + smallrange.sibling.xpath;
                let text = webpage + "," + run + "," + smallrange.ID + "," + smallrange.type + "," + smallrange.range.getMinimum() + "," + smallrange.range.getMaximum() + "," + xpaths + "," + smallrange.range.narrowerClassification + "," + smallrange.range.minClassification + "," + smallrange.range.midClassification + "," + smallrange.range.maxClassification + "," + smallrange.range.widerClassification + "," + repairApplied + "," + repairAppliedTo;
                assist.printToFile(file, text);
            }
            for (let wrapping of this.wrappings) {
                let xpaths = wrapping.node.xpath + ',' + wrapping.row[0].xpath;
                let text = webpage + "," + run + "," + wrapping.ID + "," + wrapping.type + "," + wrapping.range.getMinimum() + "," + wrapping.range.getMaximum() + "," + xpaths + "," + wrapping.range.narrowerClassification + "," + wrapping.range.minClassification + "," + wrapping.range.midClassification + "," + wrapping.range.maxClassification + "," + wrapping.range.widerClassification + "," + repairApplied + "," + repairAppliedTo;
                assist.printToFile(file, text);
            }
        }
    }
    /**
     * Prints failures that were detected if any.
     * @param {Path} file File path to print to.
     * @param {boolean} printNode Print the xpath of this node?
     */
    printFailures(file, printNode = false) {
        if (this.isFailing()) {
            if (printNode) {
                assist.printToFile(file, '|--[ Node: ' + this.xpath + ' ]');
            }
            for (let viewportProtrusion of this.viewportProtrusions) {
                viewportProtrusion.printClassified(file);
            }
            for (let protrusion of this.elementProtrusions) {
                protrusion.printClassified(file);
            }
            for (let collision of this.elementCollisions) {
                collision.printClassified(file);
            }
            for (let wrapping of this.wrappings) {
                wrapping.printClassified(file);
            }
            for (let smallrange of this.smallranges) {
                smallrange.printClassified(file);
            }
        }
    }

    /**
     * Returns true if the this RLGNode has the same xpath as the other.
     * @param {RLGNode} otherNode The RLGNode to compare too.
     */
    sameAs(otherNode) {
        return this.xpath === otherNode.xpath;
    }
}
module.exports = RLGNode;