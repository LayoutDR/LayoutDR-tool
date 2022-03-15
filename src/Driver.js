const puppeteer = require('puppeteer');
const assist = require('./assist.js');
const settings = require('../settings.js');
const { rec, Run } = require('./assist.js');
const Mode = assist.Mode;
const HighlightColors = assist.highlightColors;

let driver = {}; //store all globals to control puppeteer.

driver.startup =
    /**
     * Start a new browser and a new page.
     */
    async function (choice = Mode.HEADLESS) {
        let args = [];
        if (settings.run === Run.STATISTICS)
            args.push('--disable-web-security');
        if (choice === Mode.FULLSCREEN) {
            args.push('--start-fullscreen');
            driver.browser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: args,
                ignoreDefaultArgs: ["--enable-automation"]
            });
        }
        else if (choice == Mode.MAXIMIZED) {
            args.push('--start-maximized')
            driver.browser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: args,
                ignoreDefaultArgs: ["--enable-automation"]
            });

        } else { //headless
            driver.browser = await puppeteer.launch({
                defaultViewport: null,
                args: args,
                ignoreDefaultArgs: ["--enable-automation"]
            });
        }

        driver.page = await driver.browser.newPage();
        //Workaround to avoid information bar like "Set as Default Browser"
        let oldPage = driver.page;
        driver.page = await driver.browser.newPage();
        await oldPage.close();
        //driver.cdp = await driver.page.target().createCDPSession();
        await driver.page.setDefaultNavigationTimeout(0);
        return driver.page;
    };
driver.highlight =
    /**
     * Take a screenshot and save image to file.
     * @param {[Rectangle]} rectangles rectangles array to stroke.
     * @param {Image} screenshot screenshot image buffer.
     */
    async function (rectangles, screenshot, drawViewportWidthLine = false) {
        let screenshotHighlighted = await driver.page.evaluate(async function (rectangles, screenshot, colors, viewport, drawViewportWidthLine) {
            let canvas = document.createElement("CANVAS");
            let context = canvas.getContext("2d");
            let image = new Image();
            let imgLoadPromise = async function () {
                return new Promise((resolve, reject) => {
                    image.onload = () => { return resolve };
                    image.onerror = reject;
                });
            }
            image.src = 'data:image/png;base64,' + screenshot;
            await imgLoadPromise;
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            context.drawImage(image, 0, 0);


            //Stroke rectangles...
            context.lineWidth = 2;
            for (let i = 0; i < rectangles.length; i++) {
                let rectangle = rectangles[i];
                if (rectangle === undefined || rectangle === null)
                    continue;
                context.strokeStyle = "black";
                context.strokeRect(rectangle.minX, rectangle.minY, rectangle.width, rectangle.height);
            }
            for (let i = 0; i < rectangles.length; i++) {
                let rectangle = rectangles[i];
                if (rectangle === undefined)
                    continue;
                context.setLineDash([20 - i - 2, 8]);
                colorIndex = Math.min(i, colors.length - 1);
                context.strokeStyle = colors[colorIndex];
                context.strokeRect(rectangle.minX, rectangle.minY, rectangle.width, rectangle.height);
                context.setLineDash([]);
            }
            //Stroke viewport width line...
            if (drawViewportWidthLine) {
                context.beginPath();
                context.moveTo(viewport, 0);
                context.lineTo(viewport, canvas.height);
                context.setLineDash([4, 4]);
                context.strokeStyle = "black";
                context.stroke();
                context.setLineDash([2, 6]);
                context.strokeStyle = "white";
                context.beginPath();
                context.moveTo(viewport, 0);
                context.lineTo(viewport, canvas.height);
                context.stroke();

                context.setLineDash([]);
            }

            return canvas.toDataURL();
        }, rectangles, screenshot, HighlightColors, this.currentViewport, drawViewportWidthLine);
        return screenshotHighlighted;
    }
