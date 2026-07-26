import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const cssDirectory = path.resolve('resources/css');
const outputPath = path.join(cssDirectory, 'theme-generated.css');
const excluded = new Set([
    'app.css',
    'app-sidebar.css',
    'auth-login.css',
    'fonts.css',
    'responsive.css',
    'theme-generated.css',
    'theme-sync.css',
    'welcome.css',
]);

const files = fs
    .readdirSync(cssDirectory)
    .filter((file) => file.endsWith('.css') && !excluded.has(file))
    .sort();

const surfaceSelectors = new Set();
const borderSelectors = new Set();
const textSelectors = new Set();

function colorFrom(value) {
    const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hex) {
        let digits = hex[1];
        if (digits.length === 3) {
            digits = digits.split('').map((digit) => digit + digit).join('');
        }
        return [
            Number.parseInt(digits.slice(0, 2), 16),
            Number.parseInt(digits.slice(2, 4), 16),
            Number.parseInt(digits.slice(4, 6), 16),
        ];
    }

    const rgb = value.trim().match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    return rgb ? rgb.slice(1, 4).map(Number) : null;
}

function isLightSurface(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'white' || normalized === '#fff' || normalized === '#ffffff') {
        return true;
    }

    const color = colorFrom(normalized);
    if (color && Math.min(...color) >= 225) {
        return true;
    }

    return /(?:#fff(?:fff)?|rgb(?:a)?\(\s*255[\s,]+255[\s,]+255)/i.test(normalized);
}

function isLightBorder(value) {
    const color = colorFrom(value);
    return Boolean(color && Math.min(...color) >= 190);
}

function isDarkNeutralText(value) {
    const color = colorFrom(value);
    if (!color) return false;
    const spread = Math.max(...color) - Math.min(...color);
    return spread <= 55 && (color[0] + color[1] + color[2]) / 3 <= 145;
}

function isInsideKeyframes(rule) {
    for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return true;
    }
    return false;
}

function addSelectors(target, selector) {
    postcss.list.comma(selector).forEach((part) => {
        const trimmed = part.trim();
        if (!trimmed || trimmed === 'from' || trimmed === 'to' || /^\d+%$/.test(trimmed)) return;
        target.add(`html.dark .crm-app-content ${trimmed}`);
    });
}

for (const file of files) {
    const root = postcss.parse(fs.readFileSync(path.join(cssDirectory, file), 'utf8'), {
        from: file,
    });

    root.walkRules((rule) => {
        if (isInsideKeyframes(rule)) return;

        let hasSurface = false;
        let hasBorder = false;
        let hasText = false;

        rule.walkDecls((declaration) => {
            const property = declaration.prop.toLowerCase();
            if ((property === 'background' || property === 'background-color') && isLightSurface(declaration.value)) {
                hasSurface = true;
            }
            if (property.startsWith('border') && property.endsWith('color') && isLightBorder(declaration.value)) {
                hasBorder = true;
            }
            if (property === 'border' && declaration.value.split(/\s+/).some(isLightBorder)) {
                hasBorder = true;
            }
            if (property === 'color' && isDarkNeutralText(declaration.value)) {
                hasText = true;
            }
        });

        if (hasSurface) addSelectors(surfaceSelectors, rule.selector);
        if (hasBorder) addSelectors(borderSelectors, rule.selector);
        if (hasText) addSelectors(textSelectors, rule.selector);
    });
}

function render(selectors, declarations) {
    if (selectors.size === 0) return '';
    return `${[...selectors].sort().join(',\n')} {\n${declarations}\n}\n`;
}

const output = `/*
 * Generated dark-mode coverage for every authenticated feature stylesheet.
 * Run: node scripts/generate-dark-overrides.mjs
 */

${render(surfaceSelectors, '    color: #e6edf7 !important;\n    background: #101b2c !important;')}
${render(borderSelectors, '    border-color: #2b3c54 !important;')}
${render(textSelectors, '    color: #dce6f4 !important;')}
`;

fs.writeFileSync(outputPath, output);
console.log(`Generated ${outputPath} from ${files.length} feature stylesheets.`);
console.log(`${surfaceSelectors.size} surfaces, ${borderSelectors.size} borders, ${textSelectors.size} text selectors.`);
