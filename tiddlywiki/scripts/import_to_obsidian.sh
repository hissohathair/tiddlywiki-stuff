#!/bin/sh
#
# Export tiddlers with tag (e.g. "Person")
#

WIKIDIR=myWiki.$(date "+%Y%m%d")
OBSIDIAN="$HOME/Documents/TestVault"

if [ "x$1" != "x" ] ; then
    WIKIDIR="$1"
fi
if [ "x$2" != "x" ] ; then
    OBSIDIAN="$2"
fi

EXPORTDIR="$WIKIDIR/output"
if [ ! -d "$EXPORTDIR" ] ; then
    echo "Error: $EXPORTDIR is not found, or not a directory"
    exit 1
fi
if [ ! -d "$OBSIDIAN" ] && ! mkdir "$OBSIDIAN" ; then
    echo "Error: $OBSIDIAN is not found, or not a directory"
    exit 1
fi

echo "Importing from $EXPORTDIR to $OBSIDIAN"

echo "- Checking for duplicate files..."
DUPELIST=`fdupes -r "$EXPORTDIR"`
if [ -n "$DUPELIST" ] ; then
    echo "Warning: Export has duplicate files, de-dupe with "
    echo "    fdupes -d -r \"$EXPORTDIR\""
    echo "Warning: Duplicates:"
    echo $DUPELIST
    echo " "
    exit 1
fi

echo "- Copying to $OBSIDIAN/"
cp -Rp "$EXPORTDIR/" "$OBSIDIAN/"

echo "Done"