driver.clipImage =
    /**
     * Clip image down using rectangle coordinates.
     * @param {Image} screenshot screenshot image buffer.
     * @param {Rectangle} rectangle rectangle to clip image.
     */
    async function (screenshot, rectangle, fullViewportWidth = false, viewportWidth = Infinity) {
        let clippedScreenshot = await driver.page.evaluate(async function (rectangle, screenshot, fullViewportWidth, viewportWidth) {
            let canvas = document.createElement("CANVAS");
            let context = canvas.getContext("2d");
            let image = new Image();
            let imgLoadPromise = async function () {
                return new Promise((resolve, reject) => {
                    image.onload = () => { return resolve };
                    image.onerror = reject;
                });
            }
            image.src = 'data:image/png;base64,' + screenshot;
            await imgLoadPromise;
            let originalAreaRequested = "minX:" + rectangle.minX + " maxX:" + rectangle.maxX + " minY:" + rectangle.minY + " maxY:" + rectangle.maxY + " width:" + rectangle.width + " height:" + rectangle.height;
            if (fullViewportWidth) {
                rectangle.minX = 0;
                if (viewportWidth !== undefined)
                    rectangle.maxX = viewportWidth;
                else
                    rectangle.maxX = image.naturalWidth
            } else {
                rectangle.minX = Math.max(0, rectangle.minX);
                rectangle.maxX = Math.min(image.naturalWidth, rectangle.maxX);
            }

            rectangle.minY = Math.max(0, rectangle.minY);
            rectangle.maxY = Math.min(image.naturalHeight, rectangle.maxY);
            rectangle.width = rectangle.maxX - rectangle.minX;
            rectangle.height = rectangle.maxY - rectangle.minY;
            if (rectangle.width <= 0 || rectangle.height <= 0) {
                throw "\nError cannot clip canvas with width: \n" +
                "minX:" + rectangle.minX + " maxX:" + rectangle.maxX + " minY:" + rectangle.minY + " maxY:" + rectangle.maxY + " width:" + rectangle.width + " height:" + rectangle.height +
                "\n image-natural-width: " + image.naturalWidth +
                " image-natural-height: " + image.naturalHeight + "\n" +
                "Originally Requested Clipping:\n " + originalAreaRequested;
            }
            canvas.width = rectangle.width;
            canvas.height = rectangle.height;
            context.drawImage(image, rectangle.minX, rectangle.minY, rectangle.width, rectangle.height, 0, 0, rectangle.width, rectangle.height);

            return canvas.toDataURL();
        }, rectangle, screenshot, fullViewportWidth, viewportWidth);
        return clippedScreenshot;
    }
