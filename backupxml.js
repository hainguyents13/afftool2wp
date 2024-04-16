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

const url_pattern = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)*:\d*/g;

async function doBackup(out_folder, web_folder) {
  const backup = await p.group({
    change_domain: () =>
      p.confirm({
        message: `Do you want to restore the website to a new domain?`,
        initialValue: false
      }),
    old_domain: ({ results }) => {
      if (!results.change_domain) return;
      return p.text({
        message: 'Old domain:',
        placeholder: 'Ex: https://example.com or http://123.456.789.8000...',
        validate: (value) => {
          if (value && !url_pattern.test(value)) {
            return 'Please enter a valid domain or ip address.';
          }
        },
      })
    },
    new_domain: ({ results }) => {
      if (!results.change_domain) return;
      return p.text({
        message: 'New domain:',
        placeholder: 'Ex: https://example.com or http://123.456.789.8000...',
        validate: (value) => {
          if (value && !url_pattern.test(value)) {
            return 'Please enter a valid domain or ip address.';
          }
        },
      })
    },
    has_posts: () =>
      p.confirm({
        message: `Does your new website already has some posts?`,
        initialValue: false
      }),
    start_id: ({ results }) => {
      if (!results.has_posts) return;
      return p.text({
        message: 'You must provide a starting ID to restore backed-up posts. \nWithout a starting ID, there could be conflicts or data overlap.',
        placeholder: 'Start ID...',
        validate: (value) => {
          if (value && !url_pattern.test(value)) {
            return 'Please enter a valid domain or ip address.';
          }
        },
      })
    }
  },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    }
  )

  const s = p.spinner()
  s.start("Backing up to XML...")
  s.stop("Exported!")
  p.note(path.join(out_folder, "backup.xml"), "XML saved to:")

  // await askIfContinue()
}

// async function askIfContinue() {
//   const ask = await p.group(
//     {
//       continue: ({ results }) =>
//         p.confirm({
//           message: "Continue?",
//           initialValue: true
//         })
//     },
//     {
//       onCancel: () => {
//         p.cancel('Operation cancelled.');
//         process.exit(0);
//       },
//     }
//   );

//   if (ask.continue) {
//     await doBackup()
//   }
// }

async function main() {
  const [root_folder, backup_folder] = process.argv.slice(2);
  p.intro(`${color.bgYellow(color.black(` Backing up: ${backup_folder} `))}`)

  await doBackup(root_folder, backup_folder)

  p.log.info("Done!")
  p.outro(`Problems? Please contact us at ${color.underline(color.cyan('https://affiliatecms.com'))}`);
}

main().catch(console.error)