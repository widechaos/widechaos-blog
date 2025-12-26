 import { defineCollection, z } from 'astro:content';

 const blog = defineCollection({
   type: 'content',
   schema: z.object({
     title: z.string(),
     pubDate: z.string().or(z.date()).transform((val) => new Date(val)),
     description: z.string().optional(),
     author: z.string().default('你'),
     tags: z.array(z.string()).optional(),
     draft: z.boolean().default(false),
   }),
 });

 export const collections = { blog };