driver.cropImage =
    /**
     * Clop image down using rectangle coordinates.
     * @param {Image} screenshot screenshot image buffer.
     * @param {Number} top crop from top.
     * @param {Number} bottom crop from bottom.
     * @param {Number} left crop from left.
     * @param {Number} right crop from right.
     */
    async function (screenshot, top = 0, bottom = 0, left = 0, right = 0) {
        let croppedScreenshot = await driver.page.evaluate(async function (screenshot, top, bottom, left, right) {
            let canvas = document.createElement("CANVAS");
            let context = canvas.getContext("2d");
            let image = new Image();
            let imgLoadPromise = async function () {
                return new Promise((resolve, reject) => {
                    image.onload = () => { return resolve };
                    image.onerror = reject;
                });
            }
            image.src = 'data:image/png;base64,' + screenshot;
            await imgLoadPromise;

            if (image.naturalWidth <= (left + right) || image.naturalHeight <= (top + bottom)) {
                throw "\nError cropping canvas with...\n" +
                "\nimage-natural-width: " + image.naturalWidth +
                " image-natural-height: " + image.naturalHeight + "\n" +
                "Cropping Values...\nTop: " + top + "   Bottom: " + bottom + "   Left: " + left + "   Right: " + right;
            }
            canvas.width = image.naturalWidth - left - right;
            canvas.height = image.naturalHeight - top - bottom;
            context.drawImage(image, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

            return canvas.toDataURL();
        }, screenshot, top, bottom, left, right);
        return croppedScreenshot;
    }
driver.screenshotWithHighlights =
    /**
     * Take a screenshot and save image to file. Highlights element using
     * the input rectangles and colors corresponding to the rectangles.
     * @param {string} savePath Image name, PNG extension, and path.
     * @param {Rectangle} rectangles list of rectangles to highlight.
     */
    async function (savePath, rectangles) {
        //create overlay elements.
        await driver.page.evaluate(async function (rectangles, colors) {
            for (let i = 0; i < rectangles.length; i++) {
                let rectangle = rectangles[i];
                let color = colors[i];
                let overlayElement = document.createElement("div");
                overlayElement.setAttribute('id', 'overlayElement' + i);
                document.body.appendChild(overlayElement);
                overlayElement.style.cssText = ("position: absolute; box-sizing: border-box; background-color: white; opacity: 0.5;color: black; text-align: center;" + " top: " + (window.scrollY + rectangle.top) + "px;" + " left: " + (window.scrollX + rectangle.left) + "px;" + " height: " + rectangle.height + "px;" + " width: " + rectangle.width + "px;" + " z-index: " + 99999999 + ";" + " border: 2px dashed " + color + ";");
            }
        }, rectangles, HighlightColors);
        //take screenshot.
        //await assist.pause();
        await driver.page.screenshot({ path: savePath, fullPage: true }, savePath);
        //delete overlay elements.
        await driver.page.evaluate(async function (rectangles) {
            for (let i = 0; i < rectangles.length; i++) {
                let overlayElement = document.getElementById('overlayElement' + i);
                document.body.removeChild(overlayElement);
            }
        }, rectangles);
    }
driver.screenshot =
    /**
     * Take a screenshot and save image to file.
     * @param {string} savePath Image name, PNG extension, and path.
     */
    async function (savePath, fullPage = false, encoding64 = true) {
        let options = {
            path: savePath,
            fullPage: fullPage
        }
        if (encoding64)
            options.encoding = "base64";
        let screenshotPromise = await driver.page.screenshot(options);
        return screenshotPromise;
    }
driver.goto =
    /**
     * Navigate to web page URI.
     * @param {string} uri URI to web page.
     */
    async function (uri) {
        let gotoPromise = await driver.page.goto(uri, { waitUntil: 'networkidle0' });
        if (settings.run !== assist.Run.MANUAL && this.currentViewport !== settings.testingWidthMax)
            await this.setViewport(settings.testingWidthMax);
        if (settings.scrollPage === true)
            await this.fullPageScroll(settings.testingHeight);
        this.FirstScrollHeight = undefined;
        return gotoPromise;
    }
driver.getURL =
    function () {
        return driver.page.url();
    };
driver.setHeadlessViewportHeight =
    async function (scaleFactor) {
        if (settings.browserMode === assist.Mode.HEADLESS && this.FirstScrollHeight === undefined) {
            //Scrolling height must be from the widest testing viewport width.
            if (this.currentViewport !== settings.testingWidthMax) {
                this.currentViewport = settings.testingWidthMax;
                this.currentViewportHeight = settings.testingHeight;
                let options = {
                    width: this.currentViewport,
                    height: this.currentViewportHeight,
                    deviceScaleFactor: scaleFactor
                }
                await driver.page.setViewport(options);
                if (settings.loadDelay !== undefined)
                    await assist.resolveAfterSeconds(settings.loadDelay);
            }
            if (this.FirstScrollHeight === undefined) {
                this.FirstScrollHeight = await this.getPageScrollHeight();
                assist.log("Viewport Height Set To: " + this.FirstScrollHeight);
            }
        }
    }
driver.setViewport =
    /**
     * Set the viewport size.
     * @param {Number} widthV Viewport width.
     * @param {Number} heightV Viewport height.
     * @param {Number} scaleFactor Device scale factor.
     */
    async function (widthV, heightV = settings.testingHeight, scaleFactor = 1) {
        //this.setHeadlessViewportHeight(scaleFactor);
        if (this.currentViewport === undefined || this.currentViewport !== widthV || this.currentViewportHeight !== heightV) {
            this.currentViewport = widthV;
            this.currentViewportHeight = heightV;
            let options = {
                width: this.currentViewport,
                height: this.currentViewportHeight,
                deviceScaleFactor: scaleFactor
            }
            let viewportPromise = await driver.page.setViewport(options);
            if (settings.loadDelay !== undefined) {
                await assist.resolveAfterSeconds(settings.loadDelay);
            }
            return viewportPromise;
        }
    };

driver.fullPageScroll =
    async function (viewportHeight) {
        let maxAutoScroll = settings.maxAutoScroll;
        let autoScrollDelay = settings.autoScrollDelay * 1000;
        await this.page.evaluate(async (viewportHeight, autoScrollDelay, maxAutoScroll) => {
            await new Promise((resolve, reject) => {

                var totalHeight = window.scrollY;
                var finished = false;
                var timer = setInterval(() => {
                    let scrollHeight = window.scrollY;
                    if ((totalHeight > scrollHeight || totalHeight >= maxAutoScroll) && !finished) {
                        window.scrollTo(0, 0);
                        finished = true;
                    } else if ((totalHeight > scrollHeight || totalHeight >= maxAutoScroll) && finished) {
                        clearInterval(timer);
                        resolve();
                    } else {
                        window.scrollBy(0, viewportHeight);
                        totalHeight += viewportHeight;
                    }

                }, autoScrollDelay);

            }, viewportHeight, autoScrollDelay, maxAutoScroll);
        }, viewportHeight, autoScrollDelay, maxAutoScroll);
    }
driver.getElementAndDeclarationCount =
    /**
     * Returns number of HTML elements and CSS Declarations as interpreted by the webpage
     */
    async function () {
        return await this.page.evaluate(() => {
            let allElements = window.document.getElementsByTagName("*");
            let inlineStyleDeclarationCount = 0;
            let ruleCount = 0;
            let securityErrors = [];
            let sheets = window.document.styleSheets;
            for (z = 0; z < sheets.length; z++) {
                try {
                    let rules = sheets[z].cssRules || sheets[z].rules;
                    for (x = 0; x < rules.length; x++) {
                        if (rules[x] !== undefined)
                            if (rules[x].style !== undefined) {
                                ruleCount = ruleCount + rules[x].style.length;
                            }
                    }
                } catch (e) {
                    if (e.name !== 'SecurityError')
                        throw e;
                    else {
                        let errorSource = sheets[z].href;
                        securityErrors.push(errorSource)
                    }
                }
            }
            for (i = 0; i < allElements.length; i++) {
                let currentElement = allElements[i];
                if (currentElement.style !== undefined)
                    inlineStyleDeclarationCount = inlineStyleDeclarationCount + currentElement.style.length;
            }
            // console.log("    Elements: " + allElements.length);
            // console.log("    Inline Declarations: " + inlineStyleDeclarationCount);
            // console.log("    StyleSheet Declarations: " + ruleCount);
            // console.log("    Total Declarations: " + (ruleCount + inlineStyleDeclarationCount));
            return {
                elements: allElements.length,
                declarations: (ruleCount + inlineStyleDeclarationCount),
                securityErrors: securityErrors
            }
        });
    }
driver.scroll =
    /**
     * Scroll to coordinates to be displayed in the upper left corner.
     * @param {Number} x The x coordinates value.
     * @param {Number} y the y coordinates value.
     */
    async function (x = 0, y = 0) {
        await this.page.evaluate((x, y) => { window.scroll(x, y); }, x, y);
        if (settings.scrollDelay !== undefined)
            await assist.resolveAfterSeconds(settings.scrollDelay);
    }
driver.getPageScrollHeight =
    /**
     * Return width scroll height of documentElement (html element).
     */
    async function () {
        return await this.page.evaluate(() => {
            return Math.floor(document.documentElement.scrollHeight)
        });
    }
driver.getPageScrollWidth =
    /**
     * Return the scroll width of documentElement (html element).
     */
    async function () {
        return await this.page.evaluate(() => {
            return Math.floor(document.documentElement.scrollWidth)
        });
    }
    driver.getPageScrollHeightOrDocumentHeight =
    /**
     * Return width scroll height of documentElement (html element).
     */
    async function () {
        return await this.page.evaluate(() => {
            return Math.floor(Math.max(document.documentElement.scrollHeight,
                document.documentElement.getBoundingClientRect().height))
        });
    }
driver.getPageScrollWidthOrDocumentHeight =
    /**
     * Return the scroll width of documentElement (html element).
     */
    async function () {
        return await this.page.evaluate(() => {
            return Math.floor(Math.max(document.documentElement.scrollWidth,
                document.documentElement.getBoundingClientRect().width))
        });
    }
driver.shutdown =
    /**
     * Close browser.
     */
    async function () {
        let closePromise = await this.browser.close();
        return closePromise;
    };

driver.getBodyElement =
    /**
     * Get the body element from the page.
     */
    async function () {
        let bodyElement = await driver.page.$('body'); //return elementHandle
        return bodyElement;
    };
driver.getMaxElementHeight =
    /**
     * Gets maximum value of y+height over all elements.
     * @returns the height of the page.
     */
    async function () {
        return await this.page.evaluate((viewport) => {
            let traverse = [];
            let root = document.getElementsByTagName('html')[0];
            traverse.push(root);
            let height = 0;
            while (traverse.length > 0) {
                let element = traverse.shift();
                if (element.getBoundingClientRect) {
                    let rect = element.getBoundingClientRect();
                    if (rect !== undefined) {
                        let elementHeight = rect.y + rect.height;
                        if (elementHeight !== undefined && !isNaN(elementHeight)) {
                            if (!(rect.x + rect.width < 0) &&
                                !(rect.x > viewport)) {
                                if (elementHeight > height)
                                    height = elementHeight;
                            }
                        }
                    }
                    for (let child of element.children)
                        traverse.push(child);
                }
            }
            return Math.floor(height);
        }, this.currentViewport);
    }
driver.getHTMLElement =
    /**
     * Get the html element from the page.
     */
    async function () {
        let htmlElement = await driver.page.$('html'); //return elementHandle
        return htmlElement;
    };
driver.getPageHeightUsingHTMLElement =
    /**
     * Get the height of the page using the HTML element height Y + Height. 
     */
    async function () {
        let htmlElement = await driver.getHTMLElement();
        let rect = await driver.getRectangle(htmlElement);
        return Math.ceil(rect.y + rect.height);
    }
driver.addRepair =
    /**
     * Adds CSS repair using style tag and returns an element handle.
     * @param {CSS} repairCode The code to be added as content of style tag.
     */
    async function (repairCode) {
        let elementHandle = await driver.page.addStyleTag({ content: repairCode });
        if (settings.repairDelay != undefined && settings.repairDelay > 0)
            await assist.resolveAfterSeconds(settings.repairDelay);
        return elementHandle;
    };
driver.removeRepair =
    /**
     * Remove style element associated that contains the repair.
     * @param {elementHandle} element The element reference.
     */
    async function (element) {
        if (element === undefined) {
            throw "Error: no elementHandle passed in (removeRepair)";
        }
        await this.page.evaluate((element) => { element.parentNode.removeChild(element); }, element);
    };
driver.getID =
    /**
     * Get ID property of a an element.
     * @param {elementHandle} element The element reference.
     */
    async function (element) {
        let id = await element.evaluate(element => element.id);
        return id;
    };
driver.getTagname =
    /**
     * Get tagname of a an element.
     * @param {elementHandle} element The element reference.
     */
    async function (element) {
        let tagname = await element.evaluate(element => element.tagName);
        return tagname;
    };

driver.setBackgroundColor =
    /**
     * Set background-color of an element.
     * @param {elementHandle} element The element reference.
     * @param {number} color The color to set the element to.
     */
    async function (element, color) {
        await this.page.evaluate((element, color) => { element.style.backgroundColor = color }, element, color);
    };
driver.setMarginTop =
    /**
     * Set margin-top of an element.
     * @param {elementHandle} element The element reference.
     * @param {String} marginTop The margin-top to set the element to.
     */
    async function (element, marginTop) {
        await this.page.evaluate((element, marginTop) => { element.style.marginTop = marginTop }, element, marginTop);
    };
driver.setMarginLeft =
    /**
     * Set margin-Left of an element.
     * @param {elementHandle} element The element reference.
     * @param {String} marginLeft The margin-left property to set the element to.
     */
    async function (element, marginLeft) {
        await this.page.evaluate((element, marginLeft) => { element.style.marginLeft = marginLeft }, element, marginLeft);
    };
driver.setMinWidth =
    /**
     * Set min-width of an element.
     * @param {elementHandle} element The element reference.
     * @param {String} minWidth The minimum width to set the element to.
     */
    async function (element, minWidth) {
        await this.page.evaluate((element, minWidth) => { element.style.minWidth = minWidth }, element, minWidth);
    };
driver.setMinHeight =
    /**
     * Set min-height of an element.
     * @param {elementHandle} element The element reference.
     * @param {String} minHeight The minimum height to set the element to.
     */
    async function (element, minHeight) {
        await this.page.evaluate((element, minHeight) => { element.style.minHeight = minHeight }, element, minHeight);
    };
driver.getBackgroundColor =
    /**
     * get background-color of an element.
     * @param {elementHandle} element The element reference.
     */
    async function (element) {
        let color = await element.evaluate(element => element.style.backgroundColor);
        return color;
    };
driver.getMinWidth =
    /**
     * Return value of min-width.
     * @param {elementHandle} element The element reference.
     * @returns {Number} The min-width from computedStyle.
     */
    async function (element) {
        let minWidth = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);
                return style.minWidth;
            }, element)
        return minWidth;
    };
