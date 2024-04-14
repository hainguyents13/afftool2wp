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

    cp backupxml.js /web/$f/
    cd /web/$f/
    node backupxml.js $ip $id
    mv backup.xml $dir/out/$f.xml
    zip -r $dir/out/$f_uploads.zip /web/$f/upload
    echo "[!] $f: Backup saved to $dir/out/$f.xml"
  fi
done

echo "Done!"