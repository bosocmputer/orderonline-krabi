<script setup>
import OrderHistoryService from '@/services/OrderHistoryService';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import QRCode from 'qrcode';

import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const orders = ref([]);
const loading = ref(true);
const error = ref(null);
const selectedOrder = ref(null);
const selectedOrderDetails = ref(null);
const displayOrderDetails = ref(false);
const loadingDetails = ref(false);

// QR Payment
const showQrPaymentDialog = ref(false);
const qrPaymentLoading = ref(false);
const qrCodeUrl = ref('');
const selectedOrdersForPayment = ref([]);
const paymentAmount = ref(0);
const txnUid = ref('');
const paymentInterval = ref(null);
const paymentSuccess = ref(false);
const paymentProcessing = ref(false);
const txnData = ref(null);

// Payment timeout management
const paymentTimeoutDuration = ref(900000); // 15 นาที (900,000 ms)
const paymentStartTime = ref(null);
const paymentTimeRemaining = ref(0);
const paymentTimeoutId = ref(null);
const timeUpdateInterval = ref(null);

// Multi-select variables
const multiSelectMode = ref(false);
const selectedOrders = ref([]);

// ตรวจสอบการตั้งค่า QR Code API
const isQRPaymentEnabled = computed(() => {
    const qrApiUrl = import.meta.env.VITE_QR_API_URL;
    const qrApiKey = import.meta.env.VITE_QR_API_KEY;
    return qrApiUrl && qrApiUrl.trim() !== '' && qrApiKey && qrApiKey.trim() !== '';
});

// สถานะของออเดอร์และสีที่ใช้แสดง
const orderStatuses = {
    success: { label: 'สำเร็จ', color: 'success', icon: 'pi pi-check-circle' },
    partial: { label: 'ชำระแล้วบางส่วน', color: 'info', icon: 'pi pi-credit-card' },
    payment: { label: 'กำลังจัดส่ง / รอรับชำระ', color: 'primary', icon: 'pi pi-send' },
    packing: { label: 'กำลังจัดสินค้า', color: 'primary', icon: 'pi pi-sync' },
    cancel: { label: 'ยกเลิก / ติดต่อพนักงาน', color: 'danger', icon: 'pi pi-times-circle' },
    pending: { label: 'รอตรวจสอบ', color: 'warning', icon: 'pi pi-clock' }
};

// เพิ่มตัวแปรเพื่อเก็บขนาดหน้าจอปัจจุบัน
const windowWidth = ref(window.innerWidth);

// ฟังก์ชันอัพเดทขนาดหน้าจอ
const updateWidth = () => {
    windowWidth.value = window.innerWidth;
};

// เพิ่ม event listener เมื่อโหลดคอมโพเนนต์
onMounted(() => {
    window.addEventListener('resize', updateWidth);
    updateWidth(); // เรียกครั้งแรกเพื่อตั้งค่าเริ่มต้น
});

// ลบ event listener เมื่อคอมโพเนนต์ถูกทำลาย
onUnmounted(() => {
    window.removeEventListener('resize', updateWidth);

    // ล้างทุก timer เมื่อออกจากหน้านี้
    if (paymentInterval.value) {
        clearInterval(paymentInterval.value);
        paymentInterval.value = null;
    }

    if (paymentTimeoutId.value) {
        clearTimeout(paymentTimeoutId.value);
        paymentTimeoutId.value = null;
    }

    if (timeUpdateInterval.value) {
        clearInterval(timeUpdateInterval.value);
        timeUpdateInterval.value = null;
    }
});

// กรองออเดอร์
const filters = reactive({
    // ตั้งค่าเริ่มต้นเป็น payment
    status: 'payment',
    dateRange: null,
    searchTerm: ''
});

// ดึงข้อมูลประวัติการสั่งซื้อจาก API
async function fetchOrderHistory() {
    try {
        loading.value = true;
        error.value = null;

        const userData = localStorage.getItem('_userData');
        if (!userData) {
            router.push('/auth/login');
            return;
        }

        const userObj = JSON.parse(userData);
        const custCode = userObj.user_code;

        if (!custCode) {
            error.value = 'ไม่พบข้อมูลลูกค้า';
            return;
        }

        // ส่งค่า status เป็น 'payment' เสมอ
        const response = await OrderHistoryService.getOrderHistory(custCode, 'payment');

        if (response?.data?.success) {
            orders.value = response.data.data || [];
        } else {
            error.value = 'ไม่สามารถดึงข้อมูลสถานะการจัดส่งได้';
        }
    } catch (err) {
        console.error('Error fetching shipping status:', err);
        error.value = 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะการจัดส่ง';
    } finally {
        loading.value = false;
    }
}

// ดึงรายละเอียดของคำสั่งซื้อ
async function fetchOrderDetails(docNo) {
    try {
        loadingDetails.value = true;
        const userData = localStorage.getItem('_userData');
        if (!userData) {
            return false;
        }

        const userObj = JSON.parse(userData);
        const custCode = userObj.user_code;

        const response = await OrderHistoryService.getOrderDetail(custCode, docNo);

        if (response?.data?.success) {
            // เก็บข้อมูลทั้งหมดของออเดอร์ลงใน selectedOrder
            selectedOrder.value = {
                ...selectedOrder.value,
                ...response.data.data
            };

            // เก็บเฉพาะรายการสินค้าลงใน selectedOrderDetails
            selectedOrderDetails.value = response.data.data.items || [];
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error fetching order details:', err);
        return false;
    } finally {
        loadingDetails.value = false;
    }
}

// แสดงรายละเอียดออเดอร์
async function showOrderDetails(order) {
    selectedOrder.value = order;
    displayOrderDetails.value = true;
    selectedOrderDetails.value = null;

    const success = await fetchOrderDetails(order.doc_no);
    if (!success) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถดึงรายละเอียดคำสั่งซื้อได้',
            life: 3000
        });
    }
}

