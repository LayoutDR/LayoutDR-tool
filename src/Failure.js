const assist = require('./assist.js');
const { Range, Ranges } = require('./Ranges.js');
const path = require('path');
const Rectangle = require('./Rectangle.js');
const RepairStatistics = require('./RepairStatistics.js');
const settings = require('../settings.js');
const FailureType = assist.FailureType;
const RepairStrategy = assist.RepairStrategy;
const RepairType = assist.RepairType;
const RBush = require('rbush');
const ProgressBar = require('progress');
const { EOL } = require('os');
const RepairConfirmed = assist.RepairConfirmed;
const fs = require('fs');
const driver = require('./Driver.js');

class Failure {
    constructor(webpage, run) {
        this.webpage = webpage;
        this.run = run;
        this.ID = undefined;
        this.range = undefined;
        this.type = 'Unknown-Failure-Type';
        this.checkRepairLater = false;
        this.repairStats = new RepairStatistics();
        this.ID = assist.getNewFailureID(); //unique to entire run and all webpages
        assist.incrementFailureCount(); //counts failures of the current web page.
        this.repairElementHandle = undefined; //Style Element used to inject
        this.repairCSS = undefined; //CSS code for repair
        this.repairCSSComments = undefined; //CSS comments for repair
        this.repairApproach = undefined; //indicated which approach was successfully applied.
        this.removeFailingRepair = true;
        this.repairCombinationResult = [];
        this.durationFailureClassify = undefined;
        this.durationFailureRepair = undefined;
        this.durationWiderRepair = undefined;
        this.durationNarrowerRepair = undefined;
        this.durationWiderConfirmRepair = undefined;
        this.durationNarrowerConfirmRepair = undefined;

    }
    /**
     * Prepare data for human study related to this failure.
     */
    setupHumanStudyData() {
        this.hsData = { //will carry anonymous data only.
            ID: this.ID,
            type: this.type,
            rangeMin: this.range.min,
            rangeMax: this.range.max,
            rectangles: []
        };
        if (this.outputDirectory === undefined)
            throw "\nError - " + this.type + " has no output directory - ID:" + this.ID + "\n";
        this.hsKey = {
            humanStudyDirectory: path.join(this.outputDirectory, 'human-study', 'screenshots'),
            ID: this.ID,
            type: this.type,
            rangeMin: this.range.min,
            rangeMax: this.range.max,
            repairName: [],
            anonymizedImageNames: [],
            viewports: [],
            randomIDsUsed: [],
            rectangles: [],
            scrollY: []
        }
    }
    /**
     * Get image name composed of Failures ID - New Random Number
     */
    getAnonymousImageName(letter = undefined, viewport) {
        if (letter === undefined) {
            let number = assist.getRandomNumber(this.hsKey.randomIDsUsed);
            this.hsKey.randomIDsUsed.push(number);
            return this.ID + "-" + number;
        } else {
            if (letter.toLocaleLowerCase() === 'transform-narrower')
                return this.ID + '-' + viewport + '-N';
            if (letter.toLocaleLowerCase() === 'transform-wider')
                return this.ID + '-' + viewport + '-W';
            if (letter.toLocaleLowerCase() === 'failure')
                return this.ID + '-' + viewport + '-F';
        }
    }
    async screenshotForHumanStudy(repairName) {
        let oldViewport = driver.currentViewport;
        await this.screenshotForHumanStudyFullPage(repairName, this.range.getMinimum());
        //await this.screenshotForHumanStudyViewport(repairName, this.range.getMiddle())
        await this.screenshotForHumanStudyFullPage(repairName, this.range.getMaximum())
        await driver.setViewport(oldViewport);
    }
    async screenshotForHumanStudyFullPage(repairName, viewport) {
        let imageAnonymousName = this.getAnonymousImageName(repairName, viewport);
        this.hsKey.anonymizedImageNames.push(imageAnonymousName);
        let name = repairName + '-' + viewport;
        this.hsKey.repairName.push(name);
        this.hsKey.viewports.push(viewport);

        let imagePath = path.join(this.hsKey.humanStudyDirectory, imageAnonymousName + '.png');


        await driver.setViewport(viewport);
        let rectangles = await this.getRectangles(driver, true);
        this.hsData.rectangles.push(rectangles);

        await this.fullPageScreenshot(viewport, imagePath)
    }
    async screenshotForHumanStudyViewport(repairName, viewport, clipHeight = 500) {
        let imageAnonymousName = this.getAnonymousImageName(repairName, viewport);
        this.hsKey.anonymizedImageNames.push(imageAnonymousName);
        let name = repairName + '-' + viewport;
        this.hsKey.repairName.push(name);
        this.hsKey.viewports.push(viewport);

        let imagePath = path.join(this.hsKey.humanStudyDirectory, imageAnonymousName + '.png');
        ////await this.setViewportHeightBeforeSnapshots(viewport, settings.testingHeight);
        ////await this.screenshot(driver, imagePath, false, true, true, true);
        await driver.setViewport(viewport);
        let rectangles = await this.getRectangles(driver, true);
        this.hsData.rectangles.push(rectangles);
        let pageWidth = viewport;
        if (settings.humanStudyMoreViewportWidth)
            pageWidth = Math.max(viewport, await driver.getPageScrollWidth());
        await this.setViewportHeightBeforeSnapshots(pageWidth, settings.testingWidthMin, settings.testingWidthMax)
        //let tmp = await this.getYScrollForHumanStudyScreenshot();
        //let yScroll = tmp[0];
        //let rect = tmp[1];
        //let elementYCenter = Math.floor((rect.y + (rect.height / 2)))

        //let pageHeight = await driver.getPageHeightUsingHTMLElement();
        //if (settings.screenshotSpecial !== undefined && settings.screenshotSpecial.length > 0) {
        //    for (let name of settings.screenshotSpecial) {
        //        if (this.webpage.toLocaleLowerCase().includes(name.toLocaleLowerCase())) {
        //            pageHeight = await driver.getMaxElementHeight();
        //        }
        //    }
        //}
        let screenshot = await driver.screenshot(undefined, false);
        // if (settings.humanStudyClippedSnapshot)
        //     screenshot = await driver.cropImage(screenshot, top, bottom)
        let clip = this.getClippingCoordinates(rectangles, 0, 1000);
        if (settings.humanStudyClippedSnapshot && !clip.isMissingValues()) {
            screenshot = await this.clipScreenshot(rectangles, screenshot, driver, true, driver.currentViewport, clip);
        }
        this.saveScreenshot(imagePath, screenshot, settings.humanStudyClippedSnapshot);
        //this.hsData.rectangles = rectangles;
        //this.hsData.clip = clip;
        await this.resetViewportHeightAfterSnapshots(viewport);
    }
    async screenshotForHumanStudyViewportScroll(repairName, viewport, clipHeight = Math.floor(settings.testingHeight / 2)) {
        let imageAnonymousName = this.getAnonymousImageName(repairName, viewport);
        this.hsKey.anonymizedImageNames.push(imageAnonymousName);
        let name = repairName + '-' + viewport;
        this.hsKey.repairName.push(name);
        this.hsKey.viewports.push(viewport);

        let imagePath = path.join(this.hsKey.humanStudyDirectory, imageAnonymousName + '.png');
        await driver.setViewport(viewport);
        let rectangles = await this.getRectangles(driver, true);//
        let rect = this.getClippingCoordinates(rectangles, 0, 1000);//
        //let tmp = await this.getYScrollForHumanStudyScreenshot();
        //let yScroll = tmp[0];
        //let rect = tmp[1];
        let elementYCenter = Math.floor((rect.minY + (rect.height / 2)))
        let pageHeight = await driver.getPageHeightUsingHTMLElement();
        if (settings.screenshotSpecial !== undefined && settings.screenshotSpecial.length > 0) {
            for (let name of settings.screenshotSpecial) {
                if (this.webpage.toLocaleLowerCase().includes(name.toLocaleLowerCase())) {
                    pageHeight = await driver.getMaxElementHeight();
                }
            }
        }
        let yScroll = 0;
        let halfViewportHeight = Math.floor((settings.testingHeight / 2));
        if (elementYCenter > halfViewportHeight ||
            elementYCenter > halfViewportHeight) {
            yScroll = Math.max(0, elementYCenter - halfViewportHeight);
        }
        yScroll = Math.max(0, Math.min(yScroll, pageHeight - settings.testingHeight));
        assist.log('yScroll: ' + yScroll)

        await driver.scroll(0, yScroll);
        // if (yScroll > (pageHeight - clipHeight))
        //     yScroll = pageHeight - clipHeight;
        // let top = 0;
        // let bottom = 0;
        // if (yScroll !== 0) {
        //     await driver.scroll(0, yScroll);
        //     top = Math.floor(clipHeight / 2);
        //     bottom = Math.floor(clipHeight / 2);
        // } else {
        //     let topCalc = (elementYCenter - Math.floor(clipHeight / 2));
        //     let bottomCalc = (elementYCenter + Math.floor(clipHeight / 2))
        //     if (topCalc > 0)
        //         top = topCalc;
        //     else
        //         bottomCalc += (topCalc * -1)
        //     if (bottomCalc < settings.testingHeight)
        //         bottom = settings.testingHeight - bottomCalc;
        //     else {
        //         top -= bottomCalc - settings.testingHeight;
        //     }
        // }
        let screenshot = await driver.screenshot(undefined, false);
        if (settings.humanStudyClippedSnapshot) {
            let top = Math.max(0, rect.minY - yScroll);
            let bottom = settings.testingHeight - Math.min(settings.testingHeight, rect.maxY - yScroll);
            screenshot = await driver.cropImage(screenshot, top, bottom)
        }
        this.saveScreenshot(imagePath, screenshot, settings.humanStudyClippedSnapshot);
        if (yScroll > 0)
            await driver.scroll(0, 0);
    }
    async getYScrollForHumanStudyScreenshot() {
        let selector = this.node.getSelector();
        let element = await driver.getElementBySelector(selector);
        let rectangle = undefined
        if (element != undefined) {
            try {
                rectangle = await driver.getRectangle(element, true);
            } catch (err) {
                console.log(err);
            }
        }
        if (element !== undefined)
            element.dispose();
        let y = 0;
        if (rectangle != undefined)
            if (rectangle.x !== undefined && rectangle.y != undefined) {
                let elementYCenter = Math.floor((rectangle.y + (rectangle.height / 2)))
                let halfViewportHeight = Math.floor((settings.testingHeight / 2));
                if (rectangle.x > settings.testingHeight ||
                    rectangle.y > settings.testingHeight) {
                    y = Math.max(0, elementYCenter - halfViewportHeight);
                }
            }
        return [y, rectangle];
    }
    getHumanStudyData() {
        //json for human study
        if (this.hsKey.anonymizedImageNames !== undefined && this.hsKey.anonymizedImageNames.length > 0) {
            this.hsData.anonymizedImageNames = this.hsKey.anonymizedImageNames;
            return this.hsData;
        }
        return undefined;
    }
    printHumanStudyDataCSV(file) {
        if (settings.humanStudy === true) {
            for (let i = 0; i < this.hsKey.repairName.length; i++) {
                let repairName = this.hsKey.repairName[i];
                let imageName = this.hsKey.anonymizedImageNames[i];
                let text = this.webpage + "," + this.run + "," + this.ID + "," +
                    this.type + "," + this.range.getMinimum() + "," + this.range.getMaximum() + "," +
                    repairName + "," + imageName;
                assist.printToFile(file, text);
            }
        }
    }
    /**
     * Used if an RLF can have multiple ranges. Deprecated.
     */
    setID() {
        this.ID = assist.getNewFailureID(); //unique to entire run and all webpages
        assist.incrementFailureCount(); //counts failures of the current web page.
    }
    /**
     * Adds single range to the set of ranges. Deprecated
     * @param {Range} range The range to add.
     */
    addRange(range) {
        this.ranges.addRange(range);
    }
    /**
     * Adds a set of ranges to the set of ranges belonging to this failures. Deprecated
     * @param {Ranges} ranges The set of ranges to add to this set of ranges.
     */
    addRanges(ranges) {
        this.ranges.addRanges(ranges);
    }
    /**
     * Dom level verification of the reported failures.
     * @param {Driver} driver Browser driver.
     * @param {Path} classificationFile the classification output file.
     * @param {Path} snapshotDirectory the snapshot output directory.
     * @param {ProgressBar} bar Bar to update progress.
     */
    async classify(driver, classificationFile, snapshotDirectory, bar) {
        this.durationFailureClassify = new Date();
        let range = this.range

        await driver.setViewport(range.getNarrower(), settings.testingHeight);
        range.narrowerClassification = await this.isFailing(driver, range.getNarrower(), classificationFile, range) ? 'TP' : 'FP';
        if (settings.screenshotNarrower === true)
            await this.screenshotViewport(driver, range.getNarrower(), snapshotDirectory, true);

        await driver.setViewport(range.getMinimum(), settings.testingHeight);
        range.minClassification = await this.isFailing(driver, range.getMinimum(), classificationFile, range) ? 'TP' : 'FP';
        if (settings.screenshotMin === true)
            await this.screenshotViewport(driver, range.getMinimum(), snapshotDirectory, true);
        if (settings.humanStudy === true)
            await this.screenshotForHumanStudy('Failure');

        await driver.setViewport(range.getMiddle(), settings.testingHeight);
        range.midClassification = await this.isFailing(driver, range.getMiddle(), classificationFile, range) ? 'TP' : 'FP';
        if (settings.screenshotMid === true)
            await this.screenshotViewport(driver, range.getMiddle(), snapshotDirectory, true);

        await driver.setViewport(range.getMaximum(), settings.testingHeight);
        range.maxClassification = await this.isFailing(driver, range.getMaximum(), classificationFile, range) ? 'TP' : 'FP';
        if (settings.screenshotMax === true)
            await this.screenshotViewport(driver, range.getMaximum(), snapshotDirectory, true);

        await driver.setViewport(range.getWider(), settings.testingHeight);
        range.widerClassification = await this.isFailing(driver, range.getWider(), classificationFile, range) ? 'TP' : 'FP';
        if (settings.screenshotWider === true)
            await this.screenshotViewport(driver, range.getWider(), snapshotDirectory, true);

        bar.tick();
        this.durationFailureClassify = new Date() - this.durationFailureClassify;
    }
    /**
     * Repair this failure.
     * @param {Driver} driver Puppeteer driver object.
     * @param {Path} directory The image output directory.
     * @param {ProgressBar} bar Bar to update progress.
     * @param {String} webpage The name of the webpage.
     * @param {Number} run The current run number.     
     */
    async repair(driver, directory, bar, webpage, run) {
        this.durationFailureRepair = new Date();
        await this.findRepair(driver, directory, bar, webpage, run);
        this.durationFailureRepair = new Date() - this.durationFailureRepair;
    }
    /**
     * Prints the repairs attempted in CSV format.
     * @param {Path} file The file to print to.
     * @param {string} webpage The name of webpage.
     * @param {number} run The run number.
     */
    printWorkingRepairs(file, webpage, run) {
        for (let i = 0; i < this.repairCombinationResult.length; i++) {
            let repairArray = settings.repairCombination[i];
            let repairName = '';
            for (let subRepair of repairArray) {
                if (repairName === '')
                    repairName = subRepair;
                else
                    repairName += "-" + subRepair;
            }
            let xpaths = ''
            if (this.type === FailureType.COLLISION || this.type === FailureType.SMALLRANGE)
                xpaths = this.node.xpath + ',' + this.sibling.xpath;
            else if (this.type === FailureType.VIEWPORT || this.type === FailureType.PROTRUSION)
                xpaths = this.node.xpath + ',' + this.parent.xpath;
            else if (this.type === FailureType.WRAPPING)
                xpaths = this.node.xpath + ',' + this.row[0].xpath;
            let repairOutcome = this.repairCombinationResult[i];
            let text =
                EOL + webpage + "," + run + "," + this.ID + "," + this.type + "," + this.range.getMinimum() + "," + this.range.getMaximum() + "," + xpaths + "," + this.range.narrowerClassification + "," + this.range.minClassification + "," + this.range.midClassification + "," + this.range.maxClassification + "," + this.range.widerClassification + "," + repairName + "," + repairOutcome;
            fs.appendFileSync(file, text, function (err) {
                if (err) throw err;
            });
        }
        if (this.repairCombinationResult.length === 0) {
            let xpaths = ''
            if (this.type === FailureType.COLLISION || this.type === FailureType.SMALLRANGE)
                xpaths = this.node.xpath + ',' + this.sibling.xpath
            else if (this.type === FailureType.VIEWPORT || this.type === FailureType.PROTRUSION)
                xpaths = this.node.xpath + ',' + this.parent.xpath
            else if (this.type === FailureType.WRAPPING)
                xpaths = this.node.xpath + ',' + this.row[0].xpath;
            let repairOutcome = "Skipped";
            let repairName = 'None';
            let text =
                EOL + webpage + "," + run + "," + this.ID + "," + this.type + "," + this.range.getMinimum() + "," + this.range.getMaximum() + "," + xpaths + "," + this.range.narrowerClassification + "," + this.range.minClassification + "," + this.range.midClassification + "," + this.range.maxClassification + "," + this.range.widerClassification + "," + repairName + "," + repairOutcome;
            fs.appendFileSync(file, text, function (err) {
                if (err) throw err;
            });
        }
    }

