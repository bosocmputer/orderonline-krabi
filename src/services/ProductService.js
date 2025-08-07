// services/ProductService.js
import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default {
    /**
     * ดึงรายการสินค้าทั้งหมด
     * @param {Object} filters - ตัวกรองต่างๆ (หมวดหมู่, การค้นหา)
     * @param {Number} page - หน้าที่ต้องการดึงข้อมูล
     * @returns {Promise} รายการสินค้าที่กรองแล้ว
     */
    getProducts(filters = {}, page = 0) {
        const offset = page * 50; // แต่ละหน้ามี 10 รายการ
        const category = filters.category || '';
        const search = filters.search || '';
        const custCode = localStorage.getItem('_userCode') || '';
        const favorite = filters.favorite !== undefined ? filters.favorite : 0;

        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('service/wawashopservice/getProductList', {
                    params: {
                        cust_code: custCode || '',
                        search: search,
                        category: category,
                        offset: offset,
                        premium: 0, // สินค้าทั่วไป
                        limit: 50,
                        favorite: favorite
                    }
                })
                .then((response) => {
                    // ตรวจสอบว่าข้อมูลมีรูปแบบที่ถูกต้อง
                    if (response.data && response.data.data && Array.isArray(response.data.data)) {
                        // เพิ่มข้อมูลเพิ่มเติมให้กับสินค้าแต่ละรายการ
                        const enhancedData = response.data.data.map((product) => {
                            return {
                                ...product,
                                // ใช้ API สำหรับดึงรูปภาพสินค้า
                                image: this.getProductImageUrl(product.item_code),
                                // สำรองรูปภาพ (เผื่อต้องใช้เป็น fallback)
                                imageFallback: this.getPlaceholderImage(),
                                // ถ้า API ไม่ส่งราคามา ให้กำหนดเป็น 0
                                price: product.price || 0,
                                // ถ้า API ไม่ส่งหมวดหมู่มา ให้กำหนดเป็นค่าว่าง
                                category: product.category || ''
                            };
                        });

                        const result = {
                            pagination: response.data.pagination,
                            data: enhancedData,
                            success: response.data.success
                        };

                        resolve(result);
                    } else {
                        console.error('รูปแบบข้อมูล API ไม่ถูกต้อง:', response.data);
                        reject(new Error('รูปแบบข้อมูลไม่ถูกต้อง'));
                    }
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    /**
     * ดึงข้อมูลสินค้าตามรหัสสินค้า
     * @param {string} itemCode - รหัสสินค้า
     * @returns {Promise} ข้อมูลสินค้า
     */
    getProductByItemCode(itemCode) {
        const custCode = localStorage.getItem('_userCode') || '';

        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API
            apiClient
                .get('service/wawashopservice/getProductDetail', {
                    params: {
                        cust_code: custCode || '',
                        item_code: itemCode
                    }
                })
                .then((response) => {
                    if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
                        // สินค้า 1 รายการอาจมีหลายหน่วย (unit) ให้เลือกตัวแรกเป็นค่าเริ่มต้น
                        const primaryProduct = response.data.data[0];
                        const otherUnits = response.data.data.slice(1);

                        // เพิ่มข้อมูลเพิ่มเติม
                        const enhancedProduct = {
                            ...primaryProduct,
                            image: this.getProductImageUrl(primaryProduct.item_code),
                            imageFallback: this.getPlaceholderImage(),
                            category: primaryProduct.category || '',
                            description: `รหัสสินค้า: ${primaryProduct.item_code}\nบาร์โค้ด: ${primaryProduct.barcode || 'ไม่ระบุ'}\nหน่วย: ${primaryProduct.unit_code || 'ไม่ระบุ'}`,
                            otherUnits: otherUnits,
                            // แปลงข้อมูลให้ตรงกับที่ ProductDetail.vue ใช้
                            id: primaryProduct.item_code,
                            name: primaryProduct.item_name,
                            inventoryStatus: primaryProduct.sold_out === '1' ? 'OUTOFSTOCK' : 'INSTOCK',
                            code: primaryProduct.item_code,
                            specifications: [
                                { name: 'บาร์โค้ด', value: primaryProduct.barcode || 'ไม่ระบุ' },
                                { name: 'หน่วย', value: primaryProduct.unit_code || 'ไม่ระบุ' },
                                { name: 'คงเหลือ', value: parseFloat(primaryProduct.balance_qty).toFixed(2) + ' ' + primaryProduct.unit_code }
                            ]
                        };

                        resolve({ data: enhancedProduct });
                    } else {
                        reject({ error: 'ไม่พบสินค้า' });
                    }
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    /**
     * สร้าง URL รูปภาพสินค้าจาก API
     * @param {string} itemCode - รหัสสินค้า
     * @returns {string} URL รูปภาพสินค้า
     */
    getProductImageUrl(itemCode) {
        // ใช้ endpoint สำหรับดึงรูปภาพสินค้า
        const baseUrl = import.meta.env.VITE_APP_API.endsWith('/') ? import.meta.env.VITE_APP_API.slice(0, -1) : import.meta.env.VITE_APP_API;

        return `${baseUrl}/service/wawashopservice/images?item_code=${itemCode}`;
    },

    /**
     * สร้าง URL รูปภาพตัวอย่างสำหรับสินค้าที่ไม่มีรูปภาพ
     * @returns {string} URL รูปภาพตัวอย่าง
     */
    getPlaceholderImage() {
        // ใช้รูปภาพ No Image Available จาก URL ที่กำหนด
        return 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
    },

    /**
     * อัพเดตสถานะรายการโปรด (ถูกใจ) ของสินค้า
     * @param {string} itemCode - รหัสสินค้า
     * @param {string|number} status - สถานะการถูกใจ (0=ไม่ถูกใจ, 1=ถูกใจ)
     * @returns {Promise} ผลลัพธ์การอัพเดตสถานะ
     */
    updateFavoriteStatus(itemCode, status) {
        const custCode = localStorage.getItem('_userCode') || '';

        if (!custCode) {
            return Promise.reject(new Error('ไม่พบรหัสลูกค้า กรุณาเข้าสู่ระบบ'));
        }

        return new Promise((resolve, reject) => {
            apiClient
                .get('service/wawashopservice/setfav', {
                    params: {
                        status: status === '1' ? 1 : 0,
                        cust_code: custCode,
                        item_code: itemCode
                    }
                })
                .then((response) => {
                    if (response.data && response.data.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error('ไม่สามารถอัพเดตสถานะรายการโปรดได้'));
                    }
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    getProductBalancePrice(custCode, itemCode, unitCode) {
        return apiClient.get('service/wawashopservice/getProductBalancePrice', {
            params: {
                cust_code: custCode,
                item_code: itemCode,
                unit_code: unitCode
            }
        });
    }
};
