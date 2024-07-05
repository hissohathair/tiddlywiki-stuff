#!/bin/sh
#
# Export tiddlers with tag (e.g. "Person") to a subdiretory (e.g. "People")
# Option: Include a filter to exclude certain tags


if [ "x$1" = "x" ] || [ "x$2" = "x" ] || [ "x$3" = "x" ] ; then
    echo "Usage: $0 <wikidir> <tag> <target> [<filter>]"
    echo "Example: $0 myWiki Person People '!tag[Organisation]'"
    exit 1
fi

if [ ! -d "$1" ] ; then
    echo "$0: Error: $1 is not a directory"
    exit 1
fi

WIKIDIR=$1
TAG=$2
TARGET=$3
FILTER=$4
EXPORTDIR="$WIKIDIR/output"

echo "Exporting $TAG to $EXPORTDIR/$TARGET"

npx tiddlywiki "$WIKIDIR" --render "[!prefix[$:/]tag[$TAG]$FILTER]" "[addprefix[$TARGET/]addsuffix[.md]]" 'text/plain' '$:/plugins/cdaven/markdown-export/md-tiddler'