driver.getMarginTop =
    /**
     * Return value of margin-top.
     * @param {elementHandle} element The element reference.
     * @returns {String} The margin-top from computedStyle.
     */
    async function (element) {
        let marginTop = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);
                return style.marginTop;
            }, element)
        return marginTop;
    };
driver.getComputedStyle =
    /**
     * Return the computed styles.
     * @param {elementHandle} element The element reference.
     * @param {String} pseudoElement The target pseudoElement name.
     * @returns {object} The computedStyles.
     */
    async function (element, pseudoElement = undefined) {
        let styles = await element.evaluate(
            (element, pseudoElement) => {
                let style = undefined;
                if (pseudoElement !== undefined) {
                    let pe = ':' + pseudoElement;
                    style = window.getComputedStyle(element, pe);
                } else {
                    style = window.getComputedStyle(element);
                }
                return [...style].reduce((elementStyles, property) => ({ ...elementStyles, [property]: style.getPropertyValue(property) }), {})
            }, element, pseudoElement)
        return styles;
    };
driver.getMarginBottom =
    /**
     * Return value of margin-bottom.
     * @param {elementHandle} element The element reference.
     * @returns {String} The margin-bottom from computedStyle.
     */
    async function (element) {
        let marginBottom = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);
                return style.marginBottom;
            }, element)
        return marginBottom;
    };
