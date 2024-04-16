#!/bin/sh
RED="\e[31m"
GREEN="\e[32m"
YELLOW="\e[33m"
CYAN="\e[36m"
ENDCOLOR="\e[0m"

print_text_done(){
  print_text_green "✓ Done!"
}
print_text_yellow(){
  echo -e "${YELLOW}$1${ENDCOLOR}"
}

print_text_hello() {
  echo ""
  print_text_yellow "+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+"
  print_text_yellow "| AffiliateCMS Backup to Wordpress  |"
  print_text_yellow "+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+"
}

dir=$(pwd)
if [ ! -d out ]; then
  mkdir out
fi

next="y"
while [ "$next" = "y" ]
do
  clear
  print_text_hello
  echo "[?] Enter folder name:"
  read f
  if [[ ! -d "/web/$f/" ]]; then
    echo "❎ Folder does not exists"
  else
    # Backup content
    cp backupxml.js /web/$f/
    cd /web/$f/
    echo "Installing packages..."
    yarn add --dev @clack/prompts picocolors adm-zip
    echo ""
    node backupxml.js $dir/out $f
    mv backup.xml $dir/out/$f.xml
    # # Backup upload folder
    cd /web/$f/upload
    zip -rq $f.zip .
    mv $f.zip $dir/out/$f.zip
  fi
  echo ""
  echo "[?] Continue? (y/n)"
  read next
done

print_text_done