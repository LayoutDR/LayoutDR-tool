
const Webpage = require('./src/Webpage.js');
const driver = require('./src/Driver.js');
const { Range, Ranges } = require('./src/Ranges.js');
const assist = require('./src/assist.js');
const fs = require('fs');
const path = require('path');
const RepairStatistics = require('./src/RepairStatistics.js');
const Failure = require('./src/Failure.js');
const settings = require('./settings.js');
const { clipImage } = require('./src/Driver.js');
const RUN = assist.Run;
const MODE = assist.Mode;

/**
 * Main/Entry function.
 */
(async () => {
    this.durationProgram = new Date();
    assist.settings = settings;
    if (settings.additionalRepairs == assist.AdditionalRepairs.COMBINATIONS)
        settings.repairCombination = assist.getCombinationsOfSets(settings.repairs, settings.maxNumberOfCombinedRepairs);
    else if (settings.additionalRepairs == assist.AdditionalRepairs.PERMUTATIONS)
        settings.repairCombination = assist.getPermutationsOfSets(settings.repairs, settings.maxNumberOfCombinedRepairs);
    else
        settings.repairCombination = assist.getArraysFromArray(settings.repairs);
    //let webpage = new Webpage(uriPrefix + '/tests/subjects/simple.html', driver, testingRange, testingHeight);
    commandLineOptions(process.argv.slice(2));
    //location of local subject
    const uriPrefix = 'file://' + __dirname.replace(/\\/g, "/");
    //make output directory...
    if (!fs.existsSync(settings.mainOutputFile)) {
        fs.mkdirSync(settings.mainOutputFile);
    }
    fs.mkdirSync(settings.runOutputFile);

    //save settings to file for future reference...
    for (let key in settings) {
        if (key === 'tolerance') {
            for (let subKey in settings[key])
                assist.printToFile(path.join(settings.runOutputFile, 'settings.txt'), key + ': ' + subKey + ': ' + settings[key][subKey])
        }
        else {
            assist.printToFile(path.join(settings.runOutputFile, 'settings.txt'), key + ': ' + settings[key])
        }
    }
    let testingRange = new Range(settings.testingWidthMin, settings.testingWidthMax);
    await driver.startup(settings.browserMode); //can change mode to HEADLESS, FULLSCREEN, MAXIMIZED
    let webpages = [];
    if (settings.URLs.length === 0 && settings.run !== RUN.DIFFERENCING) {
        let mainDirectory = settings.webpagesDirectory;
        let allFiles = fs.readdirSync(mainDirectory);
        while (allFiles.length > 0) {
            let file = allFiles.shift();
            if (file.toLowerCase().includes('index.html') && file.toLocaleLowerCase().includes('index.htm')) {
                if (settings.not !== undefined && settings.not.length > 0) {
                    let testSubject = true;
                    for (let name of settings.not)
                        if (file.toLocaleLowerCase().replace(/\\/g, "-").replace(/\//g, "-").replace(/\:/g, "-").replace(/\./g, "-").includes(name.toLocaleLowerCase())) {
                            testSubject = false;
                            break;
                        }
                    if (testSubject) {
                        settings.URLs.push('file://' + path.join(mainDirectory, file).replace(/\\/g, "/"));
                    }
                }
                else if (settings.only !== undefined && settings.only.length > 0) {
                    for (let name of settings.only) {
                        if (file.toLocaleLowerCase().replace(/\\/g, "-").replace(/\//g, "-").replace(/\:/g, "-").replace(/\./g, "-").includes(name.toLocaleLowerCase())) {
                            settings.URLs.push('file://' + path.join(mainDirectory, file).replace(/\\/g, "/"));
                            break;
                        }
                    }

                } else {
                    settings.URLs.push('file://' + path.join(mainDirectory, file).replace(/\\/g, "/"));
                }
                //if (file.toLowerCase().includes('index.html') && file.toLocaleLowerCase().includes('index.htm')) {
            } else if (fs.statSync(path.join(mainDirectory, file)).isDirectory()) {
                let subFiles = fs.readdirSync(path.join(mainDirectory, file));
                let extendedPathSubFiles = subFiles.map(newFile => { return file + path.sep + newFile; })
                allFiles = [...allFiles, ...extendedPathSubFiles];
            }
        }
    }
    for (let URL of settings.URLs) {
        //create output file from URL and create webpage instances.
        let pageName = undefined;
        if (URL.includes(settings.webpagesDirectory.replace(/\\/g, "/"))) {
            pageName = URL.split(settings.webpagesDirectory.replace(/\\/g, "/") + '/')[1].replace(/\\/g, "-").replace(/\//g, "-").replace(/\:/g, "-").replace(/\./g, "-");;
        } else {
            pageName = URL.replace(/\\/g, "-").replace(/\//g, "-").replace(/\:/g, "-").replace(/\./g, "-");;
        }
        let pageOutputPath = path.join(settings.runOutputFile, pageName);
        webpages.push(new Webpage(URL, driver, testingRange, settings.testingHeight, pageOutputPath, pageName));
        // console.log("Found Webpage: " + pageName);
        // console.log("          URL: " + URL);

    }
    let statsForRun = [];
    let runCounter = 0;
    while (runCounter < settings.repeat) {
        statsForRun.push({
            collisionRS: new RepairStatistics(),
            protrusionRS: new RepairStatistics(),
            viewportRS: new RepairStatistics(),
            allRS: new RepairStatistics()
        });
        runCounter++;
    }
    let total = { elements: 0, declarations: 0 }
    let latexFile = path.join(settings.runOutputFile, 'statistics-data.tex');
    for (let webpage of webpages) {
        try {
            if (settings.run === RUN.RQ) {
                webpage.createMainOutputFile();
                await webpage.setRunOutput();
                await webpage.answerRQ(1400);
                //await webpage.classifyFailures();
                webpage.printRLG();
                webpage.printFailures();
                //await webpage.repairFailures();
            } else if (settings.run === RUN.STATISTICS) {
                assist.logFile = path.join(settings.runOutputFile, 'error-log.txt');
                let name = webpage.name.replace('-index-html', '');
                await webpage.navigateToPage();
                await assist.resolveAfterSeconds(2);
                let stats = await driver.getElementAndDeclarationCount();
                console.log('Webpage: ' + name + ' Elements: ' + stats.elements + ' Declarations: ' + stats.declarations);
                let data = name + ' & URL & ' + stats.elements + ' & ' + stats.declarations + ' \\\\';
                assist.printToFile(latexFile, data);
                if (stats.securityErrors.length > 0) {
                    console.log('Security Errors: ' + stats.securityErrors.length)
                    for (let se of stats.securityErrors)
                        assist.log('Webpage: ' + name + ' SecurityError: ' + se);
                }
                total.elements += stats.elements;
                total.declarations += stats.declarations;
            }
            else if (settings.run === RUN.MANUAL) {
                assist.logFile = path.join(settings.runOutputFile, 'error-log.txt');
                await webpage.navigateToPage();
                console.log(webpage.name);
                let viewport = '';
                let response = undefined;
                let viewportScreenshots = [];
                while (true) {
                    response = await assist.pause('Go to viewport:');
                    if (response.toLocaleLowerCase().trim() === 'exit' || response.toLocaleLowerCase().trim() === 'quit' || response.toLocaleLowerCase().trim() === 'q') {
                        break;
                    }
                    if (response.toLocaleLowerCase().trim() === 's' || response.toLocaleLowerCase().trim() === 'screenshot' || response.toLocaleLowerCase().trim() === 'snapshot') {
                        if (viewportScreenshots.includes(driver.currentViewport)) {
                            console.log('Already taken');
                        } else {
                            try {
                                if (settings.browserMode === MODE.HEADLESS) {
                                    if (driver.currentViewport !== undefined) {
                                        //To reduce repeated code, using a fake failure.
                                        let failure = new Failure();
                                        let range = new Range(driver.currentViewport - 1, driver.currentViewport - 1)
                                        failure.range = range;
                                        await failure.setViewportHeightBeforeSnapshots(driver.currentViewport)
                                        let screenshot = await driver.screenshot(undefined, false);
                                        await failure.resetViewportHeightAfterSnapshots(driver.currentViewport)
                                        viewportScreenshots.push(driver.currentViewport);
                                        let imageFileName = driver.currentViewport + '.png';
                                        failure.saveScreenshot(path.join(settings.runOutputFile, imageFileName), screenshot, false);
                                    }

                                } else {
                                    console.log('Screenshots while in headless')
                                }

                            } catch (e) {
                                console.error(e)
                            }

                        }

                    }
                    else if (response === '') {
                        viewport -= 1;
                        await webpage.manualCheck(viewport - 1);
                    } else {
                        viewport = Number(response);
                        await webpage.manualCheck(Number(viewport));
                    }


                }
            } else {
                let runCounter = 0;
                while (runCounter < settings.repeat) {
                    if (runCounter == 0)
                        webpage.createMainOutputFile();
                    await webpage.test();
                    if (settings.run === RUN.DETECTION || RUN.REPAIR) {
                        await webpage.classifyFailures();
                        webpage.printRLG();
                        webpage.printFailures();

                        if (settings.run === RUN.REPAIR)
                            await webpage.repairFailures();
                        if (settings.humanStudy === true) {
                            webpage.printHumanStudyDataCSV();
                            webpage.printHumanStudyData();
                        }
                        //statsForRun[runCounter].collisionRS.addValuesFrom(webpage.rlg.collisionRepairStats);
                        //statsForRun[runCounter].protrusionRS.addValuesFrom(webpage.rlg.protrusionRepairStats);
                        //statsForRun[runCounter].viewportRS.addValuesFrom(webpage.rlg.viewportRepairStats);
                        //statsForRun[runCounter].allRS.addValuesFrom(webpage.rlg.allRepairStats);
                    }
                    runCounter++;
                }
                webpage.durationWebpage = new Date() - webpage.durationWebpage;
            }
        } catch (error) {
            let name = webpage.name.replace('-index-html', '');
            assist.log('====------')
            assist.log("FAILED: Webpage (" + name + ") did not complete successfully.");
            if (error !== undefined && error.stack !== undefined) {
                assist.log(error.stack);

            } else {
                assist.log(error);
            }
            assist.log('====------');
        }

    }
    if (settings.run === RUN.STATISTICS) {
        let data = '\\textbf{Total} &  & ' + total.elements + ' & ' + total.declarations + ' \\\\';
        assist.printToFile(latexFile, '\\midrule');
        assist.printToFile(latexFile, data);
    }
    // if (settings.run === RUN.REPAIR) {
    //     for (let i = 0; i < statsForRun.length; i++) {
    //         let runTotalsFile = path.join(settings.runOutputFile, 'run-' + (i + 1) + '-repair-results.txt');
    //         //console.log('All webpage repair results for run ' + runCounter + ': ');
    //         statsForRun[i].collisionRS.printRepairStats(runTotalsFile, 'Total ' + assist.FailureType.COLLISION + ' Repair Statistics:');
    //         statsForRun[i].protrusionRS.printRepairStats(runTotalsFile, 'Total ' + assist.FailureType.PROTRUSION + ' Repair Statistics:');
    //         statsForRun[i].viewportRS.printRepairStats(runTotalsFile, 'Total ' + assist.FailureType.VIEWPORT + ' Repair Statistics:');
    //         statsForRun[i].allRS.printRepairStats(runTotalsFile, 'Total Repair Statistics:');
    //     }
    // }
    if (settings.run === RUN.DIFFERENCING) {
        webpages[0].rlg.difference(webpages[1].rlg);
    }
    await driver.shutdown();
    this.durationProgram = new Date() - this.durationProgram;
    //Print duration timing
    let file = path.join(path.join(settings.runOutputFile, 'duration.csv'));
    let header = "Webpage,Run,ID,Type,RangeMin,RangeMax,DurationProgram,DurationWebpage,DurationWebpageDOM,DurationWebpageDetection,DurationWebpageClassify,DurationWebpageRepair,DurationFailureClassify,DurationFailureRepair,DurationFailureWiderRepair,DurationFailureWiderConfirmFailure,DurationFailureNarrowerRepair,DurationFailureNarrowerConfirmRepair,NarrowerClass,MinClass,MidClass,MaxClass,WiderClass,Repair,RepairOutcome";
    assist.printToFile(file, header);

    for (let webpage of webpages) {
        for (node of webpage.rlg.nodesWithFailures) {

            let allFailures = [...node.elementCollisions, ...node.elementProtrusions, ...node.viewportProtrusions, ...node.smallranges, ...node.wrappings];
            for (failure of allFailures) {
                for (let i = 0; i < failure.repairCombinationResult.length; i++) {
                    let repairArray = settings.repairCombination[i];
                    let repairName = '';
                    for (let subRepair of repairArray) {
                        if (repairName === '')
                            repairName = subRepair;
                        else
                            repairName += "-" + subRepair;
                    }
                    let repairOutcome = failure.repairCombinationResult[i];

                    let line = failure.webpage + "," +
                        failure.run + "," +
                        failure.ID + "," +
                        failure.type + "," +
                        failure.range.getMinimum() + "," +
                        failure.range.getMaximum() + "," +
                        this.durationProgram + "," +
                        webpage.durationWebpage + "," +
                        webpage.durationDOM + "," +
                        webpage.durationDetection + "," +
                        webpage.durationClassify + "," +
                        webpage.durationRepair + "," +
                        failure.durationFailureClassify + "," +
                        failure.durationFailureRepair + "," +
                        failure.durationWiderRepair + "," +
                        failure.durationWiderConfirmRepair + "," +
                        failure.durationNarrowerRepair + "," +
                        failure.durationNarrowerConfirmRepair + "," +
                        failure.range.narrowerClassification + "," +
                        failure.range.minClassification + "," +
                        failure.range.midClassification + "," +
                        failure.range.maxClassification + "," +
                        failure.range.widerClassification + "," +
                        repairName + "," + repairOutcome;
                    assist.printToFile(file, line);
                }
            }
        }
    }
    console.log('End of Program');
})();

/**
 * Parses and sets command line options.
 * @param {Array} args Arguments from the command line.
 */
function commandLineOptions(args) {
    //for comparing two webpages specified from the user
    let URL1 = undefined;
    let URL2 = undefined;
    for (let i = 0; i < args.length; i++) {
        let argument = args[i];
        if (argument.toLowerCase() === "compare" || argument.toLowerCase() === "-c") {
            settings.run = RUN.DIFFERENCING;
            if ((i + 2) > args.length - 1) {
                console.log("Two URIs to web pages should be supplied when using the graph compare options.");
                process.exit();
            } else {
                URL1 = args[i + 1];
                URL2 = args[i + 2];
                settings.URLs.push(URL1);
                settings.URLs.push(URL2);
            }
        }
        if (argument.toLowerCase() === "viewport" || argument.toLowerCase() === "-vp") {
            if ((i + 1) > args.length - 1) {
                console.log("Please specify a viewport number");
                process.exit();
            }
            settings.testingWidthMin = args[i + 1];
            settings.testingWidthMax = args[i + 1];
        }
        if (argument.toLowerCase() === "viewport-start" || argument.toLowerCase() === "-vps") {
            if ((i + 1) > args.length - 1) {
                console.log("Please specify a start viewport number");
                process.exit();
            }
            settings.testingWidthMin = args[i + 1];
            if (settings.testingWidthMax === undefined)
                settings.testingWidthMax = args[i + 1];
        }
        if (argument.toLowerCase() === "viewport-end" || argument.toLowerCase() === "-vpe") {
            if ((i + 1) > args.length - 1) {
                console.log("Please specify an end viewport number");
                process.exit();
            }
            if (settings.testingWidthMin === undefined)
                settings.testingWidthMin = args[i + 1];
            settings.testingWidthMax = args[i + 1];
        }
        if (argument.toLowerCase() === "viewport-height" || argument.toLowerCase() === "-vph") {
            if ((i + 1) > args.length - 1) {
                console.log("Please specify a viewport height");
                process.exit();
            }
            settings.testingHeight = args[i + 1];
        }
        if (argument.toLowerCase() === "help" || argument.toLowerCase() === "-h") {
            console.log("compare (-c): To compare two layout graphs for differences.");
            console.log("   expects: Two consecutive and valid URIs that point to the web pages.");
            console.log("viewport (-vp): The viewport size to use.");
            console.log("   expects: A number to set the viewport size to.");
            console.log("viewport-start (-vps): The start viewport size to use.");
            console.log("   expects: A number used as the start viewport size.");
            console.log("viewport-end (-vpe): The end viewport size to use.");
            console.log("   expects: A number used as the end viewport size.");
            console.log("viewport-height (-vph): The height of the viewport to use.");
            console.log("   expects: A number used as the height of the viewport.");
            process.exit();
        }
    }
    if (settings.run === RUN.DIFFERENCING && (URL1 === undefined || URL2 === undefined)) {
        URL1 = 'file://' + __dirname.replace(/\\/g, "/") + '/webpages/new-age/index.html';
        URL2 = 'file://' + __dirname.replace(/\\/g, "/") + '/webpages/new-age-modified/index.html';
        settings.URLs.push(URL1);
        settings.URLs.push(URL2);
    }
}