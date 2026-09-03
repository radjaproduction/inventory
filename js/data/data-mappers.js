/* Radja Production - database row -> application state mappers */
(function (global) {
    'use strict';

    function mapMasterData(target, rows) {
        target.vendor = (rows.vendor || []).map(x => ({
            id: x.id, nama: x.nama, telp: x.telp || ''
        }));
        target.brand = (rows.brand || []).map(x => ({
            id: x.id, nama: x.nama
        }));
        target.model = (rows.model || []).map(x => ({
            id: x.id,
            brandId: x.brand_id,
            brandNama: x.brand?.nama || x.brand_nama || '',
            nama: x.nama,
            harga: x.harga || 0,
            hargaModal: x.harga_modal || 0
        }));
        target.warna = (rows.warna || []).map(x => ({
            id: x.id, nama: x.nama, kode: x.kode
        }));
        target.ukuran = (rows.ukuran || []).map(x => ({
            id: x.id, nama: x.nama
        }));
        return target;
    }

    function mapInputHistory(headers, items) {
        const itemsByHeader = groupBy(items, 'riwayat_input_id');
        return [...(headers || [])]
            .sort((a, b) => b.id - a.id)
            .map(row => ({
                id: row.id,
                mode: row.mode,
                brand: row.brand,
                model: row.model,
                keterangan: row.keterangan || '',
                tanggal: row.tanggal,
                jam: row.jam,
                items: (itemsByHeader[row.id] || []).map(item => ({
                    id: item.id,
                    warna: item.warna,
                    ukuran: item.ukuran,
                    qty: item.qty
                }))
            }));
    }

    function mapTransactions(headers, items) {
        const itemsByHeader = groupBy(items, 'transaksi_id');
        return [...(headers || [])]
            .sort((a, b) => b.id - a.id)
            .map(row => ({
                id: row.id,
                vendor: row.vendor,
                brand: row.brand,
                model: row.model,
                harga: row.harga || 0,
                hargaModal: row.harga_modal || 0,
                status: row.status,
                orderCode: row.order_code || null,
                tanggal: row.tanggal,
                jam: row.jam,
                items: (itemsByHeader[row.id] || []).map(item => ({
                    id: item.id,
                    warna: item.warna,
                    ukuran: item.ukuran,
                    qty: item.qty,
                    ssk: item.ssk
                }))
            }));
    }

    function mapSettlements(rows) {
        return [...(rows || [])].sort((a, b) => b.id - a.id).map(row => ({
            id: row.id,
            transaksi_id: row.transaksi_id,
            vendor: row.vendor,
            jumlah: row.jumlah || 0,
            keterangan: row.keterangan || '',
            tanggal: row.tanggal,
            jam: row.jam
        }));
    }

    function mapPartialPayments(rows) {
        return [...(rows || [])].sort((a, b) => b.id - a.id).map(row => ({
            id: row.id,
            vendor: row.vendor,
            jumlah_bayar: row.jumlah_bayar || 0,
            total_tagihan: row.total_tagihan || 0,
            sisa: row.sisa || 0,
            keterangan: row.keterangan || '',
            tanggal: row.tanggal,
            jam: row.jam
        }));
    }

    function groupBy(rows, key) {
        return (rows || []).reduce((groups, row) => {
            const group = groups[row[key]] || (groups[row[key]] = []);
            group.push(row);
            return groups;
        }, {});
    }

    global.RPDataMappers = {
        mapMasterData,
        mapInputHistory,
        mapTransactions,
        mapSettlements,
        mapPartialPayments
    };
})(window);
