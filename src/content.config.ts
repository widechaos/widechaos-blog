import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { SITE_CONFIG } from './config/site';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			author: z.string().default(SITE_CONFIG.author),
			tags: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			readTime: z.string().optional(),
		}),
});

export const collections = { blog };
