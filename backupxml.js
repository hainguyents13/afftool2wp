const p = require('@clack/prompts');
const { setTimeout } = require('node:timers/promises');
const color = require('picocolors');
const AdmZip = require('adm-zip')
const fs = require('fs-extra')
const path = require('path')

function ZipSite({ new_file, backup_path }) {
  const zip = new AdmZip();
  for (const file of backup_files) {
    const file_path = path.join(process.cwd(), file)
    const is_folder = file_path.endsWith('/') || file_path.endsWith('\\')
    if (is_folder) {
      zip.addLocalFolder(file_path)
    } else {
      zip.addLocalFile(file_path)
    }
  }
  const zip_des = path.join(backup_path, new_file)
  try {
    zip.writeZip(zip_des);
    console.log('Backup Site completed!');
  } catch (e) {
    console.log(e)
  }
}

let web_folder = ""
let out_folder = ""

async function doBackup() {
  const backup = await p.group({
    old_domain: () =>
      p.text({
        message: 'If old domain is not valid, you need to specify an alternative domain \nor IP address with port number in order to download post images',
        placeholder: 'https://example.com or http://123.456.789.8000',
      }),
  },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    }
  )

  const { folder } = backup
  if (folder) {
    root_folder = path.resolve("../" + folder + '/')
    const s = p.spinner()
    s.start("Backing up to XML...")
    s.stop("Exported!")
    p.note(path.join(path.resolve(folder), "backup.xml"), "XML saved to:")
  }

  await askIfContinue()
}

async function askIfContinue() {
  const ask = await p.group(
    {
      continue: ({ results }) =>
        p.confirm({
          message: "Continue?",
          initialValue: true
        })
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    }
  );

  if (ask.continue) {
    await doBackup()
  }
}

async function main() {
  const [root_folder, backup_folder] = process.argv.slice(2);
  out_folder = path.join(_root_folder, "out")
  web_folder = path.join(_root_folder, _backup_folder)
  console.clear()

  console.log("out_folder", out_folder)
  console.log("web_folder", web_folder)


  p.intro(`${color.bgYellow(color.black(` AffiliateCMS Backup to Wordpress (${_backup_folder}) `))}`)

  // await doBackup()

  p.log.info("Done!")
  p.outro(`Problems? Please contact us at ${color.underline(color.cyan('https://affiliatecms.com'))}`);
}

main().catch(console.error)