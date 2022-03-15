const DOMNode = require('./DOMNode.js');
const Rectangle = require('./Rectangle.js');
const RBush = require('rbush');
const assist = require('./assist.js');
const settings = require('../settings.js');
const path = require('path');
const fs = require('fs');

/**
* Data structure to capture the DOM tree.
*/
class DOM {
    /**
     * Constructor takes a reference to driver and creates RBush.
     * @param {BrowserDriver} driver reference to browser driver.
     * @param {Number} viewport The viewport size;
     */
    constructor(driver, viewport) {
        this.driver = driver;
        this.viewport = viewport;
        this.report = undefined;
        this.root = undefined;
        this.unmatched = [];
        this.rbush = new RBush();
        this.map = new Map(); //For easier access to nodes using XPath as key.
    }
    /**
     * Returns the DOM Node if it exists, undefined otherwise.
     * @param {XPath} xpath The xpath of the target RLG Node.
     */
    getDOMNode(xpath) {
        return this.map.get(xpath);
    }
    /**
     * Creates root Node, captures DOM, and inserts all rectangles in RBush.
     */
    async captureDOM(allNodes = false, getComputedStyle = false, pseudoElements = [], rootElement = undefined, xpath = undefined) {

        if (rootElement !== undefined) {
            this.root = new DOMNode(rootElement);
            if (xpath === undefined)
                this.root.setXPath(await this.driver.getTagname(this.root.element), false);
            else
                this.root.xpath = xpath;
        }
        else {
            this.root = new DOMNode(await this.driver.getBodyElement());
            this.root.setXPath(await this.driver.getTagname(this.root.element));
        }

        let traversalStackDOM = [];
        traversalStackDOM.push(this.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            domNode.rectangle = new Rectangle(await this.driver.getRectangle(domNode.element));
            domNode.rectangle.xpath = domNode.xpath; //Used as ID for RBush library.
            if (getComputedStyle) {
                domNode.setComputedStyle(await this.driver.getComputedStyle(domNode.element));
                for (let pseudoElement of pseudoElements) {
                    domNode[pseudoElement] = await this.driver.getComputedStyle(domNode.element, pseudoElement)
                }
            }
            domNode.setCSSVisibilityProperties(await this.driver.getVisibilityProperties(domNode.element));
            if (domNode.rectangle.visible === false) {//puppeteer determined not visible (Rectangle == null)
                domNode.visible = false;
            }
            if (settings.logViewports.includes(this.viewport) && settings.logXPaths.includes(domNode.xpath)) {
                console.log(domNode.xpath);
                console.log('minX: ' + domNode.rectangle.minX + ' maxX: ' + domNode.rectangle.maxX + ' minY: ' + domNode.rectangle.minY + ' maxY: ' + domNode.rectangle.maxY + ' width: ' + domNode.rectangle.width + ' height: ' + domNode.rectangle.height)
                //await assist.pause("Paused");
            }
            if (allNodes || (domNode.visible && domNode.addDescendantsToRLG && domNode.rectangle.validSize && domNode.rectangle.positiveCoordinates && !settings.excludeElementsWithDisplayValue.includes(domNode.display)))
                this.rbush.insert(domNode.rectangle);
            this.map.set(domNode.xpath, domNode);
            let childHandles = await this.driver.getChildren(domNode.element);
            for (let i = 0; i < childHandles.length; i++) {
                let capturedChildNode = domNode.addChild(childHandles[i]);
                capturedChildNode.addDescendantsToRLG = domNode.addDescendantsToRLG; //All descendants are invisible
                capturedChildNode.setXPath(await this.driver.getTagname(capturedChildNode.element));
                traversalStackDOM.push(capturedChildNode);
            }
        }
    }
    /**
     * Traverse this dom and execute function.
     * @param {Function} exec A function to execute on each node.
     * @param {boolean} domLevel True if the function is to be executed at the dom.
     * @param {...*} args A function to execute on each node.
     */
    traverse(exec, domLevel = false, ...args) {
        let traversalStackDOM = [];
        traversalStackDOM.push(this.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            if (domLevel === true) { //execute 'exec' function on this DOM.
                this.exec = exec;
                this.exec(domNode, ...args);
            } else { //execute 'exec' function on the DOMNode.
                domNode.exec = exec;
                domNode.exec(...args);
            }
            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
            domNode.exec = undefined;
            this.exec = undefined;
        }
    }
    /**
     * Save RBush object to disk. 
     * @param {number} directory directory where to save file.
     */
    saveRBushData(directory) {
        let fileName = 'viewport-' + this.viewport + '.json';
        try {
            fs.writeFileSync(path.join(directory, fileName), JSON.stringify(this.rbush))
        } catch (err) {
            console.error(err)
        }
    }
    /**
     * Remove all puppeteer references.
     */
    disposeAllElementHandles() {
        this.traverse(function () {
            this.element.dispose();
        });
    }
}


module.exports = DOM;

