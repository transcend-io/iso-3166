"use strict";
/**
 * @typedef {import('hast').Element} Element
 *
 * @typedef {{name?: string, alpha2: string, alpha3: string, numeric: string}} Reserved
 *
 * @typedef {{name: string, alpha2: string, alpha3: string, numeric: string}} Assigned
 *
 * @typedef {{state: string, alpha2: string, alpha3: string, numeric: string, name?: string}} Iso31661
 *
 * @typedef {{code: string, name: string, parent?: string}} Iso31662
 *
 * @typedef {{alpha4: string, type: string, from: Iso31663From, to: Array<Iso31663To>}} Iso31663
 *
 * @typedef {{state: string|undefined, alpha2: string, alpha3: string, numeric?: string, name: string}} Iso31663From
 *
 * @typedef {{state: string|undefined, alpha2: string, alpha3: string, numeric?: string, name: string}} Iso31663To
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_fs_1 = require("node:fs");
const p_map_1 = require("p-map");
const bail_1 = require("bail");
const node_fetch_1 = require("node-fetch");
const unified_1 = require("unified");
const rehype_parse_1 = require("rehype-parse");
const hast_util_select_1 = require("hast-util-select");
const hast_util_to_string_1 = require("hast-util-to-string");
const own = {}.hasOwnProperty;
const html = (0, unified_1.unified)().use(rehype_parse_1.default);
const wiki = 'https://en.wikipedia.org';
const iso31661Main = wiki + '/wiki/ISO_3166-1';
const iso31661Overview = wiki + '/wiki/ISO_3166-1_alpha-2';
const iso31662Base = wiki + '/wiki/ISO_3166-2:';
const iso31663Main = wiki + '/wiki/ISO_3166-3';
/** @type {Array<Assigned>} */
const assigned = [];
/** @type {Array<Iso31661>} */
let iso31661 = [];
/** @type {Array<Iso31662>} */
let iso31662 = [];
/** @type {Array<Iso31663>} */
let iso31663 = [];
Promise.resolve()
    // ISO 3166-1:
    .then(() => (0, node_fetch_1.default)(iso31661Main))
    .then(textIfSuccessful)
    .then((doc) => {
    const tree = html.parse(doc);
    const table = (0, hast_util_select_1.selectAll)('table.wikitable', tree)[1];
    const rows = (0, hast_util_select_1.selectAll)('tr', table);
    let index = -1;
    while (++index < rows.length) {
        const row = rows[index];
        const cells = (0, hast_util_select_1.selectAll)('td', row);
        const [name, alpha2, alpha3, numeric] = cells.map((d) => cleanNode(d));
        if (!name)
            continue;
        assigned.push({ name, alpha2, alpha3, numeric });
    }
})
    .then(() => (0, node_fetch_1.default)(iso31661Overview))
    .then(textIfSuccessful)
    .then((doc) => {
    const tree = html.parse(doc);
    /** @type {Record<string, string>} */
    const map = {
        'user-assigned': 'user-assigned',
        'exceptionally reserved': 'exceptionally-reserved',
        'transitionally reserved': 'transitionally-reserved',
        'indeterminately reserved': 'indeterminately-reserved',
        deleted: 'formerly-assigned',
        unassigned: 'unassigned',
        assigned: 'assigned'
    };
    const states = [
        'user-assigned',
        'exceptionally reserved',
        'transitionally reserved',
        'indeterminately reserved',
        'deleted',
        'unassigned'
    ];
    /**
     * @typedef {{state: string, alpha2: string, note: string|undefined}} Entry
     */
    /** @type {Element} */
    const table = (0, hast_util_select_1.selectAll)('table.wikitable', tree)[1];
    /** @type {Element[]} */
    const cells = (0, hast_util_select_1.selectAll)('td', table);
    /** @type {Entry[]} */
    const entries = [];
    let index = -1;
    while (++index < cells.length) {
        const d = cells[index];
        const alpha2 = cleanNode(d);
        let title = String((d.properties || {}).title);
        let state = 'assigned';
        let stateIndex = -1;
        const length = states.length;
        if (!/^[A-Z]{2}$/.test(alpha2)) {
            continue;
        }
        // `OO` is an intentional escape code, one of its kind; ISO ignores it,
        // but it’s also not a user-assigned code.
        if (title === 'Escape code') {
            title = 'unassigned';
        }
        while (++stateIndex < length) {
            const stateValue = states[stateIndex];
            if (new RegExp('^' + stateValue, 'i').test(title)) {
                state = map[stateValue];
                break;
            }
        }
        const colon = title.indexOf(':');
        const semicolon = colon === -1 ? -1 : title.indexOf(';', colon);
        const note = colon === -1
            ? undefined
            : title
                .slice(colon + 1, semicolon === -1 ? title.length : semicolon)
                .replace(/\([^)]*\)/g, '')
                .replace(/\)/g, '')
                .trim();
        entries.push({ state, alpha2, note });
    }
    index = -1;
    while (++index < entries.length) {
        const entry = entries[index];
        const { state, note, alpha2 } = entry;
        const record = assigned.find((d) => d.alpha2 === alpha2);
        const { name, alpha3, numeric } = record || {};
        if (entry.state === 'assigned') {
            if (!record) {
                console.error('Cannot handle missing assigned entry', entry, record);
                throw new Error('Cannot handle missing assigned entry');
            }
        }
        else if (record) {
            console.error('Cannot handle unassigned entry', entry, record);
            throw new Error('Cannot handle assigned entry');
        }
        iso31661.push({
            state,
            alpha2,
            // @ts-expect-error: missing for now.
            alpha3,
            // @ts-expect-error: missing for now.
            numeric,
            name: name || note || undefined
        });
    }
    iso31661 = iso31661.sort(sort);
})
    // ISO 3166-2:
    .then(() => {
    const codes = iso31661.filter((d) => d.state === 'assigned');
    return (0, p_map_1.default)(codes, map, { concurrency: 1 });
    /**
     * @param {Iso31661} d
     */
    function map(d) {
        return new Promise((resolve) => {
            setTimeout(resolve, 1000);
        })
            .then(() => (0, node_fetch_1.default)(iso31662Base + d.alpha2))
            .then(textIfSuccessful)
            .then((doc) => {
            const tree = html.parse(doc);
            const prefix = d.alpha2 + '-';
            /** @type {Element[]} */
            const tables = (0, hast_util_select_1.selectAll)('table.wikitable', tree);
            const tableLength = tables.length;
            let tableIndex = -1;
            let found = false;
            /** @type {Record<string, Iso31662>} */
            const byCode = {};
            /** @type {number} */
            let columnIndex;
            /** @type {Element} */
            let table;
            /** @type {Element[]} */
            let rows;
            /** @type {number} */
            let rowIndex;
            /** @type {number} */
            let rowLength;
            /** @type {number} */
            let cellIndex;
            /** @type {number} */
            let cellLength;
            /** @type {Element[]} */
            let cellNodes;
            /** @type {string[]} */
            let cells;
            /** @type {Element} */
            let row;
            /** @type {Element} */
            let cellNode;
            /** @type {string|undefined} */
            let cell;
            /** @type {keyof Iso31662|null} */
            let field;
            /** @type {string} */
            let column;
            /** @type {Iso31662} */
            let result;
            /** @type {RegExpMatchArray|null} */
            let match;
            /** @type {string} */
            let key;
            while (++tableIndex < tableLength) {
                table = tables[tableIndex];
                /** @type {string[]} */
                const headers = [];
                /** @type {number[]} */
                const headerSpans = [];
                rows = (0, hast_util_select_1.selectAll)('tr', table);
                rowIndex = 0;
                rowLength = rows.length;
                while (rowIndex < rowLength) {
                    row = rows[rowIndex];
                    cellNodes = (0, hast_util_select_1.selectAll)('th', row);
                    cellLength = cellNodes.length;
                    // Not a header row.
                    if (cellLength === 0) {
                        break;
                    }
                    cellIndex = 0;
                    columnIndex = 0;
                    while (cellIndex < cellLength) {
                        if (headerSpans[columnIndex]) {
                            headerSpans[columnIndex]--;
                            columnIndex++;
                            continue;
                        }
                        cellNode = cellNodes[cellIndex];
                        if (cellNode.properties && cellNode.properties.rowSpan) {
                            headerSpans[columnIndex] =
                                Number.parseInt(String(cellNode.properties.rowSpan), 10) - 1;
                        }
                        if (cellNode.properties && cellNode.properties.colSpan) {
                            columnIndex += Number.parseInt(String(cellNode.properties.colSpan), 10);
                        }
                        else {
                            headers[columnIndex] = cleanNode(cellNode).toLowerCase();
                            columnIndex++;
                        }
                        cellIndex++;
                    }
                    rowIndex++;
                }
                if (headers.length === 0 || headers[0] !== 'code') {
                    if (!/newsletter|date of change|date issued/.test(headers.join(' '))) {
                        console.warn('Not a code table', d.alpha2, headers);
                    }
                    break;
                }
                rowIndex--;
                while (++rowIndex < rowLength) {
                    row = rows[rowIndex];
                    cells = (0, hast_util_select_1.selectAll)('td', row).map((d) => cleanNode(d));
                    cellLength = cells.length;
                    if (cellLength === 0) {
                        console.warn('Empty row', d.alpha2);
                        continue;
                    }
                    result = { code: '', name: '' };
                    cellIndex = -1;
                    while (++cellIndex < cellLength) {
                        cell = cells[cellIndex];
                        column = headers[cellIndex];
                        field = null;
                        if (!result.code && /code/.test(column)) {
                            field = 'code';
                        }
                        else if (!result.name && /name|bgn\/pcgn/.test(column)) {
                            // Some regions have different languages, and then the
                            // primary names are also in different languages (e.g.,
                            // Belgium).
                            // For Switzerland, it gets more confusing, because the
                            // column contains multiple translations.
                            // E.g., `Fribourg (fr), Freiburg (de)`
                            match = cell.match(/\([a-z]{2}\)/);
                            // Pick the first translation:
                            if (match) {
                                cell = clean(cell.slice(0, match.index));
                            }
                            field = 'name';
                        }
                        else if (!result.parent && /^parent |^in /i.test(column)) {
                            if (
                            // Used by `AZ` and `FR` to show non-parent.
                            cell === '—') {
                                cell = undefined;
                            }
                            else {
                                // Make sure the full code is used.
                                if (cell.slice(0, 3) !== prefix) {
                                    cell = prefix + cell;
                                }
                                if (!/[A-Z]{2}-[A-Z\d]{1,3}/.test(cell)) {
                                    console.warn('Cannot handle invalid ISO 3166-2 code', cell, column);
                                    cell = undefined;
                                }
                            }
                            field = 'parent';
                        }
                        if (field && cell) {
                            result[field] = cell;
                        }
                    }
                    if (!result.code || !result.name) {
                        console.warn('Cannot handle result w/o code or name', pick(d), result, cells);
                    }
                    else {
                        byCode[result.code] = {
                            code: result.code,
                            name: result.name,
                            parent: result.parent || d.alpha2
                        };
                    }
                }
            }
            for (key in byCode) {
                if (own.call(byCode, key)) {
                    iso31662.push(byCode[key]);
                    found = true;
                }
            }
            if (tables.length === 0) {
                console.warn('No tables in %s', d.alpha2);
            }
            else if (found === false) {
                console.warn('Tables in %s but no subdivisions', d.alpha2);
            }
            iso31662 = iso31662.sort(sort);
        });
    }
})
    // ISO 3166-3:
    .then(() => (0, node_fetch_1.default)(iso31663Main))
    .then(textIfSuccessful)
    .then((doc) => {
    const tree = html.parse(doc);
    /** @type {Element} */
    const table = (0, hast_util_select_1.selectAll)('table.wikitable', tree)[0];
    /** @type {Element[]} */
    const rows = (0, hast_util_select_1.selectAll)('tr', table);
    /** @type {Record<string, RegExp>} */
    const types = {
        merge: /^merged into /i,
        change: /^name changed to /i,
        split: /^divided into: /i
    };
    let index = -1;
    while (++index < rows.length) {
        const row = rows[index];
        // Exit if there is no row data.
        if (!(0, hast_util_select_1.select)('td', row)) {
            continue;
        }
        const cells = (0, hast_util_select_1.selectAll)('th, td', row);
        let [alpha4, name, before, , after] = cells.map((d) => cleanNode(d));
        /** @type {string|null} */
        let kind = null;
        let lastIndex = 0;
        const re = /\([A-Z]{2}, [A-Z]{3}, (\d{3}|-)\)/g;
        /** @type {string} */
        let key;
        /** @type {string} */
        let alpha2;
        /** @type {string} */
        let alpha3;
        /** @type {string} */
        let numeric;
        /** @type {Iso31663To[]} */
        const changeTo = [];
        for (key in types) {
            if (own.call(types, key)) {
                const match = after.match(types[key]);
                if (match && match.index !== undefined) {
                    kind = key;
                    after =
                        after.slice(0, match.index) +
                            after.slice(match.index + match[0].length);
                    break;
                }
            }
        }
        ;
        [alpha2, alpha3, numeric] = before.split(/,\s+/g);
        (0, node_assert_1.default)(kind, 'expected `kind`');
        iso31663.push({
            alpha4,
            type: kind,
            from: {
                state: undefined,
                alpha2,
                alpha3,
                numeric: numeric === '-' ? undefined : numeric,
                name
            },
            to: changeTo
        });
        /** @type {RegExpMatchArray|null} */
        let match;
        while ((match = re.exec(after)) && match.index !== undefined) {
            ;
            [alpha2, alpha3, numeric] = match[0].slice(1, -1).split(/,\s+/g);
            name = clean(after.slice(lastIndex, match.index).replace(/part of/i, ''));
            changeTo.push({
                state: undefined,
                alpha2,
                alpha3,
                numeric: numeric === '-' ? undefined : numeric,
                name
            });
            lastIndex = match.index + match[0].length;
        }
    }
    iso31663 = iso31663.sort(sort);
})
    .then(() => {
    // Check which ISO 3166-3 changes are (formerly) assigned:
    let index = -1;
    while (++index < iso31663.length) {
        const d = iso31663[index];
        const entries = [d.from, ...d.to];
        let entryIndex = -1;
        while (++entryIndex < entries.length) {
            const entry = entries[entryIndex];
            const i1 = iso31661.find((d) => d.alpha2 === entry.alpha2);
            const same = i1 &&
                i1.state === 'assigned' &&
                i1.alpha3 === entry.alpha3 &&
                i1.numeric === entry.numeric;
            entry.state = (same ? '' : 'formerly-') + 'assigned';
        }
    }
    /** @type {Array<Assigned>} */
    const iso31661Assigned = [];
    /** @type {Array<Reserved>} */
    const iso31661Reserved = [];
    /** @type {Record<string, string>} */
    const a2ToA3 = {};
    /** @type {Record<string, string>} */
    const a2ToN = {};
    /** @type {Record<string, string[]>} */
    const a2To2 = {};
    /** @type {Record<string, string>} */
    const a3ToA2 = {};
    /** @type {Record<string, string>} */
    const nToA2 = {};
    index = -1;
    while (++index < iso31661.length) {
        const d = iso31661[index];
        if (d.state === 'assigned') {
            iso31661Assigned.push({ name: '', ...d });
        }
        else if (d.state === 'indeterminately-reserved' ||
            d.state === 'exceptionally-reserved' ||
            d.state === 'transitionally-reserved' ||
            d.state === 'formerly-assigned') {
            iso31661Reserved.push(d);
        }
    }
    index = -1;
    while (++index < iso31661Assigned.length) {
        const { alpha2, alpha3, numeric } = iso31661Assigned[index];
        a2ToA3[alpha2] = alpha3;
        a2ToN[alpha2] = numeric;
        nToA2[numeric] = alpha2;
        a3ToA2[alpha3] = alpha2;
    }
    index = -1;
    while (++index < iso31662.length) {
        const { code } = iso31662[index];
        const country = code.slice(0, 2);
        a2To2[country] = [...(a2To2[country] || []), code];
    }
    /** @type {string} */
    let key;
    for (key in a2To2) {
        if (own.call(a2To2, key)) {
            a2To2[key].sort((a, b) => a.localeCompare(b));
        }
    }
    write('1', 'iso31661', iso31661Assigned, [
        '/**',
        ' * @typedef ISO31661AssignedEntry',
        ' *   Object representing an assigned country.',
        " * @property {'assigned'} state",
        " *   State (example: `'assigned'`)",
        ' * @property {string} alpha2',
        " *   ISO 3166-1 alpha-2 code (example: `'GB'`)",
        ' * @property {string} alpha3',
        " *   ISO 3166-1 alpha-3 code (example: `'GBR'`)",
        ' * @property {string} numeric',
        " *   ISO 3166-1 numeric (UN M49) code (example: `'826'`)",
        ' * @property {string} name',
        " *   Name (example: `'United Kingdom of Great Britain and Northern Ireland'`)",
        ' */',
        '',
        '/**',
        ' * List of assigned countries.',
        ' *',
        ' * @type {Array<ISO31661AssignedEntry>}',
        ' */'
    ].join('\n'));
    write('1-reserved', 'iso31661Reserved', iso31661Reserved, [
        '/**',
        ' * @typedef ISO31661ReservedEntry',
        ' *   Object representing a reserved country.',
        " * @property {'indeterminately-reserved'|'exceptionally-reserved'|'transitionally-reserved'|'formerly-assigned'} state",
        " *   State (example: `'assigned'`)",
        ' * @property {string} alpha2',
        " *   ISO 3166-1 alpha-2 code (example: `'GB'`)",
        ' * @property {string} name',
        " *   Name (example: `'United Kingdom of Great Britain and Northern Ireland'`)",
        ' */',
        '',
        '/**',
        ' * List of reserved country codes.',
        ' *',
        ' * @type {Array<ISO31661ReservedEntry>}',
        ' */'
    ].join('\n'));
    write('1-a2-to-1-a3', 'iso31661Alpha2ToAlpha3', a2ToA3, [
        '/**',
        ' * Map of ISO 3166-1 alpha-2 codes to ISO 3166-1 alpha-3 codes.',
        ' *',
        ' * @type {Record<string, string>}',
        ' */'
    ].join('\n'));
    write('1-a2-to-1-n', 'iso31661Alpha2ToNumeric', a2ToN, [
        '/**',
        ' * Map of ISO 3166-1 alpha-2 codes to ISO 3166-1 numeric (UN M49) codes',
        ' *',
        ' * @type {Record<string, string>}',
        ' */'
    ].join('\n'));
    write('1-a3-to-1-a2', 'iso31661Alpha3ToAlpha2', a3ToA2, [
        '/**',
        ' * Map of ISO 3166-1 alpha-3 codes to ISO 3166-1 alpha-2 codes',
        ' *',
        ' * @type {Record<string, string>}',
        ' */'
    ].join('\n'));
    write('1-n-to-1-a2', 'iso31661NumericToAlpha2', nToA2, [
        '/**',
        ' * Map of ISO 3166-1 numeric (UN M49) codes to ISO 3166-1 alpha-2 codes',
        ' *',
        ' * @type {Record<string, string>}',
        ' */'
    ].join('\n'));
    write('2', 'iso31662', iso31662, [
        '/**',
        ' * @typedef ISO31662Entry',
        ' *   Object representing a subdivision.',
        ' * @property {string} code',
        " *   ISO 3166-2 code (example: `'GB-BFS'`)",
        ' * @property {string} parent',
        " *    ISO 3166-1 alpha-2 code or ISO 3166-2 code (example: `'GB'`)",
        ' * @property {string} name',
        " *   Name (example: `'Belfast'`)",
        ' */',
        '',
        '/**',
        ' * List of subdivisions.',
        ' *',
        ' * @type {Array<ISO31662Entry>}',
        ' */'
    ].join('\n'));
    write('3', 'iso31663', iso31663, [
        '/**',
        " * @typedef {'merge'|'change'|'split'} Type",
        ' *',
        ' * @typedef ISO31661FromEntry',
        " * @property {'formerly-assigned'} state",
        ' * @property {string} alpha2',
        ' * @property {string} alpha3',
        ' * @property {string} [numeric]',
        ' * @property {string} name',
        ' *',
        ' * @typedef ISO31661ToEntry',
        " * @property {'formerly-assigned'|'assigned'} state",
        ' * @property {string} alpha2',
        ' * @property {string} alpha3',
        ' * @property {string} numeric',
        ' * @property {string} name',
        ' *',
        ' * @typedef ISO31663Entry',
        ' *   Object representing a former country.',
        ' * @property {string} alpha4',
        ' *   ISO 3166-3 alpha-4 code (example: `ANHH`)',
        ' * @property {Type} type',
        " *   Type of revision (example: `'split'`)",
        ' * @property {ISO31661FromEntry} from',
        ' *   Country before revision',
        ' * @property {Array<ISO31661ToEntry>} to',
        ' *   List of countries after revision',
        ' */',
        '',
        '/**',
        ' * List of former countries.',
        ' *',
        ' * @type {Array<ISO31663Entry>}',
        ' */'
    ].join('\n'));
    /**
     * @param {string} name
     * @param {string} id
     * @param {unknown} data
     * @param {string} jsdoc
     * @returns {void}
     */
    function write(name, id, data, jsdoc) {
        node_fs_1.default.writeFile(name + '.js', [
            jsdoc,
            'export const ' + id + ' = ' + JSON.stringify(data, null, 2),
            ''
        ].join('\n'), bail_1.bail);
    }
})
    .catch(
/** @param {Error} error */ (error) => {
    console.log('Error:', error);
});
/**
 * @param {Iso31661|Iso31662|Iso31663} a
 * @param {Iso31661|Iso31662|Iso31663} b
 * @returns {number}
 */
function sort(a, b) {
    return pick(a).localeCompare(pick(b));
}
/**
 * @param {import('node-fetch').Response} response
 * @returns {Promise<string>}
 */
function textIfSuccessful(response) {
    if (response.status !== 200) {
        throw new Error('Unsuccessful response: `' + response.status + '`');
    }
    return response.text();
}
/**
 * @param {Iso31661|Iso31662|Iso31663} d
 * @returns {string}
 */
function pick(d) {
    // @ts-ignore TS making life difficult.
    return d.alpha2 || d.code || d.alpha4;
}
/**
 * @param {Element} d
 * @returns {string}
 */
function cleanNode(d) {
    return clean((0, hast_util_to_string_1.toString)(d));
}
/**
 * @param {string} d
 * @returns {string}
 */
function clean(d) {
    return d
        .replace(/\[[^\]]+]/g, '')
        .replace(/\(i\.e\., [^\]]+\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
