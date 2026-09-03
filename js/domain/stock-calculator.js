/* Radja Production - stock domain
 *
 * Pure calculations only. The caller supplies a snapshot shaped like:
 * { masterData: { brand: [] }, appData: { riwayatInput: [], riwayatTransaksi: [] } }
 * No DOM, Supabase, localStorage, or global application state is used here.
 */
(function (global) {
    'use strict';

    function normalize(value) {
        return String(value == null ? '' : value).trim().toUpperCase();
    }

    function create(snapshot) {
        const masterData = snapshot.masterData || {};
        const appData = snapshot.appData || {};
        const brands = masterData.brand || [];
        const inputs = appData.riwayatInput || [];
        const transactions = appData.riwayatTransaksi || [];
        const brandNameToId = new Map(
            brands.map(brand => [normalize(brand.nama), brand.id])
        );

        function brandMatches(record, brandName, brandId) {
            if (!brandName && !brandId) return true;
            const recordBrand = normalize(record.brand);
            if (brandId) return brandNameToId.get(recordBrand) == brandId;
            const requestedId = brandNameToId.get(brandName);
            return requestedId == null
                ? recordBrand === brandName
                : brandNameToId.get(recordBrand) == requestedId;
        }

        function variantKey(model, warna, ukuran) {
            return normalize(model) + '||' + normalize(warna) + '||' + normalize(ukuran);
        }

        function applyRecords(map, records, brandName, brandId, sign) {
            records.forEach(record => {
                if (!brandMatches(record, brandName, brandId)) return;
                (record.items || []).forEach(item => {
                    const key = variantKey(record.model, item.warna, item.ukuran);
                    map[key] = (map[key] || 0) + sign(item, record);
                });
            });
        }

        function item(modelName, warnaName, ukuranName, brandName, brandId) {
            const key = variantKey(modelName, warnaName, ukuranName);
            const result = {};
            applyRecords(result, inputs, normalize(brandName), brandId, (row, record) =>
                record.mode === 'retur' ? -Number(row.qty || 0) : Number(row.qty || 0)
            );
            applyRecords(result, transactions, normalize(brandName), brandId, row =>
                -Number(row.qty || 0)
            );
            return result[key] || 0;
        }

        function brand(brandId) {
            const result = {};
            applyRecords(result, inputs, '', brandId, (row, record) =>
                record.mode === 'retur' ? -Number(row.qty || 0) : Number(row.qty || 0)
            );
            applyRecords(result, transactions, '', brandId, row =>
                -Number(row.qty || 0)
            );
            return result;
        }

        function allBrands() {
            const stockByBrand = new Map();
            const modelsByBrand = new Map();

            function addRecord(record, amount, countModel) {
                const brandId = brandNameToId.get(normalize(record.brand));
                if (brandId == null) return;
                if (!stockByBrand.has(brandId)) stockByBrand.set(brandId, {});
                if (countModel) {
                    if (!modelsByBrand.has(brandId)) modelsByBrand.set(brandId, new Set());
                    if (record.model) modelsByBrand.get(brandId).add(normalize(record.model));
                }

                const map = stockByBrand.get(brandId);
                (record.items || []).forEach(row => {
                    const key = variantKey(record.model, row.warna, row.ukuran);
                    map[key] = (map[key] || 0) + amount(row, record);
                });
            }

            inputs.forEach(record => addRecord(record, (row, record) =>
                record.mode === 'retur' ? -Number(row.qty || 0) : Number(row.qty || 0)
            , true));
            transactions.forEach(record => addRecord(record, row =>
                -Number(row.qty || 0)
            , false));

            return brands.map(currentBrand => {
                const stock = stockByBrand.get(currentBrand.id) || {};
                return {
                    ...currentBrand,
                    total: Object.values(stock).reduce((sum, value) => sum + value, 0),
                    modelCount: (modelsByBrand.get(currentBrand.id) || new Set()).size,
                };
            });
        }

        return { item, brand, allBrands };
    }

    global.RPStockCalculator = { create };
})(window);
