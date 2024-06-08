/*\
title: $:/plugins/cdaven/markdown-export/render-rules.js
type: application/javascript
module-type: library
\*/

import { IMarkupRenderer } from "./core";
import { btoa, isDomNode, isTextNode, trimEnd } from "./render-helpers";

type NodeRenderer = (node: TW_Element, innerMarkup: string) => string | null;
export type RulesRecord = Record<string, NodeRenderer>;

interface TableCell {
    innerMarkup: string | null;
    header: boolean;
    align: string | undefined;
}

const renderAttributes = (attributes: { [key: string]: string }): string => {
  // Convert the attributes object into an array of key-value pairs, then map to a string format
  return Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' '); // Join all attribute strings into a single string separated by spaces
}

/** TODO: Need to review the YAML escaping rules...
 * Quotes:
 *      Use double quotes (") for strings that contain special characters or need escaping.
 *      Use single quotes (') for strings that contain double quotes or other characters that don't need to be escaped.
 * Lists:
 *      Use square brackets ([]) for inline lists.
 *      Use a hyphen (-) for block lists, each item on a new line.
 * Special Characters:
 *      Backslash (\) is used to escape special characters within double-quoted strings.
 *      Single quotes inside single-quoted strings should be doubled ('').
 * Multiline Strings:
 *      Use | for block literals (preserve newlines).
 *      Use > for folded scalars (newlines become spaces).
 */

