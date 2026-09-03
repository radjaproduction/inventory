/* Radja Production - lightweight performance instrumentation */
(function (global) {
    'use strict';

    const marks = new Map();
    const measures = [];

    function start(name) {
        marks.set(name, performance.now());
    }

    function end(name, metadata) {
        const startedAt = marks.get(name);
        if (startedAt == null) return null;
        const entry = {
            name,
            durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
            ...(metadata || {})
        };
        measures.push(entry);
        marks.delete(name);
        return entry;
    }

    function report() {
        return measures.map(entry => ({ ...entry }));
    }

    function log(entry) {
        if (!entry) return;
        console.info('[RP PERF]', entry.name, entry.durationMs + 'ms', entry);
    }

    global.RPPerformance = { start, end, report, log };
})(window);
