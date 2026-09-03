/* Radja Production - data access layer (vanilla JS, transitional)
 *
 * This module intentionally has no DOM or application-state dependency. The current
 * UI still owns the mapping into masterData/appData; that mapping will move out in a
 * later phase. Keeping the database calls here gives us one seam for query changes.
 */
(function (global) {
    'use strict';

    function create(client) {
        if (!client) throw new Error('Supabase client belum tersedia.');

        const writes = {
            insert: (table, payload, single) => {
                let query = client.from(table).insert(payload).select();
                return single ? query.single() : query;
            },
            insertRaw: (table, payload) =>
                client.from(table).insert(payload),
            update: (table, values, column, value) =>
                client.from(table).update(values).eq(column, value),
            remove: (table, column, value) =>
                client.from(table).delete().eq(column, value),
            upsert: (table, payload, options) =>
                client.from(table).upsert(payload, options || {}),
            updateWhere: (table, values, filters) => {
                let query = client.from(table).update(values);
                (filters || []).forEach(filter => {
                    query = filter.op === 'in'
                        ? query.in(filter.column, filter.value)
                        : filter.op === 'neq'
                            ? query.neq(filter.column, filter.value)
                            : query.eq(filter.column, filter.value);
                });
                return query;
            },
            removeWhere: (table, filters) => {
                let query = client.from(table).delete();
                (filters || []).forEach(filter => {
                    query = filter.op === 'in'
                        ? query.in(filter.column, filter.value)
                        : filter.op === 'neq'
                            ? query.neq(filter.column, filter.value)
                            : query.eq(filter.column, filter.value);
                });
                return query;
            },
        };

        async function list(table, select, options) {
            const opts = options || {};
            const pageSize = opts.pageSize || 1000;
            const orderBy = opts.orderBy || 'id';
            const ascending = opts.ascending !== false;
            const thenOrderBy = opts.thenOrderBy || null;
            const thenAscending = opts.thenAscending !== false;
            let offset = 0;
            const rows = [];

            while (true) {
                let query = client
                    .from(table)
                    .select(select || '*')
                if (opts.gte) query = query.gte(opts.gte.column, opts.gte.value);
                if (opts.lte) query = query.lte(opts.lte.column, opts.lte.value);
                let ordered = query.order(orderBy, { ascending });
                if (thenOrderBy) ordered = ordered.order(thenOrderBy, { ascending: thenAscending });
                const result = await ordered.range(offset, offset + pageSize - 1);

                if (result.error) throw result.error;
                const page = result.data || [];
                rows.push(...page);
                if (page.length < pageSize) break;
                offset += pageSize;
            }

            return rows;
        }

        async function one(table, select, filters) {
            let query = client.from(table).select(select || '*');
            (filters || []).forEach(filter => {
                query = filter.op === 'in'
                    ? query.in(filter.column, filter.value)
                    : query.eq(filter.column, filter.value);
            });
            const result = await query.maybeSingle();
            if (result.error) throw result.error;
            return result.data || null;
        }

        async function probe(table, select) {
            const result = await client.from(table).select(select || '*').limit(1);
            if (result.error) throw result.error;
            return result.data || [];
        }

        async function rpc(functionName, params) {
            const result = await client.rpc(functionName, params || {});
            if (result.error) throw result.error;
            return result.data;
        }

        return {
            writes,
            rows: (table, select, options) => list(table, select, options),
            one,
            probe,
            rpc,
            master: {
                vendor: () => list('vendor', '*'),
                brand: () => list('brand', '*'),
                model: () => list('model', '*, brand:brand_id(nama)'),
                warna: () => list('warna', '*'),
                ukuran: () => list('ukuran', '*'),
                pengaturan: () => list('pengaturan', '*', { orderBy: 'key' }),
            },
            inventory: {
                headers: () => list('riwayat_input', 'id,mode,brand,model,keterangan,tanggal,jam'),
                items: () => list('riwayat_input_item', 'id,riwayat_input_id,warna,ukuran,qty'),
            },
            transactions: {
                headers: () => list('transaksi', 'id,vendor,brand,model,harga,harga_modal,status,tanggal,jam,order_code'),
                items: () => list('transaksi_item', 'id,transaksi_id,warna,ukuran,qty,ssk'),
            },
            payments: {
                settlements: () => list('pelunasan', 'id,transaksi_id,vendor,jumlah,keterangan,tanggal,jam', { ascending: false }),
                partial: () => list('bayar_sebagian', 'id,vendor,jumlah_bayar,total_tagihan,sisa,keterangan,tanggal,jam', { ascending: false }),
            },
            expenses: {
                list: (select, range) => list('beban_operasional', select || 'id,kategori,nominal,tanggal,keterangan,sumber', {
                    gte: range && range.from ? { column: 'tanggal', value: range.from } : null,
                    lte: range && range.to ? { column: 'tanggal', value: range.to } : null,
                    orderBy: 'tanggal',
                    ascending: false,
                    thenOrderBy: 'id',
                    thenAscending: false
                }),
            },
        };
    }

    global.RPDataRepository = { create };
})(window);
