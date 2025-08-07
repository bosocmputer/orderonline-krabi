// services/CustomerService.js
import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API || 'http://43.229.149.11:8998/WawaShopService',
    headers: {
        'Content-Type': 'application/json'
    }
});

export default {
    /**
     * ดึงรายการลูกค้าตามคำค้นหา
     * @param {string} search คำค้นหา (ชื่อหรือรหัสลูกค้า)
     * @param {number} limit จำนวนรายการสูงสุดที่ต้องการ (ค่าเริ่มต้น: ไม่จำกัด)
     * @returns {Promise} รายการลูกค้าที่ตรงกับคำค้นหา
     */
    getCustomers(search = '', limit = null) {
        return new Promise((resolve, reject) => {
            // แสดง URL ที่กำลังเรียก
            console.log(`กำลังเรียก API: ${apiClient.defaults.baseURL}/service/wawashopservice/getCustomerList?search=${encodeURIComponent(search)}`);
            console.log('ค่าพารามิเตอร์ search ที่ส่งไป:', search);

            apiClient
                .get('service/wawashopservice/getCustomerList', {
                    params: {
                        search: search
                    }
                })
                .then((response) => {
                    console.log('Response จาก API:', response);
                    // เพิ่ม log เพื่อดูโครงสร้างข้อมูลที่ API ส่งกลับมา
                    let results = [];

                    if (response.data && Array.isArray(response.data)) {
                        results = response.data;
                    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
                        // บางครั้ง API อาจส่งข้อมูลมาในรูปแบบ { data: [...] }
                        results = response.data.data;
                    } else {
                        console.warn('รูปแบบข้อมูลไม่ตรงตามที่คาดหวัง:', response.data);
                        results = [];
                    }

                    // จำกัดจำนวนผลลัพธ์ถ้ามีการระบุ limit
                    if (limit && Number(limit) > 0 && results.length > Number(limit)) {
                        results = results.slice(0, Number(limit));
                    }

                    resolve(results);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API ค้นหาลูกค้า:', error);
                    reject(error);
                });
        });
    },

    /**
     * ดึงข้อมูลลูกค้าตามรหัสลูกค้า
     * @param {string} code รหัสลูกค้า
     * @returns {Promise} ข้อมูลลูกค้า
     */
    getCustomerByCode(code) {
        return new Promise((resolve, reject) => {
            apiClient
                .get('service/wawashopservice/getCustomerList', {
                    params: {
                        code: code
                    }
                })
                .then((response) => {
                    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                        resolve(response.data[0]);
                    } else {
                        reject(new Error('ไม่พบข้อมูลลูกค้า'));
                    }
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API ดึงข้อมูลลูกค้า:', error);
                    reject(error);
                });
        });
    }
};
