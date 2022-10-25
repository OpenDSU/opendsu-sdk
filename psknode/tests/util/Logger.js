const ENABLE_DEBUG = true;

class Logger {
    constructor(prefix) {
        this.prefix = prefix || "";
    }

    debug(...args) {
        if (ENABLE_DEBUG) {
            console.log(`${this.prefix}[DEBUG]`, ...args);
        }
    }

    info(...args) {
        console.log(`${this.prefix}[INFO]`, ...args);
    }

    warn(...args) {
        console.log(`${this.prefix}[WARN]`, ...args);
    }

    error(...args) {
        console.log(`${this.prefix}[ERROR]`, ...args);
    }

    trace(...args) {
        console.trace(`${this.prefix}[ERROR]`, ...args);
    }
}

module.exports = Logger;
