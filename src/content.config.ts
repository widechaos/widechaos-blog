import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string().optional(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			author: z.string().optional().default('WideChaos'),
			author: z.string().optional().default('十方空烬'),
			tags: z.array(z.string()).optional().default([]),
			draft: z.boolean().optional().default(false),
			readTime: z.number().optional(),
			heroImage: image().optional(),
		}),
});

export const collections = { blog };
