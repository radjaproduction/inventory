/* Radja Production - repositories for external integrations */
(function (global) {
    'use strict';

    function create(client, tables) {
        if (!client) throw new Error('Supabase client belum tersedia.');
        const pesananTable = tables?.pesanan || 'produksi_orders';

        return {
            pesanan: {
                setPaymentStatus: (orderCode, status) =>
                    client.from(pesananTable).update({ status_bayar: status }).eq('order_code', orderCode),
                confirm: (orderCode) =>
                    client.from(pesananTable).update({ stage: 1 }).eq('order_code', orderCode).select('id'),
                markPrepared: (orderCode) =>
                    client.from(pesananTable).update({ disiapkan_selesai: true }).eq('order_code', orderCode),
                listWaiting: () =>
                    client.from(pesananTable).select('id, order_code').eq('stage', 0),
                listWaitingWithStage: () =>
                    client.from(pesananTable).select('id, order_code, stage').eq('stage', 0),
                updateItems: (orderCode, items) =>
                    client.from(pesananTable).update({ items }).eq('order_code', orderCode),
            },
            fcm: {
                upsertToken: (payload) =>
                    client.from('fcm_tokens').upsert(payload, { onConflict: 'token' }),
            },
        };
    }

    global.RPExternalRepository = { create };
})(window);
