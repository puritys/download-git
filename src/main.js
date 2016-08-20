var Q  = require('q');
var fs = require('fs');
var lh = require('light-http');
var logger = require('js-logger');
var mkdir = require('mkdirp');
var child = require('child_process');
var self;

function downloadGit() {
    this.waitMs  = 300;// prevent from abuse
    this.baseUrl = "";
    this.treeIds = [];
    this.blobs   = [];
    self = this;
}
var o = downloadGit.prototype;


o.fetch = function (url) {
    this.baseUrl = url;
    this.createBasicFiles().fail(error)
    .then(self.fetchBasicFiles.bind(self)).fail(error)
    .then(self.fetchObjectFromFile.bind(self, ".git/refs/heads/master"))
    .fail(error)
    .then(function () {
        console.log("finish");        
    })
    ;
};

o.fetchObjectFromFile = function (filePath) {//{{{
    logger.info("Fetch object from file:" , filePath);
    return Q.Promise(function (resolve, reject, notify) {
        Q.fcall(Q.Promise.bind(null, function (resolve, reject, notify) {
            fs.readFile(filePath, function (err, content) {
                content = content.toString();
                if (err) {
                    console.log("Cannot read file: ", filePath, " error: ", err);
                    reject();
                } else {
                    resolve(content);
                }
            });
        })).fail(error)
        .then(function (objectId) {
            logger.info("objectId: ", objectId);
            self.fetchObject(objectId)
            .then(function () {resolve();})
            .fail(error)
            ;
        })
        ;
       
    });
};//}}}

o.fetchObjectByObjectId = function (objectId) {//{{{
    return Q.Promise(function (resolve, reject, notify) {
       child.exec("git cat-file -p " + objectId, function (err, text) {
           var matches, treeId, parentId;
           if (!text) resolve();
           console.log("Object content: \n",text);
           matches = text.match(/tree ([^\n\r\s]+)[\n\r]+parent ([^\n\r\s]+)/mi);
           if (matches) {
               treeId   = matches[1];
               parentId = matches[2];
               logger.debug("treeId: ", treeId, " parentId: ", parentId);
               self.fetchObject(treeId)
               .then(self.fetchObject.bind(self, parentId)).fail(error)
               .then(function () {
                   resolve();
               }).fail(error)
               ;
           } else {
               resolve();
           }
        });
    });
};//}}}

o.fetchObject = function (objectId, type, onlyOne) {//{{{
    objectId = objectId.replace(/[\n\r]+/, '');
    return Q.Promise(function (resolve, reject, notify) {
    setTimeout(function() {
        var dir, objectFilename, url, localFilePath;
        dir = objectId.substr(0, 2);
        objectFilename = objectId.substr(2);
        url = self.baseUrl + "/objects/" + dir + "/" + objectFilename;
        localFilePath = ".git/objects/" + dir + "/" + objectFilename;
        mkdir(".git/objects/" + dir + "/", function () {
            logger.debug("object url = ", url);
            lh.get(url, {}, function (content, err, obj) {
                if (err) {
                    console.log("Can not fetch: ", url, " error message : ", err);
                } else {
                    fs.writeFile(localFilePath, obj.binary, function () {
                        if (onlyOne) {
                            resolve();
                        } else {
                            self.fetchObjectByObjectId(objectId)
                            .then(function () {
                                resolve();    
                            }).fail(error);
                        }
                    }); 
                }
            });
        });
    }, self.waitMs);
    });
};//}}}

o.fetchBasicFiles = function () {//{{{
    return Q.Promise(function (resolve, reject, notify) {
        logger.info("Start to fetch basic files:");
        var files = ['config', 'description', 'ORIG_HEAD', 'index', 'HEAD', 'refs/heads/master'];
        var filesCount, processCount = 0;
        filesCount = files.length;
        files.forEach(function(name, index) {
            var url = self.baseUrl + "/" + name;
            var file = ".git/" + name;
            console.log(url);
            lh.get(url, {}, function (content, err, obj) {
                processCount++;
                if (err) {
                    console.log("Can not fetch ", url, ". error message : ", err);
                } else {
                    fs.writeFile(file, obj.binary, function (err) {
                        if (err) console.log("Can not write into file ", file);
                        if (filesCount === processCount) resolve();
                    });
                }
            });
        }); 
    });
};//}}}

o.createBasicFiles = function () {//{{{
    logger.info("Start to crate basic files and directory:");
    var dirs, dirsCount, result = 0;
    dirs = [".git", ".git/refs/heads", ".git/objects", ".git/info", ".git/logs"];
    dirsCount = dirs.length;
    return Q.Promise(function (resolveG, rejectG, notifyG) {
        dirs.reduce(function (qState, name) {
            return qState.then(Q.promise.bind(null, function(resolve, reject, notify) {
                mkdir(name, function (err) {
                    result++;
                    if (err) {
                        console.log("Can not create dir.git, error:", err );
                        reject();
                    } else {
                        resolve();
                    }
                    if (dirsCount == result) resolveG();
                });
            }));
        }, Q(0));
    });
};//}}}


function error(err, msg) {
    console.log("Promise has exception: ", err);
    if (msg) console.log("promise error message", msg);
}

module.exports = new downloadGit();
module.exports.constructor = downloadGit;
