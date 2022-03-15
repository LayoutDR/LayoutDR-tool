const assist = require('./src/assist.js');
const path = require('path');
const MODE = assist.Mode;
//const RepairStrategy = assist.RepairStrategy;
const RepairConfirmed = assist.RepairConfirmed;
const AdditionalRepairs = assist.AdditionalRepairs;
const RUN = assist.Run;

//RR Settings. 
let settings = {
    URLs: [],
    testingWidthMin: 320,
    testingWidthMax: 1400,
    testingHeight: 1000,
    repeat: 1,
    run: RUN.REPAIR,
    browserMode: MODE.HEADLESS,
    loadDirectory: path.join(__dirname, 'saved-doms-headless-4ms'),
    //Split the 19 webpages with RLFs into two batches...
    //only: ['3-Minute-Journal', 'pdf-escape', 'Pepfeed', 'BugMeNot', 'MidwayMeetup', 'WillMyPhoneWork', 'CloudConvert', 'Consumer-Reports', 'UserSearch'], //Only check these webpages to check. Case-Sensitive... 'Pepfeed'
    //only: ['Days-Old','Covered-Calendar','HotelWifiTest', 'Pocket', 'Duolingo', 'Dictation','Honey','WhatShouldIReadNext', 'AirBnb', 'TopDocumentary'],
    //Other...
    //only: ['3-Minute-Journal', 'pdf-escape', 'Pepfeed', 'BugMeNot', 'MidwayMeetup', 'WillMyPhoneWork', 'CloudConvert'], //Only check these webpages to check. Case-Sensitive... 'Pepfeed'
    //only: ['Consumer-Reports'],
    //only: ['Days-Old','Covered-Calendar','HotelWifiTest', 'Pocket', 'Duolingo','Dictation','Honey','WhatShouldIReadNext', 'UserSearch'],
    //only: ['AirBnb', 'TopDocumentary'], 
    //Webpages with TP RLFs...
    //only: [ 'pdf-escape', 'Pepfeed', 'BugMeNot', 'MidwayMeetup',  'Consumer-Reports', 'Duolingo','HotelWifiTest'], 
    //Webpages that do not have any RLFs...
    //not: ['Accountkiller', 'Mailinator', 'Ninite', 'RainyMood', 'RunPee', 'ZeroDollarMovies'],
    //only: ['3-Minute-Journal', 'HotelWifiTest', 'MidwayMeetup', 'pdf-escape', 'BugMeNot', 'Pepfeed'],
    //not: ['cas','plotlyDash','poetry','coffeescript','graalvm','infernojs','keystone',jspdf','mdbui','quasar','reactivex','redash','asciidoctor','pixelsign','stackstorm','habitica','novnc','magento','metroui','mailgun','showdownjs','tuiEditor','ionic','mdbootstrap','videojs','graalvm','infer','jhipster','arthasAliyun','graalvm','numpy','redash','spacy','odoo','airflow','sqlmap','fastapi','pandas','python','sentry','superset','ansible','thealgorithms','vuetify','nest','hexo','typescript','storybook','material','lodash','frontendchecklist','electron','deno','bootstrap','angular','tensorflow','nodejs','nanoid','stimulus','reactioncommerce','quokka','puppeteer','pritter','popmotion','parceljs','onivim','vuejs','spectrum','reactjs','reactioncommerce','luma','digikam','phplist', 'osticket','prestashop', 'suitecrm', 'vtiger', 'elementary','opencv','openproject','suitecrm-js-stripe-com-v3-index-html', 'woocommerce-woocommerce-com-_static-index-html'],
    //only: ['reactspring', 'marktext', 'cyberduck', 'electronReactBoilerplate','WillMyPhoneWork','selenium'],
    //only: ['reactspring', 'electronReactBoilerplate','WillMyPhoneWork'],
    //only: ['WillMyPhoneWork'],
    //not: ['electronReactBoilerplate','reactspring','dataWrapper', 'ZeroDollarMovies', 'RunPee', 'RainyMood', 'Mailinator'],
    //only:['Ardour','Bottender','Bower','CyberDuck','Django','DjangoRest','DjangoRest','Elastic','MantisBT','MarkText','OrchardCore', 'Selenium'],
    //only: ['Honey', 'Orchard', 'TopDoc', 'MarkText'],
    //only: ['mantisbt','elastic','bottender','orchard','willmyphonework'],
    //only: ['midwaymeetup','willmyphonework','consumer','mantisbt'],
    //only: ['3-Minute', 'airbnb','bugmenot','cloud','consumer','covered','days','dictation','duolingo', 'Honey', 'HotelWifiTest','Mail', 'MidwayMeetup', 'pdf',  'Pepfeed', 'Pocket', 'TopDocumentary', 'UserSearch', 'WhatShouldIReadNext', 'WillMyPhoneWork' ],
    //only: ['MinuteJournal','Bower','ConsumerReports','DjangoRest','Duolingo','ElasticSearch','Honey','HotelWifiTest','MantisBT','MarkText','MidwayMeetup','PepFeed','Selenium','WillMyPhoneWork'],
    //only: ['MinuteJournal','Ardour','Bottender','Bower','BugMeNot','ConsumerReports','Django','Duolingo','ElasticSearch','Honey','HotelWifiTest','MantisBT','MarkText','MidwayMeetup','OrchardCore','PepFeed','Selenium','WillMyPhoneWork'],
    //only: ['Bower'],
    excludeElementsWithDisplayValue: ['inline'], //excluded from the RLG
    logXPaths: [],
    logViewports: [],
    logValuesDuringScreenCapture: false,
    capturePCAlignments: true, //top right left bottom aligned, center justified vertical and horizontal
    capturePCVerticalAlignments: false, //top aligned, bottom aligned, vertically center justified.
    captureSiblingAlignments: true, //above, below, right, left
    smallrangeThreshold: 5,
    webpagesDirectory: path.join(__dirname, 'subjects'),
    //Replace F: with __dirname 
    mainOutputFile: path.join(__dirname, 'output'),
    runOutputFile: path.join(__dirname, 'output', assist.getDateTimeString()),
    repairDelay: 0.4,//Test 0.4,
    loadDelay: 0.4,//Test //0.4, //.2 does not work on windows 
    autoScrollDelay: 0.4,//Test 0.4,
    scrollDelay: 0.4,//Test 0.4,
    scrollPage: true, // should the page be scrolled on navigation to trigger any events or load elements?
    maxAutoScroll: 25000, //The maximum Y/Height to scroll a page.
    tolerance: { collision: 2, equivalentParent: 1, protrusion: 1, smallrange: 1, ignoreFractions: false }, //Collision allows 1px border over === 1.
    rowThreshold: 2, //the number of elements must be in a row to consider a wrapping failure (does not include wrapped element)
    detectElementCollision: true,
    detectElementProtrusion: true,
    detectViewportProtrusion: true,
    detectWrapping: true,
    detectSmallrange: true,
    repairConfirmUsing: RepairConfirmed.DOMRLG,
    screenshotNarrower: false,
    screenshotMin: true,
    screenshotMid: false,
    screenshotMax: false,
    screenshotWider: true,
    screenshotFullpage: true,
    screenshotFailingRepairs: true,
    screenshotHighlights: true,
    screenshotSpecial: ['Duolingo', 'DjangoRest', 'Bower'], //Use all element height for page height instead of just the HTML element
    maxNumberOfCombinedRepairs: 3,
    additionalRepairs: AdditionalRepairs.NONE,
    aftermath: false, //generate new full rlg for each repair and print to check consequences.
    NoScalingCSSProperties: [],//['background-position-x','background-position-y','background-position'],
    skipCopyingCSSProperties: [],
    repairs: [
        // 'bodyMaximizeWidthToViewportCSS',
        // 'elementMaxWidthMaxHeightCSS',
        // 'parentMaxWidthMaxHeightCSS',
        // 'ancestorsMaxWidthHeightCSS',
        // 'parentMinWidthHeightCSS',
        // 'shrinkSiblingsCSS',
        // 'expandParentCSS',
        // 'pushApart',
        // 'negativeMarginsToZeroCSS',
        // 'marginsToZeroCSS',
        // 'differenceComputedStylesCSS',
        // 'setProtrudingElementToParentSize',
        // 'autoWidthHeightElement',
        // 'autoWidthHeightParent',
        // 'allElementsAutoRestrictedMax',
        // 'overflowAuto',
        // 'htmlDescendantsMaxWidthMaxHeight',
        //  'widerComparisonViewportSpacing',
        //  'narrowerComparisonViewportSpacing',
        // 'widerComparisonElements',
         'Transform-Wider',
         'Transform-Narrower',
        //'Transform-Wider-Targeted'
    ],
    metaInformation: "Repair Human Study",
    humanStudy: false, //take anonymized screenshots specifically made for the human study.
    humanStudyClippedSnapshot: false,
    humanStudyMoreViewportWidth: true
};

module.exports = settings;
