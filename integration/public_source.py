"""Read-only preview adapter for the production public content feed."""
import json,urllib.request
from integration.site_catalog import SLUG

def public_posts():
 with urllib.request.urlopen('https://widechaos.cn/static/content.json',timeout=20) as response:
  data=json.load(response)
 posts=[]
 for article in data['articles']:
  slug=article['id']
  if not SLUG.fullmatch(slug) or article['status']!='published':
   raise ValueError('Invalid public article')
  posts.append({'slug':slug,'meta':{
   'title':article['title'],'date':article['publishedAt'],
   'updatedAt':article.get('updatedAt'), 'status':'published',
   'summary':article['summary'],'lang':article['lang'],
   'translationKey':article['translationKey'],'topics':article.get('topics',[]),
   **{k:article[k] for k in ('category','tags','series') if k in article}
  },'html':article['body']})
 return posts