// ฟังก์ชันแปลงวันที่
function formatDate(dateStr, timeStr) {
    if (!dateStr) return '';

    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    const date = new Date(year, month, day);

    const thaiDate = date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return timeStr ? `${thaiDate} ${timeStr} น.` : thaiDate;
}

// ฟอร์แมตตัวเลขเป็นรูปแบบเงินบาท
function formatCurrency(value) {
    if (value === undefined || value === null) return '0.00';
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(parseFloat(value));
}

// ฟังก์ชันเมื่อมีการเปลี่ยนแปลงสถานะกรอง - ในหน้านี้จะไม่ใช้เนื่องจากเราแสดงเฉพาะ status = payment เท่านั้น

// ออเดอร์ที่ผ่านการกรอง
const filteredOrders = computed(() => {
    if (!orders.value) return [];

    return orders.value.filter((order) => {
        // กรองตามคำค้นหา
        if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            const docNoMatch = order.doc_no.toLowerCase().includes(searchLower);
            return docNoMatch;
        }

        // กรองตามช่วงวันที่
        if (filters.dateRange && filters.dateRange.length === 2) {
            const orderDate = new Date(order.doc_date).setHours(0, 0, 0, 0);
            const startDate = new Date(filters.dateRange[0]).setHours(0, 0, 0, 0);
            const endDate = new Date(filters.dateRange[1]).setHours(23, 59, 59, 999);

            if (orderDate < startDate || orderDate > endDate) {
                return false;
            }
        }

        return true;
    });
});

// รีเซ็ตการกรอง (ในหน้านี้เราจะรีเซ็ตเฉพาะ searchTerm และ dateRange)
function resetFilters() {
    filters.dateRange = null;
    filters.searchTerm = '';
    fetchOrderHistory();
}

// ฟังก์ชันสร้างรูปภาพ QR Code
async function generateQRImage(qrCodeData) {
    try {
        console.log('Generating QR code for data:', qrCodeData);

        // สร้าง QR code แบบ inline
        const url = await QRCode.toDataURL(qrCodeData, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 300,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        console.log('QR code generated successfully');
        return url;
    } catch (error) {
        console.error('Error generating QR code:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถสร้าง QR Code ได้: ' + error.message,
            life: 5000
        });
        return '';
    }
}

// ฟังก์ชันสำหรับสร้าง QR Code
async function generateQRCode() {
    qrPaymentLoading.value = true;
    paymentSuccess.value = false;

    try {
        // คำนวณยอดเงินรวมของเอกสารที่เลือก
        paymentAmount.value = selectedOrdersForPayment.value.reduce((sum, order) => {
            return sum + parseFloat(order.total_amount);
        }, 0);

        // สร้าง random references
        const ref1 = Math.random().toString(36).substring(2, 10);
        const ref2 = Math.random().toString(36).substring(2, 10);
        const ref3 = Math.random().toString(36).substring(2, 10);
        const ref4 = Math.random().toString(36).substring(2, 10);

        const response = await axios.post(
            import.meta.env.VITE_QR_API_URL,
            {
                amount: paymentAmount.value,
                ref1: ref1,
                ref2: ref2,
                ref3: ref3,
                ref4: ref4
            },
            {
                headers: {
                    'x-api-key': import.meta.env.VITE_QR_API_KEY
                }
            }
        );

        if (response.data && response.data.qrCode) {
            txnUid.value = response.data.txnUid;

            // Log the QR code data for debugging
            console.log('QR Code data received:', response.data.qrCode);

            // Generate QR code
            const qrImage = await generateQRImage(response.data.qrCode);
            if (!qrImage) {
                throw new Error('Failed to generate QR code image');
            }

            qrCodeUrl.value = qrImage;

            // เริ่มตรวจสอบสถานะการชำระเงิน
            startCheckPaymentStatus();
        } else {
            throw new Error('ไม่ได้รับข้อมูล QR Code จากเซิร์ฟเวอร์');
        }
    } catch (error) {
        console.error('Error generating QR code:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถสร้าง QR Code ได้',
            life: 3000
        });
    } finally {
        qrPaymentLoading.value = false;
    }
}

// ฟังก์ชันตรวจสอบสถานะการชำระเงิน
function startCheckPaymentStatus() {
    paymentProcessing.value = true;
    paymentStartTime.value = Date.now();
    paymentTimeRemaining.value = paymentTimeoutDuration.value;

    if (paymentInterval.value) {
        clearInterval(paymentInterval.value);
    }

    // Clear existing timeout and time update interval
    if (paymentTimeoutId.value) {
        clearTimeout(paymentTimeoutId.value);
    }
    if (timeUpdateInterval.value) {
        clearInterval(timeUpdateInterval.value);
    }

    // ตั้งเวลาหมดอายุ
    paymentTimeoutId.value = setTimeout(() => {
        handlePaymentTimeout();
    }, paymentTimeoutDuration.value);

    // อัพเดทเวลาที่เหลือ
    timeUpdateInterval.value = setInterval(() => {
        if (paymentStartTime.value) {
            const elapsed = Date.now() - paymentStartTime.value;
            paymentTimeRemaining.value = Math.max(0, paymentTimeoutDuration.value - elapsed);

            if (paymentTimeRemaining.value <= 0) {
                clearInterval(timeUpdateInterval.value);
                timeUpdateInterval.value = null;
            }
        }
    }, 1000);

    paymentInterval.value = setInterval(async () => {
        try {
            const status = await checkPaymentStatus();

            console.log('Current payment status:', status);

            if (status === 'PAID') {
                console.log('Payment completed, stopping status check');

                // ล้างทุก timer
                clearInterval(paymentInterval.value);
                clearTimeout(paymentTimeoutId.value);
                clearInterval(timeUpdateInterval.value);

                paymentInterval.value = null;
                paymentTimeoutId.value = null;
                timeUpdateInterval.value = null;

                // การชำระเงินสำเร็จ
                paymentSuccess.value = true;
                paymentProcessing.value = false;

                // บันทึกการชำระเงิน
                await savePaymentTransaction();

                // แสดงข้อความแจ้งเตือน
                toast.add({
                    severity: 'success',
                    summary: 'การชำระเงินสำเร็จ',
                    detail: 'ระบบได้รับการชำระเงินเรียบร้อยแล้ว',
                    life: 5000
                });

                // clear selected orders for payment
                selectedOrdersForPayment.value = [];
                multiSelectMode.value = false;
                selectedOrders.value = [];

                // โหลดข้อมูลประวัติการสั่งซื้อใหม่
                await fetchOrderHistory();
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
        }
    }, 5000); // ตรวจสอบทุก 5 วินาที
}

// ฟังก์ชันตรวจสอบสถานะการชำระเงิน
async function checkPaymentStatus() {
    try {
        const response = await axios.post(
            'https://kapiqr.smlsoft.com/qrapi/payment-status',
            {
                txnUid: txnUid.value
            },
            {
                headers: {
                    'x-api-key': import.meta.env.VITE_QR_API_KEY
                }
            }
        );

        if (response.data) {
            console.log('Payment check response:', response.data);
            txnData.value = response.data;
            return response.data.txnStatus || 'REQUESTED';
        }

        return 'REQUESTED';
    } catch (error) {
        console.error('Error checking payment status:', error);
        return 'ERROR';
    }
}

// ฟังก์ชันบันทึกข้อมูลการชำระเงิน
async function savePaymentTransaction() {
    try {
        // สร้าง doc_no
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 90000) + 10000;

        const docNo = `WRC${year}${month}${day}${hours}${minutes}-${random}`;
        const docDate = `${year}-${month}-${day}`;

        // สร้าง payment data
        const paymentData = {
            doc_no: docNo,
            cust_code: selectedOrdersForPayment.value[0].cust_code,
            doc_date: docDate,
            wallet_amount: paymentAmount.value,
            total_amount: paymentAmount.value,
            trans_number: txnData.value.txnuid,
            no_approved: txnData.value.txnNo || '',
            emp_code: selectedOrdersForPayment.value[0].emp_code || '',
            remark: '',
            doc_detail: selectedOrdersForPayment.value.map((order) => ({
                trans_flag: '44',
                doc_no: order.inv_doc_no,
                doc_date: order.inv_doc_date,
                total_amount: parseFloat(order.total_amount)
            }))
        };

        // ส่งข้อมูลไปยัง API
        const response = await OrderHistoryService.payOrder(paymentData);

        if (!response.data || !response.data.success) {
            throw new Error('ไม่สามารถบันทึกข้อมูลการชำระเงินได้');
        }
    } catch (error) {
        console.error('Error saving payment transaction:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถบันทึกข้อมูลการชำระเงินได้',
            life: 3000
        });
    }
}

// ฟังก์ชันแสดง dialog ชำระเงิน QR Code
function showQRPayment(orders) {
    // ตรวจสอบว่า QR Payment ใช้งานได้หรือไม่
    if (!isQRPaymentEnabled.value) {
        toast.add({
            severity: 'error',
            summary: 'ไม่สามารถใช้งานได้',
            detail: 'ระบบชำระเงิน QR Code ไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
            life: 5000
        });
        return;
    }

    if (!Array.isArray(orders)) {
        orders = [orders];
    }

    // ต้องการเฉพาะเอกสารที่สถานะ payment หรือ partial
    const validOrders = orders.filter((order) => order.status === 'payment' || order.status === 'partial');

    if (validOrders.length === 0) {
        toast.add({
            severity: 'error',
            summary: 'ไม่สามารถชำระเงินได้',
            detail: 'ไม่พบเอกสารที่สามารถชำระเงินได้',
            life: 3000
        });
        return;
    }

    selectedOrdersForPayment.value = validOrders;
    showQrPaymentDialog.value = true;
    generateQRCode();
}

// ฟังก์ชันยกเลิกการชำระเงิน
function cancelQRPayment() {
    // ล้างทุก timer
    if (paymentInterval.value) {
        clearInterval(paymentInterval.value);
        paymentInterval.value = null;
    }

    if (paymentTimeoutId.value) {
        clearTimeout(paymentTimeoutId.value);
        paymentTimeoutId.value = null;
    }

    if (timeUpdateInterval.value) {
        clearInterval(timeUpdateInterval.value);
        timeUpdateInterval.value = null;
    }

    // รีเซ็ตค่า
    paymentSuccess.value = false;
    paymentProcessing.value = false;
    paymentStartTime.value = null;
    paymentTimeRemaining.value = 0;
    showQrPaymentDialog.value = false;
    selectedOrdersForPayment.value = [];
}

// ฟังก์ชันเปิด/ปิดโหมดเลือกหลายรายการ
function toggleMultiSelectMode() {
    multiSelectMode.value = !multiSelectMode.value;
    // ล้างรายการที่เลือกเมื่อออกจากโหมดเลือกหลายรายการ
    if (!multiSelectMode.value) {
        selectedOrders.value = [];
    }
}

// ฟังก์ชันตรวจสอบว่าออเดอร์ถูกเลือกหรือไม่
function isOrderSelected(order) {
    return selectedOrders.value.some((o) => o.doc_no === order.doc_no);
}

// ฟังก์ชันเลือก/ยกเลิกการเลือกออเดอร์
function toggleOrderSelection(order) {
    if (isOrderSelected(order)) {
        selectedOrders.value = selectedOrders.value.filter((o) => o.doc_no !== order.doc_no);
    } else {
        selectedOrders.value.push(order);
    }
}

// เลือกทั้งหมดที่ชำระได้
function selectAllPayableOrders() {
    if (!filteredOrders.value) return;

    // เปลี่ยนเป็นเลือกเฉพาะสถานะ 'payment' (กำลังจัดส่ง/รอรับชำระ) และ 'partial' (ชำระแล้วบางส่วน)
    const payableOrders = filteredOrders.value.filter((order) => order.status === 'payment' || order.status === 'partial');

    // ถ้าได้เลือกทั้งหมดแล้ว ให้ยกเลิกการเลือกทั้งหมด
    if (selectedOrders.value.length === payableOrders.length) {
        selectedOrders.value = [];
    } else {
        selectedOrders.value = [...payableOrders];
    }
}

// ฟังก์ชันชำระเงินสำหรับออเดอร์ที่เลือก
function paySelectedOrders() {
    if (selectedOrders.value.length === 0) {
        toast.add({
            severity: 'error',
            summary: 'ไม่สามารถชำระเงินได้',
            detail: 'กรุณาเลือกรายการที่ต้องการชำระเงิน',
            life: 3000
        });
        return;
    }

    // ตรวจสอบว่ารายการที่เลือกมีสถานะที่ชำระได้ (payment หรือ partial)
    const validOrders = selectedOrders.value.filter((order) => order.status === 'payment' || order.status === 'partial');

    if (validOrders.length === 0) {
        toast.add({
            severity: 'error',
            summary: 'ไม่สามารถชำระเงินได้',
            detail: 'ไม่มีรายการที่สามารถชำระเงินได้ในรายการที่เลือก',
            life: 3000
        });
        return;
    }

    // ใช้ฟังก์ชัน showQRPayment ที่มีอยู่แล้วโดยส่งอาร์เรย์ของออเดอร์ที่เลือก
    showQRPayment(validOrders);
}

// คำนวณจำนวนออเดอร์ที่สามารถเลือกได้ (สถานะ payment และ partial)
const payableOrdersCount = computed(() => {
    if (!filteredOrders.value) return 0;
    return filteredOrders.value.filter((order) => order.status === 'payment' || order.status === 'partial').length;
});

// คำนวณยอดรวมของออเดอร์ที่เลือก
const selectedOrdersTotal = computed(() => {
    return selectedOrders.value.reduce((sum, order) => {
        return sum + parseFloat(order.total_amount);
    }, 0);
});

// ฟังก์ชันสำหรับดาวน์โหลดรูปภาพ QR Code
function downloadQRCode() {
    if (!qrCodeUrl.value) return;

    try {
        // สร้าง element a สำหรับดาวน์โหลด
        const link = document.createElement('a');
        link.href = qrCodeUrl.value;
        link.download = `qr-payment-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.add({
            severity: 'success',
            summary: 'ดาวน์โหลดสำเร็จ',
            detail: 'บันทึกรูปภาพ QR Code สำเร็จ',
            life: 3000
        });
    } catch (error) {
        console.error('Error downloading QR code:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถดาวน์โหลดรูปภาพ QR Code ได้',
            life: 3000
        });
    }
}

// ฟังก์ชันจัดการเมื่อเวลาหมดอายุ
function handlePaymentTimeout() {
    // ล้างทุก timer
    if (paymentInterval.value) {
        clearInterval(paymentInterval.value);
        paymentInterval.value = null;
    }

    if (timeUpdateInterval.value) {
        clearInterval(timeUpdateInterval.value);
        timeUpdateInterval.value = null;
    }

    paymentProcessing.value = false;
    paymentTimeRemaining.value = 0;

    toast.add({
        severity: 'warn',
        summary: 'หมดเวลาชำระเงิน',
        detail: 'QR Code หมดอายุแล้ว กรุณาสร้าง QR Code ใหม่',
        life: 5000
    });
}

// ฟังก์ชันแปลงเวลาเป็นรูปแบบ MM:SS
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ดึงข้อมูลเมื่อโหลดคอมโพเนนต์
onMounted(fetchOrderHistory);
</script>

<template>
    <div class="order-history-page">
        <div class="order-history-container">
            <!-- Header -->
            <div class="page-header mb-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h1 class="text-2xl font-bold">สถานะการจัดส่ง</h1>
                        <p class="text-gray-500 dark:text-gray-400 mt-1">ตรวจสอบสถานะและการจัดส่งสินค้าที่อยู่ระหว่างดำเนินการ</p>
                    </div>

                    <!-- ย้ายปุ่มเลือกหลายรายการมาไว้ด้านขวาของส่วนหัว -->
                    <div v-if="payableOrdersCount > 1 && !loading && filteredOrders.length > 0 && isQRPaymentEnabled">
                        <Button
                            :label="multiSelectMode ? 'ยกเลิกการเลือก' : 'เลือกหลายรายการ'"
                            :icon="multiSelectMode ? 'pi pi-times' : 'pi pi-check-square'"
                            :severity="multiSelectMode ? 'secondary' : 'info'"
                            class="p-button-sm"
                            @click="toggleMultiSelectMode"
                        />
                    </div>
                </div>
            </div>

            <!-- แถบแสดงสถานะการเลือกหลายรายการ -->
            <div v-if="multiSelectMode" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                <div class="flex flex-col md:flex-row justify-between items-center gap-3">
                    <div class="flex flex-col md:flex-row items-center gap-3">
                        <div class="flex items-center">
                            <i class="pi pi-check-square text-blue-500 mr-2"></i>
                            <span class="font-medium">เลือก {{ selectedOrders.length }} จาก {{ payableOrdersCount }} รายการ</span>
                        </div>

                        <div v-if="selectedOrders.length > 0" class="flex items-center">
                            <i class="pi pi-wallet text-green-500 mr-2"></i>
                            <span class="font-medium">ยอดรวม: ฿{{ formatCurrency(selectedOrdersTotal) }}</span>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <Button
                            :label="selectedOrders.length === payableOrdersCount ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'"
                            :icon="selectedOrders.length === payableOrdersCount ? 'pi pi-times-circle' : 'pi pi-check-circle'"
                            outlined
                            class="p-button-sm"
                            @click="selectAllPayableOrders"
                        />
                        <Button label="ชำระเงินที่เลือก" icon="pi pi-wallet" severity="warning" class="p-button-sm" @click="paySelectedOrders" :disabled="selectedOrders.length === 0 || !isQRPaymentEnabled" v-if="isQRPaymentEnabled" />
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="filters-container mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium mb-1">ค้นหา</label>
                        <IconField iconPosition="left" class="w-full">
                            <InputText v-model="filters.searchTerm" placeholder="ค้นหาตามรหัสคำสั่งซื้อ..." class="w-full" />
                            <InputIcon class="pi pi-search" />
                        </IconField>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">ช่วงวันที่</label>
                        <DatePicker v-model="filters.dateRange" selectionMode="range" dateFormat="dd/mm/yy" placeholder="เลือกช่วงวันที่" showIcon class="w-full" />
                    </div>
                </div>

                <div class="flex justify-end mt-3">
                    <Button label="ล้างตัวกรอง" icon="pi pi-filter-slash" class="p-button-outlined p-button-sm" @click="resetFilters" />
                </div>
            </div>

            <!-- Loading state -->
            <div v-if="loading" class="flex justify-center items-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <ProgressSpinner strokeWidth="4" style="width: 50px; height: 50px" />
            </div>

            <!-- Error state -->
            <div v-else-if="error" class="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <i class="pi pi-exclamation-triangle text-5xl text-yellow-500 mb-4"></i>
                <h3 class="text-xl font-medium mb-2">เกิดข้อผิดพลาด</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-4 text-center">{{ error }}</p>
                <Button label="ลองใหม่" icon="pi pi-refresh" @click="fetchOrderHistory" />
            </div>

            <!-- Empty state -->
            <div v-else-if="filteredOrders.length === 0" class="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <i class="pi pi-truck text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                <h3 class="text-xl font-medium mb-2">ไม่พบรายการที่กำลังจัดส่ง</h3>
                <p v-if="filters.dateRange || filters.searchTerm" class="text-gray-500 dark:text-gray-400 mb-4 text-center">ไม่พบรายการที่กำลังจัดส่งที่ตรงกับเงื่อนไขการค้นหา<br />ลองเปลี่ยนตัวกรองหรือล้างตัวกรองและลองอีกครั้ง</p>
                <p v-else class="text-gray-500 dark:text-gray-400 mb-4 text-center">คุณไม่มีคำสั่งซื้อที่กำลังอยู่ระหว่างการจัดส่ง<br />เริ่มต้นช้อปปิ้งเพื่อสั่งซื้อสินค้า</p>
                <Button label="เริ่มต้นช้อปปิ้ง" icon="pi pi-shopping-cart" @click="router.push('/products')" />
            </div>

            <!-- Order list -->
            <div v-else class="orders-list">
                <div
                    v-for="order in filteredOrders"
                    :key="order.doc_no"
                    class="order-card bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4 overflow-hidden"
                    :class="{ 'border-2 border-blue-400 dark:border-blue-600': multiSelectMode && isOrderSelected(order) }"
                >
                    <!-- Order header -->
                    <div class="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
                        <div class="flex items-center">
                            <!-- Checkbox for multi-select mode -->
                            <div v-if="multiSelectMode && (order.status === 'payment' || order.status === 'partial')" class="mr-2">
                                <Checkbox :modelValue="isOrderSelected(order)" @update:modelValue="toggleOrderSelection(order)" :binary="true" />
                            </div>

                            <div>
                                <div class="flex items-center">
                                    <span class="text-lg font-semibold">{{ order.doc_no }}</span>
                                    <Tag :value="orderStatuses[order.status].label" :severity="orderStatuses[order.status].color" class="ml-3" />
                                </div>
                                <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {{ formatDate(order.doc_date, order.doc_time) }}
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-lg font-bold">฿{{ formatCurrency(order.total_amount) }}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">
                                <span>{{ order.send_type === '1' ? 'จัดส่ง' : 'รับที่ร้าน' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- สถานะการจัดส่ง -->
                    <div v-if="order.remark_5 != ''" class="mr-4 ml-4 mt-4">
                        <!-- ส่วนหัวข้อ -->
                        <div class="flex items-center mb-2">
                            <h3 class="font-medium flex items-center">
                                <i class="pi pi-truck mr-2 text-primary-500"></i>
                                สถานะการจัดส่ง
                            </h3>
                        </div>

                        <!-- ส่วนลิงก์ติดตามพัสดุ -->
                        <div class="mt-2 mb-2">
                            <div v-if="order.remark_5" class="text-sm">
                                <a :href="order.remark_5" target="_blank" class="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                    <span class="truncate mr-1">{{ order.remark_5 }}</span>
                                    <i class="pi pi-external-link"></i>
                                </a>
                            </div>
                        </div>
                    </div>

                    <!-- Order actions -->
                    <div class="p-4">
                        <div class="flex justify-end gap-2">
                            <!-- ปุ่มชำระเงิน QR Code - แสดงเฉพาะเมื่อไม่ได้อยู่ในโหมดเลือกหลายรายการ และ QR API ใช้งานได้ -->
                            <Button
                                v-if="(order.status === 'payment' || order.status === 'partial') && !multiSelectMode && isQRPaymentEnabled"
                                label="ชำระเงิน"
                                icon="pi pi-qrcode"
                                class="p-button-warning p-button-sm"
                                @click="showQRPayment(order)"
                                :disabled="loading"
                            />

                            <!-- ปุ่มเลือกหรือยกเลิกการเลือกสำหรับโหมดเลือกหลายรายการ -->
                            <Button
                                v-if="multiSelectMode && (order.status === 'payment' || order.status === 'partial')"
                                :label="isOrderSelected(order) ? 'ยกเลิกเลือก' : 'เลือก'"
                                :icon="isOrderSelected(order) ? 'pi pi-times' : 'pi pi-check'"
                                :severity="isOrderSelected(order) ? 'secondary' : 'info'"
                                class="p-button-sm p-button-outlined"
                                @click="toggleOrderSelection(order)"
                            />

                            <Button label="รายละเอียด" icon="pi pi-eye" class="p-button-outlined p-button-info p-button-sm" @click="showOrderDetails(order)" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Order details dialog ที่ปรับปรุงแล้ว -->
            <Dialog v-model:visible="displayOrderDetails" :header="`รายละเอียดคำสั่งซื้อ ${selectedOrder?.doc_no || ''}`" :style="{ width: '95%', maxWidth: '800px' }" :modal="true" :closeOnEscape="true" :dismissableMask="true">
                <!-- Loading state for details -->
                <div v-if="loadingDetails" class="flex justify-center items-center p-8">
                    <ProgressSpinner strokeWidth="4" style="width: 50px; height: 50px" />
                </div>

                <div v-else-if="selectedOrder" class="order-details">
                    <!-- Order Status and Basic Info -->
                    <div class="flex flex-col md:flex-row gap-4 mb-4">
                        <div
                            class="status-container p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex-1"
                            :class="{
                                'bg-green-50 dark:bg-green-900/20': selectedOrder.status === 'success',
                                'bg-blue-50 dark:bg-blue-900/20': selectedOrder.status === 'partial' || selectedOrder.status === 'payment' || selectedOrder.status === 'packing',
                                'bg-red-50 dark:bg-red-900/20': selectedOrder.status === 'cancel',
                                'bg-yellow-50 dark:bg-yellow-900/20': selectedOrder.status === 'pending',
                                'bg-gray-50 dark:bg-gray-800': !selectedOrder.status || !orderStatuses[selectedOrder.status]
                            }"
                        >
                            <div class="flex items-center">
                                <i :class="[orderStatuses[selectedOrder.status].icon, 'text-xl mr-2', `text-${orderStatuses[selectedOrder.status].color}-500`]"></i>
                                <span class="font-semibold">{{ orderStatuses[selectedOrder.status].label }}</span>
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">วันที่สั่งซื้อ: {{ formatDate(selectedOrder.doc_date, selectedOrder.doc_time) }}</div>
                        </div>

                        <div class="payment-summary p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 flex-1">
                            <div class="font-semibold mb-1">สรุปการชำระเงิน</div>
                            <div class="flex justify-between text-sm">
                                <span>ยอดลดหนี้รวม:</span>
                                <span class="font-medium">฿{{ formatCurrency(selectedOrder.cn_total_amount || 0) }}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span>ยอดรวม:</span>
                                <span class="font-medium">฿{{ formatCurrency(selectedOrder.total_amount) }}</span>
                            </div>
                            <div v-if="parseFloat(selectedOrder.balance) > 0" class="flex justify-between text-sm text-red-600">
                                <span>ยอดค้างชำระ:</span>
                                <span class="font-medium">฿{{ formatCurrency(selectedOrder.balance) }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Customer and Employee Info -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h3 class="text-lg font-semibold mb-2 flex items-center">
                                <i class="pi pi-user mr-2 text-primary-500"></i>
                                ข้อมูลลูกค้า
                            </h3>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="text-sm text-gray-500">รหัสลูกค้า:</div>
                                <div class="text-sm font-medium">{{ selectedOrder.cust_code }}</div>

                                <div class="text-sm text-gray-500">เบอร์โทรศัพท์:</div>
                                <div class="text-sm font-medium">{{ selectedOrder.telephone || '-' }}</div>
                            </div>
                        </div>

                        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h3 class="text-lg font-semibold mb-2 flex items-center">
                                <i class="pi pi-briefcase mr-2 text-primary-500"></i>
                                ข้อมูลพนักงาน
                            </h3>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="text-sm text-gray-500">รหัสพนักงาน:</div>
                                <div class="text-sm font-medium">{{ selectedOrder.emp_code || '-' }}</div>

                                <div class="text-sm text-gray-500">ชื่อพนักงาน:</div>
                                <div class="text-sm font-medium">{{ selectedOrder.emp_name || 'ไม่มีพนักงานดูแล' }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- ข้อมูลการจัดส่ง -->
                    <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-map-marker mr-2 text-primary-500"></i>
                            ข้อมูลการจัดส่ง
                        </h3>

                        <!-- วิธีรับสินค้า -->
                        <div class="mb-2">
                            <div class="text-sm text-gray-500">วิธีการรับสินค้า:</div>
                            <div class="text-sm font-medium mt-1">
                                <Tag :severity="selectedOrder.address_name === '1' ? 'info' : 'success'" :value="selectedOrder.send_type === '1' ? 'จัดส่ง' : 'รับที่ร้าน'" />
                            </div>
                        </div>

                        <!-- ข้อมูลที่อยู่สำหรับจัดส่ง -->
                        <div v-if="selectedOrder.send_type === '1'" class="mt-2">
                            <div class="text-sm text-gray-500 mt-2">ที่อยู่จัดส่ง: <Tag :severity="selectedOrder.address_name === 'ใช้ที่อยู่ปัจจุบัน' ? 'info' : 'success'" :value="selectedOrder.address_name" /></div>
                            <div class="text-sm font-medium">{{ selectedOrder.address || '-' }}</div>
                        </div>

                        <!-- สถานะการจัดส่ง -->
                        <div v-if="selectedOrder.remark_5" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div class="text-sm text-gray-500">ลิงก์ติดตามพัสดุ:</div>
                            <div class="text-sm font-medium mt-1">
                                <a :href="selectedOrder.remark_5" target="_blank" class="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                    <i class="pi pi-external-link mr-1"></i>
                                    <span class="truncate">{{ selectedOrder.remark_5 }}</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <!-- หมายเหตุต่างๆ -->
                    <div v-if="selectedOrder.remark || selectedOrder.remark_qt || selectedOrder.remark_inv" class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-comment mr-2 text-primary-500"></i>
                            หมายเหตุ
                        </h3>

                        <div v-if="selectedOrder.remark" class="mb-2">
                            <div class="text-sm text-gray-500">หมายเหตุทั่วไป:</div>
                            <div class="text-sm mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">{{ selectedOrder.remark }}</div>
                        </div>

                        <div v-if="selectedOrder.remark_qt" class="mb-2">
                            <div class="text-sm text-gray-500">หมายเหตุคำสั่งซื้อ:</div>
                            <div class="text-sm mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">{{ selectedOrder.remark_qt }}</div>
                        </div>

                        <div v-if="selectedOrder.remark_inv" class="mb-2">
                            <div class="text-sm text-gray-500">หมายเหตุบิลขาย:</div>
                            <div class="text-sm mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">{{ selectedOrder.remark_inv }}</div>
                        </div>
                    </div>

                    <!-- Order Items with responsive layout -->
                    <div v-if="selectedOrderDetails && selectedOrderDetails.length > 0" class="mb-4">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-shopping-cart mr-2 text-primary-500"></i>
                            รายการสินค้า
                        </h3>

                        <!-- Desktop Table (visible based on screen width using JS) -->
                        <div v-if="windowWidth >= 430" class="order-items-table">
                            <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <!-- Table header -->
                                <div class="grid grid-cols-12 bg-gray-50 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700">
                                    <div class="col-span-5 font-medium">สินค้า</div>
                                    <div class="col-span-2 font-medium text-center">หน่วย</div>
                                    <div class="col-span-2 font-medium text-right">ราคา</div>
                                    <div class="col-span-1 font-medium text-right">จำนวน</div>
                                    <div class="col-span-2 font-medium text-right">รวม</div>
                                </div>

                                <!-- Table rows -->
                                <div class="divide-y divide-gray-200 dark:divide-gray-700">
                                    <div v-for="(item, index) in selectedOrderDetails" :key="index" class="grid grid-cols-12 p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <div class="col-span-5">
                                            <div class="font-medium text-primary-600 dark:text-primary-400">
                                                {{ item.item_name }} <span class="text-sm text-blue-500 dark:text-white">[{{ item.shelf_code }}]</span>
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">รหัส: {{ item.item_code }}</div>
                                        </div>
                                        <div class="col-span-2 text-center self-center">{{ item.unit_code }}</div>
                                        <div class="col-span-2 text-right self-center">฿{{ formatCurrency(item.price) }}</div>
                                        <div class="col-span-1 text-right self-center">{{ item.qty }}</div>
                                        <div class="col-span-2 text-right self-center font-semibold">฿{{ formatCurrency(parseFloat(item.qty) * parseFloat(item.price)) }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Card View (visible based on screen width using JS) -->
                        <div v-else class="order-items-cards">
                            <div v-for="(item, index) in selectedOrderDetails" :key="index" class="mb-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="font-medium text-primary-600 dark:text-primary-400">
                                        {{ item.item_name }} <span class="text-sm text-blue-500 dark:text-white">[{{ item.shelf_code }}]</span>
                                    </div>
                                    <div class="font-semibold">฿{{ formatCurrency(parseFloat(item.qty) * parseFloat(item.price)) }}</div>
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">รหัส: {{ item.item_code }}</div>
                                <div class="grid grid-cols-3 text-sm mt-2">
                                    <div>
                                        <div class="text-gray-500 mb-1">หน่วย</div>
                                        <div>{{ item.unit_code }}</div>
                                    </div>
                                    <div>
                                        <div class="text-gray-500 mb-1">ราคา</div>
                                        <div>฿{{ formatCurrency(item.price) }}</div>
                                    </div>
                                    <div>
                                        <div class="text-gray-500 mb-1">จำนวน</div>
                                        <div>{{ item.qty }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Order Items Summary -->
                        <div class="bg-gray-50 dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg mt-2">
                            <div class="flex flex-col sm:flex-row justify-between gap-2">
                                <div class="order-2 sm:order-1">
                                    <div v-if="parseFloat(selectedOrder.balance) > 0" class="flex justify-between sm:flex-col text-sm text-red-600">
                                        <span>ชำระแล้ว:</span>
                                        <span class="font-medium">฿{{ formatCurrency(parseFloat(selectedOrder.total_amount) - parseFloat(selectedOrder.balance)) }}</span>
                                    </div>
                                    <div v-if="parseFloat(selectedOrder.balance) > 0" class="flex justify-between sm:flex-col text-sm text-red-600">
                                        <span>ยอดค้างชำระ:</span>
                                        <span class="font-medium">฿{{ formatCurrency(selectedOrder.balance) }}</span>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center order-1 sm:order-2">
                                    <div class="font-medium sm:text-right">รวมทั้งสิ้น:</div>
                                    <div class="font-bold text-primary-600 dark:text-primary-400 text-lg ml-2">฿{{ formatCurrency(selectedOrder.total_amount) }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="!loadingDetails" class="mb-4 flex items-center justify-center p-6 border border-yellow-200 bg-yellow-50 rounded-lg text-yellow-800">
                        <i class="pi pi-exclamation-triangle mr-2"></i>
                        <span>ไม่พบรายการสินค้าในคำสั่งซื้อนี้</span>
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-between gap-2">
                        <Button
                            v-if="selectedOrder && (selectedOrder.status === 'payment' || selectedOrder.status === 'partial') && isQRPaymentEnabled"
                            label="ชำระเงิน QR Code"
                            icon="pi pi-qrcode"
                            severity="warning"
                            @click="showQRPayment(selectedOrder)"
                        />
                        <div class="flex gap-2 ml-auto">
                            <Button label="ปิด" icon="pi pi-times" outlined @click="displayOrderDetails = false" />
                        </div>
                    </div>
                </template>
            </Dialog>

            <!-- Dialog การชำระเงินด้วย QR Code -->
            <Dialog v-model:visible="showQrPaymentDialog" :modal="true" :closable="false" header="ชำระเงินด้วย QR Code" :style="{ width: '90%', maxWidth: '500px' }" :closeOnEscape="false">
                <div class="flex flex-col items-center justify-center p-4">
                    <!-- แสดงเวลาที่เหลือ -->
                    <div v-if="paymentProcessing && paymentTimeRemaining > 0" class="w-full mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm font-medium">เวลาที่เหลือ:</span>
                            <span class="text-lg font-bold" :class="paymentTimeRemaining < 60000 ? 'text-red-500' : 'text-primary-500'">
                                {{ formatTime(paymentTimeRemaining) }}
                            </span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="h-2 rounded-full transition-all duration-1000" :class="paymentTimeRemaining < 60000 ? 'bg-red-500' : 'bg-primary-500'" :style="{ width: `${(paymentTimeRemaining / paymentTimeoutDuration) * 100}%` }"></div>
                        </div>
                    </div>

                    <!-- QR Code หมดอายุ -->
                    <div v-if="paymentTimeRemaining <= 0 && !paymentSuccess" class="flex flex-col items-center justify-center mb-4">
                        <i class="pi pi-times-circle text-red-500 mb-3" style="font-size: 3rem"></i>
                        <div class="text-lg font-medium text-red-500 mb-2">QR Code หมดอายุแล้ว</div>
                        <Button label="สร้าง QR Code ใหม่" icon="pi pi-refresh" @click="generateQRCode" />
                    </div>

                    <div v-else-if="qrPaymentLoading" class="flex flex-col items-center justify-center mb-4">
                        <ProgressSpinner strokeWidth="4" style="width: 50px; height: 50px" />
                        <div class="text-lg font-medium mt-3">กำลังสร้าง QR Code...</div>
                    </div>

                    <div v-else-if="paymentSuccess" class="flex flex-col items-center justify-center mb-4">
                        <div class="relative">
                            <img :src="qrCodeUrl" alt="QR Code" class="max-w-full h-auto" style="max-width: 250px" />
                            <div class="absolute inset-0 flex items-center justify-center bg-green-100 bg-opacity-70 rounded-lg">
                                <i class="pi pi-check-circle text-green-500" style="font-size: 5rem"></i>
                            </div>
                        </div>
                        <div class="text-lg font-medium mt-3 text-green-500">การชำระเงินสำเร็จ!</div>
                    </div>

                    <div v-else class="flex flex-col items-center justify-center mb-4">
                        <div class="relative">
                            <img :src="qrCodeUrl" alt="QR Code" class="max-w-full h-auto mb-4" style="max-width: 250px" />
                        </div>

                        <Button v-if="!paymentSuccess && qrCodeUrl" label="ดาวน์โหลด QR" icon="pi pi-download" class="p-button-outlined p-button-info mb-4" @click="downloadQRCode" />

                        <div class="text-lg font-medium">ยอดชำระรวม: ฿{{ formatCurrency(paymentAmount) }}</div>
                        <div class="text-center text-gray-600 dark:text-gray-400 mt-2">
                            กรุณาสแกน QR Code เพื่อชำระเงิน<br />
                            ระบบจะตรวจสอบการชำระเงินอัตโนมัติ
                        </div>

                        <div v-if="paymentProcessing" class="flex items-center justify-center mt-3">
                            <ProgressSpinner strokeWidth="3" style="width: 30px; height: 30px" class="mr-2" />
                            <span>กำลังตรวจสอบการชำระเงิน...</span>
                        </div>
                    </div>

                    <!-- รายการเอกสารที่ชำระเงิน -->
                    <div class="w-full mt-4 mb-2">
                        <h3 class="text-md font-medium mb-2">รายการที่ชำระ</h3>
                        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div
                                v-for="(order, index) in selectedOrdersForPayment"
                                :key="order.doc_no"
                                class="p-3 flex justify-between items-center"
                                :class="{ 'border-b border-gray-200 dark:border-gray-700': index < selectedOrdersForPayment.length - 1 }"
                            >
                                <div>
                                    <div class="font-medium">{{ order.doc_no }}</div>
                                    <div class="text-sm text-gray-500">{{ formatDate(order.doc_date, order.doc_time) }}</div>
                                </div>
                                <div class="text-right font-bold">฿{{ formatCurrency(parseFloat(order.total_amount)) }}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-end gap-2">
                        <!-- เพิ่มปุ่มดาวน์โหลด QR Code ในส่วนล่างของ Dialog -->
                        <Button v-if="!paymentSuccess" label="ยกเลิก" icon="pi pi-times" outlined @click="cancelQRPayment" />
                        <Button v-else label="ปิด" icon="pi pi-times" outlined @click="cancelQRPayment" />
                    </div>
                </template>
            </Dialog>
        </div>
    </div>
</template>

<style lang="scss" scoped>
/* Style remains the same as OrderHistory.vue */
</style>
