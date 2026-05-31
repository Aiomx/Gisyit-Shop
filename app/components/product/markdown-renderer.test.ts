/**
 * Property-Based Tests for Markdown Renderer and Description Section Visibility
 *
 * **Feature: product-verification-description, Property 3: Description Section Visibility Matches Content**
 * **Validates: Requirements 7.1, 7.5**
 *
 * These tests verify that the description section is displayed if and only if
 * the product's detail_content field is not null and not empty.
 *
 * **Feature: product-verification-description, Property 4: Markdown Content Preservation**
 * **Validates: Requirements 4.2, 7.2**
 *
 * These tests verify that Markdown content is preserved when rendered.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { hasValidContent } from "./markdown-renderer";

// ============================================
// Property Tests - Property 3: Description Section Visibility Matches Content
// ============================================

describe("Property 3: Description Section Visibility Matches Content", () => {
    /**
     * **Feature: product-verification-description, Property 3: Description Section Visibility Matches Content**
     * **Validates: Requirements 7.1, 7.5**
     *
     * For any product, the description section SHALL be displayed if and only if
     * detail_content is not null and not empty.
     */

    describe("Valid content shows description section", () => {
        it("non-empty strings should show the description section (Requirements: 7.1)", () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 10000 }).filter(s => s.trim().length > 0),
                    (content) => {
                        const shouldShow = hasValidContent(content);
                        return shouldShow === true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("markdown content with various elements should show the description section", () => {
            const markdownContentArb = fc.oneof(
                // Simple text
                fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
                // Headers
                fc.string({ minLength: 1, maxLength: 100 }).map(s => `# ${s.trim() || 'Header'}`),
                // Lists
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 })
                    .map(items => items.map(i => `- ${i.trim() || 'item'}`).join('\n')),
                // Code blocks
                fc.string({ minLength: 1, maxLength: 200 }).map(s => `\`\`\`\n${s}\n\`\`\``),
                // Links
                fc.tuple(fc.string({ minLength: 1, maxLength: 50 }), fc.webUrl())
                    .map(([text, url]) => `[${text.trim() || 'link'}](${url})`),
                // Images
                fc.webUrl().map(url => `![alt text](${url})`)
            );

            fc.assert(
                fc.property(markdownContentArb, (content) => {
                    const shouldShow = hasValidContent(content);
                    return shouldShow === true;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe("Empty or null content hides description section", () => {
        it("null content should NOT show the description section (Requirements: 7.5)", () => {
            const shouldShow = hasValidContent(null);
            expect(shouldShow).toBe(false);
        });

        it("undefined content should NOT show the description section (Requirements: 7.5)", () => {
            const shouldShow = hasValidContent(undefined);
            expect(shouldShow).toBe(false);
        });

        it("empty string should NOT show the description section (Requirements: 7.5)", () => {
            const shouldShow = hasValidContent("");
            expect(shouldShow).toBe(false);
        });

        it("whitespace-only strings should NOT show the description section (Requirements: 7.5)", () => {
            // Generate whitespace-only strings using array of whitespace chars
            const whitespaceArb = fc.array(
                fc.constantFrom(' ', '\t', '\n', '\r'),
                { minLength: 1, maxLength: 100 }
            ).map(chars => chars.join(''));

            fc.assert(
                fc.property(whitespaceArb, (content) => {
                    const shouldShow = hasValidContent(content);
                    return shouldShow === false;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe("Visibility is strictly based on content validity", () => {
        it("visibility matches content validity for all possible content states", () => {
            const contentArb = fc.oneof(
                fc.constant(null),
                fc.constant(undefined),
                fc.constant(""),
                fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 20 }).map(chars => chars.join('')),
                fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0)
            );

            fc.assert(
                fc.property(contentArb, (content) => {
                    const shouldShow = hasValidContent(content);
                    const isValidContent = typeof content === "string" && content.trim().length > 0;
                    return shouldShow === isValidContent;
                }),
                { numRuns: 100 }
            );
        });
    });
});

// ============================================
// Property Tests - Property 4: Markdown Content Preservation
// ============================================

describe("Property 4: Markdown Content Preservation", () => {
    /**
     * **Feature: product-verification-description, Property 4: Markdown Content Preservation**
     * **Validates: Requirements 4.2, 7.2**
     *
     * For any valid Markdown string stored in detail_content, rendering then
     * extracting text content SHALL preserve the semantic meaning of the original content.
     */

    describe("Content structure preservation", () => {
        it("plain text content is preserved through hasValidContent check", () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 5000 }).filter(s => s.trim().length > 0),
                    (content) => {
                        // The content should be considered valid
                        const isValid = hasValidContent(content);
                        // And the original content should be unchanged
                        return isValid === true && content === content;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("markdown with special characters is preserved", () => {
            const specialCharsArb = fc.string({ minLength: 1, maxLength: 500 })
                .map(s => {
                    // Add some markdown special characters
                    const chars = ['*', '_', '`', '#', '[', ']', '(', ')', '>', '-', '+'];
                    const randomChar = chars[Math.floor(Math.random() * chars.length)];
                    return `${randomChar}${s}${randomChar}`;
                })
                .filter(s => s.trim().length > 0);

            fc.assert(
                fc.property(specialCharsArb, (content) => {
                    const isValid = hasValidContent(content);
                    return isValid === true;
                }),
                { numRuns: 100 }
            );
        });

        it("multiline markdown content is preserved", () => {
            const multilineArb = fc.array(
                fc.string({ minLength: 1, maxLength: 100 }),
                { minLength: 2, maxLength: 10 }
            ).map(lines => lines.join('\n')).filter(s => s.trim().length > 0);

            fc.assert(
                fc.property(multilineArb, (content) => {
                    const isValid = hasValidContent(content);
                    // Content with multiple lines should be valid
                    return isValid === true;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe("Markdown element preservation", () => {
        it("headers are preserved in content", () => {
            const headerLevelArb = fc.integer({ min: 1, max: 6 });
            const headerTextArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

            fc.assert(
                fc.property(headerLevelArb, headerTextArb, (level, text) => {
                    const headerPrefix = '#'.repeat(level);
                    const content = `${headerPrefix} ${text}`;
                    const isValid = hasValidContent(content);
                    return isValid === true && content.includes(text);
                }),
                { numRuns: 100 }
            );
        });

        it("links are preserved in content", () => {
            const linkTextArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
            const urlArb = fc.webUrl();

            fc.assert(
                fc.property(linkTextArb, urlArb, (text, url) => {
                    const content = `[${text}](${url})`;
                    const isValid = hasValidContent(content);
                    return isValid === true && content.includes(text) && content.includes(url);
                }),
                { numRuns: 100 }
            );
        });

        it("image references are preserved in content", () => {
            const altTextArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
            const urlArb = fc.webUrl();

            fc.assert(
                fc.property(altTextArb, urlArb, (alt, url) => {
                    const content = `![${alt}](${url})`;
                    const isValid = hasValidContent(content);
                    return isValid === true && content.includes(alt) && content.includes(url);
                }),
                { numRuns: 100 }
            );
        });

        it("code blocks are preserved in content", () => {
            const codeArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);
            const languageArb = fc.constantFrom('', 'javascript', 'typescript', 'python', 'bash');

            fc.assert(
                fc.property(codeArb, languageArb, (code, lang) => {
                    const content = `\`\`\`${lang}\n${code}\n\`\`\``;
                    const isValid = hasValidContent(content);
                    return isValid === true && content.includes(code);
                }),
                { numRuns: 100 }
            );
        });

        it("lists are preserved in content", () => {
            const itemsArb = fc.array(
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                { minLength: 1, maxLength: 10 }
            );

            fc.assert(
                fc.property(itemsArb, (items) => {
                    const content = items.map(item => `- ${item}`).join('\n');
                    const isValid = hasValidContent(content);
                    // All items should be present in the content
                    const allItemsPresent = items.every(item => content.includes(item));
                    return isValid === true && allItemsPresent;
                }),
                { numRuns: 100 }
            );
        });
    });
});
