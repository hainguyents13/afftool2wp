const p = require('@clack/prompts');
const { setTimeout } = require('node:timers/promises');
const color = require('picocolors');
const AdmZip = require('adm-zip')
const fs = require('fs-extra')

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

let root_folder = ""
let backup_folder = ""

async function doBackup() {
  const backup = await p.group({
    folder: () =>
      p.text({
        message: 'Folder name?',
        placeholder: 'Ex: affiliatecms',
        validate: (value) => {
          if (!value) return 'Please enter folder name.';
          const folder = path.resolve('../' + value + '/')
          if (!fs.pathExistsSync(folder)) {
            return `Folder ${folder} does not exists!`
          }
        },
      }),
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
  const [_root_folder, _backup_folder] = process.argv.slice(2);
  root_folder = _root_folder
  backup_folder = _backup_folder
  console.clear()
  console.log("-> root_folder", root_folder)
  console.log("-> backup_folder", backup_folder)

  p.intro(`${color.bgBlue(color.black(" AffiliateCMS Backup to Wordpress "))}`)

  // await doBackup()

  p.log.info("Done!")
  p.outro(`Problems? Please contact us at ${color.underline(color.cyan('https://affiliatecms.com'))}`);
}

main().catch(console.error)