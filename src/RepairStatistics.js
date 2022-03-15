const assist = require('./assist.js');

class RepairStatistics {
    constructor() {
        this.repairs = 0;
        this.failedRepairs = 0;
        this.repairedByOthers = 0;
        this.noOracle = 0;
        this.doesNotNeedRepair = 0;
        this.oracleApplied = 0;
    }
    /**
     * Add the all stats from parameter object to this object's stats.
     * @param {...RepairStatistics} otherRepairStatistics The other stat(s) to be added to this stats object.
     */
    addValuesFrom(...args) {
        for(let otherRepairStatistics of args){
            this.repairs += otherRepairStatistics.repairs;
            this.failedRepairs += otherRepairStatistics.failedRepairs;
            this.repairedByOthers += otherRepairStatistics.repairedByOthers;
            this.noOracle += otherRepairStatistics.noOracle;
            this.doesNotNeedRepair += otherRepairStatistics.doesNotNeedRepair;
            this.oracleApplied += otherRepairStatistics.oracleApplied;
        }
    }
    /**
     * 
     * @param {Path} file The file to print to.
     * @param {String} title The title to print before statistics.
     * @param {Boolean} consolePrintTitle Should title it be printed to console.
     * @param {Boolean} consolePrint Should stats be printed to console.
     */
    printRepairStats(file, title, consolePrintTitle = false, consolePrintStats = false) {
        if (title !== undefined) {
            assist.printToFile(file, title);
            if (consolePrintTitle)
                console.log(title);
        }
        let total = this.repairs + this.repairedByOthers + this.failedRepairs + this.noOracle + this.doesNotNeedRepair;
        let fixed = this.repairs + this.repairedByOthers;
        let requireMoreRepairRate = 0;
        let successRate = 0;
        if (total !== 0) {
            successRate = ((fixed / total) * 100);
            requireMoreRepairRate = ((this.oracleApplied / total) * 100);
        }
        successRate = successRate.toFixed(2);
        requireMoreRepairRate = requireMoreRepairRate.toFixed(2);

        let text = 'Fixed:' + successRate + '%' + ' Require-More:' + requireMoreRepairRate + '%' + ' Patched:' + this.repairs + ' Free:' + this.repairedByOthers + ' Failed:' + this.failedRepairs + ' No-oracle:' + this.noOracle + ' FPs:' + this.doesNotNeedRepair + ' Require-More:' + this.oracleApplied;
        assist.printToFile(file, text);
        if (consolePrintStats)
            console.log(text);
    }
}
module.exports = RepairStatistics;