    /**
     * Returns true if width of parent rectangles matches passed in rectangle.
     * @param {Driver} driver The browser driver.
     * @param {Number} width The width of rectangle of the parent at the wider viewport.
     */
    async equalsOracleWidth(driver, width) {
        let parent = await driver.getElementBySelector(this.parent.getSelector());
        let parentRect = new Rectangle(await driver.getRectangle(parent));
        return parentRect.width >= width;
    }
    /**
     * Repair the failure using the parent size form the oracle viewport.
     * @param {Driver} driver The browser driver.
     * @param {Range} range One failure range.
     * @param {Path} directory The image output directory.
     * @param {ProgressBar} bar Bar to update progress. 
     */
    async oracleParentPatch(driver, range, directory, bar) {
        let failureViewport = range.getMinimum();
        let oracleViewport = range.getWider();
        await driver.setViewport(failureViewport, settings.testingHeight);
        if (range.minClassification === 'TP') { //Needs Repair.
            if (await this.isFailing(driver)) { //Attempt to repair failure only if there is a problem.
                if (range.widerClassification === 'TP') { //Oracle width will not repair it.
                    this.checkRepairLater = true;
                } else {
                    await driver.setViewport(oracleViewport, settings.testingHeight);
                    let parent = await driver.getElementBySelector(this.parent.getSelector());
                    let parentRect = new Rectangle(await driver.getRectangle(parent));
                    let maxWidth = Math.min(parentRect.width, failureViewport)
                    this.repairElementHandle = await driver.addRepair(this.oracleParentRepairCSS(maxWidth));
                    //await driver.setMinWidth(parent[0], parentRect.width + "px");
                    if (settings.repairDelay != undefined && settings.repairDelay > 0)
                        await assist.resolveAfterSeconds(settings.repairDelay);
                    await driver.setViewport(failureViewport, settings.testingHeight);
                    if (await this.isFailing(driver)) { //Repair failed
                        this.checkRepairLater = true;
                        if (this.equalsOracleWidth(driver, maxWidth))
                            this.repairStats.oracleApplied++;
                    } else {//Repair worked
                        this.repairStats.repairs++;
                        let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-repaired.png';
                        let imagePath = path.join(directory, "snapshots", imageFileName);

                        await this.screenshot(driver, imagePath, settings.screenshotHighlights);
                        bar.tick();
                    }
                }
            } else { //Another repair solved the problem
                this.repairStats.repairedByOthers++;
                bar.tick();
            }
        } else { //FP 
            this.repairStats.doesNotNeedRepair++;
            bar.tick();
        }
    }
    /**
     * Delete repair 
     */
    async deleteRepair() {
        if (this.repairElementHandle !== undefined) {
            await driver.removeRepair(this.repairElementHandle);
            this.repairCSS = undefined;
            await this.repairElementHandle.dispose();
        }
    }
    /**
     * Inject passed in CSS as a repair and check if repaired.
     * @param {String} css the css making up the repair.
     * @param {String} repairName the name of the repair.
     * @param {Path} outputDirectory The output directory.
     */
    async isRepaired(css, repairName, outputDirectory, webpage, run) {
        let repaired = false;
        if (css !== undefined) {
            let miniRLGDirectory = path.join(outputDirectory, 'mini-rlg', this.ID.toString(), repairName);
            fs.mkdirSync(miniRLGDirectory, { recursive: true });
            await this.injectRepair(css);
            if (settings.repairConfirmUsing === RepairConfirmed.RLG)
                repaired = await this.isRepairedRLG(driver, outputDirectory, miniRLGDirectory, webpage, run, repairName, this.ID);
            else if (settings.repairConfirmUsing === RepairConfirmed.DOM)
                repaired = await this.isRepairedDOM(driver, repairName, outputDirectory);
            else if (settings.repairConfirmUsing === RepairConfirmed.DOMRLG) {
                repaired = await this.isRepairedDOM(driver, repairName, outputDirectory);
                if (repaired)
                    repaired = await this.isRepairedRLG(driver, outputDirectory, miniRLGDirectory, webpage, run, repairName, this.ID);
            }
        }
        if (settings.humanStudy === true && repaired)
            await this.screenshotForHumanStudy(repairName);
        return repaired;
    }
    /**
     * Injects CSS into the page then applies the delay in global settings
     * if any.
     * @param {String} css The CSS to inject as a repair.
     */
    async injectRepair(css) {
        this.repairElementHandle = await driver.addRepair(css);
    }
    /**
     * Checks if isFailing after the delay is executed without using an RLG.
     * This method relies on the classification approach for detected failures.
     * @param {Driver} driver The driver of the browser.
     * @param {String} repairName the name of the repair applied.
     * @param {Path} directory directory path where to store snapshot.
     */
    async isRepairedDOM(driver, repairName, directory) {
        let failureViewport = this.range.getMinimum();
        if (driver.currentViewport !== failureViewport)
            await driver.setViewport(failureViewport, settings.testingHeight);
        let failed = await this.isFailing(driver)
        let repaired = !failed;
        if (repaired && directory !== undefined) {
            let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-repaired-' + repairName + '.png';
            let imagePath = path.join(directory, "snapshots", imageFileName);
            await this.screenshot(driver, imagePath, settings.screenshotHighlights);
            let maxViewport = this.range.getMaximum();
            if (driver.currentViewport !== maxViewport)
                await driver.setViewport(maxViewport, settings.testingHeight);
            imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + maxViewport + '-repaired-' + repairName + '.png';
            imagePath = path.join(directory, "snapshots", imageFileName);
            await this.screenshot(driver, imagePath, settings.screenshotHighlights);
        } else if (!repaired && directory !== undefined) {
            if (settings.screenshotFailingRepairs) {
                let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-FAILED-DOM-' + repairName + '.png';
                let imagePath = path.join(directory, "snapshots", imageFileName);
                await this.screenshot(driver, imagePath, settings.screenshotHighlights);
            }
        }
        return repaired;
    }

