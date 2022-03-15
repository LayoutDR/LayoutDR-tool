const assert = require('chai').assert;
const chai = require('chai');
const chaiFiles = require('chai-files');
const path = require('path');
const driver = require('../src/Driver.js');
const assist = require('../src/assist.js');
const DOM = require('../src/DOM.js');
const RLG = require('../src/RLG.js');
const RLGNode = require('../src/RLGNode.js');
const RLGEdge = require('../src/RLGEdge.js');
const RBush = require('rbush');
const { Range, Ranges } = require('../src/Ranges.js');
const ProtrusionFailure = require('../src/ProtrusionFailure.js');
const CollisionFailure = require('../src/CollisionFailure.js');
const ViewportFailure = require('../src/ViewportFailure.js');

let settings = require('../settings.js')
const fs = require('fs');
const Rectangle = require('../src/Rectangle.js');


const testingSettings = {
    testingHeight: 1000,
    logXPaths: [],
    logViewports: [],
    excludeElementsWithDisplayValue: [], //excluded from the RLG
    logValuesDuringScreenCapture: false,
    repairStrategy: 2,
    capturePCAlignments: true, //top right left bottom aligned, center justified vertical and horizontal
    capturePCVerticalAlignments: true, //top aligned, bottom aligned, vertically center justified.
    captureSiblingAlignments: true, //above, below, right, left
    smallrangeThreshold: 5,
    tolerance: { collision: 2, equivalentParent: 1, protrusion: 1, ignoreFractions: false }, //Collision allows 1px border over === 1.
    detectElementCollision: true,
    detectElementProtrusion: true,
    detectViewportProtrusion: true,
    detectSmallrange: true,
    detectWrapping: true
};
//copy testing settings into global settings
for (let key in testingSettings) {
    if (settings[key] !== undefined) {
        settings[key] = testingSettings[key];
    }
}
const tolerance = settings.tolerance;
assist.settings = settings;




