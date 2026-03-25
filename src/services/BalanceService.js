// services/BalanceService.js
import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default {
    /**
     * ดึงรายการสินค้าคงเหลือ พร้อม filter + pagination + sort
     */
    getBalanceList(params = {}) {
        return apiClient.get('/getBalanceList', {
            params: {
                cust_code: params.custCode || '',
                search: params.search || '',
                warehouse: params.warehouse || '',
                shelf_from: params.shelfFrom || '',
                shelf_to: params.shelfTo || '',
                groupsub: params.groupSub || '',
                groupsub2: params.groupSub2 || '',
                brand: params.brand || '',
                model: params.model || '',
                category2: params.category || '',
                format: params.format || '',
                sort: params.sort || 'asc',
                sort_col: params.sortCol || '',
                offset: params.offset || 0,
                limit: params.limit || 30
            }
        });
    },

    /**
     * ดึงรายการสินค้าคงเหลือ (Lite) — ไม่ query ราคา/stock หนัก → เร็ว
     */
    getBalanceListLite(params = {}) {
        return apiClient.get('/getBalanceListLite', {
            params: {
                search: params.search || '',
                warehouse: params.warehouse || '',
                shelf_from: params.shelfFrom || '',
                shelf_to: params.shelfTo || '',
                groupsub: params.groupSub || '',
                groupsub2: params.groupSub2 || '',
                brand: params.brand || '',
                model: params.model || '',
                category2: params.category || '',
                format: params.format || '',
                sort: params.sort || 'asc',
                sort_col: params.sortCol || '',
                offset: params.offset || 0,
                limit: params.limit || 30,
                stockfilter: params.stockfilter || 'all'
            }
        });
    },

    /**
     * Lazy load stock แยกปีนี้/ปีอื่น — เรียก function ครั้งเดียวด้วย item_codes ทั้งหมด
     */
    getBalanceStockBatch(itemCodes, warehouse = '', shelfList = '') {
        return apiClient.get('/getBalanceStockBatch', {
            params: {
                item_codes: itemCodes,
                warehouse: warehouse,
                shelf_list: shelfList
            }
        });
    },

    /**
     * Lazy load ราคา + stock สำหรับ item_codes batch
     */
    getBalanceItemPriceBatch(itemCodes, custCode = '', warehouse = '', shelfList = '') {
        return apiClient.get('/getBalanceItemPriceBatch', {
            params: {
                item_codes: itemCodes,
                cust_code: custCode,
                warehouse: warehouse,
                shelf_list: shelfList
            }
        });
    },    /**
     * ดึงรายละเอียดคลัง/ที่เก็บของสินค้า
     */
    getBalanceDetail(itemCode, shelfList = '', warehouse = '') {
        return apiClient.get('/getBalanceDetail', {
            params: {
                item_code: itemCode,
                shelf_list: shelfList,
                warehouse: warehouse
            }
        });
    },

    /**
     * Lazy load ราคาสำหรับ detail row (expansion) — per item_code + location
     */
    getBalanceDetailPrice(itemCode, location = '', unitCode = '', custCode = '', saleType = '1') {
        return apiClient.get('/getBalanceDetailPrice', {
            params: {
                item_code: itemCode,
                location: location,
                unit_code: unitCode,
                cust_code: custCode,
                sale_type: saleType
            }
        });
    },

    /**
     * ดึงรายการคลังสินค้า
     */
    getSearchWarehouseList() {
        return apiClient.get('/getSearchWarehouseList');
    },

    /**
     * ดึงรายการที่เก็บ
     */
    getSearchShelfList() {
        return apiClient.get('/getSearchShelfList');
    },

    /**
     * ดึงรายการกลุ่มย่อย 1
     */
    getSearchGroupSubList() {
        return apiClient.get('/getSearchGroupSubList');
    },

    /**
     * ดึงรายการกลุ่มย่อย 2
     */
    getSearchGroupSub2List() {
        return apiClient.get('/getSearchGroupSub2List');
    },

    /**
     * ดึงรายการยี่ห้อ
     */
    getSearchBrandList() {
        return apiClient.get('/getSearchBrandList');
    },

    /**
     * ดึงรายการรุ่น
     */
    getSearchModelList() {
        return apiClient.get('/getSearchModelList');
    },

    /**
     * ดึงรายการหมวดหมู่
     */
    getSearchCategoryList() {
        return apiClient.get('/getSearchCategoryList');
    },

    /**
     * ดึงรายการลาย
     */
    getSearchFormatList() {
        return apiClient.get('/getSearchFormatList');
    }
};
