import { HtmlBasePlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  // Rewrites root links like "/projects/" to "/portfolio/projects/" when the
  // site is served from a sub-path. Set PATH_PREFIX to change it (see README).
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Files copied to the site as-is.
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/resume.pdf": "resume.pdf" });

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
