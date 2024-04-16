const p = require('@clack/prompts');
const { setTimeout } = require('node:timers/promises');
const color = require('picocolors');
const AdmZip = require('adm-zip')
const fs = require('fs-extra')
const path = require('path')
const { create } = require('xmlbuilder2');
const config = require(process.cwd() + '/config/app');
const database = require(process.cwd() + '/modules/app/helpers/database');
const urljoin = require('url-join')
const moment = require('moment')
const cheerio = require('cheerio')

// ==================================
global.__version = config.app.version;
global.__modules = `${__dirname}/modules`;
global.__config = `${__dirname}/config`;
global.__root = __dirname;

// ==================================
const ReviewList = require(__modules + '/page/helpers/ReviewList');
const PostList = require(__modules + '/page/helpers/PostList');
const ReviewModel = require(__modules + '/review/models/Review')
const ProductwModel = require(__modules + '/product/models/Product')
const CateModel = require(__modules + '/category/models/Category')
const PostModel = require(__modules + '/post/models/Post')
const UserModel = require(__modules + '/user/models/User')
const { get_settings } = require(__modules + '/app/helpers/system-setting');

function sectionsToContent({ meta_content = "", sections = [] }) {
  let content = meta_content && meta_content.main ? meta_content.main : ''
  sections.sort((a, b) => a.sort - b.sort)
  for (const section of sections) {
    const is_comparison_table = section.id == "compare"
    if (!is_comparison_table) {
      content += section.title ? `<h2>${section.title}</h2>` : ""
      content += section.content ? section.content : ""
    }
  }
  return content
}

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

