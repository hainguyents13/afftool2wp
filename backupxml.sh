#!/bin/sh
dir=$(pwd)
if [ ! -d out ]; then
  mkdir out
fi

echo "[?] Folder names (etc: afftool amz_affiliate...):"
read -a folders

# yum install zip -y
for f in ${folders[@]}
do
  default_ip="-"
  default_id=10000
  echo ""
  echo "→ Backing up $f..."
  if [[ ! -d "/web/$f/" ]]; then
    echo "❎ Folder not exists"
  else
    echo "[?] If domain is invalid, enter ip address with port"
    echo "[?] Example: http://123.456.789:8001"
    read ip
    : ${ip:=$default_ip}

    echo "[?] Enter Start from ID (Default: 10000):"
    read id
    : ${id:=$default_id}

    # Backup content
    echo "-> Backing up content..."
    cp backupxml.js /web/$f/
    cd /web/$f/
    node backupxml.js $ip $id
    mv backup.xml $dir/out/$f.xml
    echo "✅ $f: Backup content saved to $dir/out/$f.xml"

    # Backup upload folder
    echo ""
    echo "-> Backing up upload folder..."
    cd /web/$f/upload
    zip -rq $f.zip .
    mv $f.zip $dir/out/$f.zip
    echo "✅ $f: Backup upload saved to $dir/out/$f.zip"

    # Done $f
  fi
done

echo "Done!"