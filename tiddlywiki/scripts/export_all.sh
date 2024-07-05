#!/bin/sh
#
# Export all tiddlers, except system tiddlers.
# Option: Include a filter (e.g. to exclude certain tags)


if [ "x$1" = "x" ] ; then
    echo "Usage: $0 <wikidir> [<filter>]"
    echo "Example: $0 myWiki '!tag[Organisation]'"
    exit 1
fi

if [ ! -d "$1" ] ; then
    echo "$0: Error: $1 is not a directory"
    exit 1
fi

WIKIDIR=$1
FILTER=$2
EXPORTDIR="$WIKIDIR/output"

if [ -d "$EXPORTDIR" ] ; then
    echo "$0: Warning: $EXPORTDIR already exists -- exporting all should delete this first"
    rm -rI "$EXPORTDIR"
    echo " "
fi

tiddlywiki "$WIKIDIR" --render "[!prefix[$:/]$FILTER]" '[is[tiddler]addsuffix[.md]]' 'text/plain' '$:/plugins/cdaven/markdown-export/md-tiddler'

echo " "
echo "Reorganising..."
./move_exported_files.sh "$EXPORTDIR" 1> ./.move_exported_files.log

echo " "
echo "Export complete. Checking for duplicate files..."
fdupes -r "$EXPORTDIR"
