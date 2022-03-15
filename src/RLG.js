const { Range, Ranges } = require('./Ranges.js');
const RBush = require('rbush');
const assist = require('./assist.js');
const settings = require('../settings.js');
const RepairStatistics = require('./RepairStatistics.js');
const ProgressBar = require('progress');
const Rectangle = require('./Rectangle.js');



const tolerance = settings.tolerance;

class RLG {
    constructor(outputDirectory, webpage, run) {
        this.ranges = new Ranges();
        this.root = undefined;
        this.map = new Map();
        this.nodesWithFailures = [];
        this.collisionRepairStats = new RepairStatistics();
        this.protrusionRepairStats = new RepairStatistics();
        this.viewportRepairStats = new RepairStatistics();
        this.allRepairStats = new RepairStatistics();
        this.outputDirectory = outputDirectory;
        this.webpage = webpage;
        this.run = run;
    }
    /**
     * Returns the RLG Node if it exists, undefined otherwise.
     * @param {XPath} xpath The xpath of the target RLG Node.
     */
    getRLGNode(xpath) {
        return this.map.get(xpath);
    }
    /**
     * Add passed in DOM instance to the RLG.
     * @param {DOM} dom the DOM to integrate into the RLG
     * @param {number} viewport The viewport where the dom is extracted.
     */
    extractRLG(dom, viewport) {
        let rlg = this;
        let domRectangles = dom.rbush.all();
        for(let r of domRectangles){ 
            if(r.xpath === "/HTML/BODY"){
                r.maxY = Infinity;
                r.height = Infinity;
                r.bottom = Infinity;
                r.realMaxY = r.maxY;
                r.realHeight = r.height;
                r.realBottom = r.bottom;
                break;
            }
        }
        dom.rbush = new RBush();
        dom.rbush.load(domRectangles);
        //set parent
        for (let rectangle of domRectangles) {
            let rlgNode = rlg.getRLGNode(rectangle.xpath);
            if (rlgNode === undefined) {//New RLG Node needs to be created.
                rlgNode = new RLGNode(rectangle, this, this.outputDirectory, this.webpage, this.run);
                this.map.set(rlgNode.xpath, rlgNode);
            }
            rlgNode.addViewport(viewport);
            //Now just set the parent-child relationship by finding the closest container. Save to rectangle object the container.
            let intersectingRectangles = dom.rbush.search(rectangle);
            let intersectionTypes = rlg.findIntersectionTypes(intersectingRectangles, rectangle);
            //let parent = this.findTightestContainer(intersectionTypes.containers, rectangle);
            let parent = undefined;
            if (intersectionTypes.containers.length > 0) { //if there are many containers choose one.
                let candidateParents = this.findCandidateContainers(intersectionTypes.containers, rectangle);
                parent = this.findParent(candidateParents, rectangle);
            }

            if (parent !== undefined) { //if has parent.
                if (parent.children === undefined) {
                    parent.children = [];
                }
                //Prevent circular PC edges search all descendants for the new parent.
                let circular = false;
                let traversalStack = [];
                traversalStack.push(rectangle);
                while (traversalStack.length > 0) {
                    let rect = traversalStack.shift();
                    if (rect.xpath === parent.xpath) {
                        circular = true;
                        assist.log("Circular avoided.")
                        break;
                    }
                    if (rect.children !== undefined)
                        for (let child of rect.children)
                            traversalStack.push(child);
                }
                if (!circular)
                    parent.children.push(rectangle);
            }
        }
        //set overlap between siblings(between the contained nodes)
        for (let rectangle of domRectangles) {
            let parentRectangle = rectangle;
            let parentNode = rlg.getRLGNode(parentRectangle.xpath);
            let siblingsRBush = new RBush();
            if (parentRectangle.children !== undefined) {
                siblingsRBush.load(parentRectangle.children); //bulk insert all children (rectangles)
                for (let childRect of parentRectangle.children) {
                    let childNode = rlg.getRLGNode(childRect.xpath);
                    //Capture parent-child edge
                    let pcEdge = parentNode.addChild(childNode, viewport);
                    if (settings.capturePCAlignments === true)
                        this.addPCEdgeAttributes(parentRectangle, childRect, pcEdge, viewport);
                    let collisionRBush = new RBush();
                    let newTargetRect = {
                        minX: childRect.minX + tolerance.collision,
                        maxX: childRect.maxX - tolerance.collision,
                        minY: childRect.minY + tolerance.collision,
                        maxY: childRect.maxY - tolerance.collision,
                        xpath: childRect.xpath
                    }
                    collisionRBush.insert(newTargetRect);
                    for (let rect of parentRectangle.children) {
                        if (rect.xpath !== childRect.xpath)
                            collisionRBush.insert(rect);
                    }
                    let overlappingRectangles = collisionRBush.search(newTargetRect);
                    //let overlappingRectangles = siblingsRBush.search(childRect);
                    for (let overlapRect of overlappingRectangles) {
                        if (childRect.xpath === overlapRect.xpath)
                            continue;
                        let overlappingSiblingNode = rlg.getRLGNode(overlapRect.xpath);
                        //Capture overlapping edge between two siblings.
                        childNode.addOverlap(overlappingSiblingNode, viewport);
                    }
                    if (settings.captureSiblingAlignments === true) {
                        //Capture above relationship.
                        let aboveArea = this.getAreaAboveOf(parentRectangle, childRect);
                        overlappingRectangles = siblingsRBush.search(aboveArea);
                        for (let overlapRect of overlappingRectangles) {
                            if (childRect.xpath === overlapRect.xpath)
                                continue;
                            if (overlapRect.maxY - tolerance.smallrange <= aboveArea.maxY) {
                                let siblingNode = rlg.getRLGNode(overlapRect.xpath);
                                childNode.addAboveMe(siblingNode, viewport);
                            }
                        }
                        //Capture below relationship.
                        let belowArea = this.getAreaBelowOf(parentRectangle, childRect);
                        overlappingRectangles = siblingsRBush.search(belowArea);
                        for (let overlapRect of overlappingRectangles) {
                            if (childRect.xpath === overlapRect.xpath)
                                continue;
                            if (overlapRect.minY + tolerance.smallrange >= belowArea.minY) {
                                let siblingNode = rlg.getRLGNode(overlapRect.xpath);
                                childNode.addBelowMe(siblingNode, viewport);
                            }
                        }
                        //Capture to the right relationship.
                        let rightArea = this.getAreaRightOf(parentRectangle, childRect);
                        overlappingRectangles = siblingsRBush.search(rightArea);
                        for (let overlapRect of overlappingRectangles) {
                            if (childRect.xpath === overlapRect.xpath)
                                continue;
                            if (overlapRect.minX + tolerance.smallrange >= rightArea.minX) {
                                let siblingNode = rlg.getRLGNode(overlapRect.xpath);
                                childNode.addToMyRight(siblingNode, viewport);
                            }
                        }
                        //Capture to the left relationship.
                        let leftArea = this.getAreaLeftOf(parentRectangle, childRect);
                        overlappingRectangles = siblingsRBush.search(leftArea);
                        for (let overlapRect of overlappingRectangles) {
                            if (childRect.xpath === overlapRect.xpath)
                                continue;
                            if (overlapRect.maxX - tolerance.smallrange <= leftArea.maxX) {
                                let siblingNode = rlg.getRLGNode(overlapRect.xpath);
                                childNode.addToMyLeft(siblingNode, viewport);
                            }
                        }
                    }
                }
            }
        }
        domRectangles = dom.rbush.all();
        for (let rectangle of domRectangles) {
            let rlgNode = rlg.getRLGNode(rectangle.xpath);

            let intersectingRectangles = dom.rbush.search(rectangle);
            //set container edge for all containers at this viewport (To remove FP protrusion) Not PC edge
            let allContainers = rlg.findAllContainers(intersectingRectangles, rectangle)
            for (let container of allContainers) {
                let containerRLGNode = rlg.getRLGNode(container.xpath);
                rlgNode.addContainer(containerRLGNode, viewport);
            }
        }
    }
    findAllContainers(overlappingRectangles, targetRect) {
        let containers = [];
        let tol = 0;
        if (tolerance.protrusion !== undefined && tolerance.protrusion > 0)
            tol = tolerance.protrusion;
        for (let overlapRect of overlappingRectangles) {
            if (overlapRect.minX - tol <= targetRect.minX
                && overlapRect.maxX + tol >= targetRect.maxX
                && overlapRect.minY - tol <= targetRect.minY
                && overlapRect.maxY + tol >= targetRect.maxY) {
                containers.push(overlapRect);
            }
        }
        return containers;
    }
    addPCEdgeAttributes(parentRect, childRect, pcEdge, viewport) {
        if (settings.capturePCVerticalAlignments === true) {
            if (this.isVerticallyCenterJustified(parentRect, childRect))
                pcEdge.verticallyCenterJustifiedRanges.addValue(viewport);
            if (this.isTopJustified(parentRect, childRect))
                pcEdge.topJustifiedRanges.addValue(viewport);
            if (this.isBottomJustified(parentRect, childRect))
                pcEdge.bottomJustifiedRanges.addValue(viewport);
        }
        if (this.isHorizontallyCenterJustified(parentRect, childRect))
            pcEdge.horizontallyCenterJustifiedRanges.addValue(viewport);
        if (this.isLeftJustified(parentRect, childRect))
            pcEdge.leftJustifiedRanges.addValue(viewport);
        if (this.isRightJustified(parentRect, childRect))
            pcEdge.rightJustifiedRanges.addValue(viewport);
    }
    difference(otherRLG) {//TODO: test.
        let rlg = this;
        let candidateNodes = [];
        console.log('*');
        //Report missing nodes in new graph.
        let sortedMap = new Map([...this.map].sort());
        sortedMap.forEach(function (node) {
            let otherNode = otherRLG.getRLGNode(node.xpath);
            if (otherNode === undefined) {
                node.printNodeDeclaration('Missing');
                //node.print(false);
            } else {
                candidateNodes.push(node.xpath);
            }
        })
        //Report new element in the other graph.
        otherRLG.map.forEach(function (node) {
            let otherNode = rlg.getRLGNode(node.xpath);
            if (otherNode === undefined) {
                node.printNodeDeclaration('New');
            }
        })
        //Difference all other nodes (present in both graphs)
        candidateNodes.forEach(function (xpath) {
            let node = rlg.getRLGNode(xpath);
            let otherNode = otherRLG.getRLGNode(xpath);
            node.difference(otherNode);
        })

    }
    //TODO: test this function.
    detectFailures(progress = true) {
        let bar = new ProgressBar('Find RLFs     [:bar] :etas Node:           :current' + "/" + this.map.size, { incomplete: ' ', total: this.map.size, width: 25 })
        let bodyNode = this.map.get('/HTML/BODY'); //used for viewport protrusion.
        let nodesWithFailures = [];
        this.map.forEach(function (node) {
            node.detectFailures(bodyNode);
            if (node.isFailing())
                nodesWithFailures.push(node);
            if (progress)
                bar.tick();
        })
        this.nodesWithFailures = nodesWithFailures;
    }
    //TODO: test this function.
    /**
     * Repair the failure of all nodes with failures.
     * @param {Driver} driver Browser driver.
     * @param {Path} directory The output image directory.
     * @param {String} webpage The name of the webpage.
     * @param {Number} run The current run number. 
     * @returns An array [collision, protrusion, viewport, all] statistics of this webpage.
     */
    async repairFailures(driver, directory, webpage, run) {
        let bar = new ProgressBar('Repair RLFs   [:bar] :etas Repair:         :current' + "/" + (assist.failureCount * settings.repairCombination.length) + " :token1", { incomplete: ' ', total: (assist.failureCount * settings.repairCombination.length), width: 25 })
        for (const [xpath, node] of this.map.entries()) {
            await node.repairFailures(driver, directory, bar, webpage, run);
            this.viewportRepairStats.addValuesFrom(node.viewportRepairStats);
            this.protrusionRepairStats.addValuesFrom(node.protrusionRepairStats);
            this.collisionRepairStats.addValuesFrom(node.collisionRepairStats);
        }
        this.allRepairStats.addValuesFrom(this.viewportRepairStats, this.protrusionRepairStats, this.collisionRepairStats);
    }
    /**
     * Print repair statistics for this run/rlg.
     * @param {Path} file Directory where output file will be.
     */
    printRepairStats(file) {
        //console.log('Run ' + runNumber + ' repair results: ');
        this.viewportRepairStats.printRepairStats(file, 'Total ' + assist.FailureType.VIEWPORT + ' Repair Statistics:');
        this.protrusionRepairStats.printRepairStats(file, 'Total ' + assist.FailureType.PROTRUSION + ' Repair Statistics:');
        this.collisionRepairStats.printRepairStats(file, 'Total ' + assist.FailureType.COLLISION + ' Repair Statistics:');
        this.allRepairStats.printRepairStats(file, 'Total Repair Statistics:');
    }

