#!/bin/sh
# 
# Usage: export_all.sh <wikidir>
#

if [ "x$1" = "x" ] ; then
    echo "Usage: $0 <wikidir>"
    echo "Example: $0 myWiki"
    exit 1
fi

WIKIDIR=$1
if [ ! -d "$WIKIDIR" ] ; then
    echo "$0: Error: $1 is not a directory"
    exit 1
fi

EXPORTDIR="$WIKIDIR/output"
if [ -d "$EXPORTDIR" ] ; then
    echo "$0: Warning: $EXPORTDIR already exists -- exporting all should delete this first"
    rm -rI "$EXPORTDIR"
    echo " "
fi

EX="$(dirname $0)/export_by_tag.sh"
if [ ! -x "$EX" ] ; then
    echo "$0: Error: $EX not found or not executable"
    exit 1
fi

for year in "2021" "2022" "2023" "2024" ; do
    $EX "$WIKIDIR" "$year" "Journal/$year"
done

$EX "$WIKIDIR" "MyOrg" "MyOrgs" '!tag[Organisation]'
$EX "$WIKIDIR" "Person" "People"
$EX "$WIKIDIR" "Project" "Projects"
$EX "$WIKIDIR" "Organisation" "Organisations"
$EX "$WIKIDIR" "Meeting" "Meetings"

$EX "$WIKIDIR" "Cheatsheets" "Library/Cheatsheets" 
$EX "$WIKIDIR" "Data Management" "Library/Data Management" 
$EX "$WIKIDIR" "Product Management" "Library/Product Management"
$EX "$WIKIDIR" "Tech" "Library/Tech"

echo " "
echo "Export complete. Checking for duplicate files..."
fdupes -r "$EXPORTDIR"