driver.getMarginLeft =
    /**
     * Return value of margin-left.
     * @param {elementHandle} element The element reference.
     * @returns {String} The margin-left from computedStyle.
     */
    async function (element) {
        let marginLeft = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);
                return style.marginLeft;
            }, element)
        return marginLeft;
    };
driver.getMarginRight =
    /**
     * Return value of margin-right.
     * @param {elementHandle} element The element reference.
     * @returns {String} The margin-right from computedStyle.
     */
    async function (element) {
        let marginRight = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);
                return style.marginRight;
            }, element)
        return marginRight;
    };
driver.getDisplay =
    /**
     * Return value of display.
     * @param {elementHandle} element The element reference.
     * @returns {String} The display property from computedStyle.
     */
    async function (element) {
        let display = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);
                return style.display;
            }, element)
        return display;
    };
driver.isVisible =
    /**
     * Check if an element is visible.
     * @param {elementHandle} element The element reference.
     * @returns {boolean} True if the computed style opacity property is
     *  not set to 0 and the visibility property is not hidden.
     */
    async function (element) {
        let isVisible = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);
                const isVisible = (style &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    style.display !== 'none' &&
                    style.filter !== 'opacity(0)' &&
                    style.transform !== 'scale(0)' &&
                    !(style.overflow === 'hidden' && (style.height === 0 || style.width == 0)));
                return isVisible;
            }, element)
        return isVisible;
    };
