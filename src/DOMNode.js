const assist = require('./assist.js');
const fs = require('fs');

/**
 * Data structure to capture a DOM node.
 */
class DOMNode {
    /**
     * Constructor to store element reference.
     * @param {HTMLElement} element 
     */
    constructor(element) {
        this.element = element;

        this.parent = undefined;
        this.children = [];

        this.containedBy = [];
        this.containerOf = [];

        this.xpath = undefined;
        this.tagname = undefined;
        this.xptagname = undefined;
        this.rectangle = undefined;

        this.visible = undefined;
        this.addDescendantsToRLG = true; //add descendants to RLG

        //css properties used to determine visibility.
        this.display = undefined;
        this.visibility = undefined;
        this.opacity = undefined;
        this.filter = undefined;
        this.transform = undefined;
        this.overflow = undefined;
        this.clipPath = undefined;
    }
    /**
     * Sets all CSS properties involved in determining visibility.
     * @param {object} properties object with properties needed to be saved
     */
    setCSSVisibilityProperties(properties, viewport) {

        this.display = properties.display;
        this.visibility = properties.visibility;
        this.opacity = properties.opacity;
        this.filter = properties.filter;
        this.transform = properties.transform;
        this.overflow = properties.overflow;
        this.clipPath = properties.clipPath;
        this.color = properties.color;
        this.backgroundColor = properties.backgroundColor;
        this.borderLeftColor = properties.borderLeftColor;
        this.borderRightColor = properties.borderRightColor;
        this.borderTopColor = properties.borderTopColor;
        this.borderBottomColor = properties.borderBottomColor;

        this.setVisibility();
    }
    /**
     * Copy all properties in the passed in object onto this DOM node.
     * This can be used to copy any CSS properties to this DOM node.  
     * @param {Any} properties 
     */
    setProperties(properties) {
        Object.assign(this, properties);
    }
    /**
     * Save computed styles of node.  
     * @param {Any} computedStyles object with all computed styles of DOM node.
     */
    setComputedStyle(computedStyles) {
        this.computedStyles = computedStyles;
    }
    /**
     * Get computed styles of node.  
     * @return  object with all computed styles of DOM node.
     */
    getComputedStyle() {
        return this.computedStyles;
    }
    setVisibility() {
        let extendsVisibility =
            (this.opacity !== '0' &&
                this.display !== 'none' &&
                this.filter !== 'opacity(0)' &&
                this.transform !== 'scale(0)' &&
                !this.clipPath.includes('circle(0px') &&
                !(this.overflow === 'hidden' && (this.rectangle.height === 0 || this.rectangle.width == 0)));


        let transparentColor =
            this.color.includes('rgba') && this.color.includes('0)') &&
            this.backgroundColor.includes('rgba') && this.backgroundColor.includes('0)') &&
            this.borderLeftColor.includes('rgba') && this.borderLeftColor.includes('0)') &&
            this.borderRightColor.includes('rgba') && this.borderRightColor.includes('0)') &&
            this.borderTopColor.includes('rgba') && this.borderTopColor.includes('0)') &&
            this.borderBottomColor.includes('rgba') && this.borderBottomColor.includes('0)');

        this.visible = (this.visibility !== 'hidden' && !transparentColor && extendsVisibility);

        if (!extendsVisibility) {
            this.addDescendantsToRLG = false; //all descendants are invisible.
        }
    }
    /**
     * Creates a new Node as a child of this parent Node.
     * @param {HTMLElement} childElement reference to childe node.
     * @return {DOMNode} The newly created child node.
     */
    addChild(childElement) {
        let child = new DOMNode(childElement);
        child.parent = this;
        this.children.push(child);
        return child;
    }
    /**
     * Creates xpath of this node but assumes tagname is already set.
     * @param {String} tagname Must be provided to set tagname and xpath.
     * @param {String} addHTML Should the xpath add HTML element explicitly.
     */
    setXPath(tagname, addHTML = true) {
        if (tagname === undefined)
            throw "Tagname should be defined first";

        if (this.parent === undefined) {
            this.xptagname = tagname;
            if (addHTML)
                this.xpath = "/HTML/" + this.xptagname;
            else
                this.xpath = "/" + this.xptagname;
        } else {
            let isSVG = false;
            if (tagname === 'svg' || this.parent.xpath.includes('*' + assist.svg.prefix + 'svg' + assist.svg.postfix)) {
                isSVG = true;
                this.tagname = '*' + assist.svg.prefix + tagname + assist.svg.postfix;
            } else {
                this.tagname = tagname;
            }
            let count = 0;
            for (let i = 0; i < this.parent.children.length; i++) {
                if (this.parent.children[i].tagname === this.tagname)
                    count++;
            }
            if (count > 1) {
                this.xptagname = this.tagname + "[" + (count) + "]";
            }
            else {
                this.xptagname = this.tagname; //first element does not get a number
            }
            if (isSVG)
                this.xpath = this.parent.xpath + "//" + this.xptagname;
            else
                this.xpath = this.parent.xpath + "/" + this.xptagname;
        }
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
     * Prints details to console.
     */
    print() {
        console.log(this.tagname);
        console.log(this.xpath);
        console.log(this.rectangle);
    }
}

module.exports = DOMNode;