function replaceDomain(url, domain) {
  if (!url || url == "undefined") {
    return ""
  }
  if (url.indexOf('amazon.com') > -1) {
    return url
  }
  if (url.indexOf('/') == 0) {
    return urljoin(domain, url)
  }
  try {
    const parsed = new URL(url)
    console.log(domain, parsed.pathname, parsed.search)
    const new_url = urljoin(domain, parsed.pathname + parsed.search)
    return new_url
  } catch (e) {
    console.log("")
    console.log(url, typeof url, e)
    return url
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

  const out_file_path = path.join(out_folder, `${web_folder}.xml`)

  const s = p.spinner()
  s.start("Backing up to XML...\n")
  const result = await startBackup({
    out_file_path,
    old_domain: backup.old_domain,
    new_domain: backup.new_domain,
    start_id: backup.start_id,
  })
  s.stop()
  if (!result.error) {
    const note = `
    - Total: ${result.total}\n
    - Exported: ${result.exported}\n
    - Old domain: ${result.total}\n
    - New domain: ${result.total}\n
    - Start ID: ${result.total}\n
    - Exported file: ${out_file_path}
    `
    p.note(note, "Result:")
    p.log.info("Done!")
  } else {
    p.log.error("Error:" + result.error)
  }
}

async function main() {
  const [root_folder, backup_folder] = process.argv.slice(2);
  p.intro(`${color.bgYellow(color.black(` Backing up: ${backup_folder} `))}`)

  await doBackup(root_folder, backup_folder)

  p.outro(`Problems? Please contact us at ${color.underline(color.cyan('https://affiliatecms.com'))}`);
  process.exit(0)
}

async function startBackup({ out_file_path, old_domain, new_domain, start_id }) {
  const stats = {
    total: 0,
    exported: 0,
    out_file_path,
    old_domain,
    new_domain,
    start_id
  }

  try {
    database.connect();
    const users = await UserModel
      .find({}, { username: true, fullname: true, email: true })
      .lean()
      .exec()
    const { main: settings } = await get_settings(["main"])

    old_domain = old_domain ? old_domain : settings.domain
    new_domain = new_domain ? new_domain : settings.domain
    start_id = Number(start_id || 1)

    const default_list_agrs = {
      cond: {},
      req: {
        query: {
          page: 1
        },
      },
      customPageSize: Infinity
    }
    const { reviews } = await ReviewList(default_list_agrs);
    const { posts } = await PostList(default_list_agrs);

    const items = [];
    [
      ...reviews.map(item => Object.assign(item, { _type: "review" })),
      ...posts.map(item => Object.assign(item, { _type: "post" }))
    ]
      .map((post, i) => {
        stats.total += 1
        let content = post.content

        // plain content from sections
        if (settings.edit_mode != 'block') {
          content = post._type == "review"
            ? sectionsToContent({
              meta_content: post.meta_content,
              sections: post.custom_sections
            })
            : sectionsToContent({
              meta_content: post.meta_content.main.content,
              sections: post.content_blocks
            })
        }

        const $ = cheerio.load(content)
        if ($('body').text() != "") {
          const date_string = moment(post.created_at).utcOffset(0).toString()
          const date_format = moment(post.created_at).format("YYYY-MM-DD H:m:s")
          let creator = ""
          if (post._type == "review") {
            creator = post.authors & post.authors.length ? post.authors[0].username : "admin"
          } else {
            creator = post.author ? post.author.username : "admin"
          }

          const attachment_file = replaceDomain(post.image)

          // replace images src urls
          $('img').each((_i, img) => {
            const src = $(img).attr('src')
            if (src) {
              let new_src = src
              if (src.indexOf('/upload') == 0) {
                new_src = src.replace('/upload', '/wp-content/uploads')
              }
              new_src = replaceDomain(new_src, new_domain)
              $(img).attr('src', new_src)
            }
          })

          // replace amz tags
          $('a').each((_i, a) => {
            const href = $(a).attr('href')
            if (href && href.indexOf("amazon.com") > -1) {
              const [new_href] = href.split('?')
              $(a).attr('href', new_href)
            }
          })

          content = $('body').html()
          const post_id = start_id
          start_id = start_id + 2

          const post_with_thumbnail = [
            // post
            {
              title: { $: post.title },
              link: urljoin(new_domain, post.meta_slug),
              pubDate: date_string,
              "dc:creator": { $: creator },
              guid: {
                "@isPermaLink": "fase",
                $: urljoin(new_domain, '/?p=' + post_id)
              },
              description: { $: post.meta_desc.split("%").join("") },
              "excerpt:encoded": { $: post.meta_desc.split("%").join("") },
              "content:encoded": { $: content },
              "wp:post_id": post_id,
              "wp:post_date": { $: date_format },
              "wp:post_date_gmt": { $: date_format },
              "wp:post_modified": { $: date_format },
              "wp:post_modified_gmt": { $: date_format },
              "wp:comment_status": { $: 'open' },
              "wp:ping_status": { $: 'open' },
              "wp:post_name": { $: post.meta_slug.split('/').join('') },
              "wp:status": { $: 'publish' },
              "wp:post_type": { $: "post" },
              "wp:post_password": { $: "" },
              "wp:is_sticky": 0,
              "wp:postmeta": [{
                "wp:meta_key": { $: "_edit_last" },
                "wp:meta_value": { $: 1 }
              }, {
                "wp:meta_key": { $: "_thumbnail_id" },
                "wp:meta_value": { $: post_id + 1 }
              }],
              ...(
                post.category
                  ? {
                    category: {
                      "@domain": "category",
                      "@nicename": post.category.path.split('/').join(''),
                      $: post.category.name
                    }
                  }
                  : {}
              )
            },
            // featured image
            attachment_file
              ? {
                title: { $: post.title },
                link: urljoin(new_domain, post.meta_slug),
                pubDate: date_string,
                "dc:creator": { $: creator },
                guid: {
                  "@isPermaLink": "fase",
                  $: post.image || ""
                },
                description: "",
                "content:encoded": { $: "" },
                "excerpt:encoded": { $: "" },
                "wp:post_id": post_id + 1,
                "wp:post_date": { $: date_format },
                "wp:post_date_gmt": { $: date_format },
                "wp:post_modified": { $: date_format },
                "wp:post_modified_gmt": { $: date_format },
                "wp:comment_status": { $: 'open' },
                "wp:post_name": { $: post.meta_slug.split('/').join('') },
                "wp:post_parent": post_id,
                "wp:ping_status": { $: 'closed' },
                "wp:status": { $: 'inherit' },
                "wp:post_type": { $: "attachment" },
                "wp:post_password": { $: "" },
                "wp:is_sticky": 0,
                "wp:attachment_url": { $: post.image || "" },
                "wp:postmeta": [{
                  "wp:meta_key": { $: "_wp_attached_file" },
                  "wp:meta_value": { $: attachment_file }
                }, {
                  "wp:meta_key": { $: "_wp_attachment_image_alt" },
                  "wp:meta_value": { $: post.title }
                }]
              }
              : false
          ]
          items.push(...post_with_thumbnail)
        }
      })

    const data = {
      rss: {
        "@xmlns:excerpt": "http://wordpress.org/export/1.2/excerpt/",
        "@xmlns:content": "http://purl.org/rss/1.0/modules/content/",
        "@xmlns:wfw": "http://wellformedweb.org/CommentAPI/",
        "@xmlns:dc": "http://purl.org/dc/elements/1.1/",
        "@xmlns:wp": "http://wordpress.org/export/1.2/",
        channel: {
          title: { $: settings.page_title },
          link: settings.domain,
          description: settings.description,
          language: "en-US",
          "wp:wxr_version": 1.2,
          "wp:base_site_url": settings.domain,
          "wp:base_blog_url": settings.domain,
          "wp:author": users.map((author, i) => ({
            "wp:author_id": i,
            "wp:author_login": { $: author.username },
            "wp:author_email": { $: author.email || "" },
            "wp:author_display_name": { $: author.fullname },
            "wp:author_first_name": { $: author.fullname },
          })),
          image: {
            url: urljoin(domain, settings.favicon),
            height: 100,
            width: 100,
            title: settings.page_title,
          },
          item: items.filter(Boolean)
        },
      }
    }

    stats.exported = tems.filter(Boolean)

    const xml = create({ version: "1.0", encoding: "UTF-8" }, data)
    fs.writeFileSync(out_file_path, xml.end({ prettyPrint: true }))

    return stats
  } catch (e) {
    console.error(e.message);
    return { error: e.message }
  }
}

main().catch(console.error)