driver.getVisibilityProperties =
    /**
     * Get visibility, opacity, display, ... , and overflow properties
     * from the getComputedStyle function of the element.
     * @param {elementHandle} element The element reference.
     * @returns {object} An object containing the properties.
     */
    async function (element) {
        let properties = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);

                const properties =
                {
                    visibility: style.visibility,
                    opacity: style.opacity,
                    display: style.display,
                    filter: style.filter,
                    transform: style.transform,
                    overflow: style.overflow,
                    color: style.color,
                    backgroundColor: style.backgroundColor,
                    borderLeftColor: style['border-left-color'],
                    borderRightColor: style['border-right-color'],
                    borderTopColor: style['border-top-color'],
                    borderBottomColor: style['border-bottom-color'],
                    clipPath: style['clip-path']
                }
                return properties;
            }, element)
        return properties;
    };
driver.getCSSRepairProperties =
    /**
     * Get visibility, opacity, display, ... , and overflow properties
     * from the getComputedStyle function of the element.
     * @param {elementHandle} element The element reference.
     * @returns {object} An object containing the properties.
     */
    async function (element) {
        let properties = await element.evaluate(
            (element) => {
                const style = window.getComputedStyle(element);
                const getProperties = ['min-width', 'width', 'max-width', 'min-height', 'height', 'max-height', 'font-size', 'line-height', 'display', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'border-left-width', 'border-right-width', 'border-top-width', 'border-bottom-width'];
                const properties = {};
                for (let key of getProperties) {
                    properties[key] = style[key];
                }
                properties.nodeType = element.nodeType;
                properties.nodeName = element.nodeName;
                return properties;
            }, element)
        return properties;
    };

