# Layout DR
Layout DR is an automated tool to repair Responsive Layout Failures (RLFs) that are found in a responsively designed webpage. The tool automatically detects the RLFs and presents the user with up to two CSS "hot fixes" for each RLF detected.  

This repository is the replication package for our ICST 2022 submission. We recommend matching the tested environment for installing, running, and proper replication of the study.

## Tested Environment
+ Ubuntu 20.04.2.
+ NPM version is 6.14.7.
+ NodeJS version 14.8.0.
+ Check your environment by typing `npm -v` and `node -v`.

> We recommend using the NodeJS version manager `nvm` to install the proper version of NodeJS in order to match the tested environment if you have issues installing and running the tool using a newer version of NodeJS. Go to https://github.com/nvm-sh/nvm#installing-and-updating for further details on installing `nvm`.

## Installing
1. Install NodeJS which comes with NPM from https://nodejs.org/ if it is not already installed on your system.
2. Download the tool by cloning the repository from https://bitbucket.org/responsiverepair/replicationpackage.
3. Go to the downloaded `replicationpackage` directory.
4. Type `npm install`.

## Running
1. Go to the `replicationpackage` directory.
2. Type `npm start` or `node tool.js`.

## Running Test Suite
1. Go to the `replicationpackage` directory.
2. Type `npm test`.

## Subject Webpages
The directory `replicationpackage\subjects` contains all the default webpages that were used as subjects by the program in the study. To limit or exclude some of these subjects see the Program Settings section bellow.

## Program Settings
All settings for the tool are in the file `settings.js` available in the main directory. 
1. `run:` sets the running mode of the program. It can be used for RLF detection only mode by setting it to RUN.DETECTION. Alternatively it can be set to detect and repair mode by RUN.REPAIR. It can also be used to for manual inspection of certain viewport by setting the RUN.MANUAL but you should be using the browser in graphical mode and not in headless mode to make observations which are set using `browserMode:`.
2. `browserMode:` can be used to set to MODE.HEADLESS for headless browser mode, MODE.MAXIMIZED AND MODE.FULLSCREEN for graphical mode.
3. `only:` limits the run to a subset of webpages found in the `subjects` folder. The strings in the array are used to match for names of subjects.
4. `not:` excludes the default input webpages by specifying the webpages not to be used by the program. This array overrides the `only:` array. Hence if the `not:` contains entries, the program will use all subjects except the ones listed in the `not:` array.

## Output
The output of the program are available in the `output` folder as specified by default in the `settings.js` file. Depending on the settings, there should be csv files containing either results of repair in `repairs.csv` or just the RLFs detected in `failures.csv`. The `repairs.csv` file is self sufficient but is only outputted in repairing mode of the program. Screenshots are taken for multiple viewports with proper naming. If a repair works a snapshot is included with the name of the repair strategy appearing in the file name. The co-ordinates information of each extracted viewport and used by the RLG is saved in `.json` file with the viewport width number in the name of the file. Other `RLG.txt` files show RLG information and automatic classification as TP or FP based on the DOM. 
