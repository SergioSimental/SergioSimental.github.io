import path from "node:path";
import { HtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { transform as minifyCss } from "lightningcss";

export default function (eleventyConfig) {
  // Rewrites root links like "/projects/" to "/portfolio/projects/" when the
  // site is served from a sub-path. Set PATH_PREFIX to change it (see README).
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Files copied to the site as-is. Images are handled by the image
  // transform below, CSS by the "css" extension.
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/assets/media/**/*.{mp4,webm}");
  eleventyConfig.addPassthroughCopy({ "src/resume.pdf": "resume.pdf" });

  // Self-hosted fonts (Latin subset, variable weight), from @fontsource.
  eleventyConfig.addPassthroughCopy({
    "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2": "assets/fonts/inter.woff2",
    "node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2": "assets/fonts/space-grotesk.woff2",
    "node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2": "assets/fonts/jetbrains-mono.woff2",
  });

  // CSS: bundled and minified with Lightning CSS.
  eleventyConfig.addTemplateFormats("css");
  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: async function (inputContent, inputPath) {
      if (path.basename(inputPath).startsWith("_")) return;
      return async () =>
        minifyCss({
          filename: inputPath,
          code: Buffer.from(inputContent),
          minify: true,
        }).code.toString();
    },
  });

  // Images: every <img> in the output is turned into a <picture> with AVIF,
  // WebP and JPEG at several widths plus width/height, so phones download a
  // small file and the layout doesn't jump while it loads.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "jpeg"],
    widths: [480, 800, 1200],
    urlPath: "/img/",
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async" },
      pictureAttributes: {},
    },
  });

  // Every Markdown file in src/projects/ is a project, sorted by its `order`.
  eleventyConfig.addCollection("projects", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/projects/*.md")
      .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99))
  );

  // Two-digit count for labels like "03 projects".
  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));

  // Board cells for a Connect 4 style preview: "row,col": "r" | "b".
  eleventyConfig.addFilter("boardCells", (pieces = {}, rows = 8, cols = 8) => {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cells.push(pieces[`${r},${c}`] || "");
    }
    return cells;
  });

  return {
    dir: { input: "src", output: "_site" },
    pathPrefix: process.env.PATH_PREFIX || "/",
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