driver.getElementByXpath =
    /**
     * Returns an element handle.
     * @param {String} path The xpath to evaluate.
     */
    async function (path) {
        await driver.page.waitForXPath(path);
        return await driver.page.$x(path);
    }
driver.getElementBySelector =
    /**
     * Returns an element handle.
     * @param {String} selector The selector to evaluate.
     */
    async function (selector) {
        await driver.page.waitForSelector(selector);
        let result = await driver.page.$(selector);
        if (result === null || result === undefined)
            throw selector + '\n not found';
        return result;
    }
driver.getRectangle =
    /**
     * Get coordinates of a an element.
     * @param {elementHandle} element The element reference.
     * @returns {Object} Object with x, y, width, and height properties
     */
    async function (element, traverseUp = false) {
        let bb = await element.boundingBox();
        if (traverseUp && bb === null) {
            while (bb === null) {
                element = await element.getProperty('parentNode');
                if (element === undefined || element === null)
                    throw "Traversed Up DOM But no more elements"
                bb = await element.boundingBox();
            }
        }
        return bb;
    };
driver.getContentBox =
    /**
     * Get content box of a an element as min X,Y and Width, and Height.
     * @param {elementHandle} element The element reference.
     * @returns {Object} Object with x, y, width, and height properties
     */
    async function (element) {
        let boxes = await element.boxModel();
        let rectangle = assist.getXYWidthHeightFromBox(boxes.content);
        return rectangle;
    };
driver.getPaddingBox =
    /**
     * Get padding box of a an element as min X,Y and Width, and Height.
     * @param {elementHandle} element The element reference.
     * @returns {Object} Object with x, y, width, and height properties
     */
    async function (element) {
        let boxes = await element.boxModel();
        let rectangle = assist.getXYWidthHeightFromBox(boxes.padding);
        return rectangle;
    };
driver.getBorderBox =
    /**
     * Get border box of a an element as min X,Y and Width, and Height.
     * @param {elementHandle} element The element reference.
     * @returns {Object} Object with x, y, width, and height properties
     */
    async function (element) {
        let boxes = await element.boxModel();
        let rectangle = assist.getXYWidthHeightFromBox(boxes.border);
        return rectangle;
    };
driver.getMarginBox =
    /**
     * Get margin box of a an element as min X,Y and Width, and Height.
     * @param {elementHandle} element The element reference.
     * @returns {Object} Object with x, y, width, and height properties
     */
    async function (element) {
        let boxes = await element.boxModel();
        let rectangle = assist.getXYWidthHeightFromBox(boxes.margin);
        return rectangle;
    };
// OLD driver.getRectangle =
//    async function (element) {
//        let rectangle = await element.evaluate(
//            (element) => {
//               const { top, left, bottom, right } = element.getBoundingClientRect();
//                return { top, left, bottom, right };
//            }, element)
//        return rectangle;
//    };
driver.getChildren =
    /**
     * Get children of a an element.
     * @param {elementHandle} element The element reference.
     */
    async function (element) {
        const listHandle = await driver.page.evaluateHandle(element => element.children, element);
        const properties = await listHandle.getProperties();
        const children = [];
        for (const property of properties.values()) {
            const child = property.asElement();
            if (child)
                children.push(child);
        }
        children; // holds elementHandles to all children of element
        return children;
    };



module.exports = driver;