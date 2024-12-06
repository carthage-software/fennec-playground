import init, { fennec_get_insight } from './pkg/fennec_wasm.js';
import * as monaco from 'monaco-editor';

async function initializeWasm() {
    await init(); // Initialize the WebAssembly module
}

initializeWasm();

// Create Monaco editor instances
const inputEditor = monaco.editor.create(document.getElementById('input-editor'), {
    value: "<?php\n\nfunction foo(): never {\n  return 1;\n}\n",
    language: 'php',
    theme: 'vs-dark',
    padding: {
        top: 24,
    },
    fontSize: 15,
    fontFamily: 'Fira Code',
    automaticLayout: true,
});

inputEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runCode);

const formattedEditor = monaco.editor.create(document.getElementById('formatted-code'), {
    value: '',
    language: 'php',
    theme: 'vs-dark',
    readOnly: true,
    padding: {
        top: 24,
    },
    fontSize: 15,
    fontFamily: 'Fira Code',
    automaticLayout: true,
});

const astEditor = monaco.editor.create(document.getElementById('ast-editor'), {
    value: '',
    language: 'json',
    theme: 'vs-dark',
    readOnly: true,
    padding: {
        top: 24,
    },
    fontSize: 15,
    fontFamily: 'Fira Code',
    automaticLayout: true,
});

document.getElementById('analyze-btn').addEventListener('click', async () => {
    runCode();
});

function runCode() {
    const code = inputEditor.getValue();
    try {
        const insights = fennec_get_insight(code);

        console.log('Insights:', insights);
        monaco.editor.removeAllMarkers('fennec');

        formattedEditor.setValue(insights.formatted || '');
        astEditor.setValue(JSON.stringify(insights.program, null, 2));
        displayNames(insights.names, insights.strings);
        displaySymbols(insights.symbols.symbols, insights.strings);
        displayInternedStrings(insights.strings);

        let markers = insights.semantic_issues.issues.map((issue) => {
            let annotation = issue.annotations[0];
            let message = annotation.message || issue.message;
            let start = annotation.span.start.offset;
            let end = annotation.span.end.offset;

            let severity;
            if (issue.level.type === 'Error') {
                severity = monaco.MarkerSeverity.Error;
            } else if (issue.level.type === 'Warning') {
                severity = monaco.MarkerSeverity.Warning;
            } else {
                severity = monaco.MarkerSeverity.Info;
            }

            const model = inputEditor.getModel();

            let startPosition = model.getPositionAt(start);
            let endPosition = model.getPositionAt(end);

            console.log('Issue:', issue.level, message, start, end, startPosition, endPosition);

            let markers = [{
                message: message,
                startLineNumber: startPosition.lineNumber,
                startColumn: startPosition.column,
                endLineNumber: endPosition.lineNumber,
                endColumn: endPosition.column,
                severity: severity,
            }];

            for (let i = 1; i < issue.annotations.length; i++) {
                let annotation = issue.annotations[i];
                let annotationStartPosition = model.getPositionAt(annotation.span.start.offset);
                let annotationEndPosition = model.getPositionAt(annotation.span.end.offset);

                markers.push({
                    message: annotation.message || '',
                    startLineNumber: annotationStartPosition.lineNumber,
                    startColumn: annotationStartPosition.column,
                    endLineNumber: annotationEndPosition.lineNumber,
                    endColumn: annotationEndPosition.column,
                    severity: monaco.MarkerSeverity.Hint,
                });
            }

            return markers;
        }).flat();

        console.log('Markers:', markers);

        monaco.editor.setModelMarkers(inputEditor.getModel(), 'fennec', markers);
    } catch (err) {
        monaco.editor.removeAllMarkers('fennec');
        console.error('Error analyzing code:', err);
    }
}

function displayNames(names, internedStrings) {
    const tbody = document.getElementById('names-table');
    tbody.innerHTML = '';
    names.forEach(([offset, [identifier]]) => {
        const value = internedStrings.find(([id]) => id === identifier)?.[1] || '<empty>';
        const row = `<tr>
            <td class="border px-4 py-2"><code>${offset}</code></td>
            <td class="border px-4 py-2"><code>${value}</code></td>
        </tr>`;

        tbody.insertAdjacentHTML('beforeend', row);
    });
}

function displaySymbols(symbols, internedStrings) {
    const tbody = document.getElementById('symbols-table');
    tbody.innerHTML = '';
    symbols.forEach((symbol) => {
        const namespace = symbol.namespace ? internedStrings.find(([id]) => id === symbol.namespace)?.[1] : '<none>';
        const name = internedStrings.find(([id]) => id === symbol.identifier?.name)?.[1] || '<none>';
        const fqName = internedStrings.find(([id]) => id === symbol.identifier?.fully_qualified_name)?.[1] || '<none>';
        const scope = symbol.scope ? symbol.scope.kind : '<none>';

        const row = `<tr>
            <td class="border px-4 py-2">${symbol.kind}</td>
            <td class="border px-4 py-2"><code>${namespace}</code></td>
            <td class="border px-4 py-2"><code>${name}</code></td>
            <td class="border px-4 py-2"><code>${fqName}</code></td>
            <td class="border px-4 py-2"><code>${scope}</code></td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

function displayInternedStrings(internedStrings) {
    const tbody = document.getElementById('interner-table');
    tbody.innerHTML = '';

    internedStrings.forEach(([id, value]) => {
        let encodedValue = '';
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            if (char === '\n') {
                encodedValue += '\\n';
            } else if (char === '\r') {
                encodedValue += '\\r';
            } else if (char === '\t') {
                encodedValue += '\\t';
            } else if (char === '\v') {
                encodedValue += '\\v';
            } else if (char === '\b') {
                encodedValue += '\\b';
            } else if (char === '\f') {
                encodedValue += '\\f';
            } else if (char === '\0') {
                encodedValue += '\\0';
            } else {
                encodedValue += char;
            }
        }

        const row = `<tr>
            <td class="border px-4 py-2">${id}</td>
            <td class="border px-4 py-2 whitespace-pre-wrap"><code>${encodedValue}</code></td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.replace('bg-purple-600', 'bg-gray-300'));
        button.classList.replace('bg-gray-300', 'bg-purple-600');

        document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.add('hidden'));
        document.getElementById(button.dataset.tab).classList.remove('hidden');
    });
});
