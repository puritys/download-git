#!/usr/bin/env node
var r = require('./main.js');

var argv = process.argv;
if (!argv || argv.length <= 2) {
    console.log("Example: node downloadGit.js http://www.aaa.com.tw/.git");
    process.exit(1);
}

var url;
url = process.argv[2];
url = url.replace(/[\n\r]+/, '');
if (process.argv[3]) {
    r.baseUrl = url;
    r.fetchObject(process.argv[3], "", true);
} else {
    console.log("fetch git :", url);
    r.fetch(url);
}
