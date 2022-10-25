const chokidar = require('chokidar');
const childProcess = require('child_process');
const path = require('path');

const rootDir = path.resolve([__dirname, '..', '..'].join(path.sep));

const config = {
    run: null,
    watch: '.',
    allowedFileExtensions: ['.js'],
    args: '',
    exec: null,

    workingDirectory: rootDir,
    ignore: []
};

let forkedProcess;
let execProcess;

// Hold debounce timeout identifiers
let timeouts = {};

const argv = Object.assign([], process.argv);
argv.shift();
argv.shift();

for (let i = 0; i < argv.length; ++i) {
    if (!argv[i].startsWith('--')) {
        throw new Error(`Invalid argument ${argv[i]}`);
    }

    const argument = argv[i].substr(2);

    const separatorIndex = argument.indexOf('=');

    if (separatorIndex !== -1) {
        const argumentKey = argument.substr(0, separatorIndex);
        const argumentValue = argument.substr(separatorIndex + 1);
        editConfig(argumentKey, preprocessArgument(argumentValue));
    } else {
        if (argv[i] !== '--args' && argv[i + 1].startsWith('--')) {
            throw new Error(`Missing value for argument ${argument}`);
        }

        editConfig(argument, preprocessArgument(argv[i + 1]));
        i += 1;
    }
}

if (!Array.isArray(config.watch)) {
    config.watch = config.watch.split(',');
}
config.watch = config.watch.map(watchPath => path.resolve(watchPath));

console.log('Watching paths ', config.watch.join(', '));

if (!Array.isArray(config.ignore)) {
    config.ignore = config.ignore.split(',');
}

const watcher = chokidar.watch(config.watch, {
    ignored: ['**/.git/**'].concat(config.ignore.map(element => `**${element}**`)),
    ignoreInitial: true,
    usePolling: true,
    interval:2000
});

if (config.run) {
    runFile(config.run);
}

if (config.exec) {
    runExec();
}


watcher.on('change', restartServer);
watcher.on('add', restartServer);
watcher.on('error', (err) => {console.error('An error occurred while watching ', config.watch, err)});

process.on('uncaughtException', function(err) {
    console.error('watcher caught and error ', err);
    if (forkedProcess) {
        forkedProcess.kill();
    }

    if (execProcess) {
        execProcess.kill();
    }

    process.kill(2);
});


/* ------------ Utils functions ------------ */

function editConfig(key, value) {
    if (!config.hasOwnProperty(key)) {
        throw new Error(`Invalid argument ${key}`);
    }

    config[key] = value;

    if (Array.isArray(config.key) && !Array.isArray(value)) {
        config[key] = [value];
    }
}

function preprocessArgument(argument) {
    let value = argument.split(',');

    if (value.length === 1) {
        value = value[0];
    } else {
        value = value.map(element => element.trim());
    }

    return value;
}

function getDebounceId(path) {
    for (let i = 0; i < config.watch.length; i++) {
        const watchedPath = config.watch[i];
        if (path.startsWith(watchedPath)) {
            return watchedPath;
        }
    }
}

function restartServer(path) {
    let match = false;
    let allowedFileExtensions = config.allowedFileExtensions;

    for (let i = 0; i < allowedFileExtensions.length; ++i) {
        if (path.endsWith(allowedFileExtensions[i])) {
            match = true;
            break;
        }
    }

    if (!match) {
        return;
    }

    const debounceId = getDebounceId(path);
    if (!debounceId) {
        console.error("Somethings wrong. Expected a debounce identifier for path: " + path);
        return;
    }

    function runListener() {
        if (config.exec) {
            runExec();
        }

        if (config.run) {
            console.log(`Some event triggered on file ${path}`);
            runFile(config.run);
        } else {
            console.log(`Some event triggered on file ${path}`);
        }
    }

    clearTimeout(timeouts[debounceId]);
    timeouts[debounceId] = setTimeout(() => {
        runListener();
    }, 100);
}


function runFile(filePath) {
    if (forkedProcess) {
        forkedProcess.kill();
    }

    forkedProcess = childProcess.fork(filePath, config.args.split(' '), {
        cwd: config.workingDirectory
    });
}

function runExec() {
    if (execProcess) {
        execProcess.kill();
    }

    execProcess = childProcess.exec(config.exec, {
        cwd: config.workingDirectory
    }, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
        }

        if (stdout) {
            console.log(stdout);
        }

        if (stderr) {
            console.error(stderr);
        }
    });
}
