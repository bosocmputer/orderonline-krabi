// services/CategoryService.js
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
    getCategories() {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('service/wawashopservice/getCategoryList')
                .then((response) => {
                    // ตรวจสอบว่าข้อมูลมีโครงสร้างที่ถูกต้อง
                    const categories = response.data;

                    // เพิ่มหมวดหมู่ "ทั้งหมด" เป็นรายการแรก
                    const enhancedCategories = {
                        data: [
                            {
                                code: 'all',
                                name: 'ทั้งหมด'
                            },
                            // แปลงข้อมูลจาก API เพื่อให้ตรงกับโครงสร้างที่ต้องการ
                            ...categories.data.map((category) => ({
                                code: category.categoryCode || category.code,
                                name: category.categoryName || category.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedCategories);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    }
};
