#!/bin/sh
#
# Move an exported Markdown file to the correct location, as indicated by
# it's `path` property in the front matter.
#

if [ "x$1" = "x" ] ; then
  echo "Usage: $0 <basedir>"
  exit 1
elif [ ! -d "$1" ]; then
  echo "Error: $1 is not a directory"
  exit 1
else
  BASEDIR=$1
fi

cd "$BASEDIR" || exit 1
echo "Processing files in $BASEDIR"
pwd

for file in *.md; do
  if [ ! -f "$file" ]; then
    echo "File not found: $file"
    continue
  fi

  path=$(egrep '^path:' "$file" | sed -e 's/^path: "//' -e 's/"$//')
  if [ "x$path" = "x" ]; then
    echo "Leaving $file in place"
    continue
  fi

  if [ ! -d "$path" ]; then
    echo "Creating directory: $path"
    mkdir -p "$path"
  fi

  echo "Moving to: $path/$file"
  mv "$file" "$path/$file"
done