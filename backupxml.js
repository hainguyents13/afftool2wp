const fs = require("fs-extra")
const { create } = require('xmlbuilder2');
const config = require(process.cwd() + '/config/app');
const database = require(process.cwd() + '/modules/app/helpers/database');
const urljoin = require('url-join')
const moment = require('moment')

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
const [alt_ip, start_id] = process.argv.slice(2);

function sectionsToContent({ meta_content = "", sections = [] }) {
  let content = meta_content && meta_content.main ? meta_content.main : ''
  sections.sort((a, b) => a.sort - b.sort)
  for (const section of sections) {
    const is_comparison_table = section.id == "compare"
    if (is_comparison_table) {
      content += `<p>%comparison_table%</p>`
    } else {
      content += `<h2>${section.title}</h2>${section.content}`
    }
  }
  return content
}

console.log("[!]: Replacement IP", alt_ip)
console.log("[!]: Start from ID", start_id)
console.log("")
console.log('Starting BackupXML process...')
try {
  database.connect();
  (async () => {
    const users = await UserModel
      .find({}, { username: true, fullname: true, email: true })
      .lean()
      .exec()
    const { main: settings } = await get_settings(["main"])
    // console.log(settings)

    const domain = alt_ip != '-' ? alt_ip : settings.domain
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
    // console.log(reviews.length, posts.length)

    const items = [];
    [
      ...reviews.map(item => Object.assign(item, { _type: "review" })),
      ...posts.map(item => Object.assign(item, { _type: "post" }))
    ]
      .map((post, i) => {
        const post_id = i + Number(start_id || 0)
        const date_string = moment(post.created_at).utcOffset(0).toString()
        const date_format = moment(post.created_at).format("YYYY-MM-DD H:m:s")
        let creator = ""
        if (post._type == "review") {
          creator = post.authors & post.authors.length ? post.authors[0].username : "admin"
        } else {
          creator = post.author ? post.author.username : "admin"
        }

        let content = post.content
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
        content = content.split('%comparison_table%').join("")

        let attachment_file = ""
        if (post.image.indexOf('amazon.com') > -1) {
          try {
            attachment_file = new URL(post.image).pathname
          } catch (e) {
            console.log(post.title, post.image)
            console.log(e)
          }
        } else {
          attachment_file = post.image
        }

        const post_with_thumbnail = [
          // post
          {
            title: { $: post.title },
            link: urljoin(domain, post.meta_slug),
            pubDate: date_string,
            "dc:creator": { $: creator },
            guid: {
              "@isPermaLink": "fase",
              $: urljoin(settings.domain, '/?p=' + post_id)
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
            }]
          },
          // featured image
          {
            title: { $: post.title },
            link: urljoin(domain, post.meta_slug),
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
        ]
        items.push(...post_with_thumbnail)
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
          item: items
        },
      }
    }
    const xml = create({ version: "1.0", encoding: "UTF-8" }, data)
    fs.writeFileSync("./backup.xml", xml.end({ prettyPrint: true }))

    // exit
    process.exit(1)
  })()
} catch (e) {
  console.error(e.message);
  throw new Error('Error connect Mongoose!');
}
