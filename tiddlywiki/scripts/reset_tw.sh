#!/bin/sh

WIKIDIR=myWiki.$(date "+%Y%m%d")
INFILE="$HOME/Documents/TiddlyWiki/Upgraded_TiddlyWiki.html"

echo "Working directory today is $WIKIDIR"

if [ -s "$INFILE" ] ; then
    echo "$0: Importing $INFILE"
else
    echo "$0: Error: $INFILE not found, or is empty"
    exit 255
fi

if [ -d "$WIKIDIR.OLD" ] ; then
    rm -rI "$WIKIDIR.OLD/"
fi
if [ -d "$WIKIDIR.OLD" ] ; then
    echo "$0: Backup dir $WIKIDIR.OLD still exists -- remove manually"
    exit 255
fi
if [ -d "$WIKIDIR" ] ; then
    mv "$WIKIDIR" "$WIKIDIR.OLD"
fi

npx tiddlywiki --load "$INFILE" --savewikifolder $WIKIDIR
#tiddlywiki myWiki --import "$INFILE" "text/html"

echo " "
cd "$WIKIDIR/tiddlers"

# List files containing the pattern {{...}} and process them with sed
echo "Modifying transclusion links..."
egrep -l '{{[^!$\|].*}}' *.tid | while read -r file; do
    echo "- Processing $file"
    # Use sed to replace {{...}} with ~ ![[...]] if preceded by a newline, else replace with ![[...]]
    sed -i '' -e ':a' -e 'N;$!ba' -e 's/\n{{\([^!$|}][^}]*\)}}/\n~ ![[\1]]/g' -e 's/{{\([^!$|}][^}]*\)}}/![[\1]]/g' "$file"
done

# Fix legacy tags in body
echo "Fixing legacy tags in body..."
egrep -l '#[A-Za-z0-9_\-]+' *.tid | while read -r file; do
    echo "- Processing $file"
    # Use sed to replace #action, #maybe, #urgent, etc. with #act/maybe, #act/urgent, etc.
    sed -i '' \
        -e 's/#\(maybe\)/#act\/\1/g' \
        -e 's/#\(someday\)/#act\/\1/g' \
        -e 's/#\(repeat\)/#act\/\1/g' \
        -e 's/#\(urgent\)/#act\/\1/g' \
        -e 's/#\(waiting\)/#act\/\1/g' \
        -e 's/#\(personal\)/#act\/\1/g' \
        -e 's/#\(due\)/#act\/urgent/g' \
        -e 's/#\(followup\)/#act\/\1/g' \
        -e 's/#\(later\)/#act\/\1/g' \
        -e 's/#action/#~~action~~/g' \
        -e 's/#\(followup\)/#act\/\1/g' \
        "$file"
done

cd -
