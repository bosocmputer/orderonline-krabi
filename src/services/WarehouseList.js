// services/WarehouseList.js
import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default {
    /**
     * ดึงรายการหมวดหมู่ทั้งหมด
     * @returns {Promise} รายการหมวดหมู่
     */
    getWarehouseList() {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('/getWarehouseList')
                .then((response) => {
                    // ตรวจสอบว่าข้อมูลมีโครงสร้างที่ถูกต้อง
                    const warehouses = response.data;

                    const enhancedWarehouses = {
                        data: [
                            // แปลงข้อมูลจาก API เพื่อให้ตรงกับโครงสร้างที่ต้องการ
                            ...warehouses.data.map((warehouse) => ({
                                code: warehouse.warehouseCode || warehouse.code,
                                name: warehouse.warehouseName || warehouse.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedWarehouses);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    }
};