    /**
     * This method creates a new RLG to check if failure is repaired.
     * @param {Driver} driver The driver of the browser.
     * @param {Path} directory directory path where to store snapshot.
     */
    async isRepairedRLG(driver, directory, miniRLGDirectory, webpage, run, repair, id) {
        let dir = directory;
        if (miniRLGDirectory !== undefined)
            dir = miniRLGDirectory;
        let rlg = await this.getNewRLG(undefined, undefined, dir);
        //rlg.printGraph(directory + path.sep + this.ID + '-RLG-' + this.repairApproach + '.txt');
        let failureExists = rlg.hasFailure(this);
        if (failureExists === false) {
            if (miniRLGDirectory !== undefined && webpage !== undefined && run !== undefined && repair !== undefined && id !== undefined) {
                rlg.printFailuresCSV(path.join(miniRLGDirectory, 'mini-failures.csv'), webpage, run, repair, id);
            }
            let failureViewport = this.range.getMinimum();
            if (driver.currentViewport !== failureViewport)
                await driver.setViewport(failureViewport, settings.testingHeight);
            let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-repaired-' + repair + '.png';
            let imagePath = path.join(directory, "snapshots", imageFileName);
            await this.screenshot(driver, imagePath, settings.screenshotHighlights);
            //
            // Take image of repair at maximum of viewport range... 
            //
            // let maxViewport = this.range.getMaximum();
            // if (driver.currentViewport !== maxViewport)
            //     await driver.setViewport(maxViewport, settings.testingHeight);
            // imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + maxViewport + '-repaired-' + repair + '.png';
            // imagePath = path.join(directory, "snapshots", imageFileName);
            // await this.screenshot(driver, imagePath);
            return true;
        } else {
            if (settings.screenshotFailingRepairs) {
                let failureViewport = this.range.getMinimum();
                if (driver.currentViewport !== failureViewport)
                    await driver.setViewport(failureViewport, settings.testingHeight);
                let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-FAILED-RLG-' + repair + '.png';
                let imagePath = path.join(directory, "snapshots", imageFileName);
                await this.screenshot(driver, imagePath, settings.screenshotHighlights);
            }

            return false;
        }
    }
    /**
     * Repair the failure using strategies declared.
     * @param {Driver} driver The browser driver.
     * @param {Path} outputDirectory The output directory.
     * @param {ProgressBar} bar Bar to update progress. 
     * @param {String} webpage The name of the webpage.
     * @param {Number} run The current run number.
     */
    async findRepair(driver, outputDirectory, bar, webpage, run) {
        let cssRepairedDirectory = path.join(outputDirectory, 'CSS', 'repaired');
        let cssFailedDirectory = path.join(outputDirectory, 'CSS', 'failed');


        let failureViewport = this.range.getMinimum();
        await driver.setViewport(failureViewport, settings.testingHeight);
        if (this.range.minClassification === 'TP') { //Needs Repair.
            //if (await this.isFailing(driver)) { //Attempt to repair failure only if there is a problem.
            //if (await this.isFailing(driver)) { //Attempt to repair failure only if there is a problem.
                this.repairCombinationResult = [];

                //let repairBar = new ProgressBar('Repair ' + this.ID + '      [:bar] :etas Attempt:       :token1/' + settings.repairCombination.length, { incomplete: ' ', total: settings.repairCombination.length, width: 25 })
                let count = 0;
                for (let repair of settings.repairCombination) {
                    this.repairApproach = '';

                    //Create CSS repairs in-order.
                    // for (let subRepair of repair) {
                    //     if (this.repairApproach === '')
                    //         this.repairApproach = subRepair;
                    //     else
                    //         this.repairApproach += "-" + subRepair;
                    //     if (subRepair === "bodyMaximizeWidthToViewportCSS")
                    //         this.bodyMaximizeWidthToViewportCSS()
                    //     if (subRepair === "elementMaxWidthMaxHeightCSS")
                    //         this.elementMaxWidthMaxHeightCSS()
                    //     if (subRepair === "parentMaxWidthMaxHeightCSS")
                    //         this.parentMaxWidthMaxHeightCSS()
                    //     if (subRepair === "htmlDescendantsMaxWidthMaxHeight")
                    //         this.htmlDescendantsMaxWidthMaxHeightCSS()
                    //     if (subRepair === "ancestorsMaxWidthHeightCSS")
                    //         this.ancestorsMaxWidthHeightCSS()
                    //     if (subRepair === "parentMinWidthHeightCSS") {
                    //         if (this.range.widerClassification === 'FP') { //comparison viewport should repair it.
                    //             let oracle = await this.getParentWidthHeight(driver);
                    //             this.parentMinWidthHeightCSS(oracle.width, oracle.height);
                    //         }
                    //     }
                    //     if (subRepair === "shrinkSiblingsCSS") {
                    //         if (this.range.widerClassification === 'FP') { //comparison viewport should repair it.
                    //             let rowSiblings = await this.getRowSiblings(driver);
                    //             this.shrinkSiblingsCSS(rowSiblings);
                    //         }
                    //     }
                    //     if (subRepair === 'pushApart') {
                    //         if (this.type === FailureType.COLLISION) {
                    //             await this.pushApart(driver)
                    //         }
                    //     }
                    //     if (subRepair === 'setProtrudingElementToParentSize') {
                    //         if (this.type !== FailureType.COLLISION) {
                    //             let available = await this.getAvailableWidthHeightWithinParent(driver, this.range.getMinimum());
                    //             if (available.width !== undefined || available.height !== undefined)
                    //                 this.elementMinMaxWidthHeightCSS(available.width, available.height);
                    //         }
                    //     }
                    //     if (subRepair === 'autoWidthHeightElement') {
                    //         if (this.type !== FailureType.COLLISION) {
                    //             this.autoWidthHeightCSS(this.node);
                    //         }
                    //     }
                    //     if (subRepair === 'autoWidthHeightParent') {
                    //         this.autoWidthHeightCSS(this.parent);
                    //     }
                    //     if (subRepair === 'marginsToZeroCSS') {
                    //         this.marginsToZeroCSS(this.node)
                    //         if (this.type === FailureType.COLLISION) {
                    //             this.marginsToZeroCSS(this.sibling)
                    //         }
                    //     }
                    //     if (subRepair === 'negativeMarginsToZeroCSS') {
                    //         await this.negativeMarginsToZeroCSS(this.node);
                    //         if (this.type === FailureType.COLLISION) {
                    //             await this.negativeMarginsToZeroCSS(this.sibling);
                    //         }
                    //     }
                    //     if (subRepair === 'differenceComputedStylesCSS') {
                    //         await this.differenceComputedStylesCSS(driver, this.node);
                    //         if (this.type === FailureType.COLLISION) {
                    //             await this.differenceComputedStylesCSS(driver, this.sibling);
                    //         } else if (this.type === FailureType.PROTRUSION || this.type === FailureType.VIEWPORT) {
                    //             await this.differenceComputedStylesCSS(driver, this.parent);
                    //         }
                    //     }
                    //     if (subRepair === 'expandParentCSS') {
                    //         await this.expandParentCSS(driver);
                    //     }
                    //     if (subRepair === 'allElementsAutoRestrictedMax') {
                    //         this.allElementsAutoRestrictedMaxCSS();
                    //     }
                    //     if (subRepair === 'overflowAuto') {
                    //         if (this.type === FailureType.PROTRUSION)
                    //             this.overflowAutoCSS(this.parent);
                    //     }
                    //     let pseudoElements = []//['after', 'before']//, 'first-letter', 'first-line'];


                    // }

                    let css = undefined;
                    let repaired = false;
                    let attemptedRepair = false;
                    let rlgNode = this.node.getParentAtViewport(this.range.getWider());
                    let pseudoElements = []//['after', 'before']//, 'first-letter', 'first-line'];
                    let repairName = ''

                    if (repair.includes('Transform-Wider')) {
                        this.durationWiderRepair = new Date();
                        if (this.range.widerClassification === 'FP') {
                            attemptedRepair = true;
                            repairName = repair[0];
                            await driver.setViewport(this.range.getWider(), settings.testingHeight);
                            let htmlElement = await driver.getHTMLElement();
                            let domWider = await this.getDOMFrom(driver, this.range.getWider(), pseudoElements, htmlElement);
                            css = this.getDOMStylesAsCSS(domWider);
                            if (!(settings.humanStudy && settings.humanStudyMoreViewportWidth && settings.browserMode === assist.Mode.HEADLESS))
                                css = this.makeRuleCSS(css);
                            //Scale ratio specifically made for viewport...
                            let min = this.range.getMinimum();
                            let max = this.range.getMaximum();
                            if (!(settings.humanStudy && settings.humanStudyMoreViewportWidth && settings.browserMode === assist.Mode.HEADLESS))
                            {
                                min = settings.testingWidthMin;
                                max= settings.testingRangeMax;
                            }
                            for (let failureViewport = min; failureViewport <= max; failureViewport++) {
                                let scaleValue = failureViewport / this.range.getWider();
                                let scaleCSS = this.getTransformScaleCSS(scaleValue);
                                let scaleCSSRule = this.makeRuleCSS(scaleCSS, false, failureViewport, failureViewport);
                                css += scaleCSSRule;
                            }
                            this.durationWiderConfirmRepair = new Date();
                            repaired = await this.isRepaired(css, repairName, outputDirectory, webpage, run);
                            this.durationWiderConfirmRepair = new Date() - this.durationWiderConfirmRepair;
                            css = await this.resolveRepair(repaired, cssRepairedDirectory, repairName, cssFailedDirectory, css);
                        }
                        this.durationWiderRepair = new Date() - this.durationWiderRepair;
                    }
                    if (repair.includes('Transform-Wider-Targeted')) {
                        if (this.range.widerClassification === 'FP') {
                            let parent = this.node.getParentAtViewport(this.range.getWider());
                            attemptedRepair = true;
                            repairName = repair[0];
                            await driver.setViewport(this.range.getWider(), settings.testingHeight);
                            let root = await driver.getElementBySelector(parent.getSelector());
                            let domWider = await this.getDOMFrom(driver, this.range.getWider(), pseudoElements, root, parent.xpath);
                            css = this.getDOMStylesAsCSS(domWider);
                            css = this.makeRuleCSS(css);
                            //Scale ratio specifically made for viewport...
                            for (let failureViewport = this.range.getMinimum(); failureViewport <= this.range.getMaximum(); failureViewport++) {
                                let scaleValue = failureViewport / this.range.getWider();
                                let scaleCSS = this.getTransformScaleCSS(scaleValue, parent.getSelector());
                                let scaleCSSRule = this.makeRuleCSS(scaleCSS, false, failureViewport, failureViewport);
                                css += scaleCSSRule;
                            }
                            repaired = await this.isRepaired(css, repairName, outputDirectory, webpage, run);
                            css = await this.resolveRepair(repaired, cssRepairedDirectory, repairName, cssFailedDirectory, css);
                        }
                    }
                    if (repair.includes('Transform-Narrower')) {
                        this.durationNarrowerRepair = new Date();
                        let narrowerViewportWidth = this.range.getNarrower();
                        if (narrowerViewportWidth >= settings.testingWidthMin && this.range.narrowerClassification === 'FP') {
                            attemptedRepair = true;
                            repairName = repair[0];
                            await driver.setViewport(this.range.getNarrower(), settings.testingHeight);
                            let htmlElement = await driver.getHTMLElement();
                            let domNarrower = await this.getDOMFrom(driver, this.range.getNarrower(), pseudoElements, htmlElement);
                            css = this.getDOMStylesAsCSS(domNarrower);
                            if (!(settings.humanStudy && settings.humanStudyMoreViewportWidth && settings.browserMode === assist.Mode.HEADLESS))
                                css = this.makeRuleCSS(css);
                            //Scale ratio specifically made for viewport...
                            let min = this.range.getMinimum();
                            let max = this.range.getMaximum();
                            if (!(settings.humanStudy && settings.humanStudyMoreViewportWidth && settings.browserMode === assist.Mode.HEADLESS))
                            {
                                min = settings.testingWidthMin;
                                max= settings.testingRangeMax;
                            }
                            for (let failureViewport = min; failureViewport <= max; failureViewport++) {
                                let scaleValue = failureViewport / this.range.getNarrower();
                                let scaleCSS = this.getTransformScaleCSS(scaleValue);
                                let scaleCSSRule = this.makeRuleCSS(scaleCSS, false, failureViewport, failureViewport);
                                css += scaleCSSRule;
                            }
                            this.durationNarrowerConfirmRepair = new Date();
                            repaired = await this.isRepaired(css, repairName, outputDirectory, webpage, run);
                            this.durationNarrowerConfirmRepair = new Date() - this.durationNarrowerConfirmRepair;
                            css = await this.resolveRepair(repaired, cssRepairedDirectory, repairName, cssFailedDirectory, css);
                        }
                        this.durationNarrowerRepair = new Date() - this.durationNarrowerRepair;
                    }

                    if (repair.includes('widerComparisonViewportSpacing')) {
                        if (this.range.widerClassification === 'FP') {
                            attemptedRepair = true;
                            repairName = repair[0];
                            let domMin = await this.getDOMFrom(driver, this.range.getMinimum(), pseudoElements);
                            let widerViewportWidth = this.range.getWider();
                            let domWider = await this.getDOMFrom(driver, widerViewportWidth, pseudoElements);
                            this.WiderComparisonViewportSpacingCSS(domWider, domMin, widerViewportWidth, pseudoElements)
                            css = this.makeRuleCSS();
                            repaired = await this.isRepaired(css, repairName, outputDirectory, webpage, run);
                            css = await this.resolveRepair(repaired, cssRepairedDirectory, repairName, cssFailedDirectory, css);
                        }
                    }
                    if (repair.includes('narrowerComparisonViewportSpacing')) {
                        repairName = repair[0];
                        let narrowerViewportWidth = this.range.getNarrower();
                        if (narrowerViewportWidth >= settings.testingWidthMin && this.range.narrowerClassification === 'FP') {
                            attemptedRepair = true;
                            let domMin = await this.getDOMFrom(driver, this.range.getMinimum(), pseudoElements);
                            let domNarrower = await this.getDOMFrom(driver, narrowerViewportWidth, pseudoElements);
                            this.narrowerComparisonViewportSpacingCSS(domNarrower, domMin, narrowerViewportWidth, pseudoElements);
                            css = this.makeRuleCSS();
                            repaired = await this.isRepaired(css, repairName, outputDirectory, webpage, run);
                            css = await this.resolveRepair(repaired, cssRepairedDirectory, repairName, cssFailedDirectory, css);
                        }
                    }

                    if (repair.includes('widerComparisonElements')) {
                        if (this.range.widerClassification === 'FP') {
                            attemptedRepair = true;
                            let domWider = await this.getDOMFrom(driver, this.range.getWider(), pseudoElements);
                            this.associateRLGNodesToDOMNodes(domWider, this.node.rlg);
                            let ancestorLevel = 0;
                            while (repaired === false && rlgNode !== undefined) {
                                ancestorLevel++;
                                if (this.ID == 2)
                                    assist.log('Level: ' + ancestorLevel);
                                repairName = repair + '-' + ancestorLevel;
                                this.widerComparisonElements(domWider, rlgNode);
                                css = this.makeRuleCSS();
                                repaired = await this.isRepaired(css, repairName, outputDirectory, webpage, run);
                                if (repaired === false) {
                                    this.saveRepairToFile(path.join(cssFailedDirectory, this.ID + '-' + repairName + ".css"), css)
                                    await this.deleteRepair();
                                    css = undefined;
                                    rlgNode = rlgNode.getParentAtViewport(this.range.getWider());
                                }
                                else if (repaired === true) {
                                    this.repairCombinationResult.push("Repaired");
                                    this.saveRepairToFile(path.join(cssRepairedDirectory, this.ID + '-' + repairName + ".css"), css)
                                }
                            }
                        }
                    }
                    // let repairName = '';
                    // for (let subRepair of repair) {
                    //     if (repairName === '')
                    //         repairName = subRepair;
                    //     else
                    //         repairName += '-' + subRepair;
                    // }
                    // let repaired = false;
                    // let css = this.makeRuleCSS();
                    if (attemptedRepair) {
                        // let miniRLGDirectory = path.join(outputDirectory, 'mini-rlg', this.ID.toString(), repairName);
                        // fs.mkdirSync(miniRLGDirectory, { recursive: true });
                        // this.repairElementHandle = await driver.addRepair(css);
                        // if (settings.repairConfirmUsing === RepairConfirmed.RLG)
                        //     repaired = await this.isRepairedRLG(driver, outputDirectory, miniRLGDirectory, webpage, run, repairName, this.ID);
                        // else if (settings.repairConfirmUsing === RepairConfirmed.DOM)
                        //     repaired = await this.isRepairedDOM(driver, repairName, outputDirectory);
                        // else if (settings.repairConfirmUsing === RepairConfirmed.DOMRLG) {
                        //     repaired = await this.isRepairedDOM(driver, repairName);
                        //     if (repaired)
                        //         repaired = await this.isRepairedRLG(driver, outputDirectory, miniRLGDirectory, webpage, run, repairName, this.ID);

                        // }

                        if (repaired) {
                            // this.repairCombinationResult.push("Repaired");
                            // this.saveRepairToFile(path.join(cssRepairedDirectory, this.repairApproach + ".css"))
                            if (settings.aftermath) {
                                //look at aftermath (Second RLG extraction)
                                let aftermathDirectory = path.join(outputDirectory, 'repair-aftermath', this.ID.toString(), repairName);
                                fs.mkdirSync(aftermathDirectory, { recursive: true });
                                let aftermathDOMsDirectory = path.join(aftermathDirectory, "DOMs");
                                fs.mkdirSync(aftermathDOMsDirectory);
                                let aftermathFile = path.join(aftermathDirectory, 'Failures.csv');
                                let rlg = await this.getNewRLG(settings.testingWidthMin, settings.testingWidthMax, aftermathDOMsDirectory);
                                await rlg.classifyFailures(driver, aftermathDirectory + path.sep + 'Classifications.txt', aftermathDirectory);
                                rlg.printFailuresCSV(aftermathFile, webpage, run, repair, this.ID);
                                rlg.printGraph(path.join(aftermathDirectory, 'RLG.txt'));
                            }
                        }
                        else {
                            this.repairCombinationResult.push("Failed");
                            // this.saveRepairToFile(path.join(cssFailedDirectory, this.repairApproach + ".css"))
                        }
                    }
                    else {
                        this.repairCombinationResult.push("Not Applicable");
                    }
                    if (repaired) { //Repair worked
                        this.repairStats.repairs++;
                        this.checkRepairLater = false;
                        //bar.tick();
                    } else {//Repair did not work
                        this.checkRepairLater = true;
                        if (css !== undefined) {
                            //assist.log(css);
                            await driver.removeRepair(this.repairElementHandle);
                            this.repairCSS = undefined;
                            await this.repairElementHandle.dispose();
                            css = undefined;
                        }
                    }
                    //delete later this is to always remove the repair so it does not have an effect on others.
                    if (css !== undefined) {
                        //assist.log(css);
                        await driver.removeRepair(this.repairElementHandle);
                        this.repairCSS = undefined;
                        await this.repairElementHandle.dispose();
                    }
                    count++;
                    //repairBar.tick({ 'token1': count });
                    if (bar.total - bar.curr === 1)
                        bar.tick({ 'token1': "Completed" });
                    else
                        bar.tick({ 'token1': "FID:" + this.ID });

                }
            // } else { //Another repair solved the problem
            //     this.repairStats.repairedByOthers++;
            //     let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-repaired-byproduct.png';
            //     let imagePath = path.join(outputDirectory, "snapshots", imageFileName);
            //     await this.screenshot(driver, imagePath, settings.screenshotHighlights);
            //     if (bar.total - bar.curr === 1)
            //         bar.tick(settings.repairCombination.length, { 'token1': "Completed" });
            //     else
            //         bar.tick(settings.repairCombination.length, { 'token1': "FID:" + this.ID });
            // }
        } else { //FP 
            this.repairStats.doesNotNeedRepair++;
            if (bar.total - bar.curr === 1)
                bar.tick(settings.repairCombination.length, { 'token1': "Completed" });
            else
                bar.tick(settings.repairCombination.length, { 'token1': "FID:" + this.ID });
        }

    }
    /**
     * Answer RQ does this tool create RLFs?
     * @param {Driver} driver The browser driver.
     * @param {Number} fromViewport The source-viewport where the patch is generated.
     */
    async answerRQ(driver, fromViewport, outputDir) {
        let pseudoElements = [];
        await driver.setViewport(fromViewport, settings.testingHeight);
        let htmlElement = await driver.getHTMLElement();
        let domWider = await this.getDOMFrom(driver, fromViewport, pseudoElements, htmlElement);
        let css = this.getDOMStylesAsCSS(domWider);
        css = this.makeRuleCSS(css, false);
        //Scale ratio specifically made for viewport...
        for (let failureViewport = this.range.getMinimum(); failureViewport <= this.range.getMaximum(); failureViewport++) {
            let scaleValue = failureViewport / fromViewport;
            let scaleCSS = this.getTransformScaleCSS(scaleValue);
            let scaleCSSRule = this.makeRuleCSS(scaleCSS, false, failureViewport, failureViewport);
            css += scaleCSSRule;
        }
        let name = "patch" + fromViewport + ".css";
        this.saveRepairToFile(path.join(outputDir, name), css);
        await this.injectRepair(css);
    }
    async resolveRepair(repaired, cssRepairedDirectory, repairName, cssFailedDirectory, css) {
        if (repaired === true) {
            this.repairCombinationResult.push("Repaired");
            this.saveRepairToFile(path.join(cssRepairedDirectory, this.ID + '-' + repairName + ".css"), css);
        } else if (repaired === false) {
            this.saveRepairToFile(path.join(cssFailedDirectory, this.ID + '-' + repairName + ".css"), css);
            await this.deleteRepair();
            css = undefined;
        }
        return css;
    }

