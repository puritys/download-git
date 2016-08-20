Download .git
=============

## Download a whole .git
<pre>
    downloadGit http://xxx.com.tw/.git
</pre>

## download one git object id
<pre>
    downloadGit http://xxx.com.tw/.git a4bbcd16a46d691e5053e50387258b7b8e918601
</pre>

This is a tool to download source code someone release the directory .git on the his website.


development
===========

1. Get config, description, ORIG_HEAD, index, HEAD, refs/heads/master
2. Get a object id from refs/heads/master.
3. Download this object id, it will also give us a new tree id and parent id.
4. Recuresively download the tree id and parent id.
