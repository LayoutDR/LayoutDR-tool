const RBush = require('rbush');
const path = require('path');
const driver = require('./Driver.js');
const Rectangle = require('./Rectangle.js');
const { Range, Ranges } = require('./Ranges.js');
const assist = require('./assist.js');
const DOM = require('./DOM.js');
const RLG = require('./RLG.js');
const Failure = require('./Failure.js');

const fs = require('fs');
const RepairStatistics = require('./RepairStatistics.js');
const ProgressBar = require('progress');
const settings = require('../settings.js');
const RLGNode = require('./RLGNode.js');

class Webpage {
    /**
     * Constructor to create a webpage object.
     * @param {URI} uri path of the webpage.
     * @param {Driver} driver puppeteer driver.
     * @param {Range} testingRange The range of viewports to test.
     * @param {Path} outputPath The output path of this webpage.
     * @param {string} pageName The name of page.
     */
    constructor(uri, driver, testingRange, testingHeight, outputPath, pageName) {
        this.name = pageName;
        this.uri = uri;
        this.driver = driver;
        this.testingRange = testingRange;
        this.testingHeight = testingHeight;
        this.rlg = undefined;
        this.outputPath = outputPath;
        this.runCounter = 0;
        this.pageRunOutputPath = undefined;
        this.collisionRepairStats = new RepairStatistics();
        this.protrusionRepairStats = new RepairStatistics();
        this.viewportRepairStats = new RepairStatistics();
        this.allRepairStats = new RepairStatistics();
        this.durationWebpage = new Date();
        this.durationDOM = undefined;
        this.durationDetection = undefined;
        this.durationRepair = undefined;
        this.durationClassify = undefined;
    }
    createMainOutputFile() {
        fs.mkdirSync(this.outputPath);
    }
    setRunOutput() {
        this.runCounter++;
        this.pageRunOutputPath = path.join(this.outputPath, 'run-' + this.runCounter);
        fs.mkdirSync(this.pageRunOutputPath);
        this.domOutputPath = path.join(this.pageRunOutputPath, 'DOMs');
        fs.mkdirSync(this.domOutputPath);
        this.snapshotOutputPath = path.join(this.pageRunOutputPath, "snapshots");
        fs.mkdirSync(this.snapshotOutputPath);
        if (settings.humanStudy) {
            fs.mkdirSync(path.join(this.pageRunOutputPath, 'human-study', 'screenshots'), { recursive: true });
        }
        assist.logFile = path.join(this.pageRunOutputPath, 'log.txt');
        //Load DOM data for first run?
        this.loadData = false;
        if (settings.loadDirectory != undefined && this.runCounter === 1) {
            this.loadDirectory = path.join(settings.loadDirectory, this.name, 'run-1', 'DOMs');
            if (fs.existsSync(this.loadDirectory))
                this.loadData = true;
            else
                assist.log("Could not find load directory: " + this.loadDirectory)
        }
        this.aftermathDirectory = path.join(this.pageRunOutputPath, 'repair-aftermath');
        fs.mkdirSync(this.aftermathDirectory);
        //Create CSS directories
        let cssDirectory = path.join(this.pageRunOutputPath, 'CSS');
        let cssRepairedDirectory = path.join(cssDirectory, 'repaired');
        let cssFailedDirectory = path.join(cssDirectory, 'failed');

        fs.mkdirSync(cssDirectory);
        fs.mkdirSync(cssRepairedDirectory);
        fs.mkdirSync(cssFailedDirectory);
    }
    async navigateToPage() {
        await driver.goto(this.uri);
    }
    /**
     * Patches the webpage using the 1400 or 320 and tests the webpage for failures.
     */
    async answerRQ(patchViewport = 320,screenshots = false) {
        let rangeMin = 320;
        let rangeMax = 1400;
        if (patchViewport === 1400)
            rangeMax--;
        else
            rangeMin++;
        await this.navigateToPage();
        let failure = new Failure(this.name, this.runCounter);
        let range = new Range(rangeMin, rangeMax);
        range.narrowerClassification = "FP";
        range.widerClassification = "FP";
        range.minClassification = "TP";
        range.midClassification = "TP";
        range.maxClassification = "TP";
        failure.range = range;
        failure.ID = 1;
        await failure.answerRQ(driver, patchViewport, this.pageRunOutputPath);
        this.loadData = false;
        await this.test(false, false);
        if(screenshots === true){
            let viewports = []
            for (let i = 1400; i >= 320; i -= 10) {
                viewports.push(i);
            }
            if (!viewports.includes(320))
                viewports.push(320);
            for (let viewport of viewports) {
                //await failure.setViewportHeightBeforeSnapshots(viewport);
                await driver.setViewport(viewport);
                let screenshot = await driver.screenshot(undefined, false);
                //await failure.resetViewportHeightAfterSnapshots(viewport);
                let imageFileName = viewport + '.png';
                failure.saveScreenshot(path.join(this.snapshotOutputPath, imageFileName), screenshot, false);
            }
        }
        await this.classifyFailures();
        await failure.deleteRepair();
    }
    async test(navigate = true, setupOutput = true) {
        this.durationDOM = new Date();
        if (setupOutput)
            this.setRunOutput();
        assist.resetFailureCount();
        assist.resetFailureID();
        console.log('Testing: ' + this.outputPath.substring(this.outputPath.lastIndexOf(path.sep) + 1) + ' Run: ' + this.runCounter + ' Time stamp: ' + assist.getDateTimeString());
        //To avoid too many 'this' usages.
        let driver = this.driver;
        let testingRange = this.testingRange;
        this.rlg = new RLG(this.pageRunOutputPath, this.name, this.runCounter);
        let testingHeight = this.testingHeight;
        if (this.runCounter === 1 && navigate) {
            await this.navigateToPage();
        }
        let totalViewports = (testingRange.max - testingRange.min + 1);
        let bar = new ProgressBar('DOM to RLG    [:bar] :etas Viewport:       :token1/' + totalViewports, { incomplete: ' ', total: totalViewports, width: 25 })
        let counter = 0;
        for (let width = testingRange.max; width >= testingRange.min; width--) {
            counter++;
            let currentViewport = "(" + width + ") " + counter;
            bar.tick({ 'token1': currentViewport });
            if (this.loadData) {
                let loadedDom = new DOM(undefined, width);
                loadedDom.rbush = this.loadRBushData(width);
                loadedDom.saveRBushData(this.domOutputPath);
                this.rlg.extractRLG(loadedDom, width);
            } else {
                await driver.setViewport(width, testingHeight);
                let dom = new DOM(driver, width);
                await dom.captureDOM();
                dom.saveRBushData(this.domOutputPath);
                this.rlg.extractRLG(dom, width);
                dom.disposeAllElementHandles();
            }
        }
        this.durationDOM = new Date() - this.durationDOM;
        this.durationDetection = new Date();
        this.rlg.detectFailures();
        this.durationDetection = new Date() - this.durationDetection;
    }
    /**
     * Load rbush of dom at given viewport from disk.
     * @param {number} viewport The viewport to lead.
     */
    loadRBushData(viewport) {
        let fileName = 'viewport-' + viewport + '.json';
        let file = path.join(settings.loadDirectory, this.name, 'run-1', 'DOMs', fileName);
        if (fs.existsSync(file)) {
            try {
                let data = JSON.parse(fs.readFileSync(file, 'utf8'));
                let rbush = new RBush()
                rbush.fromJSON(data);
                //rbush.load(data);
                return rbush;
            } catch (err) {
                console.error(err)
                return undefined;
            }
        }
        return undefined;
    }
    async manualCheck(viewport) {
        await driver.setViewport(viewport, this.testingHeight);
        console.log('Current Viewport: ' + viewport);
        for (let xpath of settings.logXPaths) {
            let rlgNode = new RLGNode({ xpath: xpath })
            await this.getInformationFor(rlgNode.getSelector());
        }
    }
    printHumanStudyData() {
        if (settings.humanStudy === true) {
            let failures = this.rlg.getHumanStudyData(this.name, this.runCounter);
            if (failures.length > 0) {
                let webpage = {
                    timestamp: assist.getDateTimeString(),
                    name: this.name,
                    run: this.runCounter,
                    failures: failures
                }
                try {
                    fs.writeFileSync(path.join(this.pageRunOutputPath, 'human-study', 'data.json'), JSON.stringify(webpage))
                } catch (err) {
                    console.error(err)
                }
            }
        }
    }
    printHumanStudyDataCSV() {
        if (settings.humanStudy) {
            let file = path.join(this.pageRunOutputPath, 'human-study', 'keys.csv');
            let header = "Webpage,Run,ID,Type,RangeMin,RangeMax,RealName,ImageName";
            assist.printToFile(file, header);
            this.rlg.printHumanStudyDataCSV(file);
        }
    }
    async getInformationFor(selector) {
        console.log(selector);
        let element = await driver.getElementBySelector(selector);
        if (element !== undefined && element.length >= 1) {
            let rectangle = new Rectangle(await driver.getRectangle(element));
            if (rectangle !== undefined)
                console.log('minX: ' + rectangle.minX + ' maxX: ' + rectangle.maxX + ' minY: ' + rectangle.minY + ' maxY: ' + rectangle.maxY + ' width: ' + rectangle.width + ' height: ' + rectangle.height);
            else
                console.log('No rectangle information.');
            element[0].dispose();
        } else {
            console.log('Element not found.');
        }
    }
    printRLG() {
        this.rlg.printGraph(path.join(this.pageRunOutputPath, 'RLG.txt'));
    }
    printFailures() {
        this.rlg.printFailuresTXT(path.join(this.pageRunOutputPath, 'Failures.txt'));
        this.rlg.printFailuresCSV(path.join(this.pageRunOutputPath, 'Failures.csv'), this.name, this.runCounter);
    }
    /**
     * Prints the repairs attempted in CSV format.
     */
    printWorkingRepairs() {
        let file = path.join(this.pageRunOutputPath, 'repairs.csv');
        let text =
            "Webpage,Run,FID,Type,RangeMin,RangeMax,XPath1,XPath2,ClassNarrower,ClassMin,ClassMid,ClassMax,ClassWider,Repair,RepairOutcome";
        fs.appendFileSync(file, text, function (err) {
            if (err) throw err;
        });
        this.rlg.printWorkingRepairs(file, this.name, this.runCounter);
    }
    /**
     * Repairs failures of the RLG.
     * @returns An array [viewport, protrusion, collision, all] statistics of this site.
     */
    async repairFailures() {
        //this.resetRepairStats();
        this.durationRepair = new Date()
        await this.rlg.repairFailures(this.driver, this.pageRunOutputPath, this.name, this.runCounter);
        this.durationRepair = new Date() - this.durationRepair;
        //this.collisionRepairStats.addValuesFrom(this.rlg.collisionRepairStats);
        //this.protrusionRepairStats.addValuesFrom(this.rlg.protrusionRepairStats);
        //this.viewportRepairStats.addValuesFrom(this.rlg.viewportRepairStats);
        //this.allRepairStats.addValuesFrom(this.rlg.allRepairStats);
        //print repair stats for this run/rlg.
        //let runResultsFile = path.join(this.pageRunOutputPath, 'repair-results.txt');
        //this.rlg.printRepairStats(runResultsFile);
        this.printWorkingRepairs(); //CSV
    }
    /**
     * Print stats for all runs of this webpage.
     */
    printRepairStats() {
        let runTotalsFile = path.join(this.outputPath, 'runs-repair-results.txt');
        //console.log('All runs repair results: ');
        this.collisionRepairStats.printRepairStats(runTotalsFile, 'Total ' + assist.FailureType.COLLISION + ' Repair Statistics:');
        this.protrusionRepairStats.printRepairStats(runTotalsFile, 'Total ' + assist.FailureType.PROTRUSION + ' Repair Statistics:');
        this.viewportRepairStats.printRepairStats(runTotalsFile, 'Total ' + assist.FailureType.VIEWPORT + ' Repair Statistics:');
        this.allRepairStats.printRepairStats(runTotalsFile, 'Total Repair Statistics:');
    }
    /**
     * Classify and screenshot failures.
     */
    async classifyFailures() {
        this.durationClassify = new Date();
        await this.rlg.classifyFailures(this.driver, this.pageRunOutputPath + path.sep + 'Classifications.txt', this.snapshotOutputPath);
        this.durationClassify = new Date() - this.durationClassify;
    }
    async screenshotFailures() {
        await this.rlg.screenshotFailures(this.driver, this.pageRunOutputPath);
    }

}
module.exports = Webpage;