chai.use(chaiFiles);
describe('Testing RLGNode', function () {
    it('get selector from xpath - empty xpath', function () {
        let node = new RLGNode({ minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '' })
        chai.expect(node.getSelector()).to.be.undefined;
    });
    it('get selector from xpath - undefined xpath', function () {
        let node = new RLGNode({ minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '' })
        node.xpath = undefined;
        chai.expect(node.getSelector()).to.be.undefined;
    });
    it('get selector from xpath - short xpath', function () {
        let node = new RLGNode({ minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' })
        chai.expect(node.getSelector()).to.equal("html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2)")
    });
    it('get selector from xpath - longer xpath', function () {
        let node = new RLGNode({ minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]/SPAN[5]/DIV' })
        chai.expect(node.getSelector()).to.equal("html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > span:nth-of-type(5) > div:nth-of-type(1)")
    });
    it('get selector from xpath - short svg xpath', function () {
        let node = new RLGNode({ minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/' + assist.svg.prefix + 'DIV[2]' + assist.svg.postfix })
        chai.expect(node.getSelector()).to.equal("html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2)")
    });
    it('get selector from xpath - longer svg xpath', function () {
        let node = new RLGNode({ minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/' + assist.svg.prefix + 'DIV' + assist.svg.postfix + '/SPAN[5]/DIV' })
        chai.expect(node.getSelector()).to.equal("html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > span:nth-of-type(5) > div:nth-of-type(1)")
    });
});
describe('Testing assist functionality', function () {
    it('Overlap function - equal rectangles', function () {
        let rect1 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - right border', function () {
        let rect1 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 10, maxX: 20, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - bottom border', function () {
        let rect1 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 0, maxX: 10, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - contain', function () {
        let rect1 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 1, maxX: 9, minY: 1, maxY: 9, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - contain reverse', function () {
        let rect1 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 1, maxX: 9, minY: 1, maxY: 9, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect2, rect1)).to.be.true;
    });
    it('Overlap function - corner touch bottom right', function () {
        let rect1 = { minX: 10, maxX: 20, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 20, maxX: 30, minY: 20, maxY: 30, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - corner touch top right', function () {
        let rect1 = { minX: 10, maxX: 20, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 20, maxX: 30, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - corner touch top left', function () {
        let rect1 = { minX: 10, maxX: 20, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - corner touch bottom left', function () {
        let rect1 = { minX: 10, maxX: 20, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 0, maxX: 10, minY: 20, maxY: 30, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - cross each other', function () {
        let rect1 = { minX: 0, maxX: 10, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 2, maxX: 8, minY: 8, maxY: 22, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Overlap function - cross each other alternative', function () {
        let rect1 = { minX: 0, maxX: 10, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: -2, maxX: 12, minY: 12, maxY: 18, xpath: '/HTML/BODY/DIV[3]' };
        chai.expect(assist.areOverlapping(rect1, rect2)).to.be.true;
    });
    it('Sorting by xpath - siblings', function () {
        let rect1 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let rect2 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[3]' };
        let rect3 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[1]' };
        let rect4 = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[4]' };
        actual = [rect1, rect2, rect3, rect4];
        expected = [rect3, rect1, rect2, rect4];
        actual.sort(assist.compare);
        chai.expect(actual).to.have.ordered.members(expected);
    });
});
describe('Testing repairing functionality', function () {
    it('Protrusion calculation - no protrusion - partially equal to parent', function () {
        let parentRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 20, minY: 0, maxY: 20, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([0, 0, 0, 0]);
    });
    it('Protrusion calculation - no protrusion - equal to parent', function () {
        let parentRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([0, 0, 0, 0]);
    });
    it('Protrusion calculation - no protrusion - protruding left', function () {
        let parentRect = { minX: 1, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([1, 0, 0, 0]);
    });
    it('Protrusion calculation - no protrusion - protruding left negative', function () {
        let parentRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: -1, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([1, 0, 0, 0]);
    });
    it('Protrusion calculation - no protrusion - protruding right', function () {
        let parentRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 101, minY: 0, maxY: 100, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([0, 1, 0, 0]);
    });
    it('Protrusion calculation - no protrusion - protruding top', function () {
        let parentRect = { minX: 0, maxX: 100, minY: 1, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([0, 0, 1, 0]);
    });
    it('Protrusion calculation - no protrusion - protruding top negative', function () {
        let parentRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 100, minY: -1, maxY: 100, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([0, 0, 1, 0]);
    });
    it('Protrusion calculation - no protrusion - protruding bottom', function () {
        let parentRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 100, minY: 0, maxY: 101, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([0, 0, 0, 1]);
    });
    it('Protrusion calculation - no protrusion - protruding all sides', function () {
        let parentRect = { minX: 1, maxX: 99, minY: 1, maxY: 99, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY/DIV' };
        let protrusionFailure = new ProtrusionFailure();
        let result = protrusionFailure.calculateProtrusion(parentRect, childRect);
        chai.expect([result.left, result.right, result.top, result.bottom]).to.eql([1, 1, 1, 1]);
    });
    it('Collision calculation - no overlap', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let siblingRect = { minX: 11, maxX: 21, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV', '/HTML/BODY/DIV[2]', 0, 0]);
    });
    it('Collision calculation - border overlap x-axis', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let siblingRect = { minX: 10, maxX: 21, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV', '/HTML/BODY/DIV[2]', 1, 11]);
    });
    it('Collision calculation - border overlap x-axis - flipped', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let siblingRect = { minX: 10, maxX: 21, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV[2]', '/HTML/BODY/DIV', 1, 11]);
    });
    it('Collision calculation - overlap x-axis 6 pixels', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let siblingRect = { minX: 5, maxX: 21, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV', '/HTML/BODY/DIV[2]', 6, 11]);
    });
    it('Collision calculation - border overlap y-axis', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let siblingRect = { minX: 0, maxX: 10, minY: 10, maxY: 21, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV', '/HTML/BODY/DIV[2]', 11, 1]);
    });
    it('Collision calculation - overlap y-axis 6 pixels', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let siblingRect = { minX: 0, maxX: 10, minY: 5, maxY: 21, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV', '/HTML/BODY/DIV[2]', 11, 6]);
    });
    it('Collision calculation - overlap same coordinates', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let siblingRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV', '/HTML/BODY/DIV[2]', 11, 11]);
    });
    it('Collision calculation - overlap same coordinates - numbered DIVs', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[3]' };
        let siblingRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV[2]', '/HTML/BODY/DIV[3]', 11, 11]);
    });
    it('Collision calculation - overlap halfway x and y', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let siblingRect = { minX: 5, maxX: 10, minY: 5, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV', '/HTML/BODY/DIV[2]', 6, 6]);
    });
    it('Collision calculation - overlap halfway x and y bigger', function () {
        let nodeRect = { minX: 0, maxX: 10, minY: 1, maxY: 9, xpath: '/HTML/BODY/DIV' };
        let siblingRect = { minX: 5, maxX: 15, minY: 0, maxY: 11, xpath: '/HTML/BODY/DIV[2]' };
        let collisionFailure = new CollisionFailure();
        let result = collisionFailure.calculateOverlap(nodeRect, siblingRect);
        chai.expect([result.otherNodeRect.xpath, result.nodeRectToBeCleared.xpath, result.xToClear, result.yToClear]).to.eql(['/HTML/BODY/DIV', '/HTML/BODY/DIV[2]', 6, 10]);
    });
});
describe('Printing RLG diff - NOT A TEST', function () {
    it('difference', function () {
        let viewport = 800;
        let parentRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRect = { minX: 0, maxX: 20, minY: 0, maxY: 20, xpath: '/HTML/BODY/DIV' };
        let overlapRect = { minX: 10, maxX: 24, minY: 1, maxY: 20, xpath: '/HTML/BODY/DIV[changeOverlap]' };
        let nonOverlapRect = { minX: 21, maxX: 24, minY: 1, maxY: 20, xpath: '/HTML/BODY/DIV[changeOverlap]' };
        let missingChildRect = { minX: 25, maxX: 40, minY: 0, maxY: 20, xpath: '/HTML/BODY/DIV[missing]' };
        let newChildRect = { minX: 0, maxX: 100, minY: 80, maxY: 100, xpath: '/HTML/BODY/DIV' };
        let rlg = new RLG();
        let otherRLG = new RLG();
        let dom = new DOM(driver);
        let otherDom = new DOM(driver);
        dom.rbush.load([Object.assign({}, parentRect), Object.assign({}, childRect), overlapRect, missingChildRect]);
        otherDom.rbush.load([Object.assign({}, parentRect), Object.assign({}, newChildRect), Object.assign({}, overlapRect), Object.assign({}, missingChildRect)]);

        //otherDom.rbush.load([Object.assign({}, parentRect), Object.assign({}, childRect),nonOverlapRect,newChildRect]);
        rlg.extractRLG(dom, viewport);
        otherRLG.extractRLG(otherDom, viewport);
        //rlg.difference(otherRLG);
    });
});
describe('Testing RLG parent child positions', function () {
    it('Left/Top to Right/Bottom alignment - switch alignment', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureRanges = new Ranges();
        let parentRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRectOrig = { minX: 0, maxX: 20, minY: 0, maxY: 20, xpath: '/HTML/BODY/DIV' };
        for (let viewport = 1000; viewport >= 900; viewport--) {
            let parentRect = Object.assign({}, parentRectOrig);
            let childRect = Object.assign({}, childRectOrig);
            let dom = new DOM(driver);
            if (viewport === 950) { //Change in alignment
                let childRectErr = { minX: 80, maxX: 100, minY: 80, maxY: 100, xpath: '/HTML/BODY/DIV' };
                dom.rbush.load([parentRect, childRectErr]);
                failureRanges.addValue(viewport);
            } else {
                dom.rbush.load([parentRect, childRect]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        let actual = [rlg.getRLGNode(parentRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].child.xpath,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].leftJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].rightJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].topJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].bottomJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].horizontallyCenterJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].verticallyCenterJustifiedRanges];
        let oracle = [1,
            childRectOrig.xpath,
            testingRanges,
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]).sortRangesDecreasing(),
            failureRanges,
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]).sortRangesDecreasing(),
            failureRanges,
            new Ranges(),
            new Ranges()
        ];
        chai.expect(actual).to.eql(oracle);
    });
    it('Horizontal and Vertical center alignment - switch to no alignments', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureRanges = new Ranges();
        let parentRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let childRectOrig = { minX: 20, maxX: 80, minY: 20, maxY: 80, xpath: '/HTML/BODY/DIV' };
        for (let viewport = 1000; viewport >= 900; viewport--) {
            let parentRect = Object.assign({}, parentRectOrig);
            let childRect = Object.assign({}, childRectOrig);
            let dom = new DOM(driver);
            if (viewport === 950) { //Change in alignment
                let childRectErr = { minX: 21, maxX: 80, minY: 21, maxY: 80, xpath: '/HTML/BODY/DIV' };
                dom.rbush.load([parentRect, childRectErr]);
                failureRanges.addValue(viewport);
            } else {
                dom.rbush.load([parentRect, childRect]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        let actual = [rlg.getRLGNode(parentRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].child.xpath,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].leftJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].rightJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].topJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].bottomJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].horizontallyCenterJustifiedRanges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].verticallyCenterJustifiedRanges];
        let oracle = [1,
            childRectOrig.xpath,
            testingRanges,
            new Ranges(),
            new Ranges(),
            new Ranges(),
            new Ranges(),
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]).sortRangesDecreasing(),
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]).sortRangesDecreasing()
        ];
        chai.expect(actual).to.eql(oracle);
    });
});
describe('Testing RLG sibling positions', function () {
    it('Above Below siblings - switch positions', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureRanges = new Ranges();
        let parentRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let siblingRect1Orig = { minX: 10, maxX: 20, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV' };
        let siblingRect2Orig = { minX: 10, maxX: 20, minY: 30, maxY: 40, xpath: '/HTML/BODY/DIV[2]' };
        for (let viewport = 1000; viewport >= 900; viewport--) {
            let parentRect = Object.assign({}, parentRectOrig);
            let siblingRect1 = Object.assign({}, siblingRect1Orig);
            let siblingRect2 = Object.assign({}, siblingRect2Orig);
            let dom = new DOM(driver);
            if (viewport === 950) { //Change in alignment
                let siblingErrRect1 = { minX: 10, maxX: 20, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
                let siblingErrRect2 = { minX: 10, maxX: 20, minY: 30, maxY: 40, xpath: '/HTML/BODY/DIV' };
                dom.rbush.load([parentRect, siblingErrRect1, siblingErrRect2]);
                failureRanges.addValue(viewport);
            } else {
                dom.rbush.load([parentRect, siblingRect1, siblingRect2]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        let actual = [rlg.getRLGNode(parentRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[1].node2.xpath,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[1].ranges,
        rlg.getRLGNode(parentRectOrig.xpath).overlapEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).aboveMeEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).belowMeEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).toMyRightEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).toMyLeftEdges.length,

        rlg.getRLGNode(siblingRect1Orig.xpath).childrenEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).overlapEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).toMyLeftEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).toMyRightEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).belowMeEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).belowMeEdges[0].below.xpath,
        rlg.getRLGNode(siblingRect1Orig.xpath).belowMeEdges[0].ranges,
        rlg.getRLGNode(siblingRect1Orig.xpath).aboveMeEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).aboveMeEdges[0].above.xpath,
        rlg.getRLGNode(siblingRect1Orig.xpath).aboveMeEdges[0].ranges,

        rlg.getRLGNode(siblingRect2Orig.xpath).childrenEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).overlapEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).toMyLeftEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).toMyRightEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).belowMeEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).belowMeEdges[0].below.xpath,
        rlg.getRLGNode(siblingRect2Orig.xpath).belowMeEdges[0].ranges,
        rlg.getRLGNode(siblingRect2Orig.xpath).aboveMeEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).aboveMeEdges[0].above.xpath,
        rlg.getRLGNode(siblingRect2Orig.xpath).aboveMeEdges[0].ranges];

        let oracle = [2,
            siblingRect1Orig.xpath,
            testingRanges,
            siblingRect2Orig.xpath,
            testingRanges,
            0,
            0,
            0,
            0,
            0,

            0,
            0,
            0,
            0,
            1,
            siblingRect2Orig.xpath,
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]).sortRangesDecreasing(),
            1,
            siblingRect2Orig.xpath,
            failureRanges,

            0,
            0,
            0,
            0,
            1,
            siblingRect1Orig.xpath,
            failureRanges,
            1,
            siblingRect1Orig.xpath,
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]).sortRangesDecreasing()];
        chai.expect(actual).to.eql(oracle);
    });
    it('Left Right siblings - switch positions', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureRanges = new Ranges();
        let parentRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let siblingRect1Orig = { minX: 10, maxX: 20, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV' };
        let siblingRect2Orig = { minX: 30, maxX: 40, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
        for (let viewport = 1000; viewport >= 900; viewport--) {
            let parentRect = Object.assign({}, parentRectOrig);
            let siblingRect1 = Object.assign({}, siblingRect1Orig);
            let siblingRect2 = Object.assign({}, siblingRect2Orig);
            let dom = new DOM(driver);
            if (viewport === 950) { //Change in alignment
                let siblingErrRect1 = { minX: 10, maxX: 20, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV[2]' };
                let siblingErrRect2 = { minX: 30, maxX: 40, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV' };
                dom.rbush.load([parentRect, siblingErrRect1, siblingErrRect2]);
                failureRanges.addValue(viewport);
            } else {
                dom.rbush.load([parentRect, siblingRect1, siblingRect2]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        let actual = [rlg.getRLGNode(parentRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[1].node2.xpath,
        rlg.getRLGNode(parentRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(parentRectOrig.xpath).overlapEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).aboveMeEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).belowMeEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).toMyRightEdges.length,
        rlg.getRLGNode(parentRectOrig.xpath).toMyLeftEdges.length,

        rlg.getRLGNode(siblingRect1Orig.xpath).childrenEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).overlapEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).aboveMeEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).belowMeEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).toMyRightEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).toMyRightEdges[0].right.xpath,
        rlg.getRLGNode(siblingRect1Orig.xpath).toMyRightEdges[0].ranges,
        rlg.getRLGNode(siblingRect1Orig.xpath).toMyLeftEdges.length,
        rlg.getRLGNode(siblingRect1Orig.xpath).toMyLeftEdges[0].left.xpath,
        rlg.getRLGNode(siblingRect1Orig.xpath).toMyLeftEdges[0].ranges,

        rlg.getRLGNode(siblingRect2Orig.xpath).childrenEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).overlapEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).aboveMeEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).belowMeEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).toMyRightEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).toMyRightEdges[0].right.xpath,
        rlg.getRLGNode(siblingRect2Orig.xpath).toMyRightEdges[0].ranges,
        rlg.getRLGNode(siblingRect2Orig.xpath).toMyLeftEdges.length,
        rlg.getRLGNode(siblingRect2Orig.xpath).toMyLeftEdges[0].left.xpath,
        rlg.getRLGNode(siblingRect2Orig.xpath).toMyLeftEdges[0].ranges];

        let oracle = [2,
            siblingRect1Orig.xpath,
            testingRanges,
            siblingRect2Orig.xpath,
            testingRanges,
            0,
            0,
            0,
            0,
            0,

            0,
            0,
            0,
            0,
            1,
            siblingRect2Orig.xpath,
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]).sortRangesDecreasing(),
            1,
            siblingRect2Orig.xpath,
            failureRanges,

            0,
            0,
            0,
            0,
            1,
            siblingRect1Orig.xpath,
            failureRanges,
            1,
            siblingRect1Orig.xpath,
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]).sortRangesDecreasing()];
        chai.expect(actual).to.eql(oracle);
    });
});
describe('Testing RLG extractions', function () {
    let bodyRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
    let divRectOrig = { minX: 0, maxX: 90, minY: 0, maxY: 90, xpath: '/HTML/BODY/DIV' };
    let divDivRectOrig = { minX: 10, maxX: 40, minY: 10, maxY: 80, xpath: '/HTML/BODY/DIV/DIV' };
    let siblingRectOrig = { minX: 50, maxX: 80, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV[2]' };
    let rectangles = [bodyRectOrig, divRectOrig, divDivRectOrig, siblingRectOrig];
    //set width and height of rectangles.
    for (let r of rectangles) {
        r.width = r.maxX - r.minX;
        r.height = r.maxY - r.minY;
    }
    it('Wrapping - element from way above wraps below', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureViewport = 800;
        let failureRanges = new Range(800, 800);
        let bodyRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let parentRectOrig = { minX: 1, maxX: 99, minY: 1, maxY: 99, xpath: '/HTML/BODY/DIV' };
        let firstRectOrig = { minX: 2, maxX: 12, minY: 12, maxY: 20, xpath: '/HTML/BODY/DIV/DIV' };
        let secondRectOrig = { minX: 12, maxX: 22, minY: 12, maxY: 20, xpath: '/HTML/BODY/DIV/DIV[2]' };
        let thirdRectOrig = { minX: 22, maxX: 32, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV[3]' };

        for (let viewport = 900; viewport >= 700; viewport--) {
            let dom = new DOM(driver);
            if (viewport === failureViewport) {
                let wrappedRectOrig = { minX: 2, maxX: 12, minY: 22, maxY: 30, xpath: '/HTML/BODY/DIV/DIV[3]' };
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, firstRectOrig),
                Object.assign({}, secondRectOrig),
                Object.assign({}, wrappedRectOrig),
                ]);
            }
            else {
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, firstRectOrig),
                Object.assign({}, secondRectOrig),
                Object.assign({}, thirdRectOrig),
                ]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        rlg.detectFailures();
        let node = rlg.map.get('/HTML/BODY/DIV/DIV[3]');
        chai.expect(node.wrappings.length).to.equal(0);
    })
    it('Wrapping - element wrap bellow and insufficient number of row elements', function () {

        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureViewport = 800;
        let failureRanges = new Range(800, 800);
        let bodyRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let parentRectOrig = { minX: 1, maxX: 99, minY: 1, maxY: 99, xpath: '/HTML/BODY/DIV' };
        let firstRectOrig = { minX: 2, maxX: 12, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV' };
        let secondRectOrig = { minX: 12, maxX: 22, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV[2]' };
        let thirdRectOrig = { minX: 22, maxX: 32, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV[3]' };

        for (let viewport = 900; viewport >= 700; viewport--) {
            let dom = new DOM(driver);
            if (viewport === failureViewport) {
                let wrappedRectOrig = { minX: 2, maxX: 12, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV/DIV[3]' };
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, firstRectOrig),
                Object.assign({}, wrappedRectOrig),
                ]);
            }
            else {
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, firstRectOrig),
                Object.assign({}, thirdRectOrig),
                ]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        rlg.detectFailures();
        let node = rlg.map.get('/HTML/BODY/DIV/DIV[3]');
        let nonFailureNode1 = rlg.map.get('/HTML/BODY/DIV/DIV');

        let rowXPaths = []


        chai.expect(node.wrappings.length).to.equal(0) &&
            chai.expect(nonFailureNode1.wrappings.length).to.equal(0);
    })
    // it('Wrapping - element wraps up', function () {
    //     let rlg = new RLG();
    //     let testingRanges = new Ranges();
    //     let failureViewport = 800;
    //     let failureRanges = new Range(800, 800);
    //     let bodyRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
    //     let parentRectOrig = { minX: 1, maxX: 99, minY: 1, maxY: 99, xpath: '/HTML/BODY/DIV' };
    //     let firstRectOrig = { minX: 2, maxX: 12, minY: 22, maxY: 32, xpath: '/HTML/BODY/DIV/DIV' };
    //     let secondRectOrig = { minX: 12, maxX: 22, minY: 22, maxY: 32, xpath: '/HTML/BODY/DIV/DIV[2]' };
    //     let thirdRectOrig = { minX: 22, maxX: 32, minY: 22, maxY: 32, xpath: '/HTML/BODY/DIV/DIV[3]' };

    //     for (let viewport = 900; viewport >= 700; viewport--) {
    //         let dom = new DOM(driver);
    //         if (viewport === failureViewport) {
    //             let wrappedRectOrig = { minX: 22, maxX: 32, minY: 12, maxY: 22, xpath: '/HTML/BODY/DIV/DIV[3]' };
    //             dom.rbush.load([Object.assign({}, bodyRectOrig),
    //             Object.assign({}, parentRectOrig),
    //             Object.assign({}, firstRectOrig),
    //             Object.assign({}, secondRectOrig),
    //             Object.assign({}, wrappedRectOrig),
    //             ]);
    //         }
    //         else {
    //             dom.rbush.load([Object.assign({}, bodyRectOrig),
    //             Object.assign({}, parentRectOrig),
    //             Object.assign({}, firstRectOrig),
    //             Object.assign({}, secondRectOrig),
    //             Object.assign({}, thirdRectOrig),
    //             ]);
    //         }
    //         testingRanges.addValue(viewport);
    //         rlg.extractRLG(dom, viewport);
    //     }
    //     rlg.detectFailures();
    //     let node = rlg.map.get('/HTML/BODY/DIV/DIV[3]');
    //     let nonFailureNode1 = rlg.map.get('/HTML/BODY/DIV/DIV');
    //     let nonFailureNode2 = rlg.map.get('/HTML/BODY/DIV/DIV[2]');

    //     let rowXPaths = []
    //     for (let rowNode of node.wrappings[0].row)
    //         rowXPaths.push(rowNode.xpath);
    //     chai.expect(node.wrappings[0].range.equals(failureRanges)).to.be.true &&
    //         chai.expect(rowXPaths.includes('/HTML/BODY/DIV/DIV')).to.be.true &&
    //         chai.expect(rowXPaths.includes('/HTML/BODY/DIV/DIV[2]')).to.be.true &&
    //         chai.expect(rowXPaths.length).to.equal(2) &&
    //         chai.expect(nonFailureNode1.wrappings.length).to.equal(0) &&
    //         chai.expect(nonFailureNode2.wrappings.length).to.equal(0);
    // })
    it('Wrapping - element wrap bellow', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureViewport = 800;
        let failureRanges = new Range(800, 800);
        let bodyRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let parentRectOrig = { minX: 1, maxX: 99, minY: 1, maxY: 99, xpath: '/HTML/BODY/DIV' };
        let firstRectOrig = { minX: 2, maxX: 12, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV' };
        let secondRectOrig = { minX: 12, maxX: 22, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV[2]' };
        let thirdRectOrig = { minX: 22, maxX: 32, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV[3]' };

        for (let viewport = 900; viewport >= 700; viewport--) {
            let dom = new DOM(driver);
            if (viewport === failureViewport) {
                let wrappedRectOrig = { minX: 2, maxX: 12, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV/DIV[3]' };
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, firstRectOrig),
                Object.assign({}, secondRectOrig),
                Object.assign({}, wrappedRectOrig),
                ]);
            }
            else {
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, firstRectOrig),
                Object.assign({}, secondRectOrig),
                Object.assign({}, thirdRectOrig),
                ]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        rlg.detectFailures();
        let node = rlg.map.get('/HTML/BODY/DIV/DIV[3]');
        let nonFailureNode1 = rlg.map.get('/HTML/BODY/DIV/DIV');
        let nonFailureNode2 = rlg.map.get('/HTML/BODY/DIV/DIV[2]');

        let rowXPaths = []
        for (let rowNode of node.wrappings[0].row)
            rowXPaths.push(rowNode.xpath);
        chai.expect(node.wrappings[0].range.equals(failureRanges)).to.be.true &&
            chai.expect(rowXPaths.includes('/HTML/BODY/DIV/DIV')).to.be.true &&
            chai.expect(rowXPaths.includes('/HTML/BODY/DIV/DIV[2]')).to.be.true &&
            chai.expect(rowXPaths.length).to.equal(2) &&
            chai.expect(nonFailureNode1.wrappings.length).to.equal(0) &&
            chai.expect(nonFailureNode2.wrappings.length).to.equal(0);
    })
    it('Wrapping - middle element wrap bellow', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureViewport = 800;
        let failureRanges = new Range(800, 800);
        let bodyRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let parentRectOrig = { minX: 1, maxX: 99, minY: 1, maxY: 99, xpath: '/HTML/BODY/DIV' };
        let firstRectOrig = { minX: 2, maxX: 12, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV' };
        let secondRectOrig = { minX: 12, maxX: 22, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV[2]' };
        let thirdRectOrig = { minX: 22, maxX: 32, minY: 2, maxY: 10, xpath: '/HTML/BODY/DIV/DIV[3]' };

        for (let viewport = 900; viewport >= 700; viewport--) {
            let dom = new DOM(driver);
            if (viewport === failureViewport) {
                let wrappedRectOrig = { minX: 2, maxX: 12, minY: 10, maxY: 20, xpath: '/HTML/BODY/DIV/DIV[2]' };
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, firstRectOrig),
                Object.assign({}, wrappedRectOrig),
                Object.assign({}, thirdRectOrig),
                ]);
            }
            else {
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, firstRectOrig),
                Object.assign({}, secondRectOrig),
                Object.assign({}, thirdRectOrig),
                ]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        rlg.detectFailures();
        let node = rlg.map.get('/HTML/BODY/DIV/DIV[2]');
        let nonFailureNode1 = rlg.map.get('/HTML/BODY/DIV/DIV');
        let nonFailureNode2 = rlg.map.get('/HTML/BODY/DIV/DIV[3]');


        let rowXPaths = []
        for (let rowNode of node.wrappings[0].row)
            rowXPaths.push(rowNode.xpath);
        chai.expect(node.wrappings[0].range.equals(failureRanges)).to.be.true &&
            chai.expect(rowXPaths.includes('/HTML/BODY/DIV/DIV')).to.be.true &&
            chai.expect(rowXPaths.includes('/HTML/BODY/DIV/DIV[3]')).to.be.true &&
            chai.expect(rowXPaths.length).to.equal(2) &&
            chai.expect(nonFailureNode1.wrappings.length).to.equal(0) &&
            chai.expect(nonFailureNode2.wrappings.length).to.equal(0);;
    })
    it('Wrapping - element wrap bellow with two rows above', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureViewport = 800;
        let failureRanges = new Range(800, 800);
        let bodyRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let parentRectOrig = { minX: 1, maxX: 99, minY: 1, maxY: 99, xpath: '/HTML/BODY/DIV' };
        let xRectOrig1 = { minX: 2, maxX: 12, minY: 12, maxY: 20, xpath: '/HTML/BODY/DIV/X' };
        let xRectOrig2 = { minX: 12, maxX: 22, minY: 12, maxY: 20, xpath: '/HTML/BODY/DIV/X[2]' };
        let xRectOrig3 = { minX: 22, maxX: 32, minY: 12, maxY: 20, xpath: '/HTML/BODY/DIV/X[3]' };
        let firstRectOrig = { minX: 2, maxX: 12, minY: 32, maxY: 40, xpath: '/HTML/BODY/DIV/DIV' };
        let secondRectOrig = { minX: 12, maxX: 22, minY: 32, maxY: 40, xpath: '/HTML/BODY/DIV/DIV[2]' };
        let thirdRectOrig = { minX: 22, maxX: 32, minY: 32, maxY: 40, xpath: '/HTML/BODY/DIV/DIV[3]' };

        for (let viewport = 900; viewport >= 700; viewport--) {
            let dom = new DOM(driver);
            if (viewport === failureViewport) {
                let wrappedRectOrig = { minX: 2, maxX: 12, minY: 40, maxY: 50, xpath: '/HTML/BODY/DIV/DIV[3]' };
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, xRectOrig1),
                Object.assign({}, xRectOrig2),
                Object.assign({}, xRectOrig3),
                Object.assign({}, firstRectOrig),
                Object.assign({}, secondRectOrig),
                Object.assign({}, wrappedRectOrig),
                ]);
            }
            else {
                dom.rbush.load([Object.assign({}, bodyRectOrig),
                Object.assign({}, parentRectOrig),
                Object.assign({}, xRectOrig1),
                Object.assign({}, xRectOrig2),
                Object.assign({}, xRectOrig3),
                Object.assign({}, firstRectOrig),
                Object.assign({}, secondRectOrig),
                Object.assign({}, thirdRectOrig),
                ]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        rlg.detectFailures();
        let node = rlg.map.get('/HTML/BODY/DIV/DIV[3]');
        let rowXPaths = []
        for (let rowNode of node.wrappings[0].row)
            rowXPaths.push(rowNode.xpath);
        chai.expect(node.wrappings[0].range.equals(failureRanges)).to.be.true &&
            chai.expect(rowXPaths.includes('/HTML/BODY/DIV/DIV')).to.be.true &&
            chai.expect(rowXPaths.includes('/HTML/BODY/DIV/DIV[2]')).to.be.true &&
            chai.expect(rowXPaths.length).to.equal(2);
    })
    it('Smallrange - element switch position', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureViewport = 800;
        let failureRanges = new Range(800, 800);
        let bodyRectOrig = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        let div1RectOrig = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
        let div2RectOrig = { minX: 20, maxX: 30, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };


        for (let viewport = 900; viewport >= 700; viewport--) {
            let dom = new DOM(driver);
            if (viewport === failureViewport) {
                let div1RectSR = { minX: 0, maxX: 10, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV[2]' };
                let div2RectSR = { minX: 20, maxX: 30, minY: 0, maxY: 10, xpath: '/HTML/BODY/DIV' };
                dom.rbush.load([Object.assign({}, bodyRectOrig), Object.assign({}, div1RectSR), Object.assign({}, div2RectSR)]);
            }
            else {
                dom.rbush.load([Object.assign({}, bodyRectOrig), Object.assign({}, div1RectOrig), Object.assign({}, div2RectOrig)]);
            }
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        rlg.detectFailures();
        let node = rlg.map.get('/HTML/BODY/DIV');
        chai.expect(node.smallranges[0].range.equals(failureRanges)).to.be.true;

    });
    it('Viewport protrusion Mock DOM - children, xpaths, overlap, and edge ranges', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureViewport = Math.floor(divDivRectOrig.maxX - divDivRectOrig.minX);
        let failureRanges = new Ranges();
        failureRanges.addValue(failureViewport);
        for (let i = divDivRectOrig.maxX; i > divDivRectOrig.minX; i--) {
            let dom = new DOM(driver);
            let widthDelta = divDivRectOrig.maxX - i;
            //New rectangle objects for each dom takes properties from original rectangles.
            let bodyRect = Object.assign({}, bodyRectOrig);
            let divRect = Object.assign({}, divRectOrig);
            let divDivRect = Object.assign({}, divDivRectOrig);
            let siblingRect = Object.assign({}, siblingRectOrig);
            bodyRect.maxX = bodyRect.maxX - widthDelta;
            divRect.maxX = divRect.maxX - widthDelta;
            divDivRect.maxX = divDivRect.maxX - widthDelta;
            siblingRect.maxX = siblingRect.maxX - widthDelta;
            if (i === failureViewport) {//create viewport protrusion
                divRect.maxX = siblingRect.maxX - (1 + tolerance.protrusion);
                bodyRect.maxX = siblingRect.maxX - (1 + tolerance.protrusion);
            }
            dom.rbush.load([bodyRect, divRect, divDivRect, siblingRect]);
            let viewport = divDivRectOrig.maxX - widthDelta;
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].ranges.sortRanges();
        let actual = [rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(bodyRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].ranges,
        rlg.getRLGNode(divRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(divDivRectOrig.xpath).childrenEdges,
        rlg.getRLGNode(divDivRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(siblingRectOrig.xpath).childrenEdges,
        rlg.getRLGNode(siblingRectOrig.xpath).overlapEdges];
        let oracle = [1,
            divRectOrig.xpath,
            testingRanges,
            [],
            2,
            divDivRectOrig.xpath,
            testingRanges,
            siblingRectOrig.xpath,
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]),
            [],
            [],
            [],
            [],
            []];
        chai.expect(actual).to.eql(oracle);
    });
    it('Element protrusion Mock DOM - children, xpaths, overlap, and edge ranges', function () {
        let rlg = new RLG();
        let testingRanges = new Ranges();
        let failureViewport = Math.floor(divDivRectOrig.maxX - divDivRectOrig.minX);
        let failureRanges = new Ranges();
        failureRanges.addValue(failureViewport);
        for (let i = divDivRectOrig.maxX; i > divDivRectOrig.minX; i--) {
            let dom = new DOM(driver);
            let widthDelta = divDivRectOrig.maxX - i;
            //New rectangle objects for each dom takes properties from original rectangles.
            let bodyRect = Object.assign({}, bodyRectOrig);
            let divRect = Object.assign({}, divRectOrig);
            let divDivRect = Object.assign({}, divDivRectOrig);
            let siblingRect = Object.assign({}, siblingRectOrig);
            bodyRect.maxX = bodyRect.maxX - widthDelta;
            divRect.maxX = divRect.maxX - widthDelta;
            divDivRect.maxX = divDivRect.maxX - widthDelta;
            siblingRect.maxX = siblingRect.maxX - widthDelta;
            if (i === failureViewport) {//create element protrusion
                divRect.maxX = siblingRect.maxX - (1 + tolerance.protrusion);
            }
            dom.rbush.load([bodyRect, divRect, divDivRect, siblingRect]);
            let viewport = divDivRectOrig.maxX - widthDelta;
            testingRanges.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].ranges.sortRanges();
        let actual = [rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[1].node2.xpath,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[1].ranges,
        rlg.getRLGNode(bodyRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].ranges,
        rlg.getRLGNode(divRectOrig.xpath).overlapEdges.length,
        rlg.getRLGNode(divRectOrig.xpath).overlapEdges[0].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).overlapEdges[0].ranges,
        rlg.getRLGNode(divDivRectOrig.xpath).childrenEdges,
        rlg.getRLGNode(divDivRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(siblingRectOrig.xpath).childrenEdges,
        rlg.getRLGNode(siblingRectOrig.xpath).overlapEdges.length,
        rlg.getRLGNode(siblingRectOrig.xpath).overlapEdges[0].node1.xpath,
        rlg.getRLGNode(siblingRectOrig.xpath).overlapEdges[0].ranges];
        let oracle = [2,
            divRectOrig.xpath,
            testingRanges,
            siblingRectOrig.xpath,
            failureRanges,
            [],
            2,
            divDivRectOrig.xpath,
            testingRanges,
            siblingRectOrig.xpath,
            testingRanges.getNonOverlappingRanges(failureRanges.list[0]),
            1,
            siblingRectOrig.xpath,
            failureRanges,
            [],
            [],
            [],
            1,
            divRectOrig.xpath,
            failureRanges];
        chai.expect(actual).to.eql(oracle);
    });

    it('Collision Mock DOM - children, xpaths, overlap, and edge ranges', function () {
        let rlg = new RLG();
        let testingRange = new Ranges();
        let failureViewport = Math.floor(divDivRectOrig.maxX - divDivRectOrig.minX);
        let failureRanges = new Ranges();
        failureRanges.addValue(failureViewport);
        for (let i = divDivRectOrig.maxX; i > divDivRectOrig.minX; i--) {
            let dom = new DOM(driver);
            let widthDelta = divDivRectOrig.maxX - i;
            //New rectangle objects for each dom takes properties from original rectangles.
            let bodyRect = Object.assign({}, bodyRectOrig);
            let divRect = Object.assign({}, divRectOrig);
            let divDivRect = Object.assign({}, divDivRectOrig);
            let siblingRect = Object.assign({}, siblingRectOrig);
            bodyRect.maxX = bodyRect.maxX - widthDelta;
            divRect.maxX = divRect.maxX - widthDelta;
            divDivRect.maxX = divDivRect.maxX - widthDelta;
            siblingRect.maxX = siblingRect.maxX - widthDelta;
            if (i === failureViewport) {//create collision
                siblingRect.maxX = siblingRect.maxX - ((siblingRect.minX - divDivRect.maxX));
                siblingRect.minX = divDivRect.maxX - tolerance.collision;
            }
            dom.rbush.load([bodyRect, divRect, divDivRect, siblingRect]);
            let viewport = divDivRectOrig.maxX - widthDelta;
            testingRange.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        let actual = [rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(bodyRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].ranges,
        rlg.getRLGNode(divRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(divDivRectOrig.xpath).childrenEdges,
        rlg.getRLGNode(divDivRectOrig.xpath).overlapEdges.length,
        rlg.getRLGNode(divDivRectOrig.xpath).overlapEdges[0].node2.xpath,
        rlg.getRLGNode(divDivRectOrig.xpath).overlapEdges[0].ranges,
        rlg.getRLGNode(siblingRectOrig.xpath).childrenEdges,
        rlg.getRLGNode(siblingRectOrig.xpath).overlapEdges.length,
        rlg.getRLGNode(siblingRectOrig.xpath).overlapEdges[0].node1.xpath,
        rlg.getRLGNode(siblingRectOrig.xpath).overlapEdges[0].ranges];
        let oracle = [1,
            divRectOrig.xpath,
            testingRange,
            [],
            2,
            divDivRectOrig.xpath,
            testingRange,
            siblingRectOrig.xpath,
            testingRange,
            [],
            [],
            1,
            siblingRectOrig.xpath,
            failureRanges,
            [],
            1,
            divDivRectOrig.xpath,
            failureRanges];
        chai.expect(actual).to.eql(oracle);
    });

    it('Simple Mock DOM - children, xpaths, overlap, and edge ranges', function () {
        let rlg = new RLG();
        let testingRange = new Ranges();
        for (let i = divDivRectOrig.maxX; i > divDivRectOrig.minX; i--) {
            let dom = new DOM(driver);
            let widthDelta = divDivRectOrig.maxX - i;
            //New rectangle objects for each dom takes properties from original rectangles.
            let bodyRect = Object.assign({}, bodyRectOrig);
            let divRect = Object.assign({}, divRectOrig);
            let divDivRect = Object.assign({}, divDivRectOrig);
            let siblingRect = Object.assign({}, siblingRectOrig);
            bodyRect.maxX = bodyRect.maxX - widthDelta;
            divRect.maxX = divRect.maxX - widthDelta;
            divDivRect.maxX = divDivRect.maxX - widthDelta;
            siblingRect.maxX = siblingRect.maxX - widthDelta;
            dom.rbush.load([bodyRect, divRect, divDivRect, siblingRect]);
            let viewport = divDivRectOrig.maxX - widthDelta;
            testingRange.addValue(viewport);
            rlg.extractRLG(dom, viewport);
        }
        let actual = [rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(bodyRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(bodyRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges.length,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[0].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[0].ranges,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].node2.xpath,
        rlg.getRLGNode(divRectOrig.xpath).childrenEdges[1].ranges,
        rlg.getRLGNode(divRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(divDivRectOrig.xpath).childrenEdges,
        rlg.getRLGNode(divDivRectOrig.xpath).overlapEdges,
        rlg.getRLGNode(siblingRectOrig.xpath).childrenEdges,
        rlg.getRLGNode(siblingRectOrig.xpath).overlapEdges];
        let oracle = [1,
            divRectOrig.xpath,
            testingRange,
            [],
            2,
            divDivRectOrig.xpath,
            testingRange,
            siblingRectOrig.xpath,
            testingRange,
            [],
            [],
            [],
            [],
            []];
        chai.expect(actual).to.eql(oracle);
    });
});
describe('Testing RLG edges', function () {
    let bodyRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
    let divRect = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY/DIV' };
    it('Add parent-child edge - parent has child', function () {
        let bodyNode = new RLGNode(bodyRect);
        let divNode = new RLGNode(divRect);
        bodyNode.addChild(divNode, 100);
        chai.expect(bodyNode.childrenEdges[0].node2).to.eql(divNode);
    });
    it('Add parent-child edge - child has parent', function () {
        let bodyNode = new RLGNode(bodyRect);
        let divNode = new RLGNode(divRect);
        bodyNode.addChild(divNode, 100);
        chai.expect(divNode.parentEdges[0].node1).to.eql(bodyNode);
    });
    it('Update parent-child edge - two viewports', function () {
        let bodyNode = new RLGNode(bodyRect);
        let divNode = new RLGNode(divRect);
        bodyNode.addChild(divNode, 100);
        bodyNode.addChild(divNode, 101);
        let oracleRanges = new Ranges();
        oracleRanges.addRange(new Range(100, 101));
        chai.expect(bodyNode.childrenEdges[0].ranges).to.eql(oracleRanges);
    });
    it('Add overlap edge - first sibling', function () {
        let bodyNode = new RLGNode(bodyRect);
        let divNode = new RLGNode(divRect);
        bodyNode.addOverlap(divNode, 100);
        chai.expect(bodyNode.overlapEdges[0].node2).to.eql(divNode);
    });
    it('Add overlap edge - first sibling', function () {
        let bodyNode = new RLGNode(bodyRect);
        let divNode = new RLGNode(divRect);
        bodyNode.addOverlap(divNode, 100);
        chai.expect(divNode.overlapEdges[0].node1).to.eql(bodyNode);
    });
    it('Update overlap edge - two viewports', function () {
        let bodyNode = new RLGNode(bodyRect);
        let divNode = new RLGNode(divRect);
        bodyNode.addOverlap(divNode, 100);
        bodyNode.addOverlap(divNode, 101);
        let oracleRanges = new Ranges();
        oracleRanges.addRange(new Range(100, 101));
        chai.expect(bodyNode.overlapEdges[0].ranges).to.eql(oracleRanges);
    });
});
describe('Test ProtrusionFailure', function () {

    let r = new Rectangle();
    r.xpath = "";
    let parent = new RLGNode(r);
    let child = new RLGNode(r);
    let grandchild = new RLGNode(r);

    it('isEquivalent protrusion-protrusion', function () {

        parent.xpath = "/HTML/BODY/DIV";
        child.xpath = "/HTML/BODY/DIV/DIV";
        grandchild.xpath = "/HTML/BODY/DIV/DIV";

        let p1 = new ProtrusionFailure(child, parent);
        let p2 = new ProtrusionFailure(grandchild, parent);

        chai.expect(p1.isEquivalent(p2)).to.be.true
    })
})
describe('Testing sets of ranges (Ranges objects)', function () {
    it('Adding a single value compared to adding a range', function () {
        let first = new Ranges();
        let oracle = new Ranges();
        first.addValue(1);
        oracle.addRange(new Range(1, 1));
        chai.expect(first.equals(oracle)).to.be.true;
    });
    it('Adding multiple single value compared to adding a range', function () {
        let first = new Ranges();
        let oracle = new Ranges();
        first.addValue(1);
        first.addValue(3);
        first.addValue(2);
        oracle.addRange(new Range(1, 3));
        chai.expect(first.equals(oracle)).to.be.true;
    });
    it('Value in range - true', function () {
        let first = new Ranges();
        first.addValue(1);
        first.addValue(3);
        chai.expect(first.inRanges(3)).to.be.true;
    });
    it('Value in range - false', function () {
        let first = new Ranges();
        first.addValue(1);
        first.addValue(3);
        chai.expect(first.inRanges(2)).to.be.false;
    });
    it('Merging Ranges - become single range', function () {
        let first = new Ranges();
        let second = new Ranges();
        let oracle = new Ranges();
        first.addValue(1);
        first.addValue(3);
        second.addValue(2);
        oracle.addRange(new Range(1, 3));
        chai.expect(first.getMergedRanges(second)).to.eql(oracle);
    });
    it('Merging Ranges - become a set of two ranges', function () {
        let first = new Ranges();
        let second = new Ranges();
        let oracle = new Ranges();
        first.addValue(1);
        first.addValue(2);
        second.addValue(5);
        oracle.addRange(new Range(1, 2));
        oracle.addRange(new Range(5, 5));
        chai.expect(first.getMergedRanges(second)).to.eql(oracle);
    });
    it('Merging Ranges - same sets', function () {
        let first = new Ranges();
        let second = new Ranges();
        let oracle = new Ranges();
        first.addValue(1);
        second.addValue(1);
        oracle.addRange(new Range(1, 1));
        chai.expect(first.getMergedRanges(second)).to.eql(oracle);
    });
    it('Get overlapping - undefined continue', function () {
        let first = new Ranges();
        first.addRange(new Range(0, 100));
        chai.expect(first.getOverlappingRanges(new Range(101, 500))).to.be.undefined;
    });
    it('Get overlapping - undefined in-between', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 500));
        first.addRange(new Range(502, 1400));
        chai.expect(first.getOverlappingRanges(new Range(501, 501))).to.be.undefined;
    });
    it('Get overlapping - match second range - same', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 420));
        first.addRange(new Range(520, 620));
        first.addRange(new Range(720, 820));
        let oracle = new Ranges();
        oracle.addRange(new Range(520, 620));
        chai.expect(first.getOverlappingRanges(new Range(520, 620))).to.eql(oracle);
    });
    it('Get overlapping - match second range - extend both ends', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 420));
        first.addRange(new Range(520, 620));
        first.addRange(new Range(720, 820));
        let oracle = new Ranges();
        oracle.addRange(new Range(520, 620));
        chai.expect(first.getOverlappingRanges(new Range(500, 700))).to.eql(oracle);
    });
    it('Get overlapping - match first range - smaller', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 420));
        first.addRange(new Range(520, 620));
        first.addRange(new Range(720, 820));
        let oracle = new Ranges();
        oracle.addRange(new Range(350, 400));
        chai.expect(first.getOverlappingRanges(new Range(350, 400))).to.eql(oracle);
    });
    it('Get overlapping - match first range - before', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 420));
        first.addRange(new Range(520, 620));
        first.addRange(new Range(720, 820));
        let oracle = new Ranges();
        oracle.addRange(new Range(320, 340));
        chai.expect(first.getOverlappingRanges(new Range(300, 340))).to.eql(oracle);
    });
    it('Get overlapping - match second range - after', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 420));
        first.addRange(new Range(520, 620));
        first.addRange(new Range(720, 820));
        let oracle = new Ranges();
        oracle.addRange(new Range(600, 620));
        chai.expect(first.getOverlappingRanges(new Range(600, 640))).to.eql(oracle);
    });
    it('Get overlapping - match second and third range - extend both ends', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 420));
        first.addRange(new Range(520, 620));
        first.addRange(new Range(720, 820));
        let oracle = new Ranges();
        oracle.addRange(new Range(520, 620));
        oracle.addRange(new Range(720, 820));
        chai.expect(first.getOverlappingRanges(new Range(500, 900))).to.eql(oracle);
    });
    it('Get non overlapping - empty same', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 1400));
        chai.expect(first.getNonOverlappingRanges(new Range(320, 1400)).isEmpty()).to.be.true;
    });
    it('Get non overlapping - empty multiple ranges', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 620));
        first.addRange(new Range(621, 1020));
        first.addRange(new Range(1021, 1400));
        chai.expect(first.getNonOverlappingRanges(new Range(320, 1400)).isEmpty()).to.be.true;
    });
    it('Get non overlapping - middle gap same', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 620));
        first.addRange(new Range(1021, 1400));
        let oracle = new Ranges();
        oracle.addRange(new Range(320, 1400))
        chai.expect(first.getNonOverlappingRanges(new Range(621, 1020))).to.eql(oracle);
    });
    it('Get non overlapping - middle gap full range', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 620));
        first.addRange(new Range(1021, 1400));
        let oracle = new Ranges();
        oracle.addRange(new Range(621, 1020));
        chai.expect(first.getNonOverlappingRanges(new Range(320, 1400))).to.eql(oracle);
    });
    it('Get non overlapping - middle gap extends full range ', function () {
        let first = new Ranges();
        first.addRange(new Range(320, 620));
        first.addRange(new Range(1021, 1400));
        let oracle = new Ranges();
        oracle.addRange(new Range(300, 319));
        oracle.addRange(new Range(621, 1020));
        oracle.addRange(new Range(1401, 1420));

        chai.expect(first.getNonOverlappingRanges(new Range(300, 1420))).to.eql(oracle);
    });
    it('In ranges -  true', function () {
        let first = new Ranges();
        first.addRange(new Range(0, 100));
        first.addRange(new Range(102, 200));
        chai.expect(first.inRanges(2)).to.be.true;
    });
    it('In ranges -  true border', function () {
        let first = new Ranges();
        first.addRange(new Range(0, 100));
        first.addRange(new Range(102, 200));
        chai.expect(first.inRanges(100)).to.be.true;
    });
    it('In ranges -  false', function () {
        let first = new Ranges();
        first.addRange(new Range(0, 100));
        first.addRange(new Range(102, 200));
        chai.expect(first.inRanges(101)).to.be.false;
    });
    it('Is overlapping ranges -  true top border', function () {
        let first = new Ranges();
        first.addRange(new Range(0, 100));
        first.addRange(new Range(105, 200));
        let second = new Ranges();
        second.addRange(new Range(200, 300));
        chai.expect(first.isOverlappingWithRanges(second)).to.be.true;
    });
    it('Is overlapping ranges -  true middle border', function () {
        let first = new Ranges();
        first.addRange(new Range(0, 100));
        first.addRange(new Range(105, 200));
        let second = new Ranges();
        second.addRange(new Range(102, 105));
        chai.expect(first.isOverlappingWithRanges(second)).to.be.true;
    });
    it('Is overlapping ranges -  true full extends', function () {
        let first = new Ranges();
        first.addRange(new Range(2, 100));
        first.addRange(new Range(105, 200));
        let second = new Ranges();
        second.addRange(new Range(0, 202));
        chai.expect(first.isOverlappingWithRanges(second)).to.be.true;
    });
    it('Is overlapping ranges -  false before', function () {
        let first = new Ranges();
        first.addRange(new Range(2, 100));
        first.addRange(new Range(105, 200));
        let second = new Ranges();
        second.addRange(new Range(0, 1));
        chai.expect(first.isOverlappingWithRanges(second)).to.be.false;
    });
    it('Is overlapping ranges -  false middle', function () {
        let first = new Ranges();
        first.addRange(new Range(2, 100));
        first.addRange(new Range(105, 200));
        let second = new Ranges();
        second.addRange(new Range(101, 104));
        chai.expect(first.isOverlappingWithRanges(second)).to.be.false;
    });
    it('Is overlapping ranges -  false surrounded', function () {
        let first = new Ranges();
        first.addRange(new Range(2, 100));
        first.addRange(new Range(105, 200));
        let second = new Ranges();
        second.addRange(new Range(0, 1));
        second.addRange(new Range(101, 104));
        second.addRange(new Range(201, 3000));
        chai.expect(first.isOverlappingWithRanges(second)).to.be.false;
    });
    it('sort ranges -  descending to ascending', function () {
        let first = new Ranges();
        first.addRange(new Range(300, 350));
        first.addRange(new Range(200, 250));
        first.addRange(new Range(100, 150));
        let oracle = new Ranges();
        oracle.addRange(new Range(100, 150));
        oracle.addRange(new Range(200, 250));
        oracle.addRange(new Range(300, 350));
        first.sortRanges();
        chai.expect(first).to.eql(oracle);
    });
    it('sort ranges -  wrongly to ascending', function () {
        let first = new Ranges();
        first.addRange(new Range(200, 250));
        first.addRange(new Range(300, 350));
        first.addRange(new Range(100, 150));
        let oracle = new Ranges();
        oracle.addRange(new Range(100, 150));
        oracle.addRange(new Range(200, 250));
        oracle.addRange(new Range(300, 350));
        first.sortRanges();
        chai.expect(first).to.eql(oracle);
    });
    it('sort ranges -  already sorted', function () {
        let first = new Ranges();
        first.addRange(new Range(100, 150));
        first.addRange(new Range(200, 250));
        first.addRange(new Range(300, 350));
        let oracle = new Ranges();
        oracle.addRange(new Range(100, 150));
        oracle.addRange(new Range(200, 250));
        oracle.addRange(new Range(300, 350));
        first.sortRanges();
        chai.expect(first).to.eql(oracle);
    });

});
describe('Testing ranges (Range objects)', function () {
    it('Equality', function () {
        let first = new Range(100, 200);
        let second = new Range(100, 200);
        chai.expect(first.equals(second)).to.be.true;
    });
    it('Non equality', function () {
        let first = new Range(100, 200);
        let second = new Range(100, 201);
        chai.expect(first.equals(second)).to.be.false;
    });
    it('Contains the other - smaller', function () {
        let first = new Range(100, 200);
        let second = new Range(101, 199);
        chai.expect(first.isContaining(second)).to.be.true;
    });
    it('Contains the other - same', function () {
        let first = new Range(100, 200);
        let second = new Range(100, 200);
        chai.expect(first.isContaining(second)).to.be.true;
    });
    it('Not contain the other - wider', function () {
        let first = new Range(100, 200);
        let second = new Range(99, 201);
        chai.expect(first.isContaining(second)).to.be.false;
    });
    it('Not contain the other - borders', function () {
        let first = new Range(100, 200);
        let second = new Range(200, 201);
        chai.expect(first.isContaining(second)).to.be.false;
    });
    it('Overlaps the other - same', function () {
        let first = new Range(100, 200);
        let second = new Range(100, 200);
        chai.expect(first.isOverlappingWith(second)).to.be.true;
    });
    it('Overlaps the other - wider', function () {
        let first = new Range(100, 200);
        let second = new Range(99, 201);
        chai.expect(first.isOverlappingWith(second)).to.be.true;
    });
    it('Overlaps the other - border', function () {
        let first = new Range(100, 200);
        let second = new Range(99, 100);
        chai.expect(first.isOverlappingWith(second)).to.be.true;
    });
    it('Overlaps the other - within', function () {
        let first = new Range(100, 200);
        let second = new Range(101, 199);
        chai.expect(first.isOverlappingWith(second)).to.be.true;
    });
    it('Not overlap the other - wider', function () {
        let first = new Range(100, 200);
        let second = new Range(201, 202);
        chai.expect(first.isOverlappingWith(second)).to.be.false;
    });
    it('Mergeable the other - bigger', function () {
        let first = new Range(100, 200);
        let second = new Range(90, 210);
        chai.expect(first.areMergeable(second)).to.be.true;
    });
    it('Mergeable the other - bigger flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(90, 210);
        chai.expect(first.areMergeable(second)).to.be.true;
    });
    it('Mergeable the other - within', function () {
        let first = new Range(100, 200);
        let second = new Range(101, 199);
        chai.expect(first.areMergeable(second)).to.be.true;
    });
    it('Mergeable the other - extends', function () {
        let first = new Range(100, 200);
        let second = new Range(150, 210);
        chai.expect(first.areMergeable(second)).to.be.true;
    });
    it('Mergeable the other - same', function () {
        let first = new Range(100, 200);
        let second = new Range(100, 200);
        chai.expect(first.areMergeable(second)).to.be.true;
    });
    it('Mergeable the other - borders', function () {
        let first = new Range(100, 200);
        let second = new Range(201, 202);
        chai.expect(first.areMergeable(second)).to.be.true;
    });
    it('Mergeable the other - borders flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(201, 202);
        chai.expect(first.areMergeable(second)).to.be.true;
    });
    it('Not mergeable the other - wider', function () {
        let first = new Range(100, 200);
        let second = new Range(202, 203);
        chai.expect(first.areMergeable(second)).to.be.false;
    });
    it('Not mergeable the other - wider flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(202, 203);
        chai.expect(first.areMergeable(second)).to.be.false;
    });
    it('Get overlapping range - no overlap', function () {
        let first = new Range(100, 200);
        let second = new Range(201, 203);
        chai.expect(first.getOverlappingRange(second)).to.be.undefined;
    });
    it('Get overlapping range - borders end only', function () {
        let first = new Range(100, 200);
        let second = new Range(200, 203);
        chai.expect(first.getOverlappingRange(second)).to.eql(new Range(200, 200));
    });
    it('Get overlapping range - top end', function () {
        let first = new Range(100, 200);
        let second = new Range(190, 203);
        chai.expect(first.getOverlappingRange(second)).to.eql(new Range(190, 200));
    });
    it('Get overlapping range - top end flipped', function () {
        let first = new Range(190, 203);
        let second = new Range(100, 200);
        chai.expect(first.getOverlappingRange(second)).to.eql(new Range(190, 200));
    });
    it('Get overlapping range - borders start', function () {
        let first = new Range(100, 200);
        let second = new Range(95, 100);
        chai.expect(first.getOverlappingRange(second)).to.eql(new Range(100, 100));
    });
    it('Get overlapping range - extends start', function () {
        let first = new Range(100, 200);
        let second = new Range(95, 105);
        chai.expect(first.getOverlappingRange(second)).to.eql(new Range(100, 105));
    });
    it('Get overlapping range - same', function () {
        let first = new Range(100, 200);
        let second = new Range(100, 200);
        chai.expect(first.getOverlappingRange(second)).to.eql(new Range(100, 200));
    });
    it('Get non overlapping range - same', function () {
        let first = new Range(100, 200);
        let second = new Range(100, 200);
        chai.expect(first.getNonOverlappingRanges(second)).to.be.undefined;
    });
    it('Get non overlapping range - start after start', function () {
        let first = new Range(100, 200);
        let second = new Range(99, 200);
        let expectedResult = new Ranges();
        expectedResult.addRange(new Range(99, 99));
        chai.expect(first.getNonOverlappingRanges(second)).to.eql(expectedResult);
    });
    it('Get non overlapping range - start and end before  start', function () {
        let first = new Range(100, 200);
        let second = new Range(99, 99);
        let expectedResult = new Ranges();
        expectedResult.addRange(first);
        expectedResult.addRange(second);
        chai.expect(first.getNonOverlappingRanges(second)).to.eql(expectedResult);
    });
    it('Get non overlapping range - extend both start and end', function () {
        let first = new Range(100, 200);
        let second = new Range(99, 201);
        let expectedResult = new Ranges();
        expectedResult.addRange(new Range(99, 99));
        expectedResult.addRange(new Range(201, 201));
        chai.expect(first.getNonOverlappingRanges(second)).to.eql(expectedResult);
    });
    it('Get non overlapping range - start after start flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(99, 200);
        let expectedResult = new Ranges();
        expectedResult.addRange(new Range(99, 99));
        chai.expect(first.getNonOverlappingRanges(second)).to.eql(expectedResult);
    });
    it('Get non overlapping range - start and end before start flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(99, 99);
        let expectedResult = new Ranges();
        expectedResult.addRange(first);
        expectedResult.addRange(second);
        chai.expect(first.getNonOverlappingRanges(second)).to.eql(expectedResult);
    });
    it('Get non overlapping range - extend both start and end flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(99, 201);
        let expectedResult = new Ranges();
        expectedResult.addRange(new Range(99, 99));
        expectedResult.addRange(new Range(201, 201));
        chai.expect(first.getNonOverlappingRanges(second)).to.eql(expectedResult);
    });
    it('Get non overlapping range - extend both start and end flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(99, 201);
        let expectedResult = new Ranges();
        expectedResult.addRange(new Range(99, 99));
        expectedResult.addRange(new Range(201, 201));
        chai.expect(first.getNonOverlappingRanges(second)).to.eql(expectedResult);
    });
    it('Get merged range - not mergeable extend end', function () {
        let first = new Range(100, 200);
        let second = new Range(202, 250);
        chai.expect(first.getMergedRange(second)).to.be.undefined;
    });
    it('Get merged range - not mergeable precedes start', function () {
        let first = new Range(100, 200);
        let second = new Range(90, 98);
        chai.expect(first.getMergedRange(second)).to.be.undefined;
    });
    it('Get merged range - not mergeable extend end flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(202, 250);
        chai.expect(first.getMergedRange(second)).to.be.undefined;
    });
    it('Get merged range - not mergeable precedes start flipped', function () {
        let second = new Range(100, 200);
        let first = new Range(90, 98);
        chai.expect(first.getMergedRange(second)).to.be.undefined;
    });
    it('Get merged range - end and start extend', function () {
        let first = new Range(100, 200);
        let second = new Range(200, 210);
        chai.expect(first.getMergedRange(second)).to.eql(new Range(100, 210));
    });
    it('Get merged range - end and start borders', function () {
        let first = new Range(100, 200);
        let second = new Range(201, 210);
        chai.expect(first.getMergedRange(second)).to.eql(new Range(100, 210));
    });
    it('Get merged range - start and end extend', function () {
        let first = new Range(100, 200);
        let second = new Range(0, 100);
        chai.expect(first.getMergedRange(second)).to.eql(new Range(0, 200));
    });
    it('Get merged range - start and end border', function () {
        let first = new Range(100, 200);
        let second = new Range(0, 99);
        chai.expect(first.getMergedRange(second)).to.eql(new Range(0, 200));
    });
    it('Get merged range - same', function () {
        let first = new Range(100, 200);
        let second = new Range(100, 200);
        chai.expect(first.getMergedRange(second)).to.eql(new Range(100, 200));
    });
    it('Get merged range - extends both directions', function () {
        let first = new Range(100, 200);
        let second = new Range(0, 300);
        chai.expect(first.getMergedRange(second)).to.eql(new Range(0, 300));
    });
});
describe('Testing real DOM against saved', function () {
    before(async () => {
        await driver.startup();
        await driver.setViewport(800, 1000, 1);
        const uri = 'file:///' + __dirname.replace(/\\/g, "/") + '/subjects/simple.html';
        await driver.goto(uri);
    });
    after(async () => {
        await driver.shutdown();
    });
    it('Coordinates compare: DOM rectangles same after 3 seconds delay', async function () {
        this.timeout(10000);
        let testDOM = new DOM(driver);
        await testDOM.captureDOM();
        let origRectangles = [];
        let newRectangles = [];
        testDOM.traverse(function (node) {
            origRectangles.push(node.rectangle);
        }, true, origRectangles);
        await assist.resolveAfterSeconds(3);
        let testDOM2 = new DOM(driver);
        await testDOM2.captureDOM();
        testDOM2.traverse(function (node) {
            newRectangles.push(node.rectangle);
        }, true, newRectangles);
        chai.expect(origRectangles).to.eql(newRectangles);
    });
    it('RBush has equal number of rectangles as DOM Nodes minus transparent and hidden', async function () {
        let testDOM = new DOM(driver);
        await testDOM.captureDOM();
        let origRectangles = [];
        testDOM.traverse(function (node) {
            if (node.xpath !== '/HTML/BODY/HEADER/DIV/BUTTON[4]' //Visibility hidden
                && node.xpath !== '/HTML/BODY/HEADER/DIV/BUTTON[5]' //Opacity 0
                && node.xpath !== '/HTML/BODY/HEADER/DIV/BUTTON[7]' //Display none
                && node.xpath !== '/HTML/BODY/HEADER/DIV/BUTTON[6]') //in the negative coordinates
                origRectangles.push(node.rectangle);
        }, true, origRectangles);
        let rbushRectangles = testDOM.rbush.all();
        let sortBy = function (a, b) {
            if (a.xpath < b.xpath) {
                return -1;
            }
            if (a.xpath > b.xpath) {
                return 1;
            }
            return 0;
        }
        chai.expect(rbushRectangles.sort(sortBy)).to.eql(origRectangles.sort(sortBy));
    });
});
describe('Testing test webpage for invisible elements', function () {
    before(async () => {
        await driver.startup();
        await driver.setViewport(800, 1000, 1);
        const uri = 'file:///' + __dirname.replace(/\\/g, "/") + '/subjects/invisible-elements.html';
        await driver.goto(uri);
    });
    after(async () => {
        await driver.shutdown();
    });
    it('Test RLG only contains visible elements', async function () {
        let testDOM = new DOM(driver);
        let rlg = new RLG();
        await testDOM.captureDOM();
        rlg.extractRLG(testDOM, 800)
        let rlgNodes = Array.from(rlg.map.keys()).sort();
        let expected = [
            '/HTML/BODY',
            '/HTML/BODY/DIV/DIV',
            '/HTML/BODY/DIV/DIV/DIV',
            '/HTML/BODY/DIV/DIV/DIV/P',
            '/HTML/BODY/DIV/P',
            '/HTML/BODY/DIV[2]/DIV/DIV',
            '/HTML/BODY/DIV[2]/DIV/DIV/P'
        ]
        chai.expect(rlgNodes).to.eql(expected);
    });
});
describe('Testing RLG functions', function () {
    let data = {};
    before(function () {
        data.container1 = {
            minX: 0,
            maxX: 100,
            minY: 0,
            maxY: 100,
            xpath: '/HTML/BODY'
        };
        data.container2 = {
            minX: 2,
            maxX: 100,
            minY: 0,
            maxY: 100,
            xpath: '/HTML/BODY/DIV'
        };
        data.container3 = {
            minX: 2,
            maxX: 98,
            minY: 0,
            maxY: 100,
            xpath: '/HTML/BODY/DIV/DIV'
        };
        data.targetContainer = {
            minX: 2,
            maxX: 98,
            minY: 2,
            maxY: 98,
            xpath: '/HTML/BODY/DIV/DIV/DIV'
        };
        data.targetContainerOverlap = {
            minX: 2,
            maxX: 98,
            minY: 2,
            maxY: 98,
            xpath: '/HTML/BODY/DIV/DIV/DIV[2]'
        };
        data.targetContainerOverlapWithSubPath = {
            minX: 2,
            maxX: 98,
            minY: 2,
            maxY: 98,
            xpath: '/HTML/BODY/DIV/DIV'
        };
        data.targetContained = {
            minX: 20,
            maxX: 40,
            minY: 20,
            maxY: 40,
            xpath: '/HTML/BODY/DIV/DIV/DIV/DIV'
        };
        data.targetCollision = {
            minX: 30,
            maxX: 50,
            minY: 20,
            maxY: 40,
            xpath: '/HTML/BODY/DIV/DIV/DIV/DIV[2]'
        };
        data.sibling = {
            minX: 51,
            maxX: 60,
            minY: 20,
            maxY: 40,
            xpath: '/HTML/BODY/DIV/DIV/DIV/DIV[3]'
        };

    });
    // it('testing tolerance for protrusion - equal rectangle', function () {
    //     //Expects tolerance of 0 or more
    //     let rlg = new RLG();
    //     let rect = {
    //         minX: 0,
    //         maxX: 10,
    //         minY: 0,
    //         maxY: 10
    //     }
    //     let otherRect = {
    //         minX: 0,
    //         maxX: 10,
    //         minY: 0,
    //         maxY: 10
    //     }
    //     chai.expect(rlg.isWithinProtrusionTolerance(rect,otherRect)).to.be.true;
    // });
    // it('testing tolerance for protrusion - smaller by 1 all sides', function () {
    //     //Expects tolerance of 1 or more
    //     let rlg = new RLG();
    //     let rect = {
    //         minX: 0,
    //         maxX: 10,
    //         minY: 0,
    //         maxY: 10
    //     }
    //     let otherRect = {
    //         minX: 1,
    //         maxX: 9,
    //         minY: 1,
    //         maxY: 9
    //     }
    //     chai.expect(rlg.isWithinProtrusionTolerance(rect,otherRect)).to.be.true;
    // });
    // it('testing tolerance for protrusion - bigger by 1 all sides with negative', function () {
    //     //Expects tolerance of 1 or more
    //     let rlg = new RLG();
    //     let rect = {
    //         minX: 0,
    //         maxX: 10,
    //         minY: 0,
    //         maxY: 10
    //     }
    //     let otherRect = {
    //         minX: -1,
    //         maxX: 11,
    //         minY: -1,
    //         maxY: 11
    //     }
    //     chai.expect(rlg.isWithinProtrusionTolerance(rect,otherRect)).to.be.true;
    // });
    // it('testing tolerance for protrusion - one side bigger and one smaller with negative', function () {
    //     //Expects tolerance of 1 or more
    //     let rlg = new RLG();
    //     let rect = {
    //         minX: 0,
    //         maxX: 10,
    //         minY: 0,
    //         maxY: 10
    //     }
    //     let otherRect = {
    //         minX: -1,
    //         maxX: 10,
    //         minY: 1,
    //         maxY: 10
    //     }
    //     chai.expect(rlg.isWithinProtrusionTolerance(rect,otherRect)).to.be.true;
    // });
    // it('testing tolerance for protrusion - two sides bigger two smaller', function () {
    //     //Expects tolerance of 1 or more
    //     let rlg = new RLG();
    //     let rect = {
    //         minX: 0,
    //         maxX: 10,
    //         minY: 0,
    //         maxY: 10
    //     }
    //     let otherRect = {
    //         minX: 1,
    //         maxX: 11,
    //         minY: 1,
    //         maxY: 11
    //     }
    //     chai.expect(rlg.isWithinProtrusionTolerance(rect,otherRect)).to.be.true;
    // });
    it('Testing tolerance for candidate parents - two candidates', function () {
        rlg = new RLG();
        body = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        candidate = { minX: 11, maxX: 89, minY: 11, maxY: 89, xpath: '/HTML/BODY/DIV' };
        bestCandidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV' };
        child = { minX: 12, maxX: 88, minY: 12, maxY: 88, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV' };
        rectangles = [body, candidate, bestCandidate, child];
        //set width and height of each rectangle
        for (let r of rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(rectangles, child);
        let candidates = rlg.findCandidateContainers(results.containers, child)
        chai.expect(candidates).to.eql([candidate, bestCandidate]);
    });
    it('Testing tolerance for candidate parents - two candidates descendant', function () {
        rlg = new RLG();
        body = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        candidate = { minX: 11, maxX: 89, minY: 11, maxY: 89, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV/DIV' };
        bestCandidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV' };
        child = { minX: 12, maxX: 88, minY: 12, maxY: 88, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV' };
        child.minX += tolerance.protrusion;
        child.maxX -= tolerance.protrusion;
        child.minY += tolerance.protrusion;
        child.maxY -= tolerance.protrusion;
        rectangles = [body, candidate, bestCandidate, child];
        //set width and height of each rectangle
        for (let r of rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(rectangles, child);
        let candidates = rlg.findCandidateContainers(results.containers, child)
        chai.expect(candidates).to.eql([candidate, bestCandidate]);
    });
    it('Testing tolerance for candidate parents - two candidates family and descendant', function () {
        rlg = new RLG();
        body = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        candidate = { minX: 11, maxX: 89, minY: 11, maxY: 89, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV/DIV' };
        bestCandidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV[2]' };
        child = { minX: 12, maxX: 88, minY: 12, maxY: 88, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV' };
        child.minX += tolerance.protrusion;
        child.maxX -= tolerance.protrusion;
        child.minY += tolerance.protrusion;
        child.maxY -= tolerance.protrusion;
        rectangles = [body, candidate, bestCandidate, child];
        //set width and height of each rectangle
        for (let r of rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(rectangles, child);
        let candidates = rlg.findCandidateContainers(results.containers, child)
        chai.expect(candidates).to.eql([candidate, bestCandidate]);
    });
    it('Testing tolerance for candidate parents - two candidates equal', function () {
        rlg = new RLG();
        body = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        candidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV' };
        bestCandidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV' };
        child = { minX: 12, maxX: 88, minY: 12, maxY: 88, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV' };
        rectangles = [body, candidate, bestCandidate, child];
        //set width and height of each rectangle
        for (let r of rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(rectangles, child);
        let candidates = rlg.findCandidateContainers(results.containers, child)
        chai.expect(candidates).to.eql([candidate, bestCandidate]);
    });
    it('Testing tolerance for candidate parents - general', function () {
        rlg = new RLG();
        data.rectangles = [data.container1, data.container2, data.container3, data.targetContainer,
        data.targetContainerOverlap, data.targetContained, data.targetCollision, data.sibling];
        data.containers = [data.container1, data.container2, data.container3, data.targetContainerOverlap];
        data.contained = [data.targetContained, data.targetCollision, data.sibling];
        data.others = [];
        //set width and height of each rectangle
        for (let r of data.rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContainer);
        let candidates = rlg.findCandidateContainers(results.containers, data.targetContainer)
        chai.expect(candidates).to.eql([data.container3, data.container2]);
    });
    it('Testing xpath choice for candidate parents - general', function () {
        rlg = new RLG();
        data.rectangles = [data.container1, data.container2, data.container3, data.targetContainer,
        data.targetContainerOverlap, data.targetContained, data.targetCollision, data.sibling];
        data.containers = [data.container1, data.container2, data.container3, data.targetContainerOverlap];
        data.contained = [data.targetContained, data.targetCollision, data.sibling];
        data.others = [];
        //set width and height of each rectangle
        for (let r of data.rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContained);
        let candidates = rlg.findCandidateContainers(results.containers, data.targetContained);
        let parent = rlg.findParent(candidates, data.targetContained);
        chai.expect(parent).to.eql(data.targetContainer);
    });
    it('Testing xpath choice for candidate parents - two candidates', function () {
        rlg = new RLG();
        body = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        candidate = { minX: 11, maxX: 89, minY: 11, maxY: 89, xpath: '/HTML/BODY/DIV' };
        bestCandidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV' };
        child = { minX: 12, maxX: 88, minY: 12, maxY: 88, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV' };
        rectangles = [body, candidate, bestCandidate, child];
        //set width and height of each rectangle
        for (let r of rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(rectangles, child);
        let candidates = rlg.findCandidateContainers(results.containers, child)
        let parent = rlg.findParent(candidates, child);
        chai.expect(parent).to.eql(bestCandidate);
    });
    it('Testing xpath choice for candidate parents - two candidates descendant', function () {
        rlg = new RLG();
        body = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        candidate = { minX: 11, maxX: 89, minY: 11, maxY: 89, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV/DIV' };
        bestCandidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV' };
        child = { minX: 12, maxX: 88, minY: 12, maxY: 88, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV' };
        rectangles = [body, candidate, bestCandidate, child];
        //set width and height of each rectangle
        for (let r of rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(rectangles, child);
        let candidates = rlg.findCandidateContainers(results.containers, child)
        let parent = rlg.findParent(candidates, child);
        chai.expect(parent).to.eql(bestCandidate);
    });
    it('Testing xpath choice for candidate parents - two candidates family over descendant', function () {
        rlg = new RLG();
        body = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        candidate = { minX: 11, maxX: 89, minY: 11, maxY: 89, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV/DIV' };
        bestCandidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV[2]' };
        child = { minX: 12, maxX: 88, minY: 12, maxY: 88, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV' };
        rectangles = [body, candidate, bestCandidate, child];
        //set width and height of each rectangle
        for (let r of rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(rectangles, child);
        let candidates = rlg.findCandidateContainers(results.containers, child)
        let parent = rlg.findParent(candidates, child);
        chai.expect(parent).to.eql(bestCandidate);
    });
    it('Testing xpath choice for candidate parents - two candidates equal', function () {
        rlg = new RLG();
        body = { minX: 0, maxX: 100, minY: 0, maxY: 100, xpath: '/HTML/BODY' };
        candidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV' };
        bestCandidate = { minX: 10, maxX: 90, minY: 10, maxY: 90, xpath: '/HTML/BODY/DIV/DIV' };
        child = { minX: 12, maxX: 88, minY: 12, maxY: 88, xpath: '/HTML/BODY/DIV/DIV/DIV/DIV' };
        rectangles = [body, candidate, bestCandidate, child];
        //set width and height of each rectangle
        for (let r of rectangles) {
            r.width = r.maxX - r.minX;
            r.height = r.maxY - r.minY;
        }
        let results = rlg.findIntersectionTypes(rectangles, child);
        let candidates = rlg.findCandidateContainers(results.containers, child)
        let parent = rlg.findParent(candidates, child);
        chai.expect(parent).to.eql(bestCandidate);
    });
    it('Testing separation of containers from the rest', function () {
        rlg = new RLG();
        data.rectangles = [data.container1, data.container2, data.container3, data.targetContainer,
        data.targetContained, data.targetCollision, data.sibling];
        data.containers = [data.container1, data.container2, data.container3];
        data.contained = [data.targetContained, data.targetCollision, data.sibling];
        data.others = [];
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContainer);
        chai.expect([results.containers, results.contained, results.others]).to.eql([data.containers, data.contained, data.others]);
    });
    it('Testing separation of containers from the rest', function () {
        rlg = new RLG();
        data.rectangles = [data.container1, data.container2, data.container3, data.targetContainer,
        data.targetContained, data.targetCollision];
        data.containers = [data.container1, data.container2, data.container3, data.targetContainer];
        data.contained = [];
        data.others = [data.targetCollision];
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContained);
        chai.expect([results.containers, results.contained, results.others]).to.eql([data.containers, data.contained, data.others]);
    });
    it('Testing tightest container', function () {
        data.rectangles = [data.container1, data.container2, data.container3, data.targetContainer,
        data.targetContained, data.targetCollision];
        data.containers = [data.container1, data.container2, data.container3, data.targetContainer];
        data.contained = [];
        data.others = [data.targetCollision];
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContained);
        chai.expect(rlg.findTightestContainer(results.containers, data.targetContained)).to.eql(data.targetContainer);
    });
    it('Testing tightest container - two equal parents - single sub-xpath', function () {
        data.rectangles = [data.container1, data.container2, data.container3, data.targetContainer,
        data.targetContainerOverlap, data.targetContained, data.targetCollision];
        data.containers = [data.container1, data.container2, data.container3, data.targetContainer];
        data.contained = [];
        data.others = [data.targetCollision];
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContained);
        chai.expect(rlg.findTightestContainer(results.containers, data.targetContained)).to.eql(data.targetContainer);
    });
    it('Testing tightest container - two equal parents - single sub-xpath - out of order', function () {
        data.rectangles = [data.container1, data.container2, data.container3, data.targetContainerOverlap,
        data.targetContainer, data.targetContained, data.targetCollision];
        data.containers = [data.container1, data.container2, data.container3, data.targetContainer];
        data.contained = [];
        data.others = [data.targetCollision];
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContained);
        chai.expect(rlg.findTightestContainer(results.containers, data.targetContained)).to.eql(data.targetContainer);
    });
    it('Testing tightest container - three equal parents - one shorter and one longer sub-xpath', function () {
        data.rectangles = [data.container1, data.container2, data.container3, data.targetContainer,
        data.targetContainerOverlap, data.targetContainerOverlapWithSubPath,
        data.targetContained, data.targetCollision];
        data.containers = [data.container1, data.container2, data.container3, data.targetContainer];
        data.contained = [];
        data.others = [data.targetCollision];
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContained);
        chai.expect(rlg.findTightestContainer(results.containers, data.targetContained)).to.eql(data.targetContainer);
    });
    it('Testing tightest container - three equal parents - one shorter and one longer sub-xpath - out of order', function () {
        data.rectangles = [data.container1, data.container2, data.container3,
        data.targetContainerOverlapWithSubPath, data.targetContainerOverlap, data.targetContainer,
        data.targetContained, data.targetCollision];
        data.containers = [data.container1, data.container2, data.container3, data.targetContainer];
        data.contained = [];
        data.others = [data.targetCollision];
        let results = rlg.findIntersectionTypes(data.rectangles, data.targetContained);
        chai.expect(rlg.findTightestContainer(results.containers, data.targetContained)).to.eql(data.targetContainer);
    });
});
describe('Testing RBush spatial indexing JS library', function () {
    let rbush = undefined;
    beforeEach(function () {
        rbush = new RBush();
    });
    afterEach(function () {
        rbush.clear();
    });
    it('Testing intersection relationship - parent intersects child', function () {
        const parentRect = {
            minX: 0,
            maxX: 100,
            minY: 0,
            maxY: 100,
            xpath: 'parent'
        };
        const childRect = {
            minX: 40,
            maxX: 60,
            minY: 40,
            maxY: 60,
            xpath: 'child'
        };
        rbush.insert(parentRect);
        rbush.insert(childRect);
        const results = rbush.search(parentRect);
        chai.expect(results).to.eql([parentRect, childRect]);
    });
    it('Testing intersection relationship - child intersects parent', function () {
        const parentRect = {
            minX: 0,
            maxX: 100,
            minY: 0,
            maxY: 100,
            xpath: 'parent'
        };
        const childRect = {
            minX: 40,
            maxX: 60,
            minY: 40,
            maxY: 60,
            xpath: 'child'
        };
        rbush.insert(parentRect);
        rbush.insert(childRect);
        const results = rbush.search(childRect);
        chai.expect(results).to.eql([parentRect, childRect]);
    });
    it('Testing intersection relationship - same coordinates 100% overlap', function () {
        const firstRect = {
            minX: 50,
            maxX: 100,
            minY: 50,
            maxY: 100,
            xpath: 'first'
        };
        const secondRect = {
            minX: 50,
            maxX: 100,
            minY: 50,
            maxY: 100,
            xpath: 'second'
        };
        rbush.insert(firstRect);
        rbush.insert(secondRect);
        const results = rbush.search(firstRect);
        chai.expect(results).to.eql([firstRect, secondRect]);
    });
    it('Testing intersection relationship - left/right', function () {
        const leftRect = {
            minX: 50,
            maxX: 100,
            minY: 50,
            maxY: 100,
            xpath: 'left'
        };
        const rightRect = {
            minX: 100,
            maxX: 150,
            minY: 50,
            maxY: 100,
            xpath: 'right'
        };
        rbush.insert(leftRect);
        rbush.insert(rightRect);
        const results = rbush.search(leftRect);
        chai.expect(results).to.eql([leftRect, rightRect]);
    });
    it('Testing intersection relationship - top/bottom', function () {
        const topRect = {
            minX: 50,
            maxX: 100,
            minY: 50,
            maxY: 100,
            xpath: 'top'
        };
        const bottomRect = {
            minX: 50,
            maxX: 100,
            minY: 100,
            maxY: 150,
            xpath: 'bottom'
        };
        rbush.insert(topRect);
        rbush.insert(bottomRect);
        const results = rbush.search(topRect);
        chai.expect(results).to.eql([topRect, bottomRect]);
    });
    it('Testing intersection relationship - right-bottom/left-top corner', function () {
        const topLeftRect = {
            minX: 50,
            maxX: 100,
            minY: 50,
            maxY: 100,
            xpath: 'topLeft'
        };
        const bottomRightRect = {
            minX: 100,
            maxX: 150,
            minY: 100,
            maxY: 150,
            xpath: 'bottomRight'
        };
        rbush.insert(topLeftRect);
        rbush.insert(bottomRightRect);
        const results = rbush.search(topLeftRect);
        chai.expect(results).to.eql([topLeftRect, bottomRightRect]);
    });
});
describe('Testing the driver', function () {
    before(async () => {
        await driver.startup();
        await driver.setViewport(800, 1000, 1);
        const uri = 'file:///' + __dirname.replace(/\\/g, "/") + '/subjects/simple.html';
        await driver.goto(uri);
    });

    after(async () => {
        await driver.shutdown();
    });
    it('Browser exists (not undefined)', async () => {
        chai.expect(driver.browser).not.to.be.undefined;
    });
    it('Page exists (not undefined)', async () => {
        chai.expect(driver.page).not.to.be.undefined;
    });
    it('Take screenshot and verify save to file', async () => {
        const imageFileName = assist.getDateTimeString() + '.png';
        const imageFilePath = path.normalize(__dirname + '/images/') + imageFileName;
        await driver.screenshot(imageFilePath);
        chai.expect(chaiFiles.file(imageFilePath)).to.exist;
    });
    it('Fetch body element and check children count', async () => {
        let bodyElement = await driver.getBodyElement();
        let children = await driver.getChildren(bodyElement);
        assert.strictEqual(children.length, 5, 'Body children should be strictly equal to 5');
    });
    it('Capture DOM and count nodes', async () => {
        let testDOM = new DOM(driver);
        await testDOM.captureDOM();
        let nodeCount = 0;
        testDOM.traverse(function () { nodeCount++; }, nodeCount);
        assert.strictEqual(nodeCount, 18, 'Number of nodes should be strictly equal to 18');
    });
    it('Capture DOM and verify numbers of A nodes', async () => {
        let testDOM = new DOM(driver);
        await testDOM.captureDOM();
        let ANodes = [];
        testDOM.traverse(function () {
            if (this.tagname === "A")
                ANodes.push(this);
        }, ANodes);
        assert.strictEqual(ANodes.length, 3, 'The number of A tags is supposed to be strictly equal to 3');
    });
    it('Capture DOM and verify xpath numbers for buttons, button[2], and button[3]', async () => {
        let testDOM = new DOM(driver);
        await testDOM.captureDOM();
        let buttonNodes = [];
        testDOM.traverse(function () {
            if (this.tagname === "BUTTON")
                buttonNodes.push(this);
        }, buttonNodes);
        let idList = [];
        let nodeLabelList = [];
        for (let node of buttonNodes) {
            let id = await driver.getID(node.element);
            let nodeLabel = '1';
            if (node.xptagname.includes('[')) {
                nodeLabel = node.xptagname.slice(node.xptagname.indexOf('[') + 1, node.xptagname.indexOf(']'))
            }
            idList.push(id);
            nodeLabelList.push(nodeLabel);
        }
        chai.expect(nodeLabelList).to.eql(idList);
    });
});

