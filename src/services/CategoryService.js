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
                .get('/getCategoryList')
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
    },

    // ดึงรายการกลุ่มทั
    getGroup(search) {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('/getGroup?search=' + search)
                .then((response) => {
                    const groups = response.data;

                    const enhancedData = {
                        data: [
                            {
                                code: 'all',
                                name: 'ทั้งหมด'
                            },
                            ...groups.data.map((item) => ({
                                code: item.code,
                                name: item.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedData);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    // ดึงรายการกลุ่มย่อย
    getGroupSub(search) {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('/getGroupSub?search=' + search)
                .then((response) => {
                    const items = response.data;

                    const enhancedData = {
                        data: [
                            {
                                code: 'all',
                                name: 'ทั้งหมด'
                            },
                            ...items.data.map((item) => ({
                                code: item.code,
                                name: item.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedData);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    // ดึงรายการกลุ่มย่อย2
    getGroupSub2(search) {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('/getGroupSub2?search=' + search)
                .then((response) => {
                    const items = response.data;

                    const enhancedData = {
                        data: [
                            {
                                code: 'all',
                                name: 'ทั้งหมด'
                            },
                            ...items.data.map((item) => ({
                                code: item.code,
                                name: item.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedData);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    // ดึงรายการยี่ห้อ
    getBrand(search) {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('/getBrand?search=' + search)
                .then((response) => {
                    const items = response.data;

                    const enhancedData = {
                        data: [
                            {
                                code: 'all',
                                name: 'ทั้งหมด'
                            },
                            ...items.data.map((item) => ({
                                code: item.code,
                                name: item.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedData);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    // ดึงรายการหมวดหมู่
    getCategory(search) {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('/getCategory?search=' + search)
                .then((response) => {
                    const items = response.data;

                    const enhancedData = {
                        data: [
                            {
                                code: 'all',
                                name: 'ทั้งหมด'
                            },
                            ...items.data.map((item) => ({
                                code: item.code,
                                name: item.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedData);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    // ดึงรายการรูปทรง
    getDesign(search) {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('/getDesign?search=' + search)
                .then((response) => {
                    const items = response.data;

                    const enhancedData = {
                        data: [
                            {
                                code: 'all',
                                name: 'ทั้งหมด'
                            },
                            ...items.data.map((item) => ({
                                code: item.code,
                                name: item.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedData);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },

    // ดึงรายการรุ่น
    getModel(search) {
        return new Promise((resolve, reject) => {
            // เรียกใช้งาน API จริง
            apiClient
                .get('/getModel?search=' + search)
                .then((response) => {
                    const items = response.data;

                    const enhancedData = {
                        data: [
                            {
                                code: 'all',
                                name: 'ทั้งหมด'
                            },
                            ...items.data.map((item) => ({
                                code: item.code,
                                name: item.name
                            }))
                        ],
                        success: true
                    };
                    resolve(enhancedData);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API:', error);
                    reject(error);
                });
        });
    },


};