    /**
     * Returns new RLG specific to the range of this failure with failures detected
     * @param {Number} testingRangeMin The minimum viewport width to visit.
     * @param {number} testingRangeMax The maximum viewport width to visit
     * @param {path} directory optional save dom to directory.
     */
    async getNewRLG(testingRangeMin = undefined, testingRangeMax = undefined, directory = undefined) {
        let rlg = new RLG(this.outputDirectory);
        let visit = [];
        if (testingRangeMin === undefined || testingRangeMax === undefined) {
            if (this.type === FailureType.SMALLRANGE && this.range.getNarrower() >= settings.testingWidthMin)
                visit.push(this.range.getNarrower());
            visit.push(this.range.getMinimum());
            if (!visit.includes(this.range.getMiddle()))
                visit.push(this.range.getMiddle());
            if (!visit.includes(this.range.getMaximum()))
                visit.push(this.range.getMaximum());
            visit.push(this.range.getWider());
        } else {
            for (let width = testingRangeMin; width <= testingRangeMax; width++)
                visit.push(width);
        }
        for (let i = visit.length - 1; i >= 0; i--) {
            let width = visit[i];
            await driver.setViewport(width, settings.testingHeight);
            let dom = new DOM(driver, width);
            await dom.captureDOM();
            if (directory !== undefined)
                dom.saveRBushData(directory);
            if (testingRangeMin === undefined || testingRangeMax === undefined)
                rlg.extractRLG(dom, i + 1);
            else
                rlg.extractRLG(dom, width);
            dom.disposeAllElementHandles();
        }
        rlg.detectFailures(false);
        if (directory !== undefined)
            rlg.printGraph(path.join(directory, 'mini-RLG.txt'));
        return rlg;
    }
    /**
     * Compares this failure to passed in failure. Returns true if both are the 
     * same type, the xpaths of two nodes involved are equal. Range is not considered.
     * @param {Failure} otherFailure the other failure to compare equality to.
     */
    isEqual(otherFailure) {
        return this.equals(otherFailure);
    }
    /**
     * Get parent width or viewport width and height from wider viewport.
     * @param {Driver} driver The browser driver.
     * @param {number} viewport The viewport to search for siblings.
     */
    async getParentWidthHeight(driver, viewport) {
        if (viewport === undefined)
            viewport = this.range.getWider();
        if (driver.currentViewport !== viewport)
            await driver.setViewport(viewport, settings.testingHeight);
        let parent = await driver.getElementBySelector(this.parent.getSelector());
        let parentRect = new Rectangle(await driver.getRectangle(parent));
        let oracle = {};
        oracle.width = Math.min(parentRect.width, this.range.getMinimum());
        oracle.height = parentRect.height;
        return oracle;
    }
    /**
     * Get parent width or viewport width and height from wider viewport.
     * @param {Driver} driver The browser driver.
     * @param {number} viewport The viewport to search for siblings.
     */
    async getDOMFrom(driver, viewport, pseudoElements = [], root = undefined, xpath = undefined) {
        if (viewport === undefined)
            viewport = this.range.getWider();
        if (driver.currentViewport !== viewport)
            await driver.setViewport(viewport, settings.testingHeight);
        let dom = new DOM(driver, viewport);
        await dom.captureDOM(true, true, pseudoElements, root, xpath);
        return dom;
    }
    getDOMStylesAsCSS(dom) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        let traversalStackDOM = [];
        traversalStackDOM.push(dom.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            let css = this.getRepairCSSFromComputedStyle(domNode.getComputedStyle(), undefined, undefined, false);
            if (css !== '') {
                this.repairCSS +=
                    "   " + domNode.getSelector() + " {\n" +
                    css +
                    "   " + "}\n";
            }
            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
        }
        return this.repairCSS;
    }

    WiderComparisonViewportSpacingCSS(domWider, domMin, widerViewportWidth, pseudoElements) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        let traversalStackDOM = [];
        traversalStackDOM.push(domWider.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            let nvWidthRatio = undefined;
            // let properties = ['min-width', 'width', 'max-width', 'min-height', 'height', 'max-height', 'font-size', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'border-left-width', 'border-right-width', 'border-top-width', 'border-bottom-width']
            let properties = ['min-width', 'width', 'max-width', 'min-height', 'height', 'font-size', 'line-height', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'border-left-width', 'border-right-width', 'border-top-width', 'border-bottom-width']
            let domNodeMin = domMin.getDOMNode(domNode.xpath);
            if (domNodeMin === undefined) {
                assist.log("In Wider not in Min DOM: " + domNode.xpath);
            }
            let computedStylesWider = domNode.getComputedStyle();
            let computedStylesMin = undefined;
            if (domNodeMin !== undefined)
                computedStylesMin = domNodeMin.getComputedStyle();
            //for (let key of properties) {
            //Rescale Ratio
            let widthWider = undefined;
            let widthMin = undefined;
            if (domNode.rectangle !== undefined && domNode.rectangle.width !== undefined && domNode.rectangle.width > 0 && domNode.rectangle.height > 0) {
                widthWider = domNode.rectangle.width;
                domNode.scale = widthWider / widerViewportWidth;
            }
            if (domNodeMin !== undefined && domNodeMin.rectangle !== undefined && domNodeMin.rectangle.width !== undefined && domNodeMin.rectangle.width > 0 && domNodeMin.rectangle.height > 0) {
                widthMin = domNodeMin.rectangle.width;
                domNodeMin.scale = widthMin / this.range.getMinimum();
            }
            if (widthWider !== undefined && widthMin !== undefined)
                domNode.rescale = domNodeMin.scale / domNode.scale;
            //Computed Style of DOM node...
            let css = this.getRepairCSSFromComputedStyle(computedStylesWider, widerViewportWidth);
            if (css !== '') {
                this.repairCSS +=
                    "   " + domNode.getSelector() + " {\n" +
                    css +
                    "   " + "}\n";
            }

            //Computed Style of DOM node pseudoElements...
            for (let pseudoElement of pseudoElements) {
                let computedStylePE = domNode[pseudoElement];
                if (computedStylePE !== undefined) {
                    css = this.getRepairCSSFromComputedStyle(computedStylePE, widerViewportWidth);
                    if (css !== '') {
                        this.repairCSS +=
                            "   " + domNode.getSelector() + "::" + pseudoElement + " {\n" +
                            css +
                            "   " + "}\n";
                    }
                }
            }


            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
        }
        //Make sure that all element in DOM min are also in wider.
        traversalStackDOM = [];
        traversalStackDOM.push(domMin.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            let domNodeWider = domWider.getDOMNode(domNode.xpath);
            if (domNodeWider === undefined) {
                assist.log("In Min not in Wider DOM: " + domNode.xpath)
            }
            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
        }
    }
    narrowerComparisonViewportSpacingCSS(domNarrower, domMin, narrowerViewportWidth, pseudoElements) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        let traversalStackDOM = [];
        traversalStackDOM.push(domNarrower.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            //Min DOM has the same node?
            let domNodeMin = domMin.getDOMNode(domNode.xpath);
            if (domNodeMin === undefined) {
                assist.log("In Narrower not in Min DOM: " + domNode.xpath);
            }

            let computedStylesNarrower = domNode.getComputedStyle();

            //Computed Style of DOM node...
            let css = this.getRepairCSSFromComputedStyle(computedStylesNarrower, narrowerViewportWidth);
            if (css !== '') {
                this.repairCSS +=
                    "   " + domNode.getSelector() + " {\n" +
                    css +
                    "   " + "}\n";
            }

            //Computed Style of DOM node pseudoElements...
            for (let pseudoElement of pseudoElements) {
                let computedStyleNarrowerPseudoElement = domNode[pseudoElement];
                if (computedStyleNarrowerPseudoElement !== undefined) {
                    css = this.getRepairCSSFromComputedStyle(computedStyleNarrowerPseudoElement, narrowerViewportWidth);
                    if (css !== '') {
                        this.repairCSS +=
                            "   " + domNode.getSelector() + "::" + pseudoElement + " {\n" +
                            css +
                            "   " + "}\n";
                    }
                }
            }


            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
        }
        //Make sure that all element in DOM min are also in wider.
        traversalStackDOM = [];
        traversalStackDOM.push(domMin.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            let domNodeNarrower = domNarrower.getDOMNode(domNode.xpath);
            if (domNodeNarrower === undefined) {
                assist.log("In Min not in Narrower DOM: " + domNode.xpath)
            }
            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
        }
    }
    widerComparisonElements(domWider, rlgNode) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';

        let targetRLGNodes = rlgNode.getDescendantRLGNodesAtViewport(this.range.getWider());
        targetRLGNodes.push(rlgNode);
        let targetXPaths = []
        for (let rlgNode of targetRLGNodes) {
            if (this.ID === 2)
                assist.log(rlgNode.xpath)
            targetXPaths.push(rlgNode.xpath);
        }
        let traversalStackDOM = [];
        traversalStackDOM.push(domWider.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            if (targetXPaths.includes(domNode.rlgNode.xpath)) {
                let css = this.getRepairCSSFromComputedStyle(domNode.getComputedStyle(), this.range.getWider())
                if (css !== '') {
                    this.repairCSS +=
                        "   " + domNode.getSelector() + " {\n" +
                        css +
                        "   " + "}\n";
                }
            }
            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
        }
    }
    /**
     * Associated DOM nodes with RLG nodes using xpath. DOM nodes are associated 
     * with the matching RLG node xpath. In case DOM node xpath is not in the RLG
     * then the longest xpath of an RLG node that is a substring of the DOM node 
     * xpath wins the association. Meaning the html ancestor in the RLG is associated.  
     * @param {DOM} dom The DOM to associate RLG nodes with.
     * @param {RLG} rlg The RLG to use for associating its nodes with DOM nodes.
     */
    associateRLGNodesToDOMNodes(dom, rlg) {
        let traversalStackDOM = [];
        traversalStackDOM.push(dom.root);
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();

            let associatedRLGNode = rlg.getRLGNode(domNode.xpath)
            if (associatedRLGNode !== undefined) {
                domNode.rlgNode = associatedRLGNode;
            } else {
                let associatedXPath = undefined;
                for (let xpath of rlg.map.keys()) {
                    if (domNode.xpath.includes(xpath + '/')) {//xpath is a sub-path of DOM node xpath
                        if (associatedXPath === undefined) {
                            associatedXPath = xpath;
                        } else if (associatedXPath.length <= xpath.length) {
                            associatedXPath = xpath;
                        }
                    }
                }
                if (associatedXPath === undefined)
                    throw "Could not associate RLG node to associate with DOM node xpath: " + domNode.xpath;
                else
                    domNode.rlgNode = rlg.getRLGNode(associatedXPath)
            }

            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
        }

    }
    getPixelCSSFromNodes(dom) {
        let traversalStackDOM = [];
        traversalStackDOM.push(dom.root);
        let css = '';
        while (traversalStackDOM.length > 0) {
            let domNode = traversalStackDOM.shift();
            let nodePixelCSS = this.getPixelCSSFromComputedStyle(domNode.getComputedStyle());
            css +=
                "   " + domNode.getSelector() + " {\n" +
                nodePixelCSS +
                "   " + "}\n";
            for (let child of domNode.children) {
                traversalStackDOM.push(child);
            }
        }
        return css;
    }
    /**
     * Returns all css properties with px units with important flag.
     * @param {ComputedStyles} computedStyle The computed styles of the some node.
     * @param {[string]} skipCSSProperties An array of CSS properties (names) to skip.
     */
    getPixelCSSFromComputedStyle(computedStyle, skipCSSProperties = []) {
        let css = '';
        for (let property in computedStyle) {
            if (skipCSSProperties.includes(property))
                continue;
            if (computedStyle[property].includes('px')) {
                css +=
                    "      " + property + ": " + computedStyle[property] + " !important; \n";
            }
        }
        return css;
    }
    getRepairCSSFromComputedStyle(computedStyle, oracleViewport, cushion = 1, scale = true) {
        let css = '';
        for (let property in computedStyle) {
            if (settings.skipCopyingCSSProperties.includes(property))
                continue;
            let widerValues = [];
            let partsWithPX = [];
            if (scale === true &&
                computedStyle[property].includes('px') &&
                !settings.NoScalingCSSProperties.includes(property)) { //Avoid scaling some properties
                let parts = computedStyle[property].split(" ");

                for (let part of parts) {
                    if (part.includes('px')) {
                        let hasComma = false;
                        if (part.includes(',')) {
                            hasComma = true
                            part = part.trim().replace(',', '');
                        }
                        let num = Number(part.trim().replace('px', ''));
                        if (num === undefined || Number.isNaN(num)) {
                            let message = "Error - PX to Number: " + num + "\n" +
                                "Original: " + part + "\n";
                            throw message;
                        }
                        widerValues.push(num);
                        partsWithPX.push(true);
                        if (hasComma) {
                            widerValues.push(',');
                            partsWithPX.push(false);
                        }
                    }
                    else {
                        widerValues.push(part.trim());
                        partsWithPX.push(false);
                    }
                }
            }
            if (widerValues.length > 0 && scale) {
                let values = '';
                for (let i = 0; i < widerValues.length; i++) {
                    let figure = widerValues[i];
                    let withPX = partsWithPX[i];
                    if (withPX === true) {
                        if (figure === 0) {
                            values += '0px ';
                        } else {
                            values += "calc((100vw/" + (oracleViewport + cushion) + ")*" + figure + ") ";
                        }
                    } else {
                        values += figure + ' ';
                    }

                }
                if (values !== '') {
                    css +=
                        "      " + property + ": " + values + "!important; \n";
                }
            }
            else {
                css +=
                    "      " + property + ": " + computedStyle[property] + " !important; \n";
            }
        }
        return css;
    }
    /**
     * Get parent width or viewport width if too wide.
     * @param {Driver} driver The browser driver.
     * @param {number} viewport The viewport to search for siblings.
     */
    async getAvailableWidthHeightWithinParent(driver, viewport) {
        if (viewport === undefined)
            viewport = this.range.getWider();
        if (driver.currentViewport !== viewport)
            await driver.setViewport(viewport, settings.testingHeight);
        let parent = await driver.getElementBySelector(this.parent.getSelector());
        let child = await driver.getElementBySelector(this.node.getSelector());
        let parentRect = new Rectangle(await driver.getContentBox(parent));
        let childRect = new Rectangle(await driver.getRectangle(child));
        let available = {}
        available.width = Math.min(parentRect.maxX, childRect.maxX, viewport) - Math.max(0, parentRect.minX, childRect.minX);
        available.height = Math.min(parentRect.maxY, childRect.maxY) - Math.max(0, parentRect.minY, childRect.minY);
        if (childRect.width <= available.width || available.width < 1)
            available.width = undefined;
        if (childRect.height <= available.height || available.height < 1)
            available.height = undefined;
        return available;
    }

    /**
     * Get row siblings
     * @param {Driver} driver The browser driver.
     * @param {number} viewport The viewport to search for siblings.
     */
    async getRowSiblings(driver, viewport) {
        if (viewport === undefined)
            viewport = this.range.getWider();
        if (driver.currentViewport !== viewport)
            await driver.setViewport(viewport, settings.testingHeight);
        let parentElement = await driver.getElementBySelector(this.parent.getSelector());
        let childElement = await driver.getElementBySelector(this.node.getSelector());
        let parentRect = new Rectangle(await driver.getRectangle(parentElement));
        let childRect = new Rectangle(await driver.getRectangle(childElement));
        let rowRect = new Rectangle({ x: parentRect.x, width: parentRect.width, y: childRect.y, height: childRect.height });
        //get siblings at viewport
        let children = this.parent.getChildrenAtViewport(viewport);
        let siblings = [];
        let siblingRectangles = [];
        for (let sibling of children) {
            if (this.node.xpath !== sibling.xpath) {
                siblings.push(sibling);
                let siblingElement = await driver.getElementBySelector(sibling.getSelector());
                let siblingRect = new Rectangle(await driver.getRectangle(siblingElement));
                siblingRect.xpath = sibling.xpath;
                siblingRectangles.push(siblingRect);
            }
        }
        //get siblings row siblings.
        let rbush = new RBush();
        rbush.load(siblingRectangles);
        let rowRectangles = rbush.search(rowRect);
        //find percentages of occupied width
        let tmp = [];
        for (let rect of rowRectangles) {
            for (let rlgNode of siblings) {
                if (rlgNode.xpath === rect.xpath) {
                    rlgNode.widthOccupied = (rect.width / rowRect.width) * 100;
                    tmp.push(rlgNode);
                    break;
                }
            }
        }
        siblings = tmp;
        return siblings;
    }
    /**
     * Create media rule using range of failure. Including comments.
     * @param {string} css CSS to put in media rule.
     */
    makeRuleCSS(css, comments = true, min = this.range.getMinimum(), max = this.range.getMaximum()) {
        if (css === undefined)
            css = this.repairCSS;
        if (css === undefined || css === '')
            return undefined;

        let ruleCSS = '';
        if (comments === true)
            ruleCSS = this.createCSSComment() +
                '/*\n' + this.repairApproach + '\n' + "comparison-wider-classification: " + this.range.widerClassification + '\n*/\n';
        ruleCSS +=
            "@media only screen and (min-width: " + min + "px) and (max-width: " + max + "px){\n" +
            css +
            "}\n";
        return ruleCSS;
    }
    /**
     * Create the CSS comments for this failure.
     */
    createCSSComment() {
        this.repairCSSComments = "/*\n" +
            "   " + "ID: " + this.ID + " Type: " + this.type + "\n" +
            "   " + "Range: " + this.range.toString() + "\n" +
            "   " + "Node: " + this.node.xpath + "\n";

        if (this.type === FailureType.COLLISION || this.type === FailureType.SMALLRANGE) {
            this.repairCSSComments += "   " + "Sibling: " + this.sibling.xpath + "\n";
            if (this.type === FailureType.COLLISION)
                this.repairCSSComments += "   " + "Parent: " + this.parent.xpath + "\n";
            if (this.type === FailureType.SMALLRANGE) {
                this.repairCSSComments += "   " + "Set: " + this.set + "\n";
                this.repairCSSComments += "   " + "Set Wider: " + this.setWider + "\n";
                this.repairCSSComments += "   " + "Set Narrower: " + this.setNarrower + "\n";

            }

        }
        if (this.type === FailureType.VIEWPORT || this.type === FailureType.PROTRUSION)
            this.repairCSSComments += "   " + "Parent: " + this.parent.xpath + "\n";
        if (this.type === FailureType.WRAPPING)
            for (let rowElement of this.row)
                this.repairCSSComments += "   " + "Row Element: " + rowElement.xpath + "\n";
        this.repairCSSComments += "*/\n"
        return this.repairCSSComments;
    }
    /**
     * Using the transform property and scale function with the provided
     * scale value, CSS that targets BODY element is returned.
     * 
     * @param {Number} scaleValue The scale value to use.
     */
    getTransformScaleCSS(scaleValue, selector = undefined) {
        let css = "";
        if (selector === undefined)
            css += "   " + "html:nth-of-type(1) {\n";
        else
            css += "   " + selector + " {\n";
        css +=
            "      " + "transform: scale(" + scaleValue + ") !important;\n" +
            "      " + "transform-origin: left top !important;\n" +

            "   " + "}\n";
        return css;
    }
    /**
     * Change the width and height of all elements maxed at 100% of viewport width.
     */
    allElementsAutoRestrictedMaxCSS() {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + "* {\n" +
            "      " + "box-sizing: border-box !important;\n" +
            "      " + "max-width: min(100vw, 100%) !important;\n" +
            "      " + "max-height: 100% !important; \n" +
            "   " + "}";
    }
    /**
     * Change the overflow of passed in node to auto.
     */
    overflowAutoCSS(node) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + node.getSelector() + " {\n" +
            "      " + "overflow: auto !important; \n" +
            "   " + "}";
    }
    /**
     * Finds difference in computed style and generates CSS fix.
     * @param {Driver} driver The browser driver.
     * @param {RLGNode} node the RLG node to fix.
     */
    async differenceComputedStylesCSS(driver, node) {
        if (this.range.getWider() > settings.testingWidthMax ||
            this.range.getNarrower() < settings.testingWidthMin) //Lack of comparison viewports
            return;

        if (driver.currentViewport !== this.range.getMinimum())
            await driver.setViewport(this.range.getMinimum(), settings.testingHeight);
        let element = await driver.getElementBySelector(node.getSelector());
        let computedStyleMin = await driver.getComputedStyle(element);


        await driver.setViewport(this.range.getWider(), settings.testingHeight);
        element = await driver.getElementBySelector(node.getSelector());
        let computedStyleWider = await driver.getComputedStyle(element);

        await driver.setViewport(this.range.getNarrower(), settings.testingHeight);
        element = await driver.getElementBySelector(node.getSelector());
        let computedStyleNarrower = await driver.getComputedStyle(element);
        let properComparisonCSS = {};
        for (let key in computedStyleWider) {
            if (computedStyleWider[key] === computedStyleNarrower[key])
                properComparisonCSS[key] = computedStyleWider[key];
        }
        let properCSS = {};
        for (let key in properComparisonCSS) {
            if (properComparisonCSS[key] !== computedStyleMin[key])
                properCSS[key] = computedStyleWider[key];
        }

        if (Object.keys(properCSS).length > 0) {
            if (this.repairCSS === undefined)
                this.repairCSS = '';
            this.repairCSS +=
                "   " + node.getSelector() + "{\n";
            for (let key in properCSS) {
                this.repairCSS +=
                    "      " + key.replace('\'', '') + ": " + properCSS[key].replace('\'', '') + " !important;\n";
            }
            this.repairCSS +=
                "   " + "}\n";
        }

    }
    /**
     * Set the body element to 100% of viewport width size.
     */
    bodyMaximizeWidthToViewportCSS() {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + "html:nth-of-type(1) > body:nth-of-type(1){\n" +
            "      " + "box-sizing: border-box !important;\n" +
            "      " + "min-width: 100vw !important;\n" +
            "      " + "max-width: 100vw !important;\n" +
            "   " + "}\n";
    }
    /**
     * Set max-width & max-height of reported failing element as 100% of parent.
     */
    elementMaxWidthMaxHeightCSS() {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + this.node.getSelector() + "{\n" +
            "      " + "box-sizing: border-box !important;\n" +
            "      " + "max-width: " + 100 + "% !important;\n" +
            "      " + "max-height: " + 100 + "% !important;\n" +
            "   }\n";

    }
    /**
     * Set max-width & max-height of parent and new-parent as 100% of grandparent.
     */
    parentMaxWidthMaxHeightCSS() {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        let parents = [];
        parents.push(this.parent)
        if (this.newParent !== undefined)
            parents.push(this.newParent)
        for (let parent of parents) {
            this.repairCSS +=
                "   " + parent.getSelector() + "{\n" +
                "      " + "box-sizing: border-box !important;\n" +
                "      " + "max-width: " + 100 + "% !important;\n" +
                "      " + "max-height: " + 100 + "% !important;\n" +
                "   }\n";
        }
    }
    /**
     * Set max-width & max-height of all the parents' html descendants.
     */
    htmlDescendantsMaxWidthMaxHeightCSS() {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + this.parent.getSelector() + " *{\n" +
            "      " + "box-sizing: border-box !important;\n" +
            "      " + "max-width: " + 100 + "% !important;\n" +
            "      " + "max-height: " + 100 + "% !important;\n" +
            "   }\n";

    }
    /**
     * Set the min-width of parent to that given in parameter.
     * @param {number} width The min-width to set the parent to.
     * @param {number} height The min-height to set the parent to.
     */
    parentMinWidthHeightCSS(width, height) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + this.parent.getSelector() + "{\n" +
            "      " + "box-sizing: border-box !important;\n" +
            "      " + "min-width: " + width + "px !important;\n" +
            "      " + "min-height: " + height + "px !important;\n" +
            "   }\n";
    }
    /**
     * Set the min-width and max-width of element to that given in parameter.
     * @param {number} width The min-width to set the parent to.
     */
    elementMinMaxWidthCSS(width) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + this.node.getSelector() + "{\n" +
            "      " + "box-sizing: border-box !important;\n" +
            "      " + "min-width: " + width + "px !important;\n" +
            "      " + "max-width: " + width + "px !important;\n" +
            "   }\n";
    }
    /**
     * Set the min-width, max-width, min-height, and max-height
     * of element to that given in parameter.
     * @param {number} width The min-width to set the parent to.
     * @param {number} height The min-height to set the parent to.
     */
    elementMinMaxWidthHeightCSS(width, height) {
        if (width === undefined && height === undefined)
            return;
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + this.node.getSelector() + "{\n";
        if (width !== undefined)
            this.repairCSS +=
                "      " + "box-sizing: border-box !important;\n" +
                "      " + "min-width: " + width + "px !important;\n" +
                "      " + "max-width: " + width + "px !important;\n";
        if (height !== undefined)
            this.repairCSS +=
                "      " + "box-sizing: border-box !important;\n" +
                "      " + "min-height: " + height + "px !important;\n" +
                "      " + "max-height: " + height + "px !important;\n";
        this.repairCSS +=
            "   }\n";
    }
    /**
     * Maximize ancestor height and widths for grandparents and above excluding the body element.
     */
    ancestorsMaxWidthHeightCSS() {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        let parentAtMin = this.node.getParentAtViewport(this.range.getMinimum());
        let ancestorsMin = [];
        if (parentAtMin !== undefined) {
            ancestorsMin = parentAtMin.getAncestorsRLGNodesAtViewport(this.range.getMinimum());

        }
        let ancestorsWider = [];
        let ancestors = []; //holds all unique ancestors
        if (settings.testingWidthMax >= this.range.getWider()) {
            let parentAtWider = this.node.getParentAtViewport(this.range.getWider());
            if (parentAtWider !== undefined)
                ancestorsWider = parentAtWider.getAncestorsRLGNodesAtViewport(this.range.getWider());
        }
        for (let ancestor of [...ancestorsWider, ...ancestorsMin]) {
            let duplicate = false;
            for (let knownAncestor of ancestors) {
                if (ancestor.xpath === knownAncestor.xpath) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate && ancestor !== undefined && ancestor.xpath !== '/HTML/BODY')
                ancestors.push(ancestor)
        }

        for (let ancestor of ancestors) {
            this.repairCSS +=
                "   " + ancestor.getSelector() + "{\n" +
                "      " + "box-sizing: border-box !important;\n" +
                "      " + "max-width: " + 100 + "% !important;\n" +
                "      " + "max-height: " + 100 + "% !important;\n" +
                "   }\n";
        }
    }
    /**
    * CSS to set the negative margins of node to zero.
    * @param {RLGNode} node The rlgNode to set the margin for.
    */
    async negativeMarginsToZeroCSS(node) {
        let element = await driver.getElementBySelector(this.node.getSelector());
        let originalMarginLeft = await driver.getMarginLeft(element);
        let originalMarginRight = await driver.getMarginRight(element);
        let originalMarginTop = await driver.getMarginTop(element);
        let originalMarginBottom = await driver.getMarginBottom(element);

        let marginLeft = 0;
        if (originalMarginLeft.includes('px')) {
            marginLeft = Number(originalMarginLeft.replace('px', '').trim());
        }

        let marginRight = 0;
        if (originalMarginRight.includes('px')) {
            marginRight = Number(originalMarginRight.replace('px', '').trim());
        }

        let marginTop = 0;
        if (originalMarginTop.includes('px')) {
            marginTop = Number(originalMarginTop.replace('px', '').trim());
        }

        let marginBottom = 0;
        if (originalMarginBottom.includes('px')) {
            marginBottom = Number(originalMarginBottom.replace('px', '').trim());
        }

        if (marginLeft >= 0 && marginRight >= 0 && marginTop >= 0 && marginBottom >= 0)
            return;
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + node.getSelector() + "{\n";
        if (marginLeft < 0)
            this.repairCSS +=
                "      " + "margin-left: " + 0 + "px !important;\n";
        if (marginRight < 0)
            this.repairCSS +=
                "      " + "margin-right: " + 0 + "px !important;\n";
        if (marginTop < 0)
            this.repairCSS +=
                "      " + "margin-top: " + 0 + "px !important;\n";
        if (marginBottom < 0)
            this.repairCSS +=
                "      " + "margin-bottom: " + 0 + "px !important;\n";

        this.repairCSS +=
            "   }\n";
    }
    /**
     * CSS to set width, height, min-width, min-height, max-width, and max-height to auto.
     * @param {RLGNode} node The rlgNode to set the width and height for.
     */
    autoWidthHeightCSS(node) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + node.getSelector() + "{\n" +
            "      " + "box-sizing: border-box !important;\n" +
            "      " + "min-width: auto !important;\n" +
            "      " + "max-width: auto !important;\n" +
            "      " + "width: auto !important;\n" +
            "      " + "min-height: auto !important;\n" +
            "      " + "max-height: auto !important;\n" +
            "      " + "height: auto !important;\n" +
            "   }\n";
    }
    /**
     * CSS to set all margins of node to zero.
     * @param {RLGNode} node The rlgNode to set the margin for.
     */
    marginsToZeroCSS(node) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        this.repairCSS +=
            "   " + node.getSelector() + "{\n" +
            "      " + "margin-left: " + 0 + "px !important;\n" +
            "      " + "margin-right: " + 0 + "px !important;\n" +
            "      " + "margin-top: " + 0 + "px !important;\n" +
            "      " + "margin-bottom: " + 0 + "px !important;\n" +
            "   }\n";
    }
    /**
     * The CSS for the shrink siblings repair.
     * @param {[RLGNode]} siblingNodes An array of sibling RLGNode with widthOccupied calculated.
     */
    shrinkSiblingsCSS(siblingNodes) {
        if (this.repairCSS === undefined)
            this.repairCSS = '';
        for (let sibling of siblingNodes) {
            this.repairCSS +=
                "   " + sibling.getSelector() + "{\n" +
                "      " + "box-sizing: border-box !important;\n" +
                "      " + "max-width: " + sibling.widthOccupied + "% !important;\n" +
                "      " + "min-width: " + sibling.widthOccupied + "% !important;\n" +
                "   }\n";
        }
    }
    /** delete
     * Repair the failure using the proportions of sibling sizes form 
     * the wider comparison viewport.
     * @param {Driver} driver The browser driver.
     * @param {Range} range One failure range.
     * @param {Path} directory The image output directory.
     * @param {ProgressBar} bar Bar to update progress. 
     */
    async shrinkSiblingsPatch(driver, range, directory, bar) {
        let failureViewport = range.getMinimum();
        let oracleViewport = range.getWider();
        await driver.setViewport(failureViewport, settings.testingHeight);
        if (range.minClassification === 'TP') { //Needs Repair.
            if (await this.isFailing(driver)) { //Attempt to repair failure only if there is a problem.
                if (range.widerClassification === 'TP') { //comparison viewport will not repair it.
                    this.checkRepairLater = true;
                } else {
                    await driver.setViewport(oracleViewport, settings.testingHeight);
                    let parentElement = await driver.getElementBySelector(this.parent.getSelector());
                    let childElement = await driver.getElementBySelector(this.node.getSelector());
                    let parentRect = new Rectangle(await driver.getRectangle(parentElement));
                    let childRect = new Rectangle(await driver.getRectangle(childElement));
                    let rowRect = new Rectangle({ x: parentRect.x, width: parentRect.width, y: childRect.y, height: childRect.height });
                    //get siblings at viewport
                    let children = this.parent.getChildrenAtViewport(oracleViewport);
                    let siblings = [];
                    let siblingRectangles = [];
                    for (let sibling of children) {
                        if (this.node.xpath !== sibling.xpath) {
                            siblings.push(sibling);
                            let siblingElement = await driver.getElementBySelector(sibling.getSelector());
                            let siblingRect = new Rectangle(await driver.getRectangle(siblingElement));
                            siblingRect.xpath = sibling.xpath;
                            siblingRectangles.push(siblingRect);
                        }
                    }
                    //get siblings row siblings.
                    let rbush = new RBush();
                    rbush.load(siblingRectangles);
                    let rowRectangles = rbush.search(rowRect);
                    //find percentages of occupied width
                    let tmp = [];
                    for (let rect of rowRectangles) {
                        for (let rlgNode of siblings) {
                            if (rlgNode.xpath === rect.xpath) {
                                rlgNode.widthOccupied = (rect.width / rowRect.width) * 100;
                                tmp.push(rlgNode);
                                break;
                            }
                        }
                    }
                    siblings = tmp;
                    this.repairElementHandle = await driver.addRepair(this.shrinkSiblingsCSS(siblings));
                    if (settings.repairDelay != undefined && settings.repairDelay > 0)
                        await assist.resolveAfterSeconds(settings.repairDelay);
                    await driver.setViewport(failureViewport, settings.testingHeight);
                    if (await this.isFailing(driver)) { //Repair failed
                        this.checkRepairLater = true;
                    } else {//Repair worked
                        this.repairStats.repairs++;
                        let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-repaired.png';
                        let imagePath = path.join(directory, "snapshots", imageFileName);
                        await this.screenshot(driver, imagePath, settings.screenshotHighlights);
                        bar.tick();
                    }
                }
            } else { //Another repair solved the problem
                this.repairStats.repairedByOthers++;
                bar.tick();
            }
        } else { //FP 
            this.repairStats.doesNotNeedRepair++;
            bar.tick();
        }
    }



    /**
     * 
     * @param {Driver} driver The browser driver.
     * @param {Path} directory The image output directory.
     * @param {ProgressBar} bar Bar to update progress. 
     */
    async checkForLaterRepair(driver, directory, bar) {
        if (this.checkRepairLater) {
            let range = this.range;
            let failureViewport = range.getMinimum();
            await driver.setViewport(failureViewport, settings.testingHeight);
            if (await this.isFailing(driver)) {
                if (range.widerClassification === 'TP') { //Oracle width will not repair it.
                    this.repairStats.noOracle++;
                } else {
                    this.repairStats.failedRepairs++;
                }
                // let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-failed-repair.png';
                // let imagePath = path.join(directory, "snapshots", imageFileName);
                // await this.screenshot(driver, imagePath);
                if (this.repairElementHandle !== undefined && this.removeFailingRepair) { //If a repair attempt was made remove it.
                    // await driver.removeRepair(this.repairElementHandle);
                    // this.repairCSS = undefined;
                    // await this.repairElementHandle.dispose();
                }
            } else {
                this.repairStats.repairedByOthers++;
                let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + failureViewport + '-repaired-byproduct.png';
                let imagePath = path.join(directory, "snapshots", imageFileName);
                await this.screenshot(driver, imagePath, settings.screenshotHighlights);
            }
            //bar.tick();
        }
    }
    /**
     * Save the repair to file.
     * @param {path} file the css file to save the repair to.
     */
    saveRepairToFile(file, css = this.repairCSS) {
        let repairApproachComment = '/*\n' + this.repairApproach + '\n' + "wider-comparison-classification: " + this.range.widerClassification + '\n*/\n';
        if (css !== undefined) {
            fs.appendFileSync(file, this.repairCSSComments + repairApproachComment + css + "\n");
        }
    }
    /**
     * Takes a screenshot of this failure.
     * @param {Driver} driver Puppeteer driver object.
     * @param {Directory} directory The directory path to write the image.
     * @param {ProgressBar} bar Bar to update progress.
     */
    async screenshotFailure(driver, directory, bar) {
        let viewports = [];
        if (this.type === FailureType.SMALLRANGE) {
            viewports = this.range.getMinNarrowerWiderOfRanges();
        } else {
            viewports = this.range.getMinWiderViewportsOfRange();
        }
        viewports.sort(function (a, b) { return b - a });
        for (let viewport of viewports) {
            await this.screenshotViewport(driver, viewport, directory, true);
        }
        bar.tick();
    }
    async fullPageScreenshot(captureViewport = driver.currentViewport, imagePath) {

        //page scroll width and scroll height
        let width = await driver.getPageScrollWidth();
        width = Math.max(width, captureViewport);

        // let height = await driver.getPageHeightUsingHTMLElement();
        // if (settings.screenshotSpecial !== undefined && settings.screenshotSpecial.length > 0) {
        //     for (let name of settings.screenshotSpecial) {
        //         if (this.webpage.toLocaleLowerCase().includes(name.toLocaleLowerCase())) {
        //             height = await driver.getMaxElementHeight();
        //         }
        //     }
        // }
        let height = await driver.getPageScrollHeight();
        height = Math.max(height, settings.testingHeight);

        //Fix the all element properties if no repair is applied.
        if (this.repairElementHandle === undefined) {
            let htmlElement = await driver.getHTMLElement();
            let dom = await this.getDOMFrom(driver, captureViewport, [], htmlElement);
            let css = this.getDOMStylesAsCSS(dom);
            this.snapshotCSSElementHandle = await driver.addRepair(css);
        }



        if (settings.browserMode === assist.Mode.HEADLESS)
            await driver.setViewport(width, height);

        await driver.screenshot(imagePath, false, false);
        if (this.repairElementHandle === undefined && this.snapshotCSSElementHandle !== undefined) {
            await driver.removeRepair(this.snapshotCSSElementHandle);
            await this.snapshotCSSElementHandle.dispose();
        }
        if (settings.browserMode === assist.Mode.HEADLESS)
            await driver.setViewport(captureViewport, settings.testingHeight);
    }
    async setViewportHeightBeforeSnapshots(viewport = driver.currentViewport, ruleMin = undefined, ruleMax = undefined) {
        if (settings.browserMode === assist.Mode.HEADLESS) {
            let css = undefined
            if (this.repairElementHandle === undefined) {
                let htmlElement = await driver.getHTMLElement();
                let dom = await this.getDOMFrom(driver, viewport, [], htmlElement);
                css = this.getDOMStylesAsCSS(dom);


                //css = this.getPixelCSSFromNodes(dom);
                //this.snapshotCSSElementHandle = await driver.addRepair(css);
            }


            let pageHeight = await driver.getPageHeightUsingHTMLElement();
            if (settings.screenshotSpecial !== undefined && settings.screenshotSpecial.length > 0) {
                for (let name of settings.screenshotSpecial) {
                    if (this.webpage.toLocaleLowerCase().includes(name.toLocaleLowerCase())) {
                        pageHeight = await driver.getMaxElementHeight();
                    }
                }
            }
            pageHeight = Math.max(pageHeight, settings.testingHeight);
            await driver.setViewport(viewport, pageHeight);
            if (this.repairElementHandle === undefined)
                this.snapshotCSSElementHandle = await driver.addRepair(css);
        } else {
            await driver.setViewport(viewport, settings.testingHeight);
        }
    }
    async resetViewportHeightAfterSnapshots(viewport = driver.currentViewport) {
        if (this.repairElementHandle === undefined && this.snapshotCSSElementHandle !== undefined) {
            await driver.removeRepair(this.snapshotCSSElementHandle);
            await this.snapshotCSSElementHandle.dispose();
        }
        if (settings.browserMode === assist.Mode.HEADLESS)
            await driver.setViewport(viewport, settings.testingHeight);
    }

    /**
     * Takes a screenshot of at the given viewport.
     * @param {Driver} driver Puppeteer driver object.
     * @param {Directory} directory The directory path to write the image.
     * @param {number} viewport The viewport where to take the screenshot.
     * @param {Boolean} includeClassification Should this function print classification.
     */
    async screenshotViewport(driver, viewport, directory, includeClassification = false, clip = true) {
        await this.setViewportHeightBeforeSnapshots(viewport);
        let fullPage = true;
        if (settings.browserMode === assist.Mode.HEADLESS)
            fullPage = false;
        let rectangles = [];
        let elements = [];
        let selectors = this.getSelectors();
        for (let i = 0; i < selectors.length; i++) {
            let currentSelector = selectors[i];
            let element = undefined;
            try {
                element = await driver.getElementBySelector(currentSelector);
                elements.push(element);
            } catch (err) {
                console.log(err);
                elements.push(undefined);
            }
            if (element != undefined) {
                try {
                    let rectangle = new Rectangle(await driver.getRectangle(element));
                    rectangle.selector = currentSelector;
                    rectangles.push(rectangle);
                } catch (err) {
                    console.log(err);
                    rectangles.push(undefined);
                }
            }
            else
                rectangles.push(undefined);
        }
        let screenshot = await driver.screenshot(undefined, fullPage);
        let removeHeader = false;
        if (settings.screenshotHighlights) {
            screenshot = await driver.highlight(rectangles, screenshot);
            removeHeader = true;
        }
        if (!settings.screenshotFullpage)
            screenshot = await this.clipScreenshot(rectangles, screenshot.split(',')[1], driver, true, viewport);
        let imageFileName = 'FID-' + this.ID + '-' + this.type.toLowerCase() + '-' + this.range.toShortString().trim() + '-capture-' + viewport;
        let classification = this.range.getClassificationOfViewport(viewport);
        if (includeClassification && classification !== '-')
            imageFileName += '-' + classification + '.png';
        else
            imageFileName += '.png';
        this.saveScreenshot(path.join(directory, imageFileName), screenshot, removeHeader);
        for (let element of elements) {
            if (element !== undefined)
                element.dispose();
        }
        await this.resetViewportHeightAfterSnapshots(driver.currentViewport);
    }
    /**
    * Takes a screenshot of the failure.
    * @param {Driver} driver Puppeteer driver object.
    * @param {Directory} file The name of the image file.
    */
    async screenshot(driver, file, highlight = true, encoding64 = true, fullViewportHeightScreenshot = false, fullViewportWidthClipping = false) {
        await this.setViewportHeightBeforeSnapshots(driver.currentViewport);
        let fullPage = true;
        if (settings.browserMode === assist.Mode.HEADLESS)
            fullPage = false;
        let screenshot = await driver.screenshot(undefined, fullPage, encoding64);
        if (highlight === true) {
            let rectangles = await this.getRectangles(driver);
            screenshot = await driver.highlight(rectangles, screenshot);
            //screenshot = await this.clipScreenshot(rectangles, screenshot.split(',')[1], driver, true);
            this.saveScreenshot(file, screenshot);
        } else if (fullViewportHeightScreenshot === true) {
            let rectangles = await this.getRectangles(driver);
            screenshot = await this.clipScreenshot(rectangles, screenshot, driver, fullViewportWidthClipping, driver.currentViewport);
            this.saveScreenshot(file, screenshot);
        } else {
            this.saveScreenshot(file, screenshot, false);
        }
        await this.resetViewportHeightAfterSnapshots(driver.currentViewport);
    }
    async clipScreenshot(rectangles, screenshot, driver, fullViewportWidthClipping, viewport, problemArea = undefined) {
        try {
            if (problemArea === undefined)
                problemArea = this.getClippingCoordinates(rectangles);
            if (problemArea.isMissingValues())
                throw "== Begin Problem Area ==\n" +
                "Missing size for cutting screenshot\n" +
                problemArea + "\n" +
                "== End  Problem  Area ==\n" +
                "==  Begin Rectangles  ==\n" +
                + rectangles + "\n" +
                "==   End  Rectangles  ==\n"
            screenshot = await driver.clipImage(screenshot, problemArea, fullViewportWidthClipping, viewport);
        } catch (passedInErrorMessage) {
            let newErrorMessage = this.ID + ' ' + this.type + ' ' + this.range.toString() + '\n';
            for (let rect of rectangles) {
                newErrorMessage += rect.toString(true) + '\n';
            }
            newErrorMessage += '\n' + passedInErrorMessage;
            throw newErrorMessage;
        }
        return screenshot;
    }

    saveScreenshot(file, screenshot, removeHeader = true) {
        if (removeHeader)
            screenshot = screenshot.split(',')[1];
        fs.writeFile(file, screenshot, 'base64', function (err) {
            if (err) {
                console.log('ERROR IN SAVING IMAGE');
                console.log(err);
            }
        });
    }
    getClippingCoordinates(rectangles, extra = 0, maxHeight = 8000) {
        let problemArea = new Rectangle();
        for (let rect of rectangles) {
            if (rect.isMissingValues()) {
                assist.log(this.ID + " " + this.type + " " + this.range.toString());
                assist.log("Warning: cannot use rectangle for cutting screenshot...");
                assist.log(rect.toString(true));
                continue;
            }
            if (rect.height > maxHeight) { //max element height to support.
                assist.log(this.ID + " " + this.type + " " + this.range.toString());
                assist.log("Warning: Human Study - rectangle height exceeds maximum height: " + maxHeight);
                assist.log(rect.toString(true));
                continue;
            }
            if (problemArea.minX === undefined || rect.minX < problemArea.minX)
                problemArea.minX = rect.minX;
            if (problemArea.maxX === undefined || rect.maxX > problemArea.maxX)
                problemArea.maxX = rect.maxX;
            if (problemArea.minY === undefined || Math.max(rect.minY - extra, 0) < problemArea.minY)
                problemArea.minY = Math.max(rect.minY - extra, 0);
            if (problemArea.maxY === undefined || (rect.maxY + extra) > problemArea.maxY)
                problemArea.maxY = (rect.maxY + extra);
        }
        if (problemArea.isMissingValues()) { //use first in the worst case
            assist.log(this.ID + " " + this.type + " " + this.range.toString());
            assist.log("Warning: Human Study - Had to use first rectangle for cutting.");
            let rect = rectangles[0];
            assist.log(rect.toString(true));
            problemArea.minX = rect.minX;
            problemArea.maxX = rect.maxX;
            problemArea.minY = Math.max(rect.minY - extra, 0);
            problemArea.maxY = (rect.maxY + extra);
        }
        problemArea.width = problemArea.maxX - problemArea.minX;
        problemArea.height = problemArea.maxY - problemArea.minY;
        return problemArea;
    }

    /**
     * Rectangles of this failure.
     */
    async getRectangles(driver, traverseUp = false) {
        let selectors = this.getSelectors();
        let xpaths = this.getXPaths();
        let rectangles = [];
        let elements = [];
        for (let i = 0; i < selectors.length; i++) {
            let currentSelector = selectors[i];
            let xpath = xpaths[i];
            let element = undefined;
            try {
                element = await driver.getElementBySelector(currentSelector);
                elements.push(element);
            } catch (err) {
                console.log(err);
                elements.push(undefined);
            }
            if (element != undefined) {
                try {
                    let boundingBox = await driver.getRectangle(element, traverseUp);
                    if (boundingBox === undefined || boundingBox === null || boundingBox === NaN) {
                        let rectangle = {
                            selector: currentSelector,
                            xpath: xpath,
                            isMissingValues: function () {
                                return true;
                            },
                            toString: function () {
                                return xpath + "\nNo BoundingBox."
                            }
                        };
                        rectangles.push(rectangle);
                    } else {
                        let rectangle = new Rectangle(boundingBox);
                        rectangle.selector = currentSelector;
                        rectangle.xpath = xpath;
                        rectangles.push(rectangle);
                    }
                } catch (err) {
                    console.log(err);
                    rectangles.push(undefined);
                }
            }
            else
                rectangles.push(undefined);
        }
        for (let element of elements) {
            if (element !== undefined)
                element.dispose();
        }
        return rectangles;
    }
    /**
    * Returns an object with pixels child protruding {left, right, top, bottom}.
    * Zeros for no protrusion.
    * @param {Rectangle} parentRect Parent/container rectangle.
    * @param {Rectangle} childRect Child/contained rectangle.
    */
    calculateProtrusion(parentRect, childRect) {
        let protruding =
        {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        }
        if (childRect.minX < parentRect.minX) {
            protruding.left = parentRect.minX - childRect.minX;
        }
        if (childRect.maxX > parentRect.maxX) {
            protruding.right = childRect.maxX - parentRect.maxX;
        }
        if (childRect.minY < parentRect.minY) {
            protruding.top = parentRect.minY - childRect.minY;
        }
        if (childRect.maxY > parentRect.maxY) {
            protruding.bottom = childRect.maxY - parentRect.maxY;
        }
        return protruding;
    }
    /**
    * Returns an object with number of pixels overlapping {left, right, top, bottom}.
    * Zeros for no collision.
    * @param {Rectangle} nodeRect The first node's rectangle.
    * @param {Rectangle} siblingRect The other node's rectangle.
    */
    calculateOverlap(nodeRect, siblingRect) {
        let overlap =
        {
            //node to be pushed away on either the x-axis or the y-axis.
            nodeRectToBeCleared: undefined,
            otherNodeRect: undefined,
            xToClear: 0,
            yToClear: 0
        }
        let nodeRectToBeCleared = undefined;
        let otherNodeRect = undefined;
        let xToClear = 0;
        let yToClear = 0;
        if (nodeRect.minX < siblingRect.minX) {
            nodeRectToBeCleared = siblingRect;
            otherNodeRect = nodeRect;
        } else if (nodeRect.minX > siblingRect.minX) {
            nodeRectToBeCleared = nodeRect;
            otherNodeRect = siblingRect;
        } else if (nodeRect.minX === siblingRect.minX) {
            if (nodeRect.minY < siblingRect.minY) {
                nodeRectToBeCleared = siblingRect;
                otherNodeRect = nodeRect;
            } else if (nodeRect.minY > siblingRect.minY) {
                nodeRectToBeCleared = nodeRect;
                otherNodeRect = siblingRect;
            } else if (nodeRect.minY === siblingRect.minY) {
                if (nodeRect.maxX < siblingRect.maxX) {
                    nodeRectToBeCleared = siblingRect;
                    otherNodeRect = nodeRect;
                } else if (nodeRect.maxX > siblingRect.maxX) {
                    nodeRectToBeCleared = nodeRect;
                    otherNodeRect = siblingRect;
                } else if (nodeRect.maxX === siblingRect.maxX) {
                    if (nodeRect.maxY < siblingRect.maxY) {
                        nodeRectToBeCleared = siblingRect;
                        otherNodeRect = nodeRect;
                    } else if (nodeRect.maxY > siblingRect.maxY) {
                        nodeRectToBeCleared = nodeRect;
                        otherNodeRect = siblingRect;
                    } else if (nodeRect.maxY === siblingRect.maxY) {
                        /**
                         * If they are equal rectangles break the tie by xpath length.
                         */
                        let sortedByXpath = [nodeRect.xpath, siblingRect.xpath].sort();
                        if (sortedByXpath[0] === nodeRect.xpath) {
                            nodeRectToBeCleared = siblingRect;
                            otherNodeRect = nodeRect;
                        } else {
                            nodeRectToBeCleared = nodeRect;
                            otherNodeRect = siblingRect;
                        }

                    }
                }
            }
        }
        if (assist.areOverlapping(nodeRectToBeCleared, otherNodeRect)) {
            xToClear = otherNodeRect.maxX - nodeRectToBeCleared.minX + 1;
            yToClear = otherNodeRect.maxY - nodeRectToBeCleared.minY + 1;
        } else {
            xToClear = 0;
            yToClear = 0;
        }

        overlap.nodeRectToBeCleared = nodeRectToBeCleared;
        overlap.otherNodeRect = otherNodeRect;
        overlap.xToClear = xToClear;
        overlap.yToClear = yToClear;
        return overlap;
    }
}
module.exports = Failure;
const RLG = require('./RLG.js');
const DOM = require('./DOM.js'); const { debugPort } = require('process');
const { browserMode } = require('../settings.js');

