"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const unified_1 = require("unified");
const rehype_format_1 = require("rehype-format");
const rehype_stringify_1 = require("rehype-stringify");
const hastscript_1 = require("hastscript");
const unist_builder_1 = require("unist-builder");
const mdast_util_heading_range_1 = require("mdast-util-heading-range");
const _1_reserved_js_1 = require("./1-reserved.js");
const _1_js_1 = require("./1.js");
const processor = (0, unified_1.unified)().use(rehype_format_1.default).use(rehype_stringify_1.default);
/**
 * @type {import('unified').Plugin<[], import('mdast').Root>}
 */
function table() {
    return (tree) => {
        const a = 65;
        const z = 90;
        /** @type {Record<string, string>} */
        const a2ToState = {};
        /** @type {Record<string, string>} */
        const a2ToName = {};
        let index = -1;
        while (++index < _1_js_1.iso31661.length) {
            const d = _1_js_1.iso31661[index];
            a2ToState[d.alpha2] = d.state;
            a2ToName[d.alpha2] = d.name;
        }
        index = -1;
        while (++index < _1_reserved_js_1.iso31661Reserved.length) {
            const d = _1_reserved_js_1.iso31661Reserved[index];
            a2ToState[d.alpha2] = d.state;
            a2ToName[d.alpha2] = d.name;
        }
        (0, mdast_util_heading_range_1.headingRange)(tree, 'matrix', (start, _, end) => {
            const head = [(0, hastscript_1.h)('th')];
            /** @type {import('hast').Element[]} */
            const rows = [];
            /** @type {import('hast').Element[]} */
            let cells;
            /** @type {number} */
            let x = a;
            /** @type {number} */
            let y;
            /** @type {import('hast').Element|string} */
            let code;
            /** @type {string} */
            let state;
            /** @type {string} */
            let title;
            while (x <= z) {
                y = a;
                head.push((0, hastscript_1.h)('th', String.fromCharCode(x)));
                cells = [(0, hastscript_1.h)('th', { scope: 'row' }, String.fromCharCode(x))];
                while (y <= z) {
                    code = String.fromCharCode(x) + String.fromCharCode(y);
                    state = a2ToState[code];
                    title = a2ToName[code];
                    switch (state) {
                        case 'assigned':
                            code = (0, hastscript_1.h)('a', { href: 'https://en.wikipedia.org/wiki/ISO_3166-1:' + code }, code);
                            break;
                        case 'exceptionally-reserved':
                        case 'transitionally-reserved':
                        case 'indeterminately-reserved':
                        case 'formerly-assigned':
                            code = (0, hastscript_1.h)('s', code);
                            break;
                        default:
                            break;
                    }
                    cells.push((0, hastscript_1.h)('td', { title }, code));
                    ++y;
                }
                rows.push((0, hastscript_1.h)('tr', cells));
                ++x;
            }
            const node = processor.runSync(
            // @ts-expect-error: fine to pass an element.
            (0, hastscript_1.h)('details', [
                (0, hastscript_1.h)('summary', 'Show ISO 3166-1 alpha-2 code matrix'),
                (0, hastscript_1.h)('table', [(0, hastscript_1.h)('thead', (0, hastscript_1.h)('tr', head)), (0, hastscript_1.h)('tbody', rows)])
            ]));
            const html = processor.stringify(node);
            return [
                start,
                (0, unist_builder_1.u)('html', '<!--lint ignore no-html-->'),
                (0, unist_builder_1.u)('html', html),
                end
            ];
        });
    };
}
exports.default = table;