    //TODO: test this function.
    /**
     * Classify the failure of all nodes with failures.
     * @param {Driver} driver Browser driver.
     * @param {Path} classificationFile the classification output file.
     * @param {Path} snapshotDirectory the snapshot output directory.
     */
    async classifyFailures(driver, classificationFile, snapshotDirectory) {
        //for (const [xpath, node] of this.map.entries()) {
        //}
        let bar = new ProgressBar('Classify RLFs [:bar] :etas Classification: :current/' + assist.failureCount, { incomplete: ' ', total: assist.failureCount, width: 25 })

        for (const node of this.nodesWithFailures) {
            await node.classifyFailures(driver, classificationFile, snapshotDirectory, bar);
        }
    }
    async screenshotFailures(driver, directory) {
        let bar = new ProgressBar('Snapshot RLFs [:bar] :etas Snapshot:       :current' + "/" + assist.failureCount, { incomplete: ' ', total: assist.failureCount, width: 25 })
        for (let node of this.nodesWithFailures) {
            await node.screenshotFailures(driver, directory, bar);
        }
    }
    /**
     * Prints the repairs attempted in CSV format.
     * @param {Path} file The file to print to.
     * @param {string} webpage The name of webpage.
     * @param {number} run The run number.
     */
    printWorkingRepairs(file, webpage, run) {
        for (let node of this.nodesWithFailures) {
            node.printWorkingRepairs(file, webpage, run);
        }
    }
    /**
     * Returns true if an equal Failure is in the RLG.
     * @param {Failure} failure The failure match in RLG.
     */
    hasFailure(failure) {
        for (let node of this.nodesWithFailures) {
            if (node.hasFailure(failure) === true)
                return true;
        }
        return false;
    }
    printHumanStudyDataCSV(file) {
        for (let node of this.nodesWithFailures)
            node.printHumanStudyDataCSV(file);
    }
    getHumanStudyData() {
        let failures = [];
        for (let node of this.nodesWithFailures) {
            let f = node.getHumanStudyData();
            if (f !== undefined)
                failures.push(...f);
        }
        return failures;
    }
    //TODO: test this function.
    printFailuresTXT(fileTXT) {
        let text = '*';
        assist.printToFile(fileTXT, text);
        this.map.forEach(function (node) {
            node.printFailures(fileTXT, true);
        })
        text = assist.failureCount + ' Responsive Layout Failures Found.';
        assist.printToFile(fileTXT, text);
    }
    /**
     * Prints the failures of the RLG to CSV.
     * @param {Path} file File to save to.
     * @param {String} webpage Name of webpage.
     * @param {Number} run The run number.
     * @param {String} repairApplied repair applied before before extracting RLG.
     * @param {Number} repairAppliedTo The repair was applied to resolve the given failure-number/ID.
     */
    printFailuresCSV(fileCSV, webpage, run, repairApplied = 'none', repairAppliedTo = 0) {
        if (assist.failureCount > 0) {
            let text =
                "Webpage,Run,FID,Type,RangeMin,RangeMax,XPath1,XPath2,ClassNarrower,ClassMin,ClassMid,ClassMax,ClassWider,RepairApplied,RepairAppliedTo";
            assist.printToFile(fileCSV, text);
            this.map.forEach(function (node) {
                node.printFailuresCSV(fileCSV, webpage, run, repairApplied, repairAppliedTo);
            })
        }

    }
    /**
     * Print the RLG
     * @param {Path} file Output file.
     * @param {boolean} printAlignments Output file.
     */
    printGraph(file, printAlignments = false) {
        let text = '*';
        assist.printToFile(file, text);
        this.map.forEach(function (node) {
            if (printAlignments)
                node.print(file, true, true);
            else
                node.print(file);
        });
    }
    /**
     * From a list of possible containers, it will return the tightest rectangle object
     * containing the passed in rectangle. Candidate containers are considered if within
     * tolerance value.
     * @param {[Rectangles]} containers An array of possible container rectangle objects.
     * @param {Rectangle} rectangle The contained rectangle.
     */
    findCandidateContainers(containers, rectangle) {
        //Find width and height of tightest container.
        let smallest = undefined;
        let smallestArea = undefined
        for (let container of containers) {
            if (container.xpath === rectangle.xpath) //An element cannot contain itself
                continue;
            let area = container.width * container.height;
            if (smallest === undefined || smallestArea > area) {
                smallest = container;
                smallestArea = area;
            }
        }
        //Find other containers with tolerance applied.
        let parentTolerance = tolerance.equivalentParent;
        let candidateContainers = [smallest];
        for (let container of containers) {

            if (container.xpath === smallest.xpath || container.xpath == rectangle.xpath)
                continue;

            let parentWidth = container.width - (parentTolerance * 2) //trim from both sides
            let parentHeight = container.height - (parentTolerance * 2) //trim from both sides

            let area = parentWidth * parentHeight;
            if (area <= smallestArea)
                candidateContainers.push(container);
        }
        return candidateContainers;
    }
    /**
     * Given a set of equivalent parents, heuristics are applied to determine the parent.
     * @param {[Rectangles]} containers An array of possible container rectangle objects.
     * @param {Rectangle} rectangle The contained rectangle.
     */
    findParent(containers, rectangle) {
        let ancestorWithLongestXPath = undefined;
        let descendants = [];
        let family = [];
        containers.sort(assist.compare); //More deterministic/stable.
        for (let container of containers) {
            if (rectangle.xpath.includes(container.xpath + '/')) { //container is a subxpath.
                if (ancestorWithLongestXPath === undefined)
                    ancestorWithLongestXPath = container;
                else if (ancestorWithLongestXPath.xpath.length < container.xpath.length) //longer subxpath wins.
                    ancestorWithLongestXPath = container;
            } else if (container.xpath.includes(rectangle.xpath + '/')) { //child is a subxpath of container.
                descendants.push(container)
            } else {
                family.push(container);
            }
        }
        if (ancestorWithLongestXPath !== undefined)
            return ancestorWithLongestXPath;

        let closestFamily = undefined;
        let closestFamilyScore = undefined;
        for (let container of family) { //Use the first container with closest ancestor.
            let maxLength = Math.min(container.xpath.length, rectangle.xpath.length)
            let score = 0;
            for (let i = 0; i < maxLength; i++) {
                if (container.xpath.charAt(i) !== rectangle.xpath.charAt(i))
                    break;
                score++;
            }
            if (closestFamily === undefined || closestFamilyScore < score) {
                closestFamily = container;
                closestFamilyScore = score;
            }
        }
        if (closestFamily !== undefined)
            return closestFamily;

        let shortestDescendantXPath = undefined;
        for (let container of descendants) {
            if (shortestDescendantXPath === undefined ||   //first shortest subxpath wins.
                shortestDescendantXPath.xpath.length > container.xpath.length)
                shortestDescendantXPath = container;
        }
        return shortestDescendantXPath;
    }
    /**
     * From a list of possible containers, it will return the tightest rectangle object
     * containing the passed in rectangle.
     * @param {[Rectangles]} containers An array of possible container rectangle objects.
     * @param {Rectangle} rectangle The contained rectangle.
     */
    findTightestContainer(containers, rectangle) {
        let result = {};
        result.container = undefined;
        result.space = undefined;
        for (let container of containers) {
            if (container.xpath === rectangle.xpath) {// an element cannot contain itself
                continue;
            }
            let leftSpace = rectangle.minX - container.minX;
            let rightSpace = container.maxX - rectangle.maxX;
            let topSpace = rectangle.minY - container.minY;
            let bottomSpace = container.maxY - rectangle.maxY;
            let totalSpace = leftSpace + rightSpace + topSpace + bottomSpace;
            if (result.container === undefined) {
                result.container = container;
                result.space = totalSpace;
            } else if (result.space === totalSpace) {
                if (rectangle.xpath.includes(result.container.xpath + '/')
                    && rectangle.xpath.includes(container.xpath + '/')) { //both are sub-xpaths
                    if (container.xpath.length > result.container.xpath.length) {//container.xpath is longer
                        result.container = container;
                        result.space = totalSpace;
                    }
                } else if (rectangle.xpath.includes(container.xpath + '/')) { //container is the only sub-xpath
                    result.container = container;
                    result.space = totalSpace;
                } else if (!rectangle.xpath.includes(result.container.xpath + '/')
                    && !rectangle.xpath.includes(container.xpath + '/')) { //non are sub-xpaths
                    if (container.xpath.length < result.container.xpath.length) { //smaller length xpath wins
                        result.container = container;
                        result.space = totalSpace;
                    }
                }
            } else if (totalSpace < result.space) {
                result.container = container;
                result.space = totalSpace;
            }
        }
        return result.container;
    }
    /**
     * Returns rectangle area above the child within the parent.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    getAreaAboveOf(parentRect, childRect) {//TODO: test.
        return {
            minX: parentRect.minX,
            maxX: parentRect.maxX,
            minY: parentRect.minY,
            maxY: childRect.minY
        };
    }
    /**
     * Returns rectangle area below the child within the parent.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    getAreaBelowOf(parentRect, childRect) {//TODO: test.
        return {
            minX: parentRect.minX,
            maxX: parentRect.maxX,
            minY: childRect.maxY,
            maxY: parentRect.maxY
        };
    }
    /**
     * Returns rectangle area right of the child within the parent.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    getAreaRightOf(parentRect, childRect) {//TODO: test.
        return {
            minX: childRect.maxX,
            maxX: parentRect.maxX,
            minY: parentRect.minY,
            maxY: parentRect.maxY
        };
    }
    /**
     * Returns rectangle area left of the child within the parent.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    getAreaLeftOf(parentRect, childRect) {//TODO: test.
        return {
            minX: parentRect.minX,
            maxX: childRect.minX,
            minY: parentRect.minY,
            maxY: parentRect.maxY
        };
    }
    /**
     * Returns true if the child is top justified.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    isTopJustified(parentRect, childRect) {
        return (parentRect.minY === childRect.minY);
    }
    /**
     * Returns true if the child is bottom justified.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    isBottomJustified(parentRect, childRect) {
        return (parentRect.maxY === childRect.maxY);
    }
    /**
     * Returns true if the child is left justified.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    isLeftJustified(parentRect, childRect) {
        return (parentRect.minX === childRect.minX);
    }
    /**
     * Returns true if the child is right justified.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    isRightJustified(parentRect, childRect) {
        return (parentRect.maxX === childRect.maxX);
    }
    /**
    * Returns true if the child is horizontally center justified.
    * @param {Rectangle} parentRect Parent/container rectangle.
    * @param {Rectangle} childRect Child/contained rectangle. 
    */
    isHorizontallyCenterJustified(parentRect, childRect) {
        return (childRect.minX - parentRect.minX === parentRect.maxX - childRect.maxX);
    }
    /**
     * Returns true if the child is vertically center justified.
     * @param {Rectangle} parentRect Parent/container rectangle.
     * @param {Rectangle} childRect Child/contained rectangle. 
     */
    isVerticallyCenterJustified(parentRect, childRect) {
        return (childRect.minY - parentRect.minY === parentRect.maxY - childRect.maxY);
    }
    /**
     * Does the first parameter rectangle contain the second parameter rectangle.
     * @param {Rectangle} rectangle The rectangle in to check if it contains otherRectangle.
     * @param {*} otherRectangle The rectangle that is to be checked if it is contained.
     */
    isContained(rectangle, otherRectangle) {
        if (otherRectangle.xpath === "/HTML/BODY") //no one contains the body element
            return false;
        let tol = 0;
        if (tolerance.protrusion !== undefined && tolerance.protrusion > 0)
            tol = tolerance.protrusion;
        if (rectangle.xpath === "/HTML/BODY") { //ignore bottom area
            if (rectangle.minX - tol <= otherRectangle.minX
                && rectangle.maxX + tol >= otherRectangle.maxX
                && rectangle.minY - tol <= otherRectangle.minY)
                return true;
        } else {
            if (rectangle.minX - tol <= otherRectangle.minX
                && rectangle.maxX + tol >= otherRectangle.maxX
                && rectangle.minY - tol <= otherRectangle.minY
                && rectangle.maxY + tol >= otherRectangle.maxY)
                return true;
        }

        return false;
    }
    /**
     * Check if the otherRectangle passed in the parameter is within tolerance area of 
     * rectangle. Returning true if the sides of the passed in otherRectangle are in the 
     * area between rectangle-tolerance and rectangle+tolerance. This function should be
     * used with protrusion tolerance to identify rectangles in the gray area.
     * @param {Rectangle} rectangle A rectangle to that will use the tolerance.
     * @param {Rectangle} otherRectangle A rectangle to inspect against that will not use tolerance.
     */
    isWithinProtrusionTolerance(rectangle, otherRectangle) {
        let tol = 0;
        if (tolerance.protrusion != undefined && tolerance.protrusion > 0)
            tol = tolerance.protrusion;
        if (rectangle.xpath === "/HTML/BODY") { //ignore bottom area
            if ((rectangle.minX - tol) <= otherRectangle.minX && (rectangle.minX + tol) >= otherRectangle.minX &&
                (rectangle.maxX - tol) <= otherRectangle.maxX && (rectangle.maxX + tol) >= otherRectangle.maxX &&
                (rectangle.minY - tol) <= otherRectangle.minY && (rectangle.minY + tol) >= otherRectangle.minY)
                return true;
        } else {
            if ((rectangle.minX - tol) <= otherRectangle.minX && (rectangle.minX + tol) >= otherRectangle.minX &&
                (rectangle.maxX - tol) <= otherRectangle.maxX && (rectangle.maxX + tol) >= otherRectangle.maxX &&
                (rectangle.minY - tol) <= otherRectangle.minY && (rectangle.minY + tol) >= otherRectangle.minY &&
                (rectangle.maxY - tol) <= otherRectangle.maxY && (rectangle.maxY + tol) >= otherRectangle.maxY)
                return true;
        }

        return false;
    }
    /**
     * Returns an object with 3 rectangle arrays obj.containers =[], obj.contained =[],
     * obj.others =[].
     * @param {[Rectangle]} rectangles Array of rectangle object used by RBush library.
     * @param {Rectangle} targetRect The rectangle to find intersection relationships for.
     */
    findIntersectionTypes(rectangles, targetRect) {
        let tol = 0;
        if (tolerance.protrusion !== undefined && tolerance.protrusion > 0)
            tol = tolerance.protrusion;
        let result = {};
        result.containers = [];
        result.contained = [];
        result.others = [];
        let domNodeIsInList = false;
        for (let intersectingRect of rectangles) {
            if (intersectingRect.xpath !== targetRect.xpath) { //Do not compare the same node to itself.
                if (this.isWithinProtrusionTolerance(targetRect, intersectingRect)) {
                    if (targetRect.xpath.includes(intersectingRect.xpath + '/')) {//rect.xpath is a sub-path of domNode.xpath
                        result.containers.push(intersectingRect);
                    } else if (intersectingRect.xpath.includes(targetRect.xpath + '/')) {
                        result.contained.push(intersectingRect);
                    } else if (targetRect.xpath.length < intersectingRect.xpath.length) {
                        result.contained.push(intersectingRect);
                    } else if (targetRect.xpath.length > intersectingRect.xpath.length) {
                        result.containers.push(intersectingRect);
                    } else {
                        let sortedByXpath = [targetRect.xpath, intersectingRect.xpath].sort();
                        if (sortedByXpath[0] === intersectingRect.xpath) {
                            result.containers.push(intersectingRect);
                        } else {
                            result.contained.push(intersectingRect);
                        }
                        //result.others.push(intersectingRect);
                        // console.log("WARNING: Edge case condition reached.");
                    }
                } else if (this.isContained(intersectingRect, targetRect)) {//rect is a container
                    result.containers.push(intersectingRect);
                } else if (this.isContained(targetRect, intersectingRect)) {//rect is contained
                    result.contained.push(intersectingRect);
                } else {
                    result.others.push(intersectingRect);
                }
            } else {
                domNodeIsInList = true;
            }
        }
        if (!domNodeIsInList) {
            throw "Error: The list of rectangles does not have the DOMNode as part of it";
        }
        return result;
    }

}
module.exports = RLG;
const RLGNode = require('./RLGNode.js');
