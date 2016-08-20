var Q  = require('q');
var fs = require('fs');
var lh = require('light-http');
var logger = require('js-logger');
var mkdir = require('mkdirp');
var child = require('child_process');
var self;

function downloadGit() {
    this.waitMs  = 100;// prevent from abuse
    this.baseUrl = "";
    this.treeIds   = [];
    this.parentIds = [];
    this.blobIds   = [];
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
        self.generateReport();
        console.log("finish");        
    }).fail(error)
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
           var matTree, matParent, matBlob, treeId, parentId, regTree, regParent, regBlob;
           if (!text) resolve();
           console.log("Object content: \n",text);
           regTree   = /tree ([^\n\r\s]+)/g;
           regParent = /parent ([^\n\r\s]+)/g;
           regBlob   = /blob[\s]+([^\n\r\s]+)[\s]+([^\n\r]+)/;
           matTree   = text.match(regTree);
           matParent = text.match(regParent);
           matBlob   = text.match(regBlob);

           self.fetchObjectByTreeIds(matTree)
           .then(self.fetchObjectByParentIds.bind(self, matParent)).fail(error)
           .then(self.fetchObjectByBlobIds.bind(self, matBlob)).fail(error)
           .then(function () {
               resolve();
           }).fail(error)
           ;
        });
    });
};//}}}

o.fetchObjectByTreeIds = function (trees) {//{{{
return Q.Promise(function (resolve, reject, notify) {
    var treeIds = [];
    if (!trees) {resolve(); return ;}
    trees.map(function(val) {
        var matches = val.match(/tree[\s]+([^\n\r]+)/);
        if (matches && matches[1]) {
            treeIds.push(matches[1]);
            self.treeIds.push(matches[1]);
        }
    });
    logger.debug("fetch tree", treeIds);
    if (!treeIds) {resolve(); return ;}
    self.fetchObjects(treeIds)
    .then(function() {resolve();})
    .fail(error);
});
};//}}}

o.fetchObjectByParentIds = function (parents) {//{{{
return Q.Promise(function (resolve, reject, notify) {
    var parentIds = [];
    if (!parents) {resolve(); return ;}
    parents.map(function(val) {
        var matches = val.match(/parent[\s]+([^\n\r]+)/);
        if (matches && matches[1]) {
            parentIds.push(matches[1]);
            self.parentIds.push(matches[1]);
        }
    });
    if (!parentIds) {resolve(); return ;}
    logger.debug("fetch parent", parentIds);
    self.fetchObjects(parentIds)
    .then(function() {resolve();})
    .fail(error);
});
};//}}}

o.fetchObjectByBlobIds = function (blobs) {//{{{
return Q.Promise(function (resolve, reject, notify) {
    var blobIds = [];
    if (!blobs) {resolve(); return ;}
    blobs.map(function(val) {
        var matches = val.match(/blob[\s]+([^\n\r\s\t]+)[\s\t]+([^\n\r]+)/);
        if (matches && matches[1]) {
            blobIds.push(matches[1]);
            self.blobIds.push(matches[1] + " " + matches[2]);
        }
    });
    logger.debug("fetch blob: ", blobIds);
    if (!blobIds ) {resolve(); return ;}
    self.fetchObjects(blobIds)
    .then(function() {resolve();})
    .fail(error);
});
};//}}}

o.fetchObjects = function (ids) {
return Q.Promise(function (resolveP, rejectP, notifyP) {
    var n, i = 0;
    if (!ids) {resolveP(); return ;}
    n = ids.length;
    ids.reduce(function(qState, id) {
        return qState.then(Q.Promise.bind(null, function (resolve, reject, notify) {
            self.fetchObject(id)
            .then(function () {
                i++;
                resolve();
                if (n == i) {resolveP();}
            }).fail(function (err) {i++;console.log("fetchObject exception: ", err);resolveP();})
            ;
        }));
    }, Q(0));
   
});
};

o.fetchObject = function (objectId, type, onlyOne) {//{{{
return Q.Promise(function (resolve, reject, notify) {
objectId = objectId.replace(/[\n\r]+/, '');
setTimeout(function() {
    var dir, objectFilename, url, localFilePath, msg;
    dir = objectId.substr(0, 2);
    objectFilename = objectId.substr(2);
    url = self.baseUrl + "/objects/" + dir + "/" + objectFilename;
    localFilePath = ".git/objects/" + dir + "/" + objectFilename;
    mkdir(".git/objects/" + dir + "/", function () {
        logger.debug("object url = ", url);
        lh.get(url, {}, function (content, err, obj) {
            if (err || obj.headers['status-code'] != 200) {
                logger.debug("Can not fetch: ", url, " error message : ", err);
                if (obj && obj.headers['status-code']) {
                    logger.debug("Response status is not 200, statu: ", obj.headers['status-code'] );
                }
                resolve();
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

o.generateReport = function () {
    var data = [];
    console.log("treeIds: ", self.treeIds);
    console.log("parentIds: ", self.parentIds);
    console.log("blobIds: ", self.blobIds);
    self.treeIds.map(function(val) {
        data.push("tree " + val + "\n");
    });
    self.parentIds.map(function(val) {
        data.push("parent " + val + "\n");
    });
    self.blobIds.map(function(val) {
        data.push("blob " + val + "\n");
    });

    fs.writeFile("./downloadGitReport.txt", data);
    console.log("See result: downloadGitReport.txt");
};

function error(err, msg) {
    console.log("Promise has exception: ", err);
    if (msg) console.log("promise error message", msg);
}

module.exports = new downloadGit();
module.exports.constructor = downloadGit;
