#!/bin/sh
dir=$(pwd)
if [ ! -d out ]; then
  mkdir out
fi

next="y"
while [ "$next" = "y"]
do
  echo "$next"
  echo "[?] Enter folder name:"
  read f
  if [[ ! -d "/web/$f/" ]]; then
    echo "❎ Folder does not exists"
  else
    echo "hello"
    # Backup content
    # cp backupxml.js /web/$f/
    # cd /web/$f/
    # # yarn add --dev @clack/prompts picocolors adm-zip
    # node backupxml.js $dir $f
    # mv backup.xml $dir/out/$f.xml
    # # Backup upload folder
    # cd /web/$f/upload
    # zip -rq $f.zip .
    # mv $f.zip $dir/out/$f.zip
  fi

  echo "[?] Continue? (y/n)"
  read next
done