/** Get rules for rendering a TiddlyWiki widget tree consisting of HTML-ish elements/nodes */
export function getRules(renderer: IMarkupRenderer): RulesRecord {
    let rules: RulesRecord = {
        // The <meta> tag contains the document's title and other attributes
        "meta": (node) => {
            const fields = node.attributes as Record<string, any>;
            let frontMatter: string[] = [];
            if (fields.caption) {
                frontMatter.push(`title: "${fields.caption.replace(/"/g, '\\"')}"`);
            } else if (fields.title) {
                frontMatter.push(`title: "${fields.title.replace(/"/g, '\\"')}"`);
            }
            if (fields.author) {
                frontMatter.push(`author: "${fields.author.replace(/"/g, '\\"')}"`);
            }
            if (fields.path) {
                frontMatter.push(`path: "${fields.path.replace(/"/g, '\\"')}"`);
            }
            if (fields.modified instanceof Date) {
                frontMatter.push(`date: '${fields.modified.toISOString()}'`);
            }
            if (fields.description) {
                // CHANGE: Use abstract field for description, and change all double quotes to escaped double quotes
                frontMatter.push(`abstract: "${fields.description.replace(/"/g, '\\"')}"`);
            }
            if (fields.aliases) {
                frontMatter.push(`aliases: ["${fields.aliases.replace(/"/g, '\\"')}"]`);
            }
            if (fields.tags && fields.tags.length > 0) {
                // Enclose tags with single quotes and escape single quotes inside the tags
                // CHANGE: Also, Obsidian doesn't accept tags that are all digits, so add a leading "N" to them, or treat them as years
                const tags: string[] = fields.tags.map((t: string) => `'${t.replace(/^(\d\d\d\d)$/, "Year/$1").replace(/^(\d+)$/, "N$1").replace("'", "\\'")}'`);

                // CHANGE: Push a subset of tags to a category field
                const categoryTags: string[] = ["'Person'", "'Course'", "'Journal'", "'Meeting'", "'Organisation'", "'Project'", "'Reference'"];
                const categories: string[] = tags.filter((t: string) => categoryTags.indexOf(t) !== -1);
                if (categories.length > 0) {
                    frontMatter.push(`category: [${categories.join(', ')}]`);
                }

                // CHANGE: Push tags that do not have spaces and are not members of categoryTags to tags field
                const nonSpaceTags: string[] = tags.filter((t: string) => t.indexOf(" ") === -1 && categoryTags.indexOf(t) === -1);
                if (nonSpaceTags.length > 0) {
                    frontMatter.push(`tags: [${nonSpaceTags.join(', ')}]`);
                }

                // CHANGE: Use 'related' field for any left over tags
                const remainingTags: string[] = tags.filter((t: string) => nonSpaceTags.indexOf(t) === -1 && categoryTags.indexOf(t) === -1).map((t: string) => `[[${t}]]`).map((t: string) => t.replace("[['", "'[[").replace("']]", "]]'"));
                if (remainingTags.length > 0) {
                    frontMatter.push(`related: [${remainingTags.join(', ')}]`);
                }

            }
            for (const field in fields) {
                if (["text", "title", "aliases", "author", "path", "modified", "description", "tags", "modifier", "creator", "caption"].indexOf(field) !== -1)
                    // Ignore full text and the fields already taken care of
                    continue;

                // Clean up field name
                const fieldName = field.replace(/\s+/g, "-").replace(":", "");

                // Clean up field value
                let fieldValue = fields[field];
                let fieldAsDate = new Date(fieldValue);
                if (fieldAsDate instanceof Date && !isNaN(fieldAsDate.getTime())) {
                    fieldValue = fieldAsDate;
                }

                // Output field value
                if (fieldValue instanceof Date) {
                    fieldValue = "'" + fieldValue.toISOString() + "'";
                }
                else if (typeof fieldValue !== "number") {
                    // Remove newlines and escape single quotes
                    fieldValue = "'" + fieldValue.toString().replace(/[\r\n]+/g, "").replace("'", "\\'") + "'";
                }
                frontMatter.push(`${fieldName}: ${fieldValue}`);
            }
            return `---\n${frontMatter.join("\n")}\n---\n`; // CHANGE: Do not emit title as heading
        },
        "p": (node, im) => {
            if (node.parentNode?.tag === "li") {
                const newlines = renderer.isLastChild(node)
                    ? "\n" // End with one newline for the last child
                    : "\n\n"; // End with two newlines between paragraphs
                if (node.parentNode.children[0] == node) {
                    // The first <p> inside a <li> is rendered as inline text
                    return `${im.trim()}${newlines}`;
                }
                else {
                    // Subsequent <p> inside a <li> is rendered with indentation
                    return `    ${im.trim()}${newlines}`;
                }
            }
            else {
                // Add newlines after paragraphs
                return `${im.trim()}\n\n`;
            }
        },
        "em": (_, im) => `*${im}*`,
        "strong": (_, im) => `**${im}**`,
        "u": (_, im) => `<u>${im}</u>`,
        "strike": (_, im) => `~~${im}~~`,
        // Force line-break
        "br": (node) => {
            const nextNode = renderer.getNextNode(node);
            if (nextNode == null || (isTextNode(nextNode) && nextNode.textContent === "\n")) {
                // If the next line is blank, shouldn't end with a \
                return "\n";
            }
            else {
                return "\\\n";
            }
        },
        "hr": () => `---\n\n`,
        "label": (_, im) => im,
        // Pandoc 3.0 supports highlighted text using ==, if you specify --from markdown+mark
        "mark": (_, im) => `==${im}==`,
        "span": (node, im) => {
            const katexStart = '<annotation encoding="application/x-tex">';
            if (node.rawHTML && node.rawHTML.indexOf(katexStart) !== -1) {
                let mathEq = node.rawHTML.substring(node.rawHTML.indexOf(katexStart) + katexStart.length);
                mathEq = mathEq.substring(0, mathEq.indexOf('</annotation>'));

                if (mathEq.startsWith("\n") && mathEq.endsWith("\n")) {
                    // As a block equation
                    return `$$${mathEq}$$\n\n`;
                }
                else {
                    // As an inline equation
                    return `$${mathEq}$`;
                }
            }
            else {
                return im;
            }
        },
        // TODO: Obsidian doesn't support sub/sup, but does have footnotes (while TW does not)
        "sub": (_, im) => `~${im.replace(/ /g, "\\ ")}~`,
        "sup": (_, im) => `^${im.replace(/ /g, "\\ ")}^`,
        "h1": (_, im) => `# ${im}\n\n`,
        "h2": (_, im) => `## ${im}\n\n`,
        "h3": (_, im) => `### ${im}\n\n`,
        "h4": (_, im) => `#### ${im}\n\n`,
        // Definition lists
        // CHANGE: Obsidian doesn't support definition lists, but Pandoc and others do support this format
        // TODO: Alternatively, could try and render as a list
        "dl": (_, im) => `${im.trim()}\n\n`,
        "dt": (_, im) => `${im}\n`,
        "dd": (_, im) => `: ${im}\n\n`,
        // Code blocks
        "pre": (node, im) => {
            if (node.children.every(child => isDomNode(child) && child.tag === "code")) {
                // <pre> with nested <code> elements, just pass through
                return im;
            }
            else {
                // <pre> without nested <code>
                return `\`\`\`\n${im.trim()}\n\`\`\`\n\n`;
            }
        },
        "code": (node, im) => {
            if (node.parentNode?.tag === "pre") {
                // <code> nested inside <pre>
                // The Highlight plugin puts the language in the "class" attribute
                let classRx = node.attributes?.class?.match(/^(.+) hljs$/);
                if (classRx) {
                    const lang = classRx[1];
                    // CHANGE: Don't trim pre-formatted code
                    return `\`\`\`${lang}\n${im}\n\`\`\`\n\n`;
                }
                else {
                    return `\`\`\`\n${im}\n\`\`\`\n\n`;
                }
            }
            else {
                // As inline code
                // CHANGE: Trim inline pre-formatted
                return `\`${im.trim()}\``;
            }
        },
        "blockquote": (node, im) => {
            let indentation = "";
            let newLine = "";
            if (node.parentNode?.tag === "li") {
                newLine = "\n";
                indentation = "    ";
            }
            // Insert "> " at the beginning of each line
            const prefix = `${indentation}> `;
            return `${newLine}${prefix}${im.trim().replace(/\n/g, `\n${prefix}`)}\n\n`
        },
        "cite": (_, im) => {
            return `<cite>${im}</cite>`;
        },
        // Lists
        "ul": (node, im) => {
            if (node.parentNode?.tag === "li") {
                // Nested list, should not end with double newlines
                return `\n${im}`;
            }
            else {
                return `${im.trim()}\n\n`;
            }
        },
        "li": (node, im) => {
            let curNode = node.parentNode;
            if (curNode == null) {
                console.error("Found <li> without parent");
                return null;
            }
            // Count the <li> tags in the parent node's attributes
            const listItems = curNode.attributes?.li || 0;
            curNode.attributes.li = listItems + 1;
            const listType = curNode.tag === "ul" ? "-" : `${listItems+1}.`;
            const listTags = ["ul", "ol", "li"];
            let depth = -1;
            // Traverse up the path to count nesting levels
            while (curNode && listTags.indexOf(curNode.tag) !== -1) {
                if (curNode.tag !== "li") {
                    depth++;
                }
                curNode = curNode.parentNode;
            }
            // guard against depth < 0
            if (depth < 0) {
                depth = 0;
            }
            const indent = "    ".repeat(depth);
            return `${indent}${listType} ${im.trim()}\n`;
        },
        "input": (node) => {
            if (node.attributes?.type === "checkbox") {
                if (node.attributes?.checked) {
                    return "[x]";
                }
                else {
                    return "[ ]";
                }
            }
            else {
                console.warn("Unsupported input node type", node);
                return null;
            }
        },
        "a": (node, im) => {
            const href = node.attributes?.href as string;
            if (href == null || href?.startsWith("#")) {
                // CHANGE: Render internal links as [[wikilinks]]
                // Also, Obsidian reverses position of alias and target
                // Remove leading '#' from href if it exits
                const target = decodeURIComponent(href.replace(/^#/, ''));
                return target === im ? `[[${im}]]` : `[[${target}|${im}]]`;
            } else if (href.startsWith("/Users/d.austin/Documents/Obsidian Vault/")) {
                // CHANGE: Yeah, hacky again...
                // If extension is .pdf, .png, .jpg, .mp4 (etc), then prefix with "!"
                const mediaExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm", ".ogg", ".mp3", ".wav"];
                const prefix = mediaExtensions.some(ext => href.endsWith(ext)) ? "!" : "";
                const target = decodeURIComponent(href.replace("/Users/d.austin/Documents/Obsidian Vault/", "").replace("//", "/"));
                return im && im === href ? `${prefix}[[${target}]]` : `${prefix}[[${target}|${im}]]`;
            } else if (im && im != href) {
                return `[${im}](${href})`;
            }
            else {
                return `<${href}>`;
            }
        },
        "img": (node) => {
            let caption = node.attributes?.title || "";
            let src = node.attributes?.src || "";
            const svgPrefix = "data:image/svg+xml,";
            if (src.startsWith(svgPrefix)) {
                // SVGs should also be Base64-encoded for compatibility
                src = svgPrefix.replace("svg+xml,", "svg+xml;base64,") +
                    btoa(
                        decodeURIComponent(
                            src.substring(svgPrefix.length)
                        )
                    );
            } else if (src.startsWith("/Users/d.austin/Documents/Obsidian Vault/")) {
                // CHANGE: Getting VERY hacky here...
                // Remove the path prefix
                src = src.replace("/Users/d.austin/Documents/Obsidian Vault/", "");
                // Also remove any double slashes...
                src = src.replace("//", "/");
                if (caption) {
                    return `![[${src}|${caption}]]`;
                } else {
                    return `![[${src}]]`;
                }
            }
            return `![${caption}](${src})`;
        },
        "i": (node, im) => {
            if (node.attributes?.class) {
                const classes: string[] = node.attributes.class.split(" ");
                if (im.trim().length === 0 && classes.some(c => c.startsWith("fa-"))) {
                    // Lazily render all FontAwesome icons as a replacement character
                    return "�";
                }
            }
            return null;
        },
        // Tables
        "table": (node) => {
            let tbody: TW_Element | null = null;
            for (const child of node.children) {
                if (isDomNode(child) && child.tag === "tbody") {
                    tbody = child;
                    break;
                }
            }
            if (tbody == null) {
                return null;
            }

            const justifyLeft = (s: string | null, w: number) => {
                const sLen = s?.length || 0;
                return s + ' '.repeat(w - sLen);
            }
            const justifyRight = (s: string | null, w: number) => {
                const sLen = s?.length || 0;
                return ' '.repeat(w - sLen) + s;
            }
            const center = (s: string | null, w: number) => {
                const sLen = s?.length || 0;
                const spacesLeft = Math.ceil((w - sLen) / 2);
                const spacesRight = w - sLen - spacesLeft;
                return ' '.repeat(spacesLeft) + s + ' '.repeat(spacesRight);
            }

            let grid: TableCell[][] = [];
            for (const row of tbody.children) {
                if (isDomNode(row) && row.tag === "tr") {
                    let cellsInCurrentRow: TableCell[] = [];
                    for (const cell of row.children) {
                        if (isDomNode(cell)) {
                            cellsInCurrentRow.push({
                                innerMarkup: renderer.renderNode(cell),
                                header: cell.tag === "th",
                                align: cell.attributes.align,
                            });
                        }
                    }
                    grid.push(cellsInCurrentRow);
                }
            }

            let columnWidths: number[] = [];
            for (let i = 0; i < grid[0].length; i++) {
                // Check max length of each column's inner markup
                columnWidths.push(Math.max(...grid.map(row => row[i].innerMarkup?.length || 0)));
            }

            let tableMarkup: string[] = [];
            let isFirstRow = true;
            for (const row of grid) {
                let rowMarkup: string[] = [];
                for (const column in row) {
                    const cell = row[column];
                    const innerMarkup = cell.innerMarkup;
                    const columnWidth = columnWidths[column];
                    if (cell.align === "center") {
                        rowMarkup.push(center(innerMarkup, columnWidth));
                    }
                    else if (cell.align === "right") {
                        rowMarkup.push(justifyRight(innerMarkup, columnWidth));
                    }
                    else {
                        rowMarkup.push(justifyLeft(innerMarkup, columnWidth));
                    }
                }
                tableMarkup.push("| " + rowMarkup.join(" | ") + " |");
                if (isFirstRow) {
                    // Markdown requires the first row to be a header row
                    let rowMarkup: string[] = [];
                    for (const column in row) {
                        const columnWidth = columnWidths[column];
                        rowMarkup.push("-".repeat(columnWidth));
                    }
                    tableMarkup.push("|-" + rowMarkup.join("-|-") + "-|");
                    isFirstRow = false;
                }
            }
            return tableMarkup.join("\n") + "\n\n";
        },
        // The <tr> tag is handled by the <table> rule
        "tr": () => null,
        "td": (_, im) => im,
        "th": (_, im) => im,
        // Generic block element rule
        "block": (node, im) => {
            if (im.trim().length > 0) {
                return `<${node.tag}>${im.trim()}</${node.tag}>\n`;
            }
            else {
                return null;
            }
        },
        // Handle <iframe> tags
        "iframe": (node, im) => {
            // go through all members of attributes and add to iframe tag
            return `<iframe ${renderAttributes(node.attributes)}>${im.trim()}</iframe>\n\n`;
        },
        // Explicit ignore rule
        "_ignore": (node, im) => {
            return null;
        },
        // Wildcard rule, catching all other inline elements
        "*": (node, im) => {
            if (im.trim().length > 0) {
                return `<${node.tag}>${im.trim()}</${node.tag}>`;
            }
            else {
                return null;
            }
        },
    };

    // Inherit identical rules
    rules["div"] = rules["p"];
    rules["ol"] = rules["ul"];

    // Generic block elements
    rules["address"] = rules["block"];
    rules["article"] = rules["block"];
    rules["aside"] = rules["block"];
    rules["details"] = rules["block"];
    rules["dialog"] = rules["block"];
    rules["fieldset"] = rules["block"];
    rules["figcaption"] = rules["block"];
    rules["figure"] = rules["block"];
    rules["footer"] = rules["block"];
    rules["form"] = rules["block"];
    rules["header"] = rules["block"];
    rules["hgroup"] = rules["block"];
    rules["main"] = rules["block"];
    rules["nav"] = rules["block"];
    rules["section"] = rules["block"];
    rules["tbody"] = rules["_ignore"];
    rules["thead"] = rules["_ignore"];

    return rules